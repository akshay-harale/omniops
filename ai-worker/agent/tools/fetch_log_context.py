"""
Tool: fetch_log_context

Calls the OmniOps Java backend to retrieve aggregated log context
for an incident (SigNoz, Datadog, etc.).
"""

from __future__ import annotations

import requests
from langchain_core.tools import tool


@tool
def fetch_log_context(incident_id: str) -> str:
    """Fetch aggregated log context for an incident from the OmniOps backend.

    This calls the Java integration layer which queries observability platforms
    (SigNoz, Datadog, etc.) and returns the consolidated logs associated with
    the incident. Use this tool whenever you need application logs, error
    stack traces, or observability data to diagnose an alert.

    Args:
        incident_id: The UUID of the incident to fetch logs for.

    Returns:
        A string containing the aggregated log context, or a message
        indicating no context was available.
    """
    try:
        response = requests.get(
            f"http://backend:8081/api/context/incident/{incident_id}",
            timeout=15,
        )
        if response.status_code == 200:
            context_map = response.json()
            if not context_map:
                return "Log context API returned an empty result. No logs were found for this incident."
            parts = []
            for provider, logs in context_map.items():
                parts.append(f"=== Logs from {provider} ===\n{logs}")
            return "\n\n".join(parts)
        else:
            return f"Log context API returned HTTP {response.status_code}. No logs available."
    except Exception as e:
        return f"Failed to fetch log context: {e}"
