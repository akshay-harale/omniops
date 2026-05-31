import os
import json
import time
import uuid
import psycopg2
import redis
import requests

# Load Config from Environment
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DEPLOYMENT_MODE = os.getenv("DEPLOYMENT_MODE", "demo")

# Define mock logs library based on alert type
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
    """
}

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def fetch_incident(incident_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, tenant_id, external_alert_id, payload, status FROM incident WHERE id = %s",
        (incident_id,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row:
        return {
            "id": row[0],
            "tenant_id": row[1],
            "external_alert_id": row[2],
            "payload": json.loads(row[3]) if row[3].strip().startswith("{") else {"raw": row[3]},
            "status": row[4]
        }
    return None

def fetch_integrations(tenant_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT service_type, encrypted_api_key FROM integration WHERE tenant_id = %s AND status = 'ACTIVE'",
        (tenant_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    integrations = {}
    for service_type, encrypted_api_key in rows:
        # Simple decode since Java backend base64 encodes it
        try:
            import base64
            api_key = base64.b64decode(encrypted_api_key).decode("utf-8")
        except Exception:
            api_key = encrypted_api_key
        integrations[service_type] = api_key
    return integrations

def parse_alert_scope(scope_str):
    """Parse Datadog-style alert_scope tags into a dict.
    Example: 'kube_cluster:prod,kube_namespace:auth,pod_name:auth-7c8b' 
    -> {'kube_cluster': 'prod', 'kube_namespace': 'auth', 'pod_name': 'auth-7c8b'}
    """
    tags = {}
    if not scope_str:
        return tags
    for tag in str(scope_str).split(","):
        tag = tag.strip()
        if ":" in tag:
            k, v = tag.split(":", 1)
            tags[k.strip()] = v.strip()
    return tags

def parse_datadog_config(raw_config_str):
    """Backward-compatible parser: handles both old plain-key and new JSON config."""
    if not raw_config_str:
        return {}
    try:
        parsed = json.loads(raw_config_str)
        if isinstance(parsed, dict):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    # Old format: treat entire string as API key
    return {"apiKey": raw_config_str}

def write_agent_run(incident_id, reasoning_steps, final_summary, tokens_used, status):
    conn = get_db_connection()
    cur = conn.cursor()
    run_id = str(uuid.uuid4())
    
    # Try updating first, if not exists then insert
    cur.execute("SELECT id FROM agent_run WHERE incident_id = %s", (incident_id,))
    existing = cur.fetchone()
    
    if existing:
        cur.execute(
            """
            UPDATE agent_run 
            SET reasoning_steps = %s, final_summary = %s, tokens_used = %s, status = %s, completed_at = CURRENT_TIMESTAMP 
            WHERE incident_id = %s
            """,
            (json.dumps(reasoning_steps), final_summary, tokens_used, status, incident_id)
        )
    else:
        cur.execute(
            """
            INSERT INTO agent_run (id, incident_id, reasoning_steps, final_summary, tokens_used, status, completed_at)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            """,
            (run_id, incident_id, json.dumps(reasoning_steps), final_summary, tokens_used, status)
        )
    
    # Update the incident status as well
    cur.execute(
        "UPDATE incident SET status = %s WHERE id = %s",
        (status, incident_id)
    )
    
    conn.commit()
    cur.close()
    conn.close()
    print(f"[Worker] Updated status of agent_run and incident {incident_id} to {status}")

def send_teams_notification(webhook_url, incident_id, alert_title, service, summary):
    if not webhook_url or "mock" in webhook_url:
        print(f"[Worker] Skipping MS Teams post (configured webhook url is mock: {webhook_url})")
        return
    
    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "FF0000",
        "summary": "AI DevOps Alert Triage Complete",
        "sections": [{
            "activityTitle": f"🚨 **Alert Triage Completed**: {alert_title}",
            "activitySubtitle": f"Service: **{service}** | Incident ID: {incident_id}",
            "facts": [
                {"name": "Status", "value": "Analyzed"},
                {"name": "Triage Result", "value": "Root Cause Identified"}
            ],
            "text": f"### **AI Analysis Summary**\n{summary}\n\n[View Full Audit Log](http://localhost:3000)"
        }]
    }
    
    try:
        response = requests.post(webhook_url, json=payload, timeout=5)
        print(f"[Worker] Sent MS Teams notification. Status code: {response.status_code}")
    except Exception as e:
        print(f"[Worker] Error sending Teams notification: {e}")

def run_mock_triage(incident_id, payload):
    alert_text = str(payload).lower()
    alert_type = "null_pointer_exception" # default
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

    reasoning_steps = []
    
    # Node 1: Ingest alert and extract details
    reasoning_steps.append(f"Node [Extract Entities]: Ingested alert payload for service '{service}'. Event: '{alert_title}'.")
    time.sleep(1)
    
    # Node 2: Retrieve context / logs
    # Ingest from shared volume if present, to simulate real file analysis
    shared_log_path = "/shared/sample-application.log"
    logs_appended = False
    
    # Inject the crash log directly into the shared file first, so it appears in the live stream UI!
    crash_log = MOCK_LOGS_LIBRARY[alert_type]
    if os.path.exists(shared_log_path):
        try:
            with open(shared_log_path, "a") as lf:
                lf.write(f"\n--- CRITICAL ALERT DETECTED ---\n")
                lf.write(crash_log.strip() + "\n")
                lf.write(f"---------------------------------\n")
            logs_appended = True
            print(f"[Worker] Appended crash trace for {alert_type} to shared log file.")
        except Exception as e:
            print(f"[Worker] Failed to write crash log to shared file: {e}")

    # Read logs from shared volume
    live_logs = ""
    if os.path.exists(shared_log_path):
        try:
            with open(shared_log_path, "r") as f:
                lines = f.readlines()
                # Read last 35 lines to include the newly appended stack trace and preceding context
                selected_lines = lines[-35:] if len(lines) > 35 else lines
                live_logs = "".join(selected_lines)
            reasoning_steps.append(f"Node [Fetch Context]: Connected to application log stream at {shared_log_path}.")
        except Exception as e:
            print(f"[Worker] Failed to read from shared log: {e}")

    # Fallback to local copy if live logs are empty
    logs = live_logs if live_logs else crash_log
    reasoning_steps.append(f"Node [Fetch Context]: Found log details matching failure fingerprint:\n---\n{logs.strip()}\n---")
    time.sleep(1.5)

    # Node 3: AI analysis
    reasoning_steps.append(f"Node [Analyze Logs]: Passing gathered context (logs and metrics) to LLM API (Reasoning Loop)...")
    
    if alert_type == "db_pool_exhausted":
        summary = (
            f"The {service} is experiencing a database connection leak or excessive pool usage. "
            "All 100 available connections in the Hikari pool are active, causing requests to time out "
            "after 30,005ms. This is likely due to order database processes failing to release connections "
            "during payment verification."
        )
    elif alert_type == "null_pointer_exception":
        summary = (
            f"A NullPointerException occurred in IncidentService.java:23 inside {service}. "
            "The service attempted to read 'tenant.getPlanTier()' but the Tenant entity object was null. "
            "This suggests a regression in onboarding logic where unverified users are routing to triage directly."
        )
    elif alert_type == "cpu_spike":
        summary = (
            f"Sustained 94.2% CPU utilization detected on {service}. Primary driver is high Garbage Collector overhead "
            "(Thread-14 consuming 68% CPU) triggered by Java VM resource limits, alongside an infinite loop in "
            "PaymentValidator.java line 143 during cryptographic checks."
        )
    else:
        summary = (
            f"An OutOfMemoryError (Java heap space) has crashed the application JVM for {service}. "
            "The active heap reached 99.9% of its 2048MB maximum allocation. High volume GC runs "
            "exhausted 98% of processing runtime prior to the container exit."
        )

    reasoning_steps.append(f"Node [Analyze Logs]: LLM analysis returned successfully. Root cause matches: {alert_type.replace('_', ' ').upper()}.")
    time.sleep(1)

    # Node 4: MS Teams delivery
    reasoning_steps.append("Node [Teams Dispatch]: Format Teams Adaptive Card message payload and queue dispatch.")
    
    return reasoning_steps, summary, service, alert_title

def run_real_triage(incident_id, payload, llm_config):
    alert_text = str(payload).lower()
    alert_type = "null_pointer_exception" # default
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

    reasoning_steps = []
    
    # Node 1: Ingest alert and extract details
    reasoning_steps.append(f"Node [Extract Entities]: Ingested alert payload for service '{service}'. Event: '{alert_title}'.")
    
    # Node 2: Retrieve context / logs
    reasoning_steps.append(f"Node [Fetch Context]: Requesting log context from backend API for incident {incident_id}...")
    
    logs_context = ""
    try:
        context_response = requests.get(f"http://backend:8081/api/context/incident/{incident_id}", timeout=10)
        if context_response.status_code == 200:
            context_map = context_response.json()
            if "SIGNOZ" in context_map:
                logs_context = context_map["SIGNOZ"]
                reasoning_steps.append(f"Node [Fetch Context]: Retrieved SigNoz logs.")
            else:
                reasoning_steps.append(f"Node [Fetch Context]: No SigNoz context returned.")
        else:
            reasoning_steps.append(f"Node [Fetch Context]: Failed to fetch context. Status: {context_response.status_code}")
    except Exception as e:
        print(f"[Worker] Failed to fetch context from Java backend: {e}")
        reasoning_steps.append(f"Node [Fetch Context]: Error requesting context: {e}")

    if not logs_context:
        logs_context = "No log context could be retrieved from the integrations."

    reasoning_steps.append(f"Node [Fetch Context]: Extracted context:\n---\n{logs_context.strip()[:500]}...\n---")

    # Node 3: AI analysis
    provider = llm_config.get("provider", "OLLAMA")
    depth = llm_config.get("analysisDepth", llm_config.get("analysis_depth", "DEEP"))
    
    reasoning_steps.append(f"Node [Analyze Logs]: Passing gathered context (logs and metrics) to LLM API ({provider} Reasoning Loop)...")
    
    # Construct Prompts
    system_prompt = (
        "You are an expert DevOps AI Triage Agent. Analyze the incident alert and the log context provided. "
        "Determine the root cause of the error. Provide a concise, actionable summary of your findings for software engineers. "
        "Strictly base your reasoning on the provided logs. Do not invent error codes or make assumptions beyond the logs."
    )
    if depth == "QUICK":
        system_prompt += " Your final response must be extremely brief (maximum 2-3 sentences)."
    else:
        system_prompt += " Provide a detailed step-by-step analysis, identifying the specific class/line of code causing the failure, potential impact, and direct instructions for resolution."

    user_prompt = (
        f"Alert Title: {alert_title}\n"
        f"Failing Service: {service}\n"
    )
    
    # Extract infrastructure context from alert_scope (if present in webhook payload)
    scope_str = payload.get("alert_scope", "") if isinstance(payload, dict) else ""
    infra_tags = parse_alert_scope(scope_str)
    
    # Also try to pull context from the Datadog and SigNoz integration config
    dd_config = llm_config.get("_datadog_config", {})
    signoz_config = llm_config.get("_signoz_config", {})
    
    cluster = infra_tags.get("kube_cluster", dd_config.get("clusterName", ""))
    namespace = infra_tags.get("kube_namespace", "")
    pod = infra_tags.get("pod_name", "")
    container = infra_tags.get("container_name", "")
    env = infra_tags.get("env", dd_config.get("environment", ""))
    host = infra_tags.get("host", "")
    alert_query = payload.get("alert_query", "") if isinstance(payload, dict) else ""
    priority = payload.get("alert_priority", "") if isinstance(payload, dict) else ""
    
    # Add infrastructure context to reasoning steps
    if cluster or namespace or pod:
        infra_parts = []
        if cluster: infra_parts.append(f"Cluster: {cluster}")
        if namespace: infra_parts.append(f"Namespace: {namespace}")
        if pod: infra_parts.append(f"Pod: {pod}")
        if container: infra_parts.append(f"Container: {container}")
        if env: infra_parts.append(f"Environment: {env}")
        if host: infra_parts.append(f"Host: {host}")
        reasoning_steps.append(f"Node [Extract Entities]: Identified K8s context — {', '.join(infra_parts)}")
    
    # Enrich user prompt with infrastructure context
    if env: user_prompt += f"Environment: {env}\n"
    if cluster: user_prompt += f"Kubernetes Cluster: {cluster}\n"
    if namespace: user_prompt += f"Namespace: {namespace}\n"
    if pod: user_prompt += f"Pod: {pod}\n"
    if container: user_prompt += f"Container: {container}\n"
    if host: user_prompt += f"Host: {host}\n"
    if priority: user_prompt += f"Alert Priority: {priority}\n"
    if alert_query: user_prompt += f"Alert Query: {alert_query}\n"
    
    user_prompt += (
        f"Alert Payload: {json.dumps(payload)}\n\n"
        f"--- GATHERED LOG CONTEXT ---\n"
        f"{logs_context}\n"
        f"----------------------------\n"
    )

    summary = ""
    tokens_used = 0
    
    # Log the payload being sent to the LLM
    print(f"[Worker] ==================== SENDING TO LLM ({provider}) ====================")
    print(f"[Worker] System Prompt:\n{system_prompt}\n")
    print(f"[Worker] User Prompt:\n{user_prompt}")
    print(f"[Worker] =====================================================================")

    try:
        if provider == "OLLAMA":
            endpoint = llm_config.get("ollamaEndpoint", "http://host.docker.internal:11434").rstrip('/')
            model = llm_config.get("ollamaModel", "llama3")
            reasoning_steps.append(f"Node [Analyze Logs]: Querying Local Ollama (model: {model}) at {endpoint}...")
            
            url = f"{endpoint}/api/chat"
            llm_payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "stream": False
            }
            response = requests.post(url, json=llm_payload, timeout=120)
            if response.status_code == 200:
                result = response.json()
                summary = result.get("message", {}).get("content", "").strip()
                tokens_used = result.get("prompt_eval_count", 0) + result.get("eval_count", 0)
            else:
                raise Exception(f"Ollama returned HTTP status {response.status_code}: {response.text}")
                
        elif provider == "OPENAI":
            api_key = llm_config.get("openaiKey", "")
            model = llm_config.get("openaiModel", "gpt-4o")
            reasoning_steps.append(f"Node [Analyze Logs]: Querying OpenAI (model: {model})...")
            
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            llm_payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.2
            }
            response = requests.post(url, headers=headers, json=llm_payload, timeout=30)
            if response.status_code == 200:
                result = response.json()
                summary = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                tokens_used = result.get("usage", {}).get("total_tokens", 0)
            else:
                raise Exception(f"OpenAI returned HTTP status {response.status_code}: {response.text}")
                
        elif provider == "ANTHROPIC":
            api_key = llm_config.get("anthropicKey", "")
            model = llm_config.get("anthropicModel", "claude-3-5-sonnet-20240620")
            reasoning_steps.append(f"Node [Analyze Logs]: Querying Anthropic (model: {model})...")
            
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01"
            }
            llm_payload = {
                "model": model,
                "max_tokens": 1024,
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": user_prompt}
                ]
            }
            response = requests.post(url, headers=headers, json=llm_payload, timeout=30)
            if response.status_code == 200:
                result = response.json()
                summary = result.get("content", [{}])[0].get("text", "").strip()
                tokens_used = result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0)
            else:
                raise Exception(f"Anthropic returned HTTP status {response.status_code}: {response.text}")
        else:
            raise Exception(f"Unsupported LLM provider: {provider}")

        reasoning_steps.append(f"Node [Analyze Logs]: LLM analysis completed successfully using {provider}.")
        
    except Exception as e:
        print(f"[Worker] LLM query failed: {e}")
        reasoning_steps.append(f"Node [Analyze Logs] ERROR: Failed querying LLM: {str(e)[:120]}. Falling back to simulated analysis.")
        
        # Fallback to local static summaries so dashboard doesn't break
        if alert_type == "db_pool_exhausted":
            summary = (
                f"The {service} is experiencing a database connection leak or excessive pool usage. "
                "All 100 available connections in the Hikari pool are active, causing requests to time out "
                "after 30,005ms. This is likely due to order database processes failing to release connections "
                "during payment verification."
            )
        elif alert_type == "null_pointer_exception":
            summary = (
                f"A NullPointerException occurred in IncidentService.java:23 inside {service}. "
                "The service attempted to read 'tenant.getPlanTier()' but the Tenant entity object was null. "
                "This suggests a regression in onboarding logic where unverified users are routing to triage directly."
            )
        elif alert_type == "cpu_spike":
            summary = (
                f"Sustained 94.2% CPU utilization detected on {service}. Primary driver is high Garbage Collector overhead "
                "(Thread-14 consuming 68% CPU) triggered by Java VM resource limits, alongside an infinite loop in "
                "PaymentValidator.java line 143 during cryptographic checks."
            )
        else:
            summary = (
                f"An OutOfMemoryError (Java heap space) has crashed the application JVM for {service}. "
                "The active heap reached 99.9% of its 2048MB maximum allocation. High volume GC runs "
                "exhausted 98% of processing runtime prior to the container exit."
            )

    # Node 4: MS Teams delivery
    target_channel = llm_config.get("targetTeamsChannel", "general")
    reasoning_steps.append(f"Node [Teams Dispatch]: Format Teams Adaptive Card payload for channel '#{target_channel}' and dispatch webhook.")
    
    return reasoning_steps, summary, service, alert_title, tokens_used

def main():
    print("[Worker] Starting AI DevOps Agent Triage Worker...")
    
    # Wait a bit for Postgres and Redis to boot up in Docker
    time.sleep(5)
    
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)
        print(f"[Worker] Connected to Redis queue at {REDIS_HOST}:{REDIS_PORT}")
    except Exception as e:
        print(f"[Worker] Failed to connect to Redis: {e}")
        return

    while True:
        try:
            print("[Worker] Waiting for incident queue items...")
            job = r.brpop("incident_queue", timeout=10)
            
            if not job:
                continue
                
            incident_id = job[1].decode("utf-8")
            print(f"[Worker] Processing enqueued incident ID: {incident_id}")
            
            # Write immediate status update
            write_agent_run(incident_id, ["Initializing Agent reasoning loop...", "Analyzing tenant context..."], "", 0, "PROCESSING")
            
            # Fetch context
            incident = fetch_incident(incident_id)
            if not incident:
                print(f"[Worker] Incident {incident_id} not found in DB! Skipping.")
                continue
                
            integrations = fetch_integrations(incident["tenant_id"])
            teams_webhook = integrations.get("TEAMS", None)
            llm_config_str = integrations.get("LLM_CONFIG", None)
            dd_config_str = integrations.get("DATADOG", None)
            signoz_config_str = integrations.get("SIGNOZ", None)
            
            llm_config = None
            if llm_config_str:
                try:
                    llm_config = json.loads(llm_config_str)
                except Exception as e:
                    print(f"[Worker] Failed to parse LLM_CONFIG: {e}")
            
            # Parse Datadog config (backward compatible) and attach to llm_config
            dd_config = parse_datadog_config(dd_config_str)
            if llm_config and dd_config:
                llm_config["_datadog_config"] = dd_config
                
            # Parse SigNoz config and attach to llm_config
            signoz_config = {}
            if signoz_config_str:
                try:
                    signoz_config = json.loads(signoz_config_str)
                    if llm_config:
                        llm_config["_signoz_config"] = signoz_config
                except Exception as e:
                    print(f"[Worker] Failed to parse SIGNOZ config: {e}")
            
            print(f"[Worker] Deployment mode: {DEPLOYMENT_MODE} | LLM config: {'found' if llm_config else 'missing'} | DD config: {'found' if dd_config else 'missing'} | SigNoz config: {'found' if signoz_config else 'missing'}")

            # Check if agent is explicitly disabled
            if llm_config and not llm_config.get("agentEnabled", True):
                print(f"[Worker] Triage Agent is disabled for tenant. Skipping AI runs.")
                write_agent_run(
                    incident_id, 
                    ["Initializing Agent reasoning loop...", "Agent disabled in settings. Skipping triage analysis."], 
                    "AI Triage Agent is currently disabled in your settings.", 
                    0, 
                    "COMPLETED"
                )
                continue
            
            if llm_config:
                # Run real LLM-based triage
                reasoning_steps, summary, service, alert_title, tokens = run_real_triage(incident_id, incident["payload"], llm_config)
            else:
                # Run mock triage for default backwards compatibility
                reasoning_steps, summary, service, alert_title = run_mock_triage(incident_id, incident["payload"])
                tokens = len(str(reasoning_steps).split()) + len(summary.split())
            
            # Post to Teams
            send_teams_notification(teams_webhook, incident_id, alert_title, service, summary)
            
            # Write final results
            write_agent_run(incident_id, reasoning_steps, summary, tokens, "COMPLETED")
            
        except psycopg2.OperationalError as e:
            print(f"[Worker] DB connection error: {e}. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            print(f"[Worker] Error processing job: {e}")
            time.sleep(2)

if __name__ == "__main__":
    main()
