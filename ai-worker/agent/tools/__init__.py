"""
Tool auto-discovery for the OmniOps triage agent.

Every Python module in this package that contains a function decorated
with ``@tool`` (from ``langchain_core.tools``) will be auto-discovered
and made available to the LangGraph agent.

**How to add a new tool:**
1. Create a new .py file in ``agent/tools/``.
2. Write a function decorated with ``@tool`` and a clear docstring
   (the docstring is what the LLM uses to decide when to call it).
3. Restart the worker.  Done — no graph wiring needed!
"""

from agent.tool_registry import discover_tools  # noqa: F401

__all__ = ["discover_tools"]
