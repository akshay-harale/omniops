# **AI DevOps Agent Platform \- Master Development Plan**

This document outlines the end-to-end roadmap for building and launching the Autonomous AIOps Agent SaaS platform. It is broken down into four sequential phases to ensure a focused MVP, robust architecture, and rapid time-to-market.

## **Phase 1: Scope the Minimum Viable Product (MVP)**

The goal of the MVP is to prove core value with minimal security friction for early adopters.

### **1\. The MVP Focus: Alert Triage Agent**

Instead of launching all 5 agents (FinOps, Auto-remediation, etc.), the MVP focuses entirely on the **Alert Triage Agent**.

* **Why:** It requires only "Read-Only" API access, mitigating major security objections from enterprise clients. It solves the immediate pain point of alert fatigue.  
* **The Workflow:** Datadog Webhook → Platform Ingestion → AI Context Gathering (Logs) → AI Analysis → MS Teams Summary.

### **2\. Technology Stack**

* **Core Backend:** Java with Spring Boot 3+. Handles tenant onboarding, billing, secure credential storage, and high-throughput webhook ingestion.  
* **AI Orchestration Layer:** Python with LangGraph. Consumes queued events from the backend to run the iterative reasoning loops and interface with the LLM (GPT-4o or Claude 3.5).  
* **Frontend:** React (Next.js) for tenant dashboards and audit logs.  
* **Database:** PostgreSQL (with Row-Level Security for multi-tenancy).  
* **Message Broker:** Apache Kafka or Redis Pub/Sub for asynchronous communication between Spring Boot and Python workers.

## **Phase 2: High-Level Architecture & Database Design**

This phase maps out data flow and tenant isolation.

### **1\. System Architecture Diagram**

The following DOT diagram illustrates how an alert flows from an external monitoring system through our SaaS platform, gets processed by the AI worker, and is delivered to the engineering team.  
`digraph SystemArchitecture {`  
    `rankdir=LR;`  
    `node [shape=box, style=filled, fontname="Helvetica", color="#E2E8F0", fillcolor="#F8FAFC"];`  
    `edge [fontname="Helvetica", fontsize=10, color="#64748B"];`

    `// External Systems`  
    `Datadog [label="Datadog\n(Monitors & Alerts)", shape=cylinder, fillcolor="#FEE2E2", color="#EF4444"];`  
    `MSTeams [label="Microsoft Teams\n(Alert Destination)", shape=cylinder, fillcolor="#DBEAFE", color="#3B82F6"];`  
    `LLM [label="LLM API\n(GPT-4o/Claude)", shape=ellipse, fillcolor="#F3E8FF", color="#A855F7"];`

    `// Core Platform (Spring Boot)`  
    `subgraph cluster_backend {`  
        `label = "Core SaaS Backend (Spring Boot)";`  
        `style=dashed;`  
        `color="#94A3B8";`  
          
        `API [label="Webhook API\n(Ingestion Gateway)"];`  
        `ConfigManager [label="Tenant & Config\nManager"];`  
        `DB [label="PostgreSQL\n(Tenant DB)", shape=cylinder, fillcolor="#E0F2FE", color="#0EA5E9"];`  
    `}`

    `// AI Layer (Python)`  
    `subgraph cluster_ai {`  
        `label = "AI Execution Layer (Python)";`  
        `style=dashed;`  
        `color="#94A3B8";`  
          
        `Queue [label="Message Queue\n(Kafka)", shape=rect, fillcolor="#FEF3C7", color="#F59E0B"];`  
        `Worker [label="LangGraph Worker\n(Agent Logic)"];`  
    `}`

    `// Flow`  
    `Datadog -> API [label=" Webhook POST"];`  
    `API -> ConfigManager [label=" Validate Tenant"];`  
    `ConfigManager -> DB [label=" Fetch API Keys"];`  
    `API -> Queue [label=" Enqueue Incident"];`  
    `Queue -> Worker [label=" Consume Event"];`  
    `Worker -> DB [label=" Read Decrypted Keys"];`  
    `Worker -> Datadog [label=" Fetch Logs/Traces"];`  
    `Worker -> LLM [label=" Send Prompt + Context"];`  
    `LLM -> Worker [label=" Return Analysis"];`  
    `Worker -> MSTeams [label=" Post Formatted Reply"];`  
`}`

### **2\. Database Schema (Entity Relationship)**

The data layer must ensure strict multi-tenancy. Every core table requires a tenant\_id.  
`digraph DatabaseSchema {`  
    `rankdir=LR;`  
    `node [shape=record, fontname="Helvetica", fontsize=11];`  
      
    `Tenant [label="Tenant | <id> id (PK) | name | plan_tier | created_at"];`  
    `Integration [label="Integration | <id> id (PK) | <tenant_id> tenant_id (FK) | service_type (e.g. Datadog) | encrypted_api_key | status"];`  
    `Incident [label="Incident | <id> id (PK) | <tenant_id> tenant_id (FK) | external_alert_id | payload (JSON) | status | created_at"];`  
    `AgentRun [label="AgentRun | <id> id (PK) | <incident_id> incident_id (FK) | reasoning_steps (JSON) | final_summary | tokens_used"];`

    `Tenant:id -> Integration:tenant_id;`  
    `Tenant:id -> Incident:tenant_id;`  
    `Incident:id -> AgentRun:incident_id;`  
`}`

## **Phase 3: AI Proof of Concept (PoC) & Core Engineering**

Before the UI is built, the backend and AI systems must prove they can successfully parse an alert and avoid hallucinations.

### **1\. Spring Boot Webhook Ingestion**

* Create a REST controller POST /api/webhooks/datadog/{tenantId}.  
* Validate the payload, map the tenantId to the database, and verify the tenant's subscription status.  
* Push a sanitized JSON event to Kafka/Redis.

### **2\. Python LangGraph Agent Logic**

* **State Management:** Define a TypedDict to hold the incident state (alert context, fetched logs, current analysis).  
* **Tool Binding:** Create Python functions for fetch\_datadog\_logs(service, time\_window) and send\_teams\_message(payload).  
* **The Graph Nodes:**  
  1. extract\_entities: Parses the webhook to find the failing service.  
  2. fetch\_context: Uses the Datadog tool to pull logs.  
  3. analyze: Passes logs to the LLM to generate the root cause summary.  
  4. respond: Posts the summary to MS Teams.  
* **Security:** Ensure the agent prompt contains strict instructions to *only* use provided logs and never invent error codes.

## **Phase 4: UI/UX Wireframing & Frontend Development**

With the backend and AI functioning, the React dashboard provides the self-serve capability for customers.

### **1\. Onboarding Flow**

* **Sign Up:** User registers and creates a workspace (Tenant).  
* **Integration Hub:** A secure form where users paste their Datadog Application/API keys and Microsoft Teams webhook URLs.

### **2\. Incident Audit Dashboard**

* **Incident List:** A table showing all ingested alerts (Timestamp, Service, Agent Status).  
* **Agent Execution View:** When a user clicks an incident, they see a "split screen":  
  * *Left Side:* The original noisy Datadog payload.  
  * *Right Side:* The Agent's step-by-step reasoning ("Fetched 50 logs", "Found NullPointerException") and the final summary sent to Teams.  
* **Feedback Mechanism:** Thumbs up / Thumbs down buttons on the agent's summary to collect RLHF (Reinforcement Learning from Human Feedback) data to improve future prompts.

### **3\. Agent Configuration**

* Simple toggles for the user:  
  * "Enable Alert Triage Agent" (On/Off)  
  * "Select Target Teams Channel" (Dropdown)  
  * "Analysis Depth" (Quick Summary vs. Deep Log Analysis)