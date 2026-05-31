"""
OmniOps AI Triage Agent — LangGraph-based agentic workflow.

This package provides a modular, extensible agent that:
  - Ingests incident alerts from a Redis queue
  - Uses LangGraph to orchestrate tool calling and LLM analysis
  - Supports pluggable tools via auto-discovery in agent/tools/
  - Works with Ollama (gemma3:1b), OpenAI, and Anthropic LLMs
"""

from agent.graph import build_triage_graph, run_triage  # noqa: F401

__all__ = ["build_triage_graph", "run_triage"]
