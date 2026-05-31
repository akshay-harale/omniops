"""
Legacy mock triage — preserved for backward compatibility.

Used when no LLM configuration is present (demo mode).
This module is a direct extraction from the original main.py.
"""

from __future__ import annotations

import os
import time

# ── Mock log corpus keyed by alert type ──
MOCK_LOGS_LIBRARY = {
    "db_pool_exhausted": """
2026-05-26 13:02:15.114 ERROR 1 --- [io-8080-exec-12] o.h.engine.jdbc.spi.SqlExceptionHelper   : Connection is not available, request timed out after 30005ms (active: 100, idle: 0, waiting: 45).
2026-05-26 13:02:15.120 ERROR 1 --- [io-8080-exec-12] c.o.b.controller.OrderController         : Failed to create order: org.hibernate.exception.JDBCConnectionException: Could not open connection
    at org.hibernate.exception.internal.SQLStateConversionDelegate.convert(SQLStateConversionDelegate.java:100)
    at org.hibernate.exception.internal.StandardSQLExceptionConverter.convert(StandardSQLExceptionConverter.java:56)
    at org.hibernate.engine.jdbc.connections.internal.BasicConnectionCreator.convertSqlException(BasicConnectionCreator.java:123)
    at org.zaxxer.hikari.pool.ProxyConnection.leakTask(ProxyConnection.java:143)
    at org.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:189)
    at org.zaxxer.hikari.HikariDataSource.getConnection(HikariDataSource.java:112)
    """,
    "null_pointer_exception": """
2026-05-26 13:04:10.450 ERROR 1 --- [nio-8080-exec-4] o.a.c.c.C.[.[.[.[dispatcherServlet]      : Servlet.service() for servlet [dispatcherServlet] in context with path [] threw exception
java.lang.NullPointerException: Cannot invoke "com.omniops.backend.domain.Tenant.getPlanTier()" because "tenant" is null
    at com.omniops.backend.service.IncidentService.createIncident(IncidentService.java:23)
    at com.omniops.backend.controller.WebhookController.handleDatadogWebhook(WebhookController.java:21)
    at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
    at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:77)
    """,
    "cpu_spike": """
System Monitor Alert: CPU utilization exceeded critical threshold (94.2% > 85.0%).
Top CPU Thread Consumers (Java VM):
- Thread-14 "Garbage Collector" CPU: 68% (Frequent Full GC running due to low memory headroom)
- Thread-45 "PaymentValidationQueue" CPU: 22% (Infinite loop identified in PaymentValidator.java:143 during signature checks)
- Thread-8 "HTTP-io-8080-exec-1" CPU: 4% (Idle worker thread)
    """,
    "memory_leak": """
2026-05-26 13:06:05.890 ERROR 1 --- [io-8080-exec-90] java.lang.OutOfMemoryError: Java heap space
Dumping heap to java_pid1.hprof ...
Heap dump file created [104857600 bytes in 1.450s]
Memory statistics: Max Heap = 2048MB, Active Heap = 2047MB (99.9% consumed)
Garbage collector overhead limit exceeded. 98% of runtime spent garbage collecting.
    """,
}


def _classify_alert(payload: dict) -> tuple[str, str, str]:
    """Return (alert_type, alert_title, service) from the payload text."""
    alert_text = str(payload).lower()
    alert_type = "null_pointer_exception"
    alert_title = "Unknown Alert"
    service = "unknown-service"

    if "db" in alert_text or "connection" in alert_text or "database" in alert_text:
        alert_type = "db_pool_exhausted"
        alert_title = "Database connection pool exhausted"
        service = "auth-service"
    elif "nullpointer" in alert_text or "null" in alert_text or "500" in alert_text:
        alert_type = "null_pointer_exception"
        alert_title = "NullPointerException in API controller"
        service = "gateway-service"
    elif "cpu" in alert_text or "spike" in alert_text or "load" in alert_text:
        alert_type = "cpu_spike"
        alert_title = "High CPU Load on web server"
        service = "order-service"
    elif "memory" in alert_text or "oom" in alert_text or "heap" in alert_text:
        alert_type = "memory_leak"
        alert_title = "OutOfMemoryError: Java heap space"
        service = "payment-service"

    if isinstance(payload, dict):
        alert_title = payload.get("event_title", alert_title)
        service = payload.get("service", service)

    return alert_type, alert_title, service


def run_mock_triage(incident_id: str, payload: dict):
    """Run a fully offline mock triage for demo/dev mode.

    Returns:
        tuple: (reasoning_steps, summary, service, alert_title)
    """
    alert_type, alert_title, service = _classify_alert(payload)
    reasoning_steps: list[str] = []

    # Node 1: Ingest
    reasoning_steps.append(
        f"Node [Extract Entities]: Ingested alert payload for service '{service}'. Event: '{alert_title}'."
    )
    time.sleep(1)

    # Node 2: Retrieve context / logs
    shared_log_path = "/shared/sample-application.log"
    crash_log = MOCK_LOGS_LIBRARY[alert_type]

    if os.path.exists(shared_log_path):
        try:
            with open(shared_log_path, "a") as lf:
                lf.write("\n--- CRITICAL ALERT DETECTED ---\n")
                lf.write(crash_log.strip() + "\n")
                lf.write("---------------------------------\n")
            print(f"[Worker] Appended crash trace for {alert_type} to shared log file.")
        except Exception as e:
            print(f"[Worker] Failed to write crash log to shared file: {e}")

    live_logs = ""
    if os.path.exists(shared_log_path):
        try:
            with open(shared_log_path, "r") as f:
                lines = f.readlines()
                selected_lines = lines[-35:] if len(lines) > 35 else lines
                live_logs = "".join(selected_lines)
            reasoning_steps.append(f"Node [Fetch Context]: Connected to application log stream at {shared_log_path}.")
        except Exception as e:
            print(f"[Worker] Failed to read from shared log: {e}")

    logs = live_logs if live_logs else crash_log
    reasoning_steps.append(f"Node [Fetch Context]: Found log details matching failure fingerprint:\n---\n{logs.strip()}\n---")
    time.sleep(1.5)

    # Node 3: AI analysis
    reasoning_steps.append("Node [Analyze Logs]: Passing gathered context (logs and metrics) to LLM API (Reasoning Loop)...")

    summaries = {
        "db_pool_exhausted": (
            f"The {service} is experiencing a database connection leak or excessive pool usage. "
            "All 100 available connections in the Hikari pool are active, causing requests to time out "
            "after 30,005ms. This is likely due to order database processes failing to release connections "
            "during payment verification."
        ),
        "null_pointer_exception": (
            f"A NullPointerException occurred in IncidentService.java:23 inside {service}. "
            "The service attempted to read 'tenant.getPlanTier()' but the Tenant entity object was null. "
            "This suggests a regression in onboarding logic where unverified users are routing to triage directly."
        ),
        "cpu_spike": (
            f"Sustained 94.2% CPU utilization detected on {service}. Primary driver is high Garbage Collector overhead "
            "(Thread-14 consuming 68% CPU) triggered by Java VM resource limits, alongside an infinite loop in "
            "PaymentValidator.java line 143 during cryptographic checks."
        ),
        "memory_leak": (
            f"An OutOfMemoryError (Java heap space) has crashed the application JVM for {service}. "
            "The active heap reached 99.9% of its 2048MB maximum allocation. High volume GC runs "
            "exhausted 98% of processing runtime prior to the container exit."
        ),
    }
    summary = summaries.get(alert_type, summaries["memory_leak"])

    reasoning_steps.append(
        f"Node [Analyze Logs]: LLM analysis returned successfully. Root cause matches: {alert_type.replace('_', ' ').upper()}."
    )
    time.sleep(1)

    # Node 4: MS Teams delivery
    reasoning_steps.append("Node [Teams Dispatch]: Format Teams Adaptive Card message payload and queue dispatch.")

    return reasoning_steps, summary, service, alert_title
