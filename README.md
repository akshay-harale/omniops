# OmniOps: Agentic AI-Driven AIOps Platform

OmniOps is a self-hosted AI-driven incident triage platform. It acts as an automated member of your on-call team—intercepting alerts from monitoring platforms (like SigNoz or Datadog), dynamically fetching relevant logs and exception stacktraces via integration APIs, running them through local LLM reasoning loops, and outputting actionable root-cause diagnoses.

---

## Architecture Overview

OmniOps runs as a microservices application containerized via Docker:

```
                  +-----------------------------------+
                  |        Nginx Reverse Proxy        | (Port 80)
                  +-----------------+-----------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
  +---------+---------+                            +--------+--------+
  | omniops-frontend  | (Vite React)               | omniops-backend | (Spring Boot)
  +-------------------+                            +--------+--------+
                                                            |
                                                   +--------+--------+
                                                   |  Postgres / DB  | (Persistent Volume)
                                                   +--------+--------+
                                                            |
                                                   +--------+--------+
                                                   |   Redis Queue   |
                                                   +--------+--------+
                                                            |
                                                   +--------+--------+
                                                   |    AI Worker    | (Python + Ollama)
                                                   +-----------------+
```

### Core Services
- **`proxy` (Nginx)**: The primary unified gateway exposed on port `80`. Routes `/api/*` and `/oauth/*` to the backend and `/` to the frontend dev/static server.
- **`frontend` (React + Vite)**: A premium HSL dark-mode analytics panel showing real-time ingested incidents, execution reasoning nodes, and Teams adaptive card previews.
- **`backend` (Spring Boot)**: Manages database transactions, decryption keys, integration routing, and context aggregation via API handlers.
- **`ai-worker` (Python)**: Subscribes to incident tasks queued in Redis. Pulls compiled log history from the Java backend, executes a multi-step reasoning graph, and outputs final summaries.
- **`db` (Postgres)**: Stores tenants, integrations, incidents, and audit trails. Mounted onto the named volume `db-data` for data persistence.
- **`redis`**: Coordinates tasks between the backend webserver and the AI reasoning workers.

---

## Getting Started

### Prerequisites
- **Docker & Docker Compose** installed.
- **Ollama** installed on your host machine:
  1. Download and start [Ollama](https://ollama.com/).
  2. Pull the default triage model:
     ```bash
     ollama pull llama3
     ```

### Installation
1. Clone this repository.
2. Spin up the application stack:
   ```bash
   docker-compose up -d --build
   ```
3. Open your browser and navigate to the unified endpoint:
   - **App URL**: [http://localhost/](http://localhost/)
   - **Postgres DB**: `localhost:5432` (User/Password: `postgres`/`postgres`)
   - **Redis**: `localhost:6379`

---

## Ingesting and Testing Incidents

OmniOps supports two primary ways to test and evaluate incident triage:

### 1. Alert Simulator (No external setup required)
Use the **Alert Simulator** tab in the UI to mock Datadog webhooks instantly. Clicking on any scenario (e.g. *Hikari Connection Leak* or *NPE Stack Trace*) fires an ingestion payload into the gateway. The AI worker automatically aggregates mock contexts and walks you through the step-by-step reasoning tree.

### 2. End-to-End SigNoz Telemetry Testing (Real logs)
To verify real log retrieval and parsing using a live APM environment:
1. Spin up the local SigNoz cluster inside `signoz-docker/`.
2. Instrument the Spring Boot `demo-api/` app.
3. Configure SigNoz webhooks to forward to the proxy endpoint.

For step-by-step instructions on setting this up, please follow the [SigNoz Triage Test Setup Guide](SIGNOZ_SETUP_GUIDE.md).

---

## Development

- **Local Frontend HMR**: Hot Module Replacement is fully routed through the proxy. Modifying frontend files triggers immediate updates on [http://localhost/](http://localhost/).
- **Database Migrations**: Handled via Flyway. New schemas and seed integrations (like disabling Datadog and activating SigNoz defaults) are registered in `backend/src/main/resources/db/migration/`.
