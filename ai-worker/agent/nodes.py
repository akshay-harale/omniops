"""
Graph node functions for the LangGraph triage workflow.

Each node is a pure function that reads from ``TriageState`` and
returns a partial dict update.  The LangGraph runtime merges these
updates back into the state automatically.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agent.state import TriageState


# ─────────────────────────────────────────────────────────────────
# System prompt used across all LLM providers
# ─────────────────────────────────────────────────────────────────
SYSTEM_PROMPT_BASE = (
    "You are an expert DevOps AI Triage Agent. You have access to tools that "
    "let you gather incident context such as application logs, stack traces, "
    "and alert metadata. "
    "Your workflow:\n"
    "1. First, use the fetch_alert_details tool to understand the alert.\n"
    "2. Then, use the fetch_log_context tool to retrieve application logs.\n"
    "3. Finally, analyze all gathered context and produce a root-cause summary.\n\n"
    "Strictly base your reasoning on the provided data. Do not invent error "
    "codes or make assumptions beyond the information you gather."
)

SYSTEM_PROMPT_DEEP = (
    " Provide a detailed step-by-step analysis, identifying the specific "
    "class/line of code causing the failure, potential impact, and direct "
    "instructions for resolution."
)

SYSTEM_PROMPT_QUICK = " Your final response must be extremely brief (maximum 2-3 sentences)."


def build_system_prompt(llm_config: dict) -> str:
    """Build the system prompt based on the analysis depth setting."""
    depth = llm_config.get("analysisDepth", llm_config.get("analysis_depth", "DEEP"))
    if depth == "QUICK":
        return SYSTEM_PROMPT_BASE + SYSTEM_PROMPT_QUICK
    return SYSTEM_PROMPT_BASE + SYSTEM_PROMPT_DEEP


# ─────────────────────────────────────────────────────────────────
# Node: ingest_alert
# ─────────────────────────────────────────────────────────────────
def ingest_alert(state: TriageState) -> dict[str, Any]:
    """Parse the incident payload and seed the graph state.

    This is the entry-point node. It extracts the alert title and
    service name from the raw payload and writes the first reasoning
    step for the UI execution graph.
    """
    payload = state["incident_payload"]
    incident_id = state["incident_id"]
    llm_config = state.get("llm_config", {})

    # Classify alert (simple heuristic, same as legacy)
    alert_text = str(payload).lower()
    alert_title = "Unknown Alert"
    service = "unknown-service"

    if "db" in alert_text or "connection" in alert_text or "database" in alert_text:
        alert_title = "Database connection pool exhausted"
        service = "auth-service"
    elif "nullpointer" in alert_text or "null" in alert_text or "500" in alert_text:
        alert_title = "NullPointerException in API controller"
        service = "gateway-service"
    elif "cpu" in alert_text or "spike" in alert_text or "load" in alert_text:
        alert_title = "High CPU Load on web server"
        service = "order-service"
    elif "memory" in alert_text or "oom" in alert_text or "heap" in alert_text:
        alert_title = "OutOfMemoryError: Java heap space"
        service = "payment-service"

    if isinstance(payload, dict):
        alert_title = payload.get("event_title", alert_title)
        service = payload.get("service", service)

    # Build initial messages for the LLM
    system_prompt = build_system_prompt(llm_config)
    user_content = (
        f"A new incident has been received. Here is the raw alert payload:\n\n"
        f"Incident ID: {incident_id}\n"
        f"Alert Title: {alert_title}\n"
        f"Service: {service}\n"
        f"Full Payload:\n```json\n{json.dumps(payload, indent=2)}\n```\n\n"
        f"Please use your tools to gather context and then provide a root-cause analysis."
    )

    reasoning_steps = list(state.get("reasoning_steps", []))
    reasoning_steps.append(
        f"Node [Extract Entities]: Ingested alert payload for service '{service}'. Event: '{alert_title}'."
    )

    return {
        "alert_title": alert_title,
        "service_name": service,
        "reasoning_steps": reasoning_steps,
        "tools_output": {},
        "messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_content),
        ],
    }


# ─────────────────────────────────────────────────────────────────
# Node: gather_context_sequential
# ─────────────────────────────────────────────────────────────────
def gather_context_sequential(state: TriageState) -> dict[str, Any]:
    """Run ALL registered tools sequentially (non-agentic fallback).

    Used when ``agent_mode == "sequential"`` — the LLM does NOT decide
    which tools to call; instead we run them all and feed the results
    into the LLM for analysis.
    """
    from agent.tool_registry import discover_tools

    incident_id = state["incident_id"]
    payload = state["incident_payload"]
    reasoning_steps = list(state.get("reasoning_steps", []))
    tools_output = dict(state.get("tools_output", {}))

    tools = discover_tools()
    reasoning_steps.append(f"Node [Gather Context]: Running {len(tools)} tools sequentially...")

    for t in tools:
        try:
            if t.name == "fetch_log_context":
                result = t.invoke({"incident_id": incident_id})
            elif t.name == "fetch_alert_details":
                result = t.invoke({"incident_payload_json": json.dumps(payload)})
            else:
                # Generic invocation — pass incident_id as default
                result = t.invoke({"incident_id": incident_id})

            tools_output[t.name] = str(result)
            reasoning_steps.append(f"Node [Gather Context]: Tool '{t.name}' returned data.")
        except Exception as e:
            tools_output[t.name] = f"Error: {e}"
            reasoning_steps.append(f"Node [Gather Context]: Tool '{t.name}' failed: {e}")

    # Append tool results as a new human message for the LLM
    context_text = "\n\n".join(
        f"=== Tool: {name} ===\n{output}" for name, output in tools_output.items()
    )
    context_message = HumanMessage(
        content=(
            "Here is the context gathered from the available tools:\n\n"
            f"{context_text}\n\n"
            "Based on this information, provide your root-cause analysis."
        )
    )

    return {
        "reasoning_steps": reasoning_steps,
        "tools_output": tools_output,
        "messages": [context_message],
    }


# ─────────────────────────────────────────────────────────────────
# Node: analyze_with_llm (used in sequential mode)
# ─────────────────────────────────────────────────────────────────
def analyze_with_llm(state: TriageState) -> dict[str, Any]:
    """Send accumulated messages to the LLM and get a final analysis.

    This is used in **sequential mode** where tools have already been
    executed. The LLM receives the full context and produces a summary.
    """
    from agent.llm_provider import create_llm

    llm_config = state.get("llm_config", {})
    provider = llm_config.get("provider", "OLLAMA")
    reasoning_steps = list(state.get("reasoning_steps", []))

    reasoning_steps.append(f"Node [Analyze Logs]: Sending context to LLM ({provider})...")

    try:
        llm = create_llm(llm_config)
        response = llm.invoke(list(state["messages"]))

        summary = response.content.strip()
        tokens_used = 0

        # Try to extract token usage from response metadata
        if hasattr(response, "response_metadata"):
            meta = response.response_metadata
            tokens_used = meta.get("prompt_eval_count", 0) + meta.get("eval_count", 0)
            if not tokens_used:
                usage = meta.get("usage", {})
                tokens_used = usage.get("total_tokens", 0)
            if not tokens_used:
                tokens_used = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

        reasoning_steps.append(f"Node [Analyze Logs]: LLM analysis completed successfully using {provider}.")

        return {
            "final_summary": summary,
            "tokens_used": tokens_used,
            "reasoning_steps": reasoning_steps,
            "messages": [response],
        }

    except Exception as e:
        print(f"[Worker] LLM query failed: {e}")
        reasoning_steps.append(f"Node [Analyze Logs] ERROR: Failed querying LLM: {str(e)[:200]}")

        return {
            "final_summary": f"LLM analysis failed: {e}. Please check the LLM configuration.",
            "tokens_used": 0,
            "reasoning_steps": reasoning_steps,
        }


# ─────────────────────────────────────────────────────────────────
# Node: agent_node (used in agentic mode — LLM with tools bound)
# ─────────────────────────────────────────────────────────────────
def agent_node(state: TriageState) -> dict[str, Any]:
    """Invoke the LLM with tools bound — it decides which tools to call.

    The LangGraph ``tools_condition`` conditional edge will route
    to the ToolNode if the LLM emits tool calls, or to END if it
    produces a final text answer.
    """
    from agent.llm_provider import create_llm
    from agent.tool_registry import discover_tools

    llm_config = state.get("llm_config", {})
    provider = llm_config.get("provider", "OLLAMA")
    reasoning_steps = list(state.get("reasoning_steps", []))

    tools = discover_tools()
    llm = create_llm(llm_config)
    llm_with_tools = llm.bind_tools(tools)

    reasoning_steps.append(f"Node [Agent]: Invoking LLM ({provider}) with {len(tools)} tools bound...")

    try:
        response = llm_with_tools.invoke(list(state["messages"]))

        # If the LLM produced tool calls, log them
        if hasattr(response, "tool_calls") and response.tool_calls:
            tool_names = [tc["name"] for tc in response.tool_calls]
            reasoning_steps.append(f"Node [Agent]: LLM requested tools: {', '.join(tool_names)}")
        else:
            # Final answer
            reasoning_steps.append(f"Node [Agent]: LLM produced final analysis using {provider}.")

            # Extract token usage
            tokens_used = 0
            if hasattr(response, "response_metadata"):
                meta = response.response_metadata
                tokens_used = meta.get("prompt_eval_count", 0) + meta.get("eval_count", 0)
                if not tokens_used:
                    usage = meta.get("usage", {})
                    tokens_used = usage.get("total_tokens", 0)
                if not tokens_used:
                    tokens_used = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

            return {
                "final_summary": response.content.strip(),
                "tokens_used": tokens_used,
                "reasoning_steps": reasoning_steps,
                "messages": [response],
            }

        return {
            "reasoning_steps": reasoning_steps,
            "messages": [response],
        }

    except Exception as e:
        print(f"[Worker] Agent LLM call failed: {e}")
        reasoning_steps.append(f"Node [Agent] ERROR: LLM call failed: {str(e)[:200]}")

        return {
            "final_summary": f"LLM analysis failed: {e}. Please check the LLM configuration.",
            "tokens_used": 0,
            "reasoning_steps": reasoning_steps,
        }


# ─────────────────────────────────────────────────────────────────
# Node: tool_executed_callback (post-ToolNode hook for reasoning)
# ─────────────────────────────────────────────────────────────────
def tool_executed_callback(state: TriageState) -> dict[str, Any]:
    """Log which tools were executed after ToolNode finishes.

    This runs after the prebuilt ``ToolNode`` and before looping
    back to the agent node, so we can record results in reasoning_steps.
    """
    reasoning_steps = list(state.get("reasoning_steps", []))
    tools_output = dict(state.get("tools_output", {}))

    # The last message(s) should be ToolMessages from the ToolNode
    messages = state.get("messages", [])
    for msg in messages:
        if hasattr(msg, "name") and hasattr(msg, "content"):
            # ToolMessage has .name = tool name
            tool_name = getattr(msg, "name", "unknown")
            tool_content = str(msg.content)[:300]
            tools_output[tool_name] = str(msg.content)
            reasoning_steps.append(f"Node [Tool Result]: '{tool_name}' returned data ({len(str(msg.content))} chars).")

    return {
        "reasoning_steps": reasoning_steps,
        "tools_output": tools_output,
    }


# ─────────────────────────────────────────────────────────────────
# Node: dispatch_notification
# ─────────────────────────────────────────────────────────────────
def dispatch_notification(state: TriageState) -> dict[str, Any]:
    """Post the triage summary to MS Teams."""
    from agent.notifications import send_teams_notification

    llm_config = state.get("llm_config", {})
    reasoning_steps = list(state.get("reasoning_steps", []))

    webhook_url = llm_config.get("_teams_webhook")
    target_channel = llm_config.get("targetTeamsChannel", "general")

    reasoning_steps.append(
        f"Node [Teams Dispatch]: Format Teams Adaptive Card payload for channel '#{target_channel}' and dispatch webhook."
    )

    send_teams_notification(
        webhook_url=webhook_url,
        incident_id=state["incident_id"],
        alert_title=state.get("alert_title", "Unknown Alert"),
        service=state.get("service_name", "unknown-service"),
        summary=state.get("final_summary", "No summary available."),
    )

    return {"reasoning_steps": reasoning_steps}
