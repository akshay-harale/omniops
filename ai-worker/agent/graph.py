"""
LangGraph StateGraph assembly for the OmniOps triage agent.

Provides two execution modes:
  - **agentic** (default): The LLM decides which tools to call via
    ``bind_tools`` and the ``ToolNode`` / ``tools_condition`` loop.
  - **sequential**: All tools run upfront, then the LLM receives the
    combined output for analysis (fallback for models without tool calling).

Usage::

    from agent.graph import run_triage

    result = run_triage(
        incident_id="abc-123",
        incident_payload={...},
        tenant_id="tenant-1",
        llm_config={...},
    )
    # result contains: reasoning_steps, final_summary, tokens_used, etc.
"""

from __future__ import annotations

import json
from typing import Any

from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from agent.nodes import (
    agent_node,
    analyze_with_llm,
    dispatch_notification,
    gather_context_sequential,
    ingest_alert,
    tool_executed_callback,
)
from agent.state import TriageState
from agent.tool_registry import discover_tools

# Maximum number of tool-calling iterations before forcing a final answer
MAX_TOOL_ITERATIONS = 5


def build_agentic_graph() -> StateGraph:
    """Build a graph where the LLM decides which tools to call.

    Flow::

        START → ingest_alert → agent → (tools_condition)
                                   ├─ tool calls → tool_executor → tool_callback → agent (loop)
                                   └─ final answer → dispatch_notification → END
    """
    tools = discover_tools()
    tool_node = ToolNode(tools, handle_tool_errors=True)

    graph = StateGraph(TriageState)

    # ── Add nodes ──
    graph.add_node("ingest_alert", ingest_alert)
    graph.add_node("agent", agent_node)
    graph.add_node("tool_executor", tool_node)
    graph.add_node("tool_callback", tool_executed_callback)
    graph.add_node("dispatch_notification", dispatch_notification)

    # ── Wire edges ──
    graph.add_edge(START, "ingest_alert")
    graph.add_edge("ingest_alert", "agent")

    # Conditional edge: if LLM wants tools → tool_executor, else → dispatch
    graph.add_conditional_edges(
        "agent",
        tools_condition,
        {"tools": "tool_executor", END: "dispatch_notification"},
    )

    # After tools execute, log results and loop back to agent
    graph.add_edge("tool_executor", "tool_callback")
    graph.add_edge("tool_callback", "agent")

    # After dispatch, we're done
    graph.add_edge("dispatch_notification", END)

    return graph


def build_sequential_graph() -> StateGraph:
    """Build a graph that runs all tools first, then calls the LLM once.

    Flow::

        START → ingest_alert → gather_context → analyze_with_llm → dispatch_notification → END
    """
    graph = StateGraph(TriageState)

    graph.add_node("ingest_alert", ingest_alert)
    graph.add_node("gather_context", gather_context_sequential)
    graph.add_node("analyze_with_llm", analyze_with_llm)
    graph.add_node("dispatch_notification", dispatch_notification)

    graph.add_edge(START, "ingest_alert")
    graph.add_edge("ingest_alert", "gather_context")
    graph.add_edge("gather_context", "analyze_with_llm")
    graph.add_edge("analyze_with_llm", "dispatch_notification")
    graph.add_edge("dispatch_notification", END)

    return graph


def build_triage_graph(llm_config: dict) -> StateGraph:
    """Build the appropriate graph variant based on configuration.

    Args:
        llm_config: The tenant's LLM config dict.

    Returns:
        An uncompiled StateGraph.
    """
    mode = llm_config.get("agentMode", "agentic")
    print(f"[Graph] Building triage graph in '{mode}' mode")

    if mode == "sequential":
        return build_sequential_graph()
    return build_agentic_graph()


def run_triage(
    incident_id: str,
    incident_payload: dict,
    tenant_id: str,
    llm_config: dict,
) -> dict[str, Any]:
    """Execute the full triage workflow and return results.

    This is the main entry point called from ``main.py``.

    Args:
        incident_id: UUID of the incident.
        incident_payload: Raw alert/webhook payload dict.
        tenant_id: UUID of the tenant.
        llm_config: Tenant's LLM configuration dict.

    Returns:
        Dict with keys: reasoning_steps, final_summary, service_name,
        alert_title, tokens_used.
    """
    mode = llm_config.get("agentMode", "agentic")
    graph = build_triage_graph(llm_config)
    app = graph.compile()

    print(f"[Graph] Executing triage graph (mode={mode}) for incident {incident_id}")

    # Prepare initial state
    initial_state: TriageState = {
        "messages": [],
        "incident_id": incident_id,
        "incident_payload": incident_payload,
        "tenant_id": tenant_id,
        "alert_title": "",
        "service_name": "",
        "reasoning_steps": [],
        "tools_output": {},
        "final_summary": "",
        "tokens_used": 0,
        "llm_config": llm_config,
        "agent_mode": mode,
    }

    # Run the graph
    import time
    start_time = time.time()
    try:
        final_state = app.invoke(
            initial_state,
            config={"recursion_limit": MAX_TOOL_ITERATIONS * 2 + 5},
        )
        elapsed = time.time() - start_time
        print(f"[Graph] Graph execution completed successfully in {elapsed:.2f}s")
        reasoning_steps = final_state.get("reasoning_steps", [])
        reasoning_steps.append(f"Node [Graph Completed]: Triage loop finished successfully in {elapsed:.2f}s.")
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[Graph] Graph execution failed in {elapsed:.2f}s: {e}")
        return {
            "reasoning_steps": [
                f"Node [Extract Entities]: Ingested alert for incident {incident_id}.",
                f"Node [Agent] ERROR: Graph execution failed in {elapsed:.2f}s: {str(e)[:300]}",
            ],
            "final_summary": f"Triage failed due to an error: {e}",
            "service_name": "unknown-service",
            "alert_title": "Unknown Alert",
            "tokens_used": 0,
        }

    return {
        "reasoning_steps": reasoning_steps,
        "final_summary": final_state.get("final_summary", "No summary produced."),
        "service_name": final_state.get("service_name", "unknown-service"),
        "alert_title": final_state.get("alert_title", "Unknown Alert"),
        "tokens_used": final_state.get("tokens_used", 0),
    }
