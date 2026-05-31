"""
Tool: fetch_alert_details

Parses a raw alert webhook payload and extracts structured metadata
(service name, alert title, infrastructure tags, severity, etc.).
"""

from __future__ import annotations

import json

from langchain_core.tools import tool


@tool
def fetch_alert_details(incident_payload_json: str) -> str:
    """Parse a raw alert/webhook payload and extract structured incident details.

    Use this tool to understand the alert context: which service is affected,
    what the alert title is, the severity/priority, Kubernetes infrastructure
    tags (cluster, namespace, pod), and any monitoring query expressions.

    Args:
        incident_payload_json: The raw incident payload as a JSON string.

    Returns:
        A human-readable summary of the extracted alert metadata.
    """
    try:
        payload = json.loads(incident_payload_json) if isinstance(incident_payload_json, str) else incident_payload_json
    except (json.JSONDecodeError, TypeError):
        payload = {"raw": str(incident_payload_json)}

    # Extract core fields
    alert_title = payload.get("event_title", payload.get("title", "Unknown Alert"))
    service = payload.get("service", "unknown-service")
    priority = payload.get("alert_priority", payload.get("priority", "N/A"))
    alert_query = payload.get("alert_query", "")

    # Parse infrastructure tags from alert_scope (Datadog-style)
    scope_str = payload.get("alert_scope", "")
    infra_tags: dict[str, str] = {}
    if scope_str:
        for tag in str(scope_str).split(","):
            tag = tag.strip()
            if ":" in tag:
                k, v = tag.split(":", 1)
                infra_tags[k.strip()] = v.strip()

    # Build output
    lines = [
        f"Alert Title: {alert_title}",
        f"Service: {service}",
        f"Priority: {priority}",
    ]

    if infra_tags:
        lines.append("Infrastructure Context:")
        for k, v in infra_tags.items():
            lines.append(f"  - {k}: {v}")

    if alert_query:
        lines.append(f"Alert Query: {alert_query}")

    # Include any related_logs URL if present
    related_logs = payload.get("relatedLogs", payload.get("related_logs", ""))
    if related_logs:
        lines.append(f"Related Logs URL: {related_logs}")

    return "\n".join(lines)
