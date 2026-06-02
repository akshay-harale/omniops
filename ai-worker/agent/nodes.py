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
    "codes or make assumptions beyond the information you gather.\n\n"
    "In your analysis/verdict call, if you can identify the correct service name experiencing the issue "
    "(e.g., from logs, traces, container names, etc.), include a line at the very end of your response: "
    "'RESOLVED_SERVICE: <service_name>'."
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

    print(f"[Graph] [Node: Ingest Alert] Ingesting incident {incident_id}...")

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
# Helper: Extract Service Name from tools output
# ─────────────────────────────────────────────────────────────────
def _extract_service_name_from_tools(tools_output: dict[str, str]) -> str | None:
    import re
    for content in tools_output.values():
        if not content:
            continue
        match = re.search(r"Service Name:\s*([^\s\n]+)", content)
        if match:
            return match.group(1).strip()
    return None


# ─────────────────────────────────────────────────────────────────
# Helper: Parse Service Name from LLM response
# ─────────────────────────────────────────────────────────────────
def _parse_service_from_llm_response(content: str) -> tuple[str, str | None]:
    import re
    match = re.search(r"RESOLVED_SERVICE:\s*([^\s\n\r]+)", content, re.IGNORECASE)
    resolved_service = None
    if match:
        resolved_service = match.group(1).strip()
        resolved_service = resolved_service.strip("*`_.")
        # Remove the RESOLVED_SERVICE line (and any surrounding whitespace/newlines)
        content = re.sub(r"\n*RESOLVED_SERVICE:\s*[^\s\n\r]+", "", content, flags=re.IGNORECASE).strip()
    return content, resolved_service


# ─────────────────────────────────────────────────────────────────
# Helper: Log Messages Sent to LLM
# ─────────────────────────────────────────────────────────────────
def _log_llm_input_messages(messages: list[Any]) -> None:
    print("=== [LLM Input Messages Start] ===")
    for idx, msg in enumerate(messages):
        msg_type = type(msg).__name__
        content = msg.content
        print(f"[{idx}] {msg_type}: {content}")
    print("=== [LLM Input Messages End] ===")


# ─────────────────────────────────────────────────────────────────
# Node: gather_context_sequential
# ─────────────────────────────────────────────────────────────────
def gather_context_sequential(state: TriageState) -> dict[str, Any]:
    """Run ALL registered tools sequentially (non-agentic fallback).

    Used when ``agent_mode == "sequential"`` — the LLM does NOT decide
    which tools to call; instead we run them all and feed the results
    into the LLM for analysis.
    """
    import time
    from agent.tool_registry import discover_tools

    incident_id = state["incident_id"]
    payload = state["incident_payload"]
    reasoning_steps = list(state.get("reasoning_steps", []))
    tools_output = dict(state.get("tools_output", {}))

    tools = discover_tools()
    print(f"[Graph] [Node: Gather Context] Running {len(tools)} tools sequentially...")
    reasoning_steps.append(f"Node [Gather Context]: Running {len(tools)} tools sequentially...")

    total_start = time.time()
    for t in tools:
        t_start = time.time()
        print(f"[Graph] [Node: Gather Context] Starting tool '{t.name}'...")
        try:
            if t.name == "fetch_log_context":
                result = t.invoke({"incident_id": incident_id})
            elif t.name == "fetch_alert_details":
                result = t.invoke({"incident_payload_json": json.dumps(payload)})
            else:
                # Generic invocation — pass incident_id as default
                result = t.invoke({"incident_id": incident_id})

            t_elapsed = time.time() - t_start
            tools_output[t.name] = str(result)
            print(f"[Graph] [Node: Gather Context] Tool '{t.name}' executed in {t_elapsed:.2f}s.")
            reasoning_steps.append(f"Node [Gather Context]: Tool '{t.name}' returned data (took {t_elapsed:.2f}s).")
        except Exception as e:
            t_elapsed = time.time() - t_start
            tools_output[t.name] = f"Error: {e}"
            print(f"[Graph] [Node: Gather Context] Tool '{t.name}' failed in {t_elapsed:.2f}s: {e}")
            reasoning_steps.append(f"Node [Gather Context]: Tool '{t.name}' failed in {t_elapsed:.2f}s: {e}")

    total_elapsed = time.time() - total_start
    print(f"[Graph] [Node: Gather Context] Completed sequential tool execution in {total_elapsed:.2f}s.")

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

    resolved_service = _extract_service_name_from_tools(tools_output)
    update_dict = {
        "reasoning_steps": reasoning_steps,
        "tools_output": tools_output,
        "messages": [context_message],
    }
    if resolved_service:
        update_dict["service_name"] = resolved_service
        reasoning_steps.append(f"Node [Gather Context]: Resolved service name '{resolved_service}' from log context.")

    return update_dict


# ─────────────────────────────────────────────────────────────────
# Node: analyze_with_llm (used in sequential mode)
# ─────────────────────────────────────────────────────────────────
def analyze_with_llm(state: TriageState) -> dict[str, Any]:
    """Send accumulated messages to the LLM and get a final analysis.

    This is used in **sequential mode** where tools have already been
    executed. The LLM receives the full context and produces a summary.
    """
    import time
    from agent.llm_provider import create_llm

    llm_config = state.get("llm_config", {})
    provider = llm_config.get("provider", "OLLAMA")
    reasoning_steps = list(state.get("reasoning_steps", []))

    print(f"[Graph] [Node: Analyze Logs] Sending context to LLM ({provider})...")
    reasoning_steps.append(f"Node [Analyze Logs]: Sending context to LLM ({provider})...")

    start_time = time.time()
    try:
        messages = list(state["messages"])
        _log_llm_input_messages(messages)
        llm = create_llm(llm_config)
        response = llm.invoke(messages)
        elapsed = time.time() - start_time
        print(f"[Graph] [Node: Analyze Logs] LLM analysis completed in {elapsed:.2f}s using {provider}.")

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

        # Parse service name if any
        summary, resolved_service = _parse_service_from_llm_response(summary)

        reasoning_steps.append(f"Node [Analyze Logs]: LLM analysis completed successfully using {provider} in {elapsed:.2f}s.")

        update_dict = {
            "final_summary": summary,
            "tokens_used": tokens_used,
            "reasoning_steps": reasoning_steps,
            "messages": [response],
        }
        if resolved_service:
            update_dict["service_name"] = resolved_service
            if state.get("service_name") != resolved_service:
                reasoning_steps.append(f"Node [Analyze Logs]: Resolved service name '{resolved_service}' from LLM response.")

        return update_dict

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[Worker] LLM query failed in {elapsed:.2f}s: {e}")
        reasoning_steps.append(f"Node [Analyze Logs] ERROR: Failed querying LLM in {elapsed:.2f}s: {str(e)[:200]}")

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
    import time
    from agent.llm_provider import create_llm
    from agent.tool_registry import discover_tools

    llm_config = state.get("llm_config", {})
    provider = llm_config.get("provider", "OLLAMA")
    reasoning_steps = list(state.get("reasoning_steps", []))

    tools = discover_tools()
    llm = create_llm(llm_config)
    llm_with_tools = llm.bind_tools(tools)

    print(f"[Graph] [Node: Agent] Invoking LLM ({provider}) with {len(tools)} tools bound...")
    reasoning_steps.append(f"Node [Agent]: Invoking LLM ({provider}) with {len(tools)} tools bound...")

    start_time = time.time()
    try:
        messages = list(state["messages"])
        _log_llm_input_messages(messages)
        response = llm_with_tools.invoke(messages)
        elapsed = time.time() - start_time
        print(f"[Graph] [Node: Agent] LLM response received in {elapsed:.2f}s.")

        # If the LLM produced tool calls, log them
        if hasattr(response, "tool_calls") and response.tool_calls:
            tool_names = [tc["name"] for tc in response.tool_calls]
            reasoning_steps.append(f"Node [Agent]: LLM requested tools: {', '.join(tool_names)} (took {elapsed:.2f}s)")
        else:
            # Final answer
            reasoning_steps.append(f"Node [Agent]: LLM produced final analysis using {provider} in {elapsed:.2f}s.")

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

            # Parse service name if any
            summary = response.content.strip()
            summary, resolved_service = _parse_service_from_llm_response(summary)

            update_dict = {
                "final_summary": summary,
                "tokens_used": tokens_used,
                "reasoning_steps": reasoning_steps,
                "messages": [response],
            }
            if resolved_service:
                update_dict["service_name"] = resolved_service
                if state.get("service_name") != resolved_service:
                    reasoning_steps.append(f"Node [Agent]: Resolved service name '{resolved_service}' from LLM response.")

            return update_dict

        return {
            "reasoning_steps": reasoning_steps,
            "messages": [response],
        }

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[Worker] Agent LLM call failed in {elapsed:.2f}s: {e}")
        reasoning_steps.append(f"Node [Agent] ERROR: LLM call failed in {elapsed:.2f}s: {str(e)[:200]}")

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
    print("[Graph] [Node: Tool Callback] Processing completed tool outputs...")
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

    resolved_service = _extract_service_name_from_tools(tools_output)
    update_dict = {
        "reasoning_steps": reasoning_steps,
        "tools_output": tools_output,
    }
    if resolved_service:
        update_dict["service_name"] = resolved_service
        if state.get("service_name") != resolved_service:
            reasoning_steps.append(f"Node [Tool Callback]: Resolved service name '{resolved_service}' from log context.")

    return update_dict


# ─────────────────────────────────────────────────────────────────
# Node: dispatch_notification
# ─────────────────────────────────────────────────────────────────
def dispatch_notification(state: TriageState) -> dict[str, Any]:
    """Post the triage summary to MS Teams."""
    import time
    from agent.notifications import send_teams_notification

    llm_config = state.get("llm_config", {})
    reasoning_steps = list(state.get("reasoning_steps", []))

    webhook_url = llm_config.get("_teams_webhook")
    target_channel = llm_config.get("targetTeamsChannel", "general")

    print(f"[Graph] [Node: Teams Dispatch] Posting triage summary to Teams webhook...")
    reasoning_steps.append(
        f"Node [Teams Dispatch]: Format Teams Adaptive Card payload for channel '#{target_channel}' and dispatch webhook."
    )

    start_time = time.time()
    try:
        send_teams_notification(
            webhook_url=webhook_url,
            incident_id=state["incident_id"],
            alert_title=state.get("alert_title", "Unknown Alert"),
            service=state.get("service_name", "unknown-service"),
            summary=state.get("final_summary", "No summary available."),
        )
        elapsed = time.time() - start_time
        print(f"[Graph] [Node: Teams Dispatch] Notification dispatched successfully in {elapsed:.2f}s.")
        reasoning_steps.append(f"Node [Teams Dispatch]: Notification dispatched successfully in {elapsed:.2f}s.")
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[Graph] [Node: Teams Dispatch] Failed to dispatch Teams notification in {elapsed:.2f}s: {e}")
        reasoning_steps.append(f"Node [Teams Dispatch] WARNING: Failed to dispatch Teams notification in {elapsed:.2f}s: {e}")

    return {"reasoning_steps": reasoning_steps}
