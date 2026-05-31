"""
Notification dispatchers (MS Teams, etc.).

Extracted from main.py. Each dispatcher is a standalone function
that can also be wrapped as a LangGraph tool if needed.
"""

from __future__ import annotations

import requests


def send_teams_notification(
    webhook_url: str | None,
    incident_id: str,
    alert_title: str,
    service: str,
    summary: str,
) -> None:
    """Post an Adaptive Card to an MS Teams channel via incoming webhook."""
    if not webhook_url or "mock" in webhook_url:
        print(f"[Worker] Skipping MS Teams post (configured webhook url is mock: {webhook_url})")
        return

    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "FF0000",
        "summary": "AI DevOps Alert Triage Complete",
        "sections": [
            {
                "activityTitle": f"🚨 **Alert Triage Completed**: {alert_title}",
                "activitySubtitle": f"Service: **{service}** | Incident ID: {incident_id}",
                "facts": [
                    {"name": "Status", "value": "Analyzed"},
                    {"name": "Triage Result", "value": "Root Cause Identified"},
                ],
                "text": f"### **AI Analysis Summary**\n{summary}\n\n[View Full Audit Log](http://localhost)",
            }
        ],
    }

    try:
        response = requests.post(webhook_url, json=payload, timeout=5)
        print(f"[Worker] Sent MS Teams notification. Status code: {response.status_code}")
    except Exception as e:
        print(f"[Worker] Error sending Teams notification: {e}")
