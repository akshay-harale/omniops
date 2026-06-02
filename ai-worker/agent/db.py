"""
Database operations for the AI Worker.

Extracted from the monolithic main.py to keep the entrypoint slim.
All functions use short-lived connections (no pool) to stay simple.
"""

from __future__ import annotations

import json
import os
import uuid

import psycopg2

# ── Connection parameters (from environment) ──
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")


def get_db_connection():
    """Open a new psycopg2 connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def fetch_incident(incident_id: str) -> dict | None:
    """Load an incident row by ID and return it as a dict."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, tenant_id, external_alert_id, payload, status FROM incident WHERE id = %s",
        (incident_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row:
        raw_payload = row[3]
        try:
            payload = json.loads(raw_payload) if raw_payload.strip().startswith("{") else {"raw": raw_payload}
        except (json.JSONDecodeError, AttributeError):
            payload = {"raw": str(raw_payload)}
        return {
            "id": row[0],
            "tenant_id": row[1],
            "external_alert_id": row[2],
            "payload": payload,
            "status": row[4],
        }
    return None


def fetch_integrations(tenant_id: str) -> dict[str, str]:
    """Return a dict of {service_type: decoded_api_key} for all ACTIVE integrations."""
    import base64

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT service_type, encrypted_api_key FROM integration WHERE tenant_id = %s AND status = 'ACTIVE'",
        (tenant_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    integrations: dict[str, str] = {}
    for service_type, encrypted_api_key in rows:
        try:
            api_key = base64.b64decode(encrypted_api_key).decode("utf-8")
        except Exception:
            api_key = encrypted_api_key
        integrations[service_type] = api_key
    return integrations


def write_agent_run(
    incident_id: str,
    reasoning_steps: list[str],
    final_summary: str,
    tokens_used: int,
    status: str,
    service_name: str | None = None,
) -> None:
    """Upsert agent_run row and update the parent incident status."""
    conn = get_db_connection()
    cur = conn.cursor()
    run_id = str(uuid.uuid4())

    cur.execute("SELECT id FROM agent_run WHERE incident_id = %s", (incident_id,))
    existing = cur.fetchone()

    if existing:
        cur.execute(
            """
            UPDATE agent_run
            SET reasoning_steps = %s, final_summary = %s, tokens_used = %s,
                status = %s, completed_at = CURRENT_TIMESTAMP
            WHERE incident_id = %s
            """,
            (json.dumps(reasoning_steps), final_summary, tokens_used, status, incident_id),
        )
    else:
        cur.execute(
            """
            INSERT INTO agent_run (id, incident_id, reasoning_steps, final_summary, tokens_used, status, completed_at)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            """,
            (run_id, incident_id, json.dumps(reasoning_steps), final_summary, tokens_used, status),
        )

    cur.execute("UPDATE incident SET status = %s WHERE id = %s", (status, incident_id))

    if service_name and service_name != "unknown-service":
        cur.execute("SELECT payload FROM incident WHERE id = %s", (incident_id,))
        row = cur.fetchone()
        if row and row[0]:
            try:
                payload = json.loads(row[0])
                if isinstance(payload, dict):
                    payload["service"] = service_name
                    cur.execute(
                        "UPDATE incident SET payload = %s WHERE id = %s",
                        (json.dumps(payload), incident_id),
                    )
            except Exception as e:
                print(f"[Worker] Failed to update service name in incident payload: {e}")

    conn.commit()
    cur.close()
    conn.close()
    print(f"[Worker] Updated status of agent_run and incident {incident_id} to {status}")
