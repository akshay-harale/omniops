"""
OmniOps AI Worker — Redis queue consumer entrypoint.

This module is intentionally slim.  All triage logic lives in the
``agent`` package (LangGraph-based workflow with pluggable tools).

Flow:
  1. Connect to Redis and block-pop from ``incident_queue``.
  2. For each incident, decide between mock triage (no LLM config)
     and real LangGraph triage.
  3. Write results to PostgreSQL and optionally post to Teams.
"""

import json
import os
import time

import psycopg2
import redis

from agent.db import fetch_incident, fetch_integrations, write_agent_run
from agent.mock_triage import run_mock_triage
from agent.notifications import send_teams_notification

# ── Environment config ──
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
DEPLOYMENT_MODE = os.getenv("DEPLOYMENT_MODE", "demo")


def parse_datadog_config(raw_config_str: str) -> dict:
    """Backward-compatible parser: handles both old plain-key and new JSON config."""
    if not raw_config_str:
        return {}
    try:
        parsed = json.loads(raw_config_str)
        if isinstance(parsed, dict):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    return {"apiKey": raw_config_str}

def get_safe_llm_config_for_log(config: dict) -> dict:
    """Returns a copy of the config with sensitive fields (keys, secret tokens) masked."""
    if not config:
        return {}
    safe_config = dict(config)
    for key in list(safe_config.keys()):
        if any(keyword in key.lower() for keyword in ["key", "secret", "token", "password", "webhook"]):
            val = safe_config[key]
            if val:
                safe_config[key] = f"***masked_len_{len(str(val))}***"
        elif key.startswith("_"):
            safe_config[key] = "...omitted..."
    return safe_config



def main():
    print("[Worker] Starting OmniOps AI Triage Worker (LangGraph Agent)...")
    print(f"[Worker] Deployment mode: {DEPLOYMENT_MODE}")

    # Wait for Postgres and Redis to boot
    time.sleep(5)

    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, socket_timeout=15)
        r.ping()
        print(f"[Worker] Connected to Redis queue at {REDIS_HOST}:{REDIS_PORT}")
    except Exception as e:
        print(f"[Worker] Failed to connect to Redis: {e}")
        return

    # ── Discover tools at startup ──
    from agent.tool_registry import discover_tools
    tools = discover_tools()
    print(f"[Worker] Agent tools loaded: {[t.name for t in tools]}")

    while True:
        try:
            print("[Worker] Waiting for incident queue items...")
            job = r.brpop("incident_queue", timeout=10)

            if not job:
                continue

            incident_id = job[1].decode("utf-8")
            print(f"[Worker] Processing enqueued incident ID: {incident_id}")

            # Write immediate PROCESSING status
            write_agent_run(
                incident_id,
                ["Initializing LangGraph Agent reasoning loop...", "Discovering tools and loading LLM configuration..."],
                "",
                0,
                "PROCESSING",
            )

            # Fetch incident from DB
            incident = fetch_incident(incident_id)
            if not incident:
                print(f"[Worker] Incident {incident_id} not found in DB! Skipping.")
                continue

            # Fetch tenant integrations
            integrations = fetch_integrations(incident["tenant_id"])
            teams_webhook = integrations.get("TEAMS", None)
            llm_config_str = integrations.get("LLM_CONFIG", None)
            dd_config_str = integrations.get("DATADOG", None)
            signoz_config_str = integrations.get("SIGNOZ", None)

            # Parse LLM config
            llm_config = None
            if llm_config_str:
                try:
                    llm_config = json.loads(llm_config_str)
                    print(f"[Worker] Loaded LLM Config: {get_safe_llm_config_for_log(llm_config)}")
                except Exception as e:
                    print(f"[Worker] Failed to parse LLM_CONFIG: {e}")

            # Attach auxiliary configs
            dd_config = parse_datadog_config(dd_config_str)
            if llm_config and dd_config:
                llm_config["_datadog_config"] = dd_config

            signoz_config = {}
            if signoz_config_str:
                try:
                    signoz_config = json.loads(signoz_config_str)
                    if llm_config:
                        llm_config["_signoz_config"] = signoz_config
                except Exception as e:
                    print(f"[Worker] Failed to parse SIGNOZ config: {e}")

            # Attach Teams webhook to config so nodes can access it
            if llm_config and teams_webhook:
                llm_config["_teams_webhook"] = teams_webhook

            agent_mode = llm_config.get("agentMode", "agentic") if llm_config else "legacy-mock"
            print(
                f"[Worker] Deployment mode: {DEPLOYMENT_MODE} | "
                f"Agent Mode: {agent_mode} | "
                f"LLM config: {'found' if llm_config else 'missing'} | "
                f"DD config: {'found' if dd_config else 'missing'} | "
                f"SigNoz config: {'found' if signoz_config else 'missing'}"
            )

            # Check if agent is disabled
            if llm_config and not llm_config.get("agentEnabled", True):
                print("[Worker] Triage Agent is disabled for tenant. Skipping AI runs.")
                write_agent_run(
                    incident_id,
                    ["Initializing Agent reasoning loop...", "Agent disabled in settings. Skipping triage analysis."],
                    "AI Triage Agent is currently disabled in your settings.",
                    0,
                    "COMPLETED",
                )
                continue

            if llm_config:
                # ═══════════════════════════════════════════════
                #  LangGraph-based real triage
                # ═══════════════════════════════════════════════
                from agent.graph import run_triage

                result = run_triage(
                    incident_id=incident_id,
                    incident_payload=incident["payload"],
                    tenant_id=incident["tenant_id"],
                    llm_config=llm_config,
                )

                reasoning_steps = result["reasoning_steps"]
                summary = result["final_summary"]
                service = result["service_name"]
                alert_title = result["alert_title"]
                tokens = result["tokens_used"]

            else:
                # ═══════════════════════════════════════════════
                #  Legacy mock triage (demo mode, no LLM config)
                # ═══════════════════════════════════════════════
                reasoning_steps, summary, service, alert_title = run_mock_triage(
                    incident_id, incident["payload"]
                )
                tokens = len(str(reasoning_steps).split()) + len(summary.split())

            # Post to Teams (if not already done by the graph's dispatch node)
            if not llm_config:
                send_teams_notification(teams_webhook, incident_id, alert_title, service, summary)

            # Write final results
            write_agent_run(incident_id, reasoning_steps, summary, tokens, "COMPLETED", service_name=service)

        except (redis.TimeoutError, TimeoutError):
            # This is expected when brpop blocks and no new items arrive in the queue
            continue
        except psycopg2.OperationalError as e:
            print(f"[Worker] DB connection error: {e}. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            print(f"[Worker] Error processing job: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(2)


if __name__ == "__main__":
    main()
