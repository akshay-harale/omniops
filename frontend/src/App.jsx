import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, Cpu, Settings, Activity, Sparkles, ArrowRight, Shield, RefreshCw, LogOut, Lock, Loader2, Square, Play
} from 'lucide-react';
import DashboardTab from './components/DashboardTab';
import SimulatorTab from './components/SimulatorTab';
import IntegrationsTab from './components/IntegrationsTab';
import OnboardingModal from './components/OnboardingModal';

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('omniops_token') || '');
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [tenants, setTenants] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [agentRun, setAgentRun] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [simulating, setSimulating] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Login Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Live log generator state
  const [logGeneratorRunning, setLogGeneratorRunning] = useState(false);
  const [liveLogs, setLiveLogs] = useState([]);
  const terminalEndRef = useRef(null);

  // Onboarding Wizard states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [obTenantName, setObTenantName] = useState('');
  const [obPlanTier, setObPlanTier] = useState('ENTERPRISE');
  const [obTenant, setObTenant] = useState(null);
  const [obDatadogKey, setObDatadogKey] = useState('mock_datadog_api_key_' + Math.floor(Math.random() * 1000));
  const [obTeamsWebhook, setObTeamsWebhook] = useState('https://mock.teams.microsoft.com/webhook/' + Math.floor(Math.random() * 1000));
  const [testingConnection, setTestingConnection] = useState({ DD: false, TEAMS: false });
  const [connectionSuccess, setConnectionSuccess] = useState({ DD: null, TEAMS: null });
  const [onboardingMessage, setOnboardingMessage] = useState('');

  // Welcome / Optional Onboarding Modal
  const [showWelcomePrompt, setShowWelcomePrompt] = useState(false);

  // Deployment Mode (demo | production)
  const [deploymentMode, setDeploymentMode] = useState('demo');

  // Settings Forms
  const [teamsWebhook, setTeamsWebhook] = useState('');
  const [integrationStatus, setIntegrationStatus] = useState('');
  
  // Datadog Rich Config State
  const [ddApiKey, setDdApiKey] = useState('');
  const [ddAppKey, setDdAppKey] = useState('');
  const [ddSite, setDdSite] = useState('datadoghq.com');
  const [ddClusterName, setDdClusterName] = useState('');
  const [ddEnvironment, setDdEnvironment] = useState('production');
  const [ddNamespaces, setDdNamespaces] = useState('');
  const [ddDefaultTags, setDdDefaultTags] = useState('');
  const [ddLogFetchEnabled, setDdLogFetchEnabled] = useState(true);
  const [ddLogQuery, setDdLogQuery] = useState('service:{{service}} env:{{env}} status:error');
  const [ddTimeWindow, setDdTimeWindow] = useState(30);
  const [ddMaxLogLines, setDdMaxLogLines] = useState(50);
  
  // Datadog connection testing
  const [testingDatadog, setTestingDatadog] = useState(false);
  const [ddTestResult, setDdTestResult] = useState({ success: null, message: '' });

  // Feedback
  const [feedbackGiven, setFeedbackGiven] = useState({});

  // LLM Config State
  const [llmProvider, setLlmProvider] = useState('OLLAMA');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://host.docker.internal:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('claude-3-5-sonnet');
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [targetTeamsChannel, setTargetTeamsChannel] = useState('general');
  const [analysisDepth, setAnalysisDepth] = useState('DEEP'); // 'QUICK' vs 'DEEP'
  
  // Connection testing for LLM config
  const [testingLlm, setTestingLlm] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState({ success: null, message: '' });

  // Auto Scroll log terminal helper
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs]);

  // Auth Fetch wrapper
  const fetchWithAuth = (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    return fetch(url, { ...options, headers })
      .then(res => {
        if (res.status === 401) {
          handleLogout();
          throw new Error("Unauthorized");
        }
        return res;
      });
  };

  // Login handler
  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLoginError("Please enter both username and password.");
      return;
    }

    setLoginError('');
    setLoggingIn(true);

    fetch('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        username: username,
        password: password
      })
    })
      .then(res => {
        if (!res.ok) {
          throw new Error("Invalid username or password.");
        }
        return res.json();
      })
      .then(data => {
        localStorage.setItem('omniops_token', data.access_token);
        setToken(data.access_token);
        setLoggingIn(false);
        setUsername('');
        setPassword('');
      })
      .catch(err => {
        setLoggingIn(false);
        setLoginError(err.message || "Failed to authenticate.");
      });
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('omniops_token');
    setToken('');
    setSelectedIncident(null);
    setAgentRun(null);
    setIncidents([]);
    setTenants([]);
    setIntegrations([]);
  };

  // Helper to fetch tenants
  const fetchTenants = () => {
    return fetchWithAuth('/api/tenants')
      .then(res => res.json())
      .then(data => {
        setTenants(data);
        return data;
      })
      .catch(err => console.error("Error loading tenants:", err));
  };

  // Load Tenants & Integrations when logged in
  useEffect(() => {
    if (!token) return;
    
    fetchTenants()
      .then(data => {
        if (data && data.length > 0) {
          const current = data[0].id;
          setTenantId(current);
          
          fetchWithAuth(`/api/integrations/tenant/${current}`)
            .then(res => res.json())
            .then(integ => {
              setIntegrations(integ);
              if (integ.length === 0) {
                setShowWelcomePrompt(true);
              }
            });
        }
      });
      
    fetchGeneratorStatus();
  }, [token]);

  // Fetch log generator status and deployment mode
  const fetchGeneratorStatus = () => {
    if (!token) return;
    fetchWithAuth('/api/onboarding/status')
      .then(res => res.json())
      .then(data => {
        setLogGeneratorRunning(data.logGeneratorRunning);
        if (data.deploymentMode) setDeploymentMode(data.deploymentMode);
      })
      .catch(err => console.error("Error fetching status:", err));
  };

  // Poll live logs if generator is running
  useEffect(() => {
    let interval = null;
    if (token && logGeneratorRunning) {
      const getLogs = () => {
        fetchWithAuth('/api/onboarding/log-generator/logs?maxLines=35')
          .then(res => res.json())
          .then(data => setLiveLogs(data))
          .catch(err => console.error("Error fetching live logs:", err));
      };
      getLogs();
      interval = setInterval(getLogs, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [logGeneratorRunning, token]);

  // Fetch Integrations and Incident feeds
  useEffect(() => {
    if (!token || !tenantId) return;
    
    fetchWithAuth(`/api/integrations/tenant/${tenantId}`)
      .then(res => res.json())
      .then(data => {
        setIntegrations(data);
        const dd = data.find(i => i.serviceType === 'DATADOG');
        const tm = data.find(i => i.serviceType === 'TEAMS');
        setTeamsWebhook(tm ? atob(tm.encryptedApiKey) : '');
        
        if (dd) {
          try {
            const decoded = atob(dd.encryptedApiKey);
            const parsed = JSON.parse(decoded);
            if (parsed.apiKey) setDdApiKey(parsed.apiKey);
            if (parsed.applicationKey) setDdAppKey(parsed.applicationKey);
            if (parsed.site) setDdSite(parsed.site);
            if (parsed.clusterName) setDdClusterName(parsed.clusterName);
            if (parsed.environment) setDdEnvironment(parsed.environment);
            if (parsed.namespaces) setDdNamespaces(parsed.namespaces);
            if (parsed.defaultTags) setDdDefaultTags(parsed.defaultTags);
            if (parsed.logFetchEnabled !== undefined) setDdLogFetchEnabled(parsed.logFetchEnabled);
            if (parsed.logQuery) setDdLogQuery(parsed.logQuery);
            if (parsed.timeWindowMinutes) setDdTimeWindow(parsed.timeWindowMinutes);
            if (parsed.maxLogLines) setDdMaxLogLines(parsed.maxLogLines);
          } catch (e) {
            setDdApiKey(atob(dd.encryptedApiKey));
          }
        }
        
        const llmConfigInteg = data.find(i => i.serviceType === 'LLM_CONFIG');
        if (llmConfigInteg) {
          try {
            const decoded = atob(llmConfigInteg.encryptedApiKey);
            const parsed = JSON.parse(decoded);
            if (parsed.provider) setLlmProvider(parsed.provider);
            if (parsed.ollamaEndpoint) setOllamaEndpoint(parsed.ollamaEndpoint);
            if (parsed.ollamaModel) setOllamaModel(parsed.ollamaModel);
            if (parsed.openaiKey) setOpenaiKey(parsed.openaiKey);
            if (parsed.openaiModel) setOpenaiModel(parsed.openaiModel);
            if (parsed.anthropicKey) setAnthropicKey(parsed.anthropicKey);
            if (parsed.anthropicModel) setAnthropicModel(parsed.anthropicModel);
            if (parsed.agentEnabled !== undefined) setAgentEnabled(parsed.agentEnabled);
            if (parsed.targetTeamsChannel) setTargetTeamsChannel(parsed.targetTeamsChannel);
            if (parsed.analysisDepth) setAnalysisDepth(parsed.analysisDepth);
          } catch (e) {
            console.error("Error parsing LLM Config:", e);
          }
        } else {
          setLlmProvider('OLLAMA');
          setOllamaEndpoint('http://host.docker.internal:11434');
          setOllamaModel('llama3');
          setOpenaiKey('');
          setOpenaiModel('gpt-4o');
          setAnthropicKey('');
          setAnthropicModel('claude-3-5-sonnet');
          setAgentEnabled(true);
          setTargetTeamsChannel('general');
          setAnalysisDepth('DEEP');
        }
      })
      .catch(err => console.error("Error loading integrations:", err));

    fetchIncidents();
  }, [tenantId, token]);

  // Fetch Incidents feed
  const fetchIncidents = () => {
    if (!token || !tenantId) return;
    fetchWithAuth(`/api/incidents/tenant/${tenantId}`)
      .then(res => res.json())
      .then(data => {
        setIncidents(data);
        if (selectedIncident) {
          const updated = data.find(i => i.id === selectedIncident.id);
          if (updated) {
            setSelectedIncident(updated);
          }
        }
      })
      .catch(err => console.error("Error fetching incidents:", err));
  };

  // Auto-refresh incidents
  useEffect(() => {
    if (!token || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchIncidents();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedIncident, tenantId, token]);

  // Fetch Agent Run detail
  useEffect(() => {
    if (!token || !selectedIncident) {
      setAgentRun(null);
      return;
    }
    
    const fetchRun = () => {
      fetchWithAuth(`/api/agent-runs/incident/${selectedIncident.id}`)
        .then(res => {
          if (res.status === 404) return null;
          return res.json();
        })
        .then(data => {
          setAgentRun(data);
        })
        .catch(err => console.error("Error fetching agent run:", err));
    };

    fetchRun();

    if (selectedIncident.status === 'PENDING' || selectedIncident.status === 'PROCESSING') {
      const runInterval = setInterval(() => {
        fetchRun();
      }, 2000);
      return () => clearInterval(runInterval);
    }
  }, [selectedIncident, token]);

  // Save integration manually
  const saveIntegration = (type, key) => {
    if (!key) return;
    fetchWithAuth(`/api/integrations/tenant/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceType: type, apiKey: key })
    })
      .then(res => res.json())
      .then(() => {
        setIntegrationStatus(`${type} Configuration Saved successfully!`);
        setTimeout(() => setIntegrationStatus(''), 3000);
        fetchWithAuth(`/api/integrations/tenant/${tenantId}`)
          .then(res => res.json())
          .then(data => setIntegrations(data));
      })
      .catch(() => setIntegrationStatus("Failed to save configuration"));
  };

  // Save Datadog Rich Config as JSON
  const saveDatadogConfig = () => {
    const config = {
      apiKey: ddApiKey,
      applicationKey: ddAppKey,
      site: ddSite,
      clusterName: ddClusterName,
      environment: ddEnvironment,
      namespaces: ddNamespaces,
      defaultTags: ddDefaultTags,
      logFetchEnabled: ddLogFetchEnabled,
      logQuery: ddLogQuery,
      timeWindowMinutes: ddTimeWindow,
      maxLogLines: ddMaxLogLines
    };
    saveIntegration('DATADOG', JSON.stringify(config));
  };

  // Test Datadog Connection
  const testDatadogConnection = () => {
    setTestingDatadog(true);
    setDdTestResult({ success: null, message: '' });
    
    fetchWithAuth('/api/onboarding/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: 'DATADOG',
        apiKey: ddApiKey,
        applicationKey: ddAppKey,
        site: ddSite
      })
    })
      .then(res => res.json())
      .then(data => {
        setTestingDatadog(false);
        setDdTestResult({ success: data.success, message: data.message });
      })
      .catch(err => {
        setTestingDatadog(false);
        setDdTestResult({ success: false, message: 'Network error testing Datadog connection.' });
      });
  };

  // Save LLM & Agent Config
  const saveLlmConfig = () => {
    const config = {
      provider: llmProvider,
      ollamaEndpoint: ollamaEndpoint,
      ollamaModel: ollamaModel,
      openaiKey: openaiKey,
      openaiModel: openaiModel,
      anthropicKey: anthropicKey,
      anthropicModel: anthropicModel,
      agentEnabled: agentEnabled,
      targetTeamsChannel: targetTeamsChannel,
      analysisDepth: analysisDepth
    };
    
    const configStr = JSON.stringify(config);
    
    fetchWithAuth(`/api/integrations/tenant/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceType: 'LLM_CONFIG', apiKey: configStr })
    })
      .then(res => res.json())
      .then(() => {
        setIntegrationStatus("Agent and LLM Settings Saved successfully!");
        setTimeout(() => setIntegrationStatus(''), 3000);
        
        fetchWithAuth(`/api/integrations/tenant/${tenantId}`)
          .then(res => res.json())
          .then(data => setIntegrations(data));
      })
      .catch(() => setIntegrationStatus("Failed to save LLM configuration"));
  };

  // Test LLM Connection
  const testLlmConnection = () => {
    setTestingLlm(true);
    setLlmTestResult({ success: null, message: '' });
    
    let targetService = llmProvider;
    let apiKeyVal = '';
    
    if (llmProvider === 'OLLAMA') {
      apiKeyVal = ollamaEndpoint;
    } else if (llmProvider === 'OPENAI') {
      apiKeyVal = openaiKey;
    } else if (llmProvider === 'ANTHROPIC') {
      apiKeyVal = anthropicKey;
    }
    
    fetchWithAuth('/api/onboarding/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceType: targetService, apiKey: apiKeyVal })
    })
      .then(res => res.json())
      .then(data => {
        setTestingLlm(false);
        setLlmTestResult({ success: data.success, message: data.message });
      })
      .catch(err => {
        setTestingLlm(false);
        setLlmTestResult({ success: false, message: "Network error testing connection." });
      });
  };

  // Toggle log generator
  const toggleLogGenerator = () => {
    const endpoint = logGeneratorRunning 
      ? '/api/onboarding/log-generator/stop' 
      : '/api/onboarding/log-generator/start';
    
    fetchWithAuth(endpoint, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        setLogGeneratorRunning(data.status === 'RUNNING');
        fetchGeneratorStatus();
      })
      .catch(err => console.error("Error toggling log generator:", err));
  };

  // Trigger simulated alerts
  const triggerSimulation = (type) => {
    setSimulating(true);
    let payload = {};
    const alertId = "alert-" + Math.floor(Math.random() * 100000);

    const cluster = ddClusterName || 'production-us-east-1';
    const env = ddEnvironment || 'production';

    if (type === 'db_leak') {
      payload = {
        id: alertId,
        event_title: "HikariPool-1 - Connection acquisition timeout on auth-service",
        event_type: "metric_alert",
        alert_status: "critical",
        alert_priority: "P1",
        service: "auth-service",
        body: "Active connections reached pool max (100/100). Connection leak suspected.",
        alert_query: "avg(last_5m):avg:hikaricp.connections.active{service:auth-service} > 95",
        alert_scope: `kube_cluster:${cluster},kube_namespace:auth,pod_name:auth-api-7c8b9d4f6-x2k9p,container_name:auth-api,env:${env}`,
        trigger_time: new Date().toISOString()
      };
    } else if (type === 'npe') {
      payload = {
        id: alertId,
        event_title: "NullPointerException in user profile controller",
        event_type: "exception_alert",
        alert_status: "error",
        alert_priority: "P2",
        service: "gateway-service",
        body: "HTTP 500 thrown on GET /api/users/profile. Null entity reference at line 23.",
        alert_query: "logs(\"service:gateway-service status:error\").rollup(\"count\").last(\"5m\") > 10",
        alert_scope: `kube_cluster:${cluster},kube_namespace:gateway,pod_name:gateway-svc-5a9c8e3d1-q7m3t,container_name:gateway-api,env:${env}`,
        trigger_time: new Date().toISOString()
      };
    } else if (type === 'cpu') {
      payload = {
        id: alertId,
        event_title: "Sustained high CPU usage (>90%) on order-service",
        event_type: "infrastructure_alert",
        alert_status: "warning",
        alert_priority: "P2",
        service: "order-service",
        body: "System CPU load is at 94.2% on node-21b7. High thread lock contention.",
        alert_query: "avg(last_10m):avg:system.cpu.user{service:order-service} > 90",
        alert_scope: `kube_cluster:${cluster},kube_namespace:orders,pod_name:order-svc-3b7d4e2f8-n1k5w,container_name:order-api,env:${env},host:node-21b7`,
        trigger_time: new Date().toISOString()
      };
    } else if (type === 'oom') {
      payload = {
        id: alertId,
        event_title: "OutOfMemoryError: Java heap space crash",
        event_type: "container_alert",
        alert_status: "critical",
        alert_priority: "P1",
        service: "payment-service",
        body: "Payment ingestion JVM crashed due to heap exhaustion. Memory leak suspected.",
        alert_query: "avg(last_5m):avg:jvm.heap_memory_max{service:payment-service} - avg:jvm.heap_memory{service:payment-service} < 52428800",
        alert_scope: `kube_cluster:${cluster},kube_namespace:payments,pod_name:payment-svc-9e1f6a4c2-h8j2p,container_name:payment-api,env:${env}`,
        trigger_time: new Date().toISOString()
      };
    }

    fetch(`/api/webhooks/datadog/${tenantId}?alertId=${alertId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        setSimulating(false);
        setActiveTab('dashboard');
        setSelectedIncident(data);
        fetchIncidents();
      })
      .catch(err => {
        setSimulating(false);
        console.error("Simulation failed:", err);
      });
  };

  // ONBOARDING WIZARD METHODS
  const handleOnboardingNext = () => {
    if (onboardingStep === 1) {
      if (!obTenantName.trim()) {
        setOnboardingMessage("Workspace name is required.");
        return;
      }
      setOnboardingMessage('');
      fetchWithAuth('/api/onboarding/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: obTenantName, planTier: obPlanTier })
      })
        .then(res => res.json())
        .then(data => {
          setObTenant(data);
          setTenantId(data.id);
          fetchTenants();
          setOnboardingStep(2);
        })
        .catch(err => setOnboardingMessage("Failed to create workspace: " + err));
    } 
    else if (onboardingStep === 2) {
      const targetId = obTenant ? obTenant.id : tenantId;
      
      const defaultDdConfig = {
        apiKey: obDatadogKey,
        applicationKey: '',
        site: 'datadoghq.com',
        clusterName: 'demo-cluster',
        environment: 'production',
        namespaces: 'payments, auth, gateway, orders',
        defaultTags: 'team:platform',
        logFetchEnabled: true,
        logQuery: 'service:{{service}} env:{{env}} status:error',
        timeWindowMinutes: 30,
        maxLogLines: 50
      };
      
      const saveDD = fetchWithAuth(`/api/integrations/tenant/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: 'DATADOG', apiKey: JSON.stringify(defaultDdConfig) })
      });

      const saveTeams = fetchWithAuth(`/api/integrations/tenant/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: 'TEAMS', apiKey: obTeamsWebhook })
      });

      const defaultLlm = {
        provider: 'OLLAMA',
        ollamaEndpoint: 'http://host.docker.internal:11434',
        ollamaModel: 'gemma3:1b',
        agentEnabled: true,
        targetTeamsChannel: 'general',
        analysisDepth: 'DEEP'
      };
      
      const saveLlm = fetchWithAuth(`/api/integrations/tenant/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: 'LLM_CONFIG', apiKey: JSON.stringify(defaultLlm) })
      });

      Promise.all([saveDD, saveTeams, saveLlm])
        .then(() => {
          setOnboardingStep(3);
          fetchWithAuth('/api/onboarding/log-generator/start', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
              setLogGeneratorRunning(data.status === 'RUNNING');
              fetchGeneratorStatus();
            });
        })
        .catch(err => setOnboardingMessage("Failed to save credentials."));
    } 
    else if (onboardingStep === 3) {
      setOnboardingStep(4);
    }
  };

  const testOnboardingConnection = (service) => {
    setTestingConnection(prev => ({ ...prev, [service]: true }));
    const apiKey = service === 'DD' ? obDatadogKey : obTeamsWebhook;
    
    fetchWithAuth('/api/onboarding/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceType: service === 'DD' ? 'DATADOG' : 'TEAMS', apiKey: apiKey })
    })
      .then(res => res.json())
      .then(data => {
        setTestingConnection(prev => ({ ...prev, [service]: false }));
        setConnectionSuccess(prev => ({ ...prev, [service]: data.success }));
      })
      .catch(() => {
        setTestingConnection(prev => ({ ...prev, [service]: false }));
        setConnectionSuccess(prev => ({ ...prev, [service]: false }));
      });
  };

  const getStatusBadgeElement = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-pending">Pending</span>;
      case 'PROCESSING':
        return <span className="badge badge-processing">Analyzing...</span>;
      case 'COMPLETED':
        return <span className="badge badge-completed">Triage Done</span>;
      case 'FAILED':
        return <span className="badge badge-failed">Failed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const handleRLHF = (incidentId, rate) => {
    setFeedbackGiven(prev => ({ ...prev, [incidentId]: rate }));
  };

  if (!token) {
    return (
      <div className="login-page">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="login-card glass-panel" style={{ background: 'rgba(13, 17, 30, 0.9)' }}>
          <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div className="brand-icon-wrapper" style={{ width: '48px', height: '48px', borderRadius: '12px' }}>
              <Cpu style={{ width: '24px', height: '24px', color: 'white' }} />
            </div>
            <h2 className="bold" style={{ fontSize: '1.4rem', color: 'white', marginTop: '8px' }}>OmniOps Portal</h2>
            <p className="text-gray-400 text-xs">Autonomous DevOps Triage Agent Sandbox</p>
          </div>

          {loginError && (
            <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--color-danger)', textAlign: 'center' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                placeholder="Enter username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input" 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                placeholder="Enter password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input" 
              />
            </div>

            <button type="submit" className="btn-neon w-full bold text-sm" style={{ marginTop: '8px', padding: '12px' }} disabled={loggingIn}>
              {loggingIn ? (
                <>
                  <Loader2 className="animate-spin" style={{ width: '16px', height: '16px' }} />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock style={{ width: '14px', height: '14px' }} />
                  Log In (OAuth2)
                </>
              )}
            </button>
          </form>

          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px', fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="bold" style={{ color: 'white' }}>Sandbox Authentication:</div>
            <div>Exchange user password tokens via <code>POST /oauth/token</code>.</div>
            <div style={{ fontStyle: 'italic', marginTop: '4px' }}>Default Credentials: <strong>admin</strong> / <strong>admin</strong></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* Top Header Navigation */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon-wrapper">
            <Cpu style={{ width: '20px', height: '20px', color: 'white' }} />
          </div>
          <div>
            <h1 className="brand-title">
              OmniOps <span className="text-xs" style={{ color: 'var(--color-secondary-light)', border: '1px solid rgba(6,182,212,0.3)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MVP</span>
            </h1>
            <p className="brand-subtitle">Autonomous AIOps Alert Triage Agent</p>
          </div>
        </div>

        {/* Tenant Selector & Header Buttons */}
        <div className="header-actions">
          <button 
            onClick={() => {
              setOnboardingStep(1);
              setObTenantName('');
              setConnectionSuccess({ DD: null, TEAMS: null });
              setShowOnboarding(true);
            }}
            className="btn-secondary text-xs"
            style={{ borderColor: 'rgba(95, 90, 247, 0.3)' }}
          >
            <Sparkles style={{ width: '13px', height: '13px', color: 'var(--color-primary-light)' }} />
            Onboarding Setup
          </button>

          <div className="flex align-center gap-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}>
            <Shield style={{ width: '14px', height: '14px', color: 'var(--color-primary-light)' }} />
            <select 
              value={tenantId} 
              onChange={(e) => setTenantId(e.target.value)}
              style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id} style={{ background: '#0d111e', color: 'white' }}>{t.name}</option>
              ))}
              {tenants.length === 0 && (
                <option value={DEFAULT_TENANT_ID} style={{ background: '#0d111e', color: 'white' }}>Default Enterprise Tenant</option>
              )}
            </select>
          </div>

          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="btn-secondary text-xs"
            style={autoRefresh ? { borderColor: 'rgba(6,182,212,0.3)', color: 'var(--color-secondary-light)' } : {}}
          >
            <RefreshCw style={{ width: '13px', height: '13px' }} className={autoRefresh ? 'animate-spin' : ''} />
            {autoRefresh ? 'Live Autorefresh' : 'Refresh Paused'}
          </button>

          <button 
            onClick={handleLogout}
            className="btn-secondary text-xs"
            style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
            title="Log out from session"
          >
            <LogOut style={{ width: '13px', height: '13px' }} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="app-body">
        
        {/* Sidebar Navigation */}
        <aside className="app-sidebar">
          <p className="sidebar-title">Navigation</p>
          
          <button 
            onClick={() => { setActiveTab('dashboard'); setSelectedIncident(null); }}
            className={`sidebar-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <Activity style={{ width: '16px', height: '16px' }} />
            Incident Dashboard
          </button>

          <button 
            onClick={() => setActiveTab('simulator')}
            className={`sidebar-nav-btn ${activeTab === 'simulator' ? 'active' : ''}`}
          >
            <Terminal style={{ width: '16px', height: '16px' }} />
            Alert Simulator
          </button>

          <button 
            onClick={() => setActiveTab('integrations')}
            className={`sidebar-nav-btn ${activeTab === 'integrations' ? 'active' : ''}`}
          >
            <Settings style={{ width: '16px', height: '16px' }} />
            Integration Hub
          </button>

          {/* Log Generator Control Panel */}
          <div className="sidebar-footer-widget" style={{ marginTop: 'auto' }}>
            <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
              <span className="bold text-xs" style={{ color: 'var(--text-secondary)' }}>Log Generator</span>
              <span 
                style={{ 
                  display: 'inline-block',
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: logGeneratorRunning ? 'var(--color-success)' : 'var(--color-danger)'
                }} 
              />
            </div>
            <p className="text-gray-400" style={{ fontSize: '0.7rem', lineHeight: '1.4', marginBottom: '10px' }}>
              Appends fake service traffic logs to `/shared/sample-application.log`.
            </p>
            <button 
              onClick={toggleLogGenerator}
              className="btn-secondary text-xs w-full"
              style={logGeneratorRunning ? { color: 'var(--color-danger)' } : { color: 'var(--color-success)' }}
            >
              {logGeneratorRunning ? <Square style={{ width: '12px', height: '12px' }} /> : <Play style={{ width: '12px', height: '12px' }} />}
              {logGeneratorRunning ? 'Stop Simulator' : 'Start Simulator'}
            </button>
          </div>
        </aside>

        {/* Central Workspace content */}
        <main className="main-workspace">
          {activeTab === 'dashboard' && (
            <DashboardTab 
              liveLogs={liveLogs}
              logGeneratorRunning={logGeneratorRunning}
              terminalEndRef={terminalEndRef}
              fetchIncidents={fetchIncidents}
              incidents={incidents}
              selectedIncident={selectedIncident}
              setSelectedIncident={setSelectedIncident}
              agentRun={agentRun}
              getStatusBadgeElement={getStatusBadgeElement}
              feedbackGiven={feedbackGiven}
              handleRLHF={handleRLHF}
            />
          )}

          {activeTab === 'simulator' && (
            <SimulatorTab 
              triggerSimulation={triggerSimulation}
              simulating={simulating}
            />
          )}

          {activeTab === 'integrations' && (
            <IntegrationsTab 
              integrationStatus={integrationStatus}
              deploymentMode={deploymentMode}
              ddApiKey={ddApiKey}
              setDdApiKey={setDdApiKey}
              ddAppKey={ddAppKey}
              setDdAppKey={setDdAppKey}
              ddSite={ddSite}
              setDdSite={setDdSite}
              testingDatadog={testingDatadog}
              testDatadogConnection={testDatadogConnection}
              ddTestResult={ddTestResult}
              ddClusterName={ddClusterName}
              setDdClusterName={setDdClusterName}
              ddEnvironment={ddEnvironment}
              setDdEnvironment={setDdEnvironment}
              ddNamespaces={ddNamespaces}
              setDdNamespaces={setDdNamespaces}
              ddDefaultTags={ddDefaultTags}
              setDdDefaultTags={setDdDefaultTags}
              ddLogFetchEnabled={ddLogFetchEnabled}
              setDdLogFetchEnabled={setDdLogFetchEnabled}
              ddLogQuery={ddLogQuery}
              setDdLogQuery={setDdLogQuery}
              ddTimeWindow={ddTimeWindow}
              setDdTimeWindow={setDdTimeWindow}
              ddMaxLogLines={ddMaxLogLines}
              setDdMaxLogLines={setDdMaxLogLines}
              saveDatadogConfig={saveDatadogConfig}
              teamsWebhook={teamsWebhook}
              setTeamsWebhook={setTeamsWebhook}
              saveIntegration={saveIntegration}
              llmProvider={llmProvider}
              setLlmProvider={setLlmProvider}
              setLlmTestResult={setLlmTestResult}
              ollamaEndpoint={ollamaEndpoint}
              setOllamaEndpoint={setOllamaEndpoint}
              ollamaModel={ollamaModel}
              setOllamaModel={setOllamaModel}
              openaiKey={openaiKey}
              setOpenaiKey={setOpenaiKey}
              openaiModel={openaiModel}
              setOpenaiModel={setOpenaiModel}
              anthropicKey={anthropicKey}
              setAnthropicKey={setAnthropicKey}
              anthropicModel={anthropicModel}
              setAnthropicModel={setAnthropicModel}
              agentEnabled={agentEnabled}
              setAgentEnabled={setAgentEnabled}
              targetTeamsChannel={targetTeamsChannel}
              setTargetTeamsChannel={setTargetTeamsChannel}
              analysisDepth={analysisDepth}
              setAnalysisDepth={setAnalysisDepth}
              llmTestResult={llmTestResult}
              testingLlm={testingLlm}
              testLlmConnection={testLlmConnection}
              saveLlmConfig={saveLlmConfig}
            />
          )}
        </main>
      </div>

      {/* WELCOME / OPTIONAL ONBOARDING PROMPT */}
      {showWelcomePrompt && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content-panel" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
              <div className="brand-icon-wrapper" style={{ width: '44px', height: '44px', borderRadius: '10px' }}>
                <Sparkles style={{ width: '22px', height: '22px', color: 'white' }} />
              </div>
              <h3 style={{ color: 'white', fontSize: '1.1rem' }}>Welcome to OmniOps Sandbox!</h3>
              <p className="text-gray-400 text-xs" style={{ lineHeight: '1.5' }}>
                Your workspace database partition has been initialized. To see the AI agent actively triage errors in real-time, we recommend setting up mock credentials and log streams.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={() => {
                  setShowWelcomePrompt(false);
                  setOnboardingStep(1);
                  setShowOnboarding(true);
                }}
                className="btn-neon text-sm bold"
                style={{ padding: '12px' }}
              >
                Launch Onboarding Wizard
                <ArrowRight style={{ width: '14px', height: '14px' }} />
              </button>
              <button 
                onClick={() => setShowWelcomePrompt(false)}
                className="btn-secondary text-sm"
                style={{ padding: '10px' }}
              >
                Later / Go directly to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING MODAL OVERLAY */}
      {showOnboarding && (
        <OnboardingModal 
          onboardingStep={onboardingStep}
          setOnboardingStep={setOnboardingStep}
          onboardingMessage={onboardingMessage}
          obTenantName={obTenantName}
          setObTenantName={setObTenantName}
          obPlanTier={obPlanTier}
          setObPlanTier={setObPlanTier}
          handleOnboardingNext={handleOnboardingNext}
          connectionSuccess={connectionSuccess}
          obDatadogKey={obDatadogKey}
          setObDatadogKey={setObDatadogKey}
          obTeamsWebhook={obTeamsWebhook}
          setObTeamsWebhook={setObTeamsWebhook}
          testingConnection={testingConnection}
          testOnboardingConnection={testOnboardingConnection}
          liveLogs={liveLogs}
          terminalEndRef={terminalEndRef}
          setShowOnboarding={setShowOnboarding}
          triggerSimulation={triggerSimulation}
        />
      )}

      {/* Footer bar */}
      <footer className="footer-bar">
        <p>© 2026 OmniOps. All rights reserved.</p>
        <div className="flex gap-4">
          <span className="flex align-center gap-2">
            <Shield style={{ width: '13px', height: '13px', color: 'var(--color-success)' }} />
            Secure Sandbox Mode
          </span>
          <span className="flex align-center gap-2">
            <Activity style={{ width: '13px', height: '13px', color: 'var(--color-secondary-light)' }} />
            Platform API: v0.1.0
          </span>
        </div>
      </footer>
    </div>
  );
}
