"""
Tool registry — auto-discovers @tool-decorated functions in agent/tools/.

The registry imports every module inside the ``agent.tools`` package,
introspects its members, and collects anything that is a LangChain
``BaseTool`` instance (which ``@tool`` creates under the hood).
"""

from __future__ import annotations

import importlib
import pkgutil
from typing import List

from langchain_core.tools import BaseTool


def discover_tools() -> List[BaseTool]:
    """Walk the ``agent.tools`` package and return all ``@tool`` instances.

    Returns:
        A list of LangChain tool objects ready for ``bind_tools()`` or ``ToolNode``.
    """
    import agent.tools as tools_pkg

    found: List[BaseTool] = []
    for importer, modname, ispkg in pkgutil.iter_modules(tools_pkg.__path__):
        module = importlib.import_module(f"agent.tools.{modname}")
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if isinstance(attr, BaseTool):
                found.append(attr)
                print(f"[ToolRegistry] Discovered tool: {attr.name}")

    print(f"[ToolRegistry] Total tools discovered: {len(found)}")
    return found
