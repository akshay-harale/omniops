# Project Handoff & Status Report: AI DevOps Agent Platform MVP

This document summarizes the current development status, implemented features, system architecture, and verification records for the **Alert Triage Agent MVP**, prepared for the next engineering agent.

---

## 📊 Project Status Overview

* **Objective**: Build an Alert Triage Agent MVP per the [AI DevOps Agent Master Plan.md](file:///d:/codebase/omniops/AI%20DevOps%20Agent%20Master%20Plan.md).
* **Current State**: **100% Implemented & Verified**. All services are containerized and actively running via Docker Compose.
* **Tech Stack**:
  - **Backend**: Java Spring Boot 3.3.0, Gradle 8.8, Spring Data JPA, Java 17
  - **AI Worker**: Python 3.12, Redis Queue Consumer, local log parser
  - **Frontend**: React 18 (Vite 5), Vanilla CSS space-dark glassmorphism theme
  - **Database**: PostgreSQL 15
  - **Message Broker**: Redis Alpine

---

## ⚙️ Implemented Features

### 1. Security & Authentication (OAuth2)
* **Token Exchange**: Exposes `POST /oauth/token` supporting `grant_type=password` exchanging credentials (`admin` / `admin`) for a Bearer access token.
* **Request Security Filter**: Implemented [AuthFilter.java](file:///d:/codebase/omniops/backend/src/main/java/com/omniops/backend/config/AuthFilter.java) verifying `Authorization: Bearer <token>` on all `/api/**` endpoints. Excludes OPTIONS (CORS preflight) and `/api/webhooks/**` (alert ingestion) from checks.
* **Client-side Session**: Stores tokens in `localStorage` and wraps all queries in a authenticated request handler (`fetchWithAuth()`).

### 2. Multi-Step Onboarding Wizard (Optional)
* **Stepped Workflow**: Form guided overlay walks the user through:
  - **Step 1**: Register Workspace (Tenant name and Plan tiers: Free, Growth, Enterprise).
  - **Step 2**: Connection Hub (Connect Datadog API keys & MS Teams webhooks, with loading verification latency spinners).
  - **Step 3**: Launch Application Agent (Initializes the mock log generator).
  - **Step 4**: Inject Test Alert (Triggers a test webhook to demonstrate the agent).
* **Optional Prompt**: Checks integrations on login. If empty, prompts onboarding with a "Skip / Do Later" button.

### 3. Fake Log Generator Engine
* **Microservice Traffic Logger**: A background thread in [LogGeneratorService.java](file:///d:/codebase/omniops/backend/src/main/java/com/omniops/backend/service/LogGeneratorService.java) appends simulated HTTP queries, Hikari connection stats, and database checks to a shared volume path `/shared/sample-application.log`.
* **Scrolling Log Console**: Renders a glowing monospaced green-text console widget in the React dashboard, streaming logs in real-time. Exposes toggles to start/stop logging.

### 4. Closed-Loop AI Triage Worker
* **Redis Consumer**: Polls `incident_queue` in Redis using block-popping (`brpop`).
* **Active Crash Logging**: Writes the detailed exception stack trace *directly* to the shared log file when an alert triggers (making the crash appear live in the UI terminal).
* **Log Analysis & Verdict**: Reads log context from the shared volume, executes reasoning nodes, posts Teams Adaptive Card mockups, and saves reasoning logs back to PostgreSQL.

---

## 🗺️ System Architecture

The workflow operates as follows:

```mermaid
graph TD
    FE[React Frontend :3000] -->|1. Exchange Credentials| Auth[/oauth/token/]
    Auth -->|2. Return access_token| FE
    FE -->|3. Poll Live Logs| SB[Spring Boot Backend :8081]
    SB -->|4. Read last log lines| LFile[/shared/sample-application.log/]
    
    SIM[UI Alert Simulator] -->|5. Ingest Alert| WebhookController[/api/webhooks/datadog/{id}/]
    WebhookController -->|6. Enqueue Incident ID| RD[(Redis Queue :6379)]
    
    PY[AI Python Worker] -->|7. BRPOP Job ID| RD
    PY -->|8. Append Stack Trace to| LFile
    PY -->|9. Scan log file for error context| LFile
    PY -->|10. Update Triage Verdict & Reasoning Logs| DB[(PostgreSQL :5432)]
```

---

## 📂 Project Structure

```text
d:\codebase\omniops\
├── docker-compose.yml           # Orchestrator with shared volumes mapping
├── backend/                     # Spring Boot app folder
│   ├── build.gradle             # Build specifications
│   ├── Dockerfile               # Multi-stage Gradle build script
│   └── src/main/resources/db/migration/V1__init.sql # Flyway migration script
│   └── src/main/java/.../
│       ├── config/AuthFilter    # Auth request interceptor
│       ├── controller/          # REST endpoints (Webhook, Auth, Onboarding, Triage)
│       └── service/             # LogGenerator, Incident, Tenant services
├── ai-worker/                   # Python background consumer
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py                  # Log scanner, parser, and database updater
└── frontend/                    # Vite React dashboard
    ├── Dockerfile
    ├── vite.config.js           # API proxy mapping for /api and /oauth routes
    └── src/
        ├── App.jsx              # Dashboard views, Onboarding modal, and terminal
        └── index.css            # Custom pure Vanilla CSS layout definitions
```

---

## 🚀 Port & Volume Configurations

* **Frontend**: [http://localhost:3000](http://localhost:3000) (Vite server)
* **Backend**: [http://localhost:8081](http://localhost:8081) (Tomcat server)
* **PostgreSQL**: `localhost:5432` (Credentials: `postgres` / `postgres`)
* **Redis**: `localhost:6379`
* **Shared Storage**: Volume named `shared-logs` mapped to `/shared` in the `backend` and `ai-worker` containers, containing the shared file `sample-application.log`.

---

## 🔍 Validation Log Reference

We verified the OAuth2 token gateway and NPE triage pipeline:
1. **Unauthenticated access** to `/api/incidents` returns `401 Unauthorized` block:
   `{"error": "unauthorized", "message": "Full authentication is required..."}`
2. **Access Token Generation**: Authenticated request with `admin` / `admin` returns the token:
   `"access_token": "mock-oauth2-access-token-12345"`
3. **Log Scanning Triage**: Sending alert `alert-test-npe-888` triggers the AI worker to write the stack trace to the shared volume and generate the verdict:
   `"finalSummary": "A NullPointerException occurred in IncidentService.java:23 inside gateway-service. The service attempted to read 'tenant.getPlanTier()' but the Tenant entity object was null..."`
