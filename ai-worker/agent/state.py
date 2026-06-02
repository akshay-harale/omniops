"""
Agent state definition for the LangGraph triage workflow.

The TriageState flows through every node in the graph and accumulates
reasoning_steps so the OmniOps UI can render the execution trace.
"""

from __future__ import annotations

from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import BaseMessage
# pyrefly: ignore [missing-import]
from langgraph.graph.message import add_messages


class TriageState(TypedDict):
    """Typed state that flows through every node in the triage graph."""

    # ── LangGraph message history (auto-appended via reducer) ──
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # ── Incident metadata ──
    incident_id: str
    incident_payload: dict
    tenant_id: str

    # ── Extracted alert fields ──
    alert_title: str
    service_name: str

    # ── Accumulated audit trail (rendered in UI execution graph) ──
    reasoning_steps: list[str]

    # ── Tool outputs keyed by tool name ──
    tools_output: dict[str, str]

    # ── Final results ──
    final_summary: str
    tokens_used: int

    # ── Runtime config (not persisted) ──
    llm_config: dict
    agent_mode: str  # "agentic" or "sequential"
