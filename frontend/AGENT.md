# AI Triage Agent Configuration (AGENT.md)

This directory houses the frontend web dashboard console for the **OmniOps AI DevOps Triage Agent** system.

## 🛠️ Architecture & Components

The interface has been modularized to ensure readability and support clean maintainability:

1.  **[App.jsx](file:///d:/codebase/omniops/frontend/src/App.jsx):**
    *   Acts as the central router, orchestrating top-level authorization (OAuth2), workspace tenant state, polling/real-time refresh loops, and navigation state.
2.  **[DashboardTab.jsx](file:///d:/codebase/omniops/frontend/src/components/DashboardTab.jsx):**
    *   Contains the incident feed checklist and audit panel.
    *   Renders real-time execution logs and displays the AI agent reasoning graphs.
    *   Supports Markdown formatting for rich analysis summaries using `react-markdown`.
3.  **[SimulatorTab.jsx](file:///d:/codebase/omniops/frontend/src/components/SimulatorTab.jsx):**
    *   Ingests test alert telemetry simulations (Hikari connection pools, OutOfMemory crashes, NullPointerExceptions, and CPU spikes) into the webhook endpoint.
4.  **[IntegrationsTab.jsx](file:///d:/codebase/omniops/frontend/src/components/IntegrationsTab.jsx):**
    *   Configures LLM providers (Local Ollama instances, Anthropic, or OpenAI endpoints).
    *   Saves rich dual-key Datadog configuration profiles along with Kubernetes cluster contexts and namespaces.
5.  **[OnboardingModal.jsx](file:///d:/codebase/omniops/frontend/src/components/OnboardingModal.jsx):**
    *   Interactive guide initializing the workspace partition, checking API gateways, and dispatching your first triage alert.

---

## ⚡ Integration Details

### Local LLM (Ollama)
Configure a local LLM under the **Integration Hub** tab:
*   **Endpoint:** `http://host.docker.internal:11434` (resolves your host machine's Ollama gateway from Docker).
*   **Model:** `gemma3:1b` (or other models pull-loaded on your system like `llama3`).
*   Ensure CORS is allowed by running Ollama with `OLLAMA_ORIGINS="*"`.
