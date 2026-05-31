import React, { useState } from 'react';
import { Send, Activity, Loader2, Check, Sparkles, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';

export default function IntegrationsTab({
  integrationStatus,
  deploymentMode,
  ddApiKey,
  setDdApiKey,
  ddAppKey,
  setDdAppKey,
  ddEnabled,
  setDdEnabled,
  ddSite,
  setDdSite,
  testingDatadog,
  testDatadogConnection,
  ddTestResult,
  ddClusterName,
  setDdClusterName,
  ddEnvironment,
  setDdEnvironment,
  ddNamespaces,
  setDdNamespaces,
  ddDefaultTags,
  setDdDefaultTags,
  ddLogFetchEnabled,
  setDdLogFetchEnabled,
  ddLogQuery,
  setDdLogQuery,
  ddTimeWindow,
  setDdTimeWindow,
  ddMaxLogLines,
  setDdMaxLogLines,
  saveDatadogConfig,
  teamsWebhook,
  setTeamsWebhook,
  saveIntegration,
  llmProvider,
  setLlmProvider,
  setLlmTestResult,
  ollamaEndpoint,
  setOllamaEndpoint,
  ollamaModel,
  setOllamaModel,
  openaiKey,
  setOpenaiKey,
  openaiModel,
  setOpenaiModel,
  anthropicKey,
  setAnthropicKey,
  anthropicModel,
  setAnthropicModel,
  agentEnabled,
  setAgentEnabled,
  targetTeamsChannel,
  setTargetTeamsChannel,
  analysisDepth,
  setAnalysisDepth,
  llmTestResult,
  testingLlm,
  testLlmConnection,
  saveLlmConfig,
  signozHost,
  setSignozHost,
  signozToken,
  setSignozToken,
  signozEnvironment,
  setSignozEnvironment,
  signozLogFetchEnabled,
  setSignozLogFetchEnabled,
  signozEnabled,
  setSignozEnabled,
  testingSignoz,
  testSignozConnection,
  signozTestResult,
  saveSignozConfig
}) {
  const [ddExpanded, setDdExpanded] = useState(true);
  const [signozExpanded, setSignozExpanded] = useState(false);

  const canSaveDatadog = !ddEnabled || (ddTestResult && ddTestResult.success);
  const canSaveSignoz = !signozEnabled || (signozTestResult && signozTestResult.success);

  return (
    <div className="flex flex-col gap-6 animate-slide-in" style={{ maxWidth: '600px' }}>
      <div>
        <h2>Tenant Integration Hub</h2>
        <p className="text-sm text-gray-400">Configure connection settings and API secret keys for this workspace partition.</p>
      </div>

      {integrationStatus && (
        <div style={{ padding: '12px', background: 'rgba(95,90,247,0.1)', border: '1px solid rgba(95,90,247,0.2)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--color-primary-light)' }}>
          {integrationStatus}
        </div>
      )}

      {/* Form 1: Datadog Integration Config */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex align-center gap-3" style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setDdExpanded(!ddExpanded)}>
            {ddExpanded ? <ChevronDown size={16} color="white" /> : <ChevronRight size={16} color="white" />}
          </div>
          <div style={{ background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.3)', padding: '6px 10px', borderRadius: '4px', color: '#c084fc', fontSize: '0.75rem', fontWeight: '800' }}>DD</div>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setDdExpanded(!ddExpanded)}>
            <h3 style={{ fontSize: '0.9rem', color: 'white' }}>Datadog Integration</h3>
            <p className="text-gray-500" style={{ fontSize: '0.7rem' }}>API credentials and logs</p>
          </div>
          
          <div className="flex align-center gap-2">
            <span style={{ fontSize: '0.7rem', color: ddEnabled ? 'var(--color-success)' : 'var(--text-secondary)' }}>
              {ddEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <div 
              onClick={() => setDdEnabled(!ddEnabled)}
              style={{
                width: '36px', height: '18px',
                background: ddEnabled ? 'var(--color-success)' : 'rgba(255,255,255,0.1)',
                borderRadius: '9px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s'
              }}
            >
              <div style={{
                width: '14px', height: '14px', background: 'white', borderRadius: '50%',
                position: 'absolute', top: '2px',
                left: ddEnabled ? '20px' : '2px', transition: 'left 0.2s'
              }} />
            </div>
          </div>
        </div>

        {ddExpanded && (
          <div className="flex flex-col gap-4 animate-slide-in">

        {/* Credentials Section */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '8px' }} className="flex flex-col gap-4">
          <div className="bold text-xs" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>API Credentials</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">API Key</label>
              <input 
                type="password" 
                placeholder="dd-api-key-xxxxx" 
                value={ddApiKey}
                onChange={(e) => setDdApiKey(e.target.value)}
                className="form-input" 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Application Key {deploymentMode === 'production' && <span style={{ color: 'var(--color-danger)' }}>*</span>}</label>
              <input 
                type="password" 
                placeholder={deploymentMode === 'demo' ? '(optional in demo mode)' : 'dd-app-key-xxxxx'}
                value={ddAppKey}
                onChange={(e) => setDdAppKey(e.target.value)}
                className="form-input" 
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="form-label">Datadog Site / Region</label>
            <select 
              value={ddSite} 
              onChange={(e) => setDdSite(e.target.value)}
              className="form-input"
              style={{ background: '#0a0d17', color: 'white' }}
            >
              <option value="datadoghq.com">US1 — datadoghq.com (Default)</option>
              <option value="datadoghq.eu">EU1 — datadoghq.eu</option>
              <option value="us3.datadoghq.com">US3 — us3.datadoghq.com</option>
              <option value="us5.datadoghq.com">US5 — us5.datadoghq.com</option>
              <option value="ap1.datadoghq.com">AP1 — ap1.datadoghq.com</option>
            </select>
          </div>

          {/* Test Connection */}
          <div className="flex align-center gap-3">
            <button onClick={testDatadogConnection} className="btn-secondary text-xs" disabled={testingDatadog || !ddApiKey}>
              {testingDatadog ? (
                <><Loader2 className="animate-spin" style={{ width: '12px', height: '12px' }} /> Testing...</>
              ) : (
                <><Activity style={{ width: '12px', height: '12px' }} /> Test Connection</>
              )}
            </button>
            {ddTestResult.message && (
              <span className="text-xs" style={{ color: ddTestResult.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {ddTestResult.success ? <Check style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: 'middle' }} /> : null} {ddTestResult.message}
              </span>
            )}
          </div>
        </div>

        {/* Infrastructure Context Section */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '8px' }} className="flex flex-col gap-4">
          <div className="bold text-xs" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Infrastructure Context (Kubernetes)</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Cluster Name</label>
              <input 
                type="text" 
                placeholder="e.g. production-us-east-1" 
                value={ddClusterName}
                onChange={(e) => setDdClusterName(e.target.value)}
                className="form-input" 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Environment</label>
              <select 
                value={ddEnvironment} 
                onChange={(e) => setDdEnvironment(e.target.value)}
                className="form-input"
                style={{ background: '#0a0d17', color: 'white' }}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="form-label">Namespaces <span className="text-gray-500" style={{ fontWeight: '400' }}>(comma-separated)</span></label>
            <input 
              type="text" 
              placeholder="e.g. payments, auth, gateway, orders" 
              value={ddNamespaces}
              onChange={(e) => setDdNamespaces(e.target.value)}
              className="form-input" 
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="form-label">Default Tags <span className="text-gray-500" style={{ fontWeight: '400' }}>(comma-separated key:value)</span></label>
            <input 
              type="text" 
              placeholder="e.g. team:platform, region:us-east" 
              value={ddDefaultTags}
              onChange={(e) => setDdDefaultTags(e.target.value)}
              className="form-input" 
            />
          </div>
        </div>

        {/* Log Fetching Configuration */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '8px' }} className="flex flex-col gap-4">
          <div className="flex align-center justify-between">
            <div className="bold text-xs" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Log Fetching</div>
            <div 
              onClick={() => setDdLogFetchEnabled(!ddLogFetchEnabled)}
              style={{
                width: '36px', height: '18px',
                background: ddLogFetchEnabled ? 'var(--color-success)' : 'rgba(255,255,255,0.1)',
                borderRadius: '9px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s'
              }}
            >
              <div style={{
                width: '14px', height: '14px', background: 'white', borderRadius: '50%',
                position: 'absolute', top: '2px',
                left: ddLogFetchEnabled ? '20px' : '2px', transition: 'left 0.2s'
              }} />
            </div>
          </div>
          
          {ddLogFetchEnabled && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="form-label">Log Query Template</label>
                <input 
                  type="text" 
                  value={ddLogQuery}
                  onChange={(e) => setDdLogQuery(e.target.value)}
                  className="form-input font-mono" 
                  style={{ fontSize: '0.78rem' }}
                />
                <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Use {'{{service}}'} and {'{{env}}'} as placeholders. They'll be substituted with alert context.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="flex flex-col gap-1.5">
                  <label className="form-label">Time Window</label>
                  <select 
                    value={ddTimeWindow} 
                    onChange={(e) => setDdTimeWindow(Number(e.target.value))}
                    className="form-input"
                    style={{ background: '#0a0d17', color: 'white' }}
                  >
                    <option value={15}>Last 15 minutes</option>
                    <option value={30}>Last 30 minutes</option>
                    <option value={60}>Last 1 hour</option>
                    <option value={120}>Last 2 hours</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="form-label">Max Log Lines</label>
                  <input 
                    type="number" 
                    min="10" max="200" step="10"
                    value={ddMaxLogLines}
                    onChange={(e) => setDdMaxLogLines(Number(e.target.value))}
                    className="form-input" 
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button 
            onClick={saveDatadogConfig} 
            className="btn-neon text-xs"
            disabled={!canSaveDatadog}
            style={{ opacity: canSaveDatadog ? 1 : 0.5, cursor: canSaveDatadog ? 'pointer' : 'not-allowed' }}
          >
            <Send style={{ width: '12px', height: '12px' }} />
            Save Datadog Configuration
          </button>
        </div>
        </div>
        )}
      </div>

      {/* Form 1.5: SigNoz Integration Config */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex align-center gap-3" style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setSignozExpanded(!signozExpanded)}>
            {signozExpanded ? <ChevronDown size={16} color="white" /> : <ChevronRight size={16} color="white" />}
          </div>
          <div style={{ background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.3)', padding: '6px 10px', borderRadius: '4px', color: '#f97316', fontSize: '0.75rem', fontWeight: '800' }}>SN</div>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSignozExpanded(!signozExpanded)}>
            <h3 style={{ fontSize: '0.9rem', color: 'white' }}>SigNoz Integration</h3>
            <p className="text-gray-500" style={{ fontSize: '0.7rem' }}>API credentials and logs</p>
          </div>
          
          <div className="flex align-center gap-2">
            <span style={{ fontSize: '0.7rem', color: signozEnabled ? 'var(--color-success)' : 'var(--text-secondary)' }}>
              {signozEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <div 
              onClick={() => setSignozEnabled(!signozEnabled)}
              style={{
                width: '36px', height: '18px',
                background: signozEnabled ? 'var(--color-success)' : 'rgba(255,255,255,0.1)',
                borderRadius: '9px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s'
              }}
            >
              <div style={{
                width: '14px', height: '14px', background: 'white', borderRadius: '50%',
                position: 'absolute', top: '2px',
                left: signozEnabled ? '20px' : '2px', transition: 'left 0.2s'
              }} />
            </div>
          </div>
        </div>

        {signozExpanded && (
          <div className="flex flex-col gap-4 animate-slide-in">

        {/* Credentials Section */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '8px' }} className="flex flex-col gap-4">
          <div className="bold text-xs" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SigNoz Setup</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Host URL</label>
              <input 
                type="text" 
                placeholder="http://host.docker.internal:8080" 
                value={signozHost}
                onChange={(e) => setSignozHost(e.target.value)}
                className="form-input" 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Service API Token <span style={{ color: 'var(--color-primary-light)' }}>*</span></label>
              <input 
                type="password" 
                placeholder="Create key in SigNoz & paste here"
                value={signozToken}
                onChange={(e) => setSignozToken(e.target.value)}
                className="form-input" 
              />
            </div>
          </div>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
            Please create an API Access Token in SigNoz (Settings &rarr; Access Tokens) and enter it above to enable log fetches.
          </p>
          </div>

        {/* Infrastructure Context Section */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '8px' }} className="flex flex-col gap-4">
          <div className="bold text-xs" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Infrastructure Context</div>
          <div className="flex flex-col gap-1.5">
            <label className="form-label">Environment</label>
            <select 
              value={signozEnvironment} 
              onChange={(e) => setSignozEnvironment(e.target.value)}
              className="form-input"
              style={{ background: '#0a0d17', color: 'white' }}
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
        </div>
        
        {/* Log Fetching Configuration */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '8px' }} className="flex flex-col gap-4">
          <div className="flex align-center justify-between">
            <div className="bold text-xs" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enable AI Log Fetching</div>
            <div 
              onClick={() => setSignozLogFetchEnabled(!signozLogFetchEnabled)}
              style={{
                width: '36px', height: '18px',
                background: signozLogFetchEnabled ? 'var(--color-success)' : 'rgba(255,255,255,0.1)',
                borderRadius: '9px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s'
              }}
            >
              <div style={{
                width: '14px', height: '14px', background: 'white', borderRadius: '50%',
                position: 'absolute', top: '2px',
                left: signozLogFetchEnabled ? '20px' : '2px', transition: 'left 0.2s'
              }} />
            </div>
          </div>
        </div>

        {/* Test Connection */}
        <div className="flex align-center gap-3">
          <button onClick={testSignozConnection} className="btn-secondary text-xs" disabled={testingSignoz || !signozHost}>
            {testingSignoz ? (
              <><Loader2 className="animate-spin" style={{ width: '12px', height: '12px' }} /> Testing...</>
            ) : (
              <><Activity style={{ width: '12px', height: '12px' }} /> Test Connection</>
            )}
          </button>
          {signozTestResult.message && (
            <span className="text-xs" style={{ color: signozTestResult.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {signozTestResult.success ? <Check style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: 'middle' }} /> : null} {signozTestResult.message}
            </span>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button 
            onClick={saveSignozConfig} 
            className="btn-neon text-xs" 
            disabled={!canSaveSignoz}
            style={{ 
              background: 'linear-gradient(45deg, #ea580c, #f97316)',
              opacity: canSaveSignoz ? 1 : 0.5,
              cursor: canSaveSignoz ? 'pointer' : 'not-allowed'
            }}
          >
            <Send style={{ width: '12px', height: '12px' }} />
            Save SigNoz Configuration
          </button>
        </div>
        </div>
        )}
      </div>

      {/* Form 2: Microsoft Teams */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex align-center gap-3" style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
          <div style={{ background: 'rgba(95,90,247,0.1)', border: '1px solid rgba(95,90,247,0.3)', padding: '6px', borderRadius: '4px', color: 'var(--color-primary-light)' }}>
            <MessageSquare style={{ width: '16px', height: '16px' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.9rem', color: 'white' }}>Microsoft Teams Connector</h3>
            <p className="text-gray-500" style={{ fontSize: '0.7rem' }}>Define channels where the agent delivers adaptive card reviews</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="form-label">Incoming Webhook URL</label>
          <input 
            type="text" 
            placeholder="https://yourtenant.webhook.office.com/webhookb2/..." 
            value={teamsWebhook}
            onChange={(e) => setTeamsWebhook(e.target.value)}
            className="form-input" 
          />
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Adaptive cards are posted containing triaged findings.</p>
        </div>

        <div className="flex justify-end">
          <button onClick={() => saveIntegration('TEAMS', teamsWebhook)} className="btn-neon text-xs">
            <Send style={{ width: '12px', height: '12px' }} />
            Save Teams URL
          </button>
        </div>
      </div>

      {/* Form 3: LLM & Agent Triage Configuration */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex align-center gap-3" style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
          <div style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', padding: '6px', borderRadius: '4px', color: 'var(--color-secondary-light)' }}>
            <Sparkles style={{ width: '16px', height: '16px' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.9rem', color: 'white' }}>AI Triage Agent & LLM Configuration</h3>
            <p className="text-gray-500" style={{ fontSize: '0.7rem' }}>Enable the agent, select your LLM provider, and set analysis depth</p>
          </div>
        </div>

        {/* Toggle: Enable Triage Agent */}
        <div className="flex align-center justify-between" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
          <div>
            <div className="bold text-xs" style={{ color: 'white' }}>Enable Alert Triage Agent</div>
            <div className="text-gray-500" style={{ fontSize: '0.7rem' }}>If disabled, incoming alerts will skip AI reasoning loops</div>
          </div>
          <div 
            onClick={() => setAgentEnabled(!agentEnabled)}
            style={{
              width: '40px',
              height: '20px',
              background: agentEnabled ? 'var(--color-success)' : 'rgba(255,255,255,0.1)',
              borderRadius: '10px',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            <div 
              style={{
                width: '16px',
                height: '16px',
                background: 'white',
                borderRadius: '50%',
                position: 'absolute',
                top: '2px',
                left: agentEnabled ? '22px' : '2px',
                transition: 'left 0.2s'
              }}
            />
          </div>
        </div>

        {/* LLM Provider Select */}
        <div className="flex flex-col gap-1.5">
          <label className="form-label">Select LLM Provider</label>
          <select 
            value={llmProvider} 
            onChange={(e) => {
              setLlmProvider(e.target.value);
              setLlmTestResult({ success: null, message: '' });
            }}
            className="form-input"
            style={{ background: '#0a0d17', color: 'white', border: '1px solid var(--border-glass)' }}
          >
            <option value="OLLAMA">Ollama (Local LLM - Keep Your Data Local)</option>
            <option value="OPENAI">OpenAI (Cloud API)</option>
            <option value="ANTHROPIC">Anthropic Claude (Cloud API)</option>
          </select>
        </div>

        {/* Sub forms depending on LLM Provider */}
        {llmProvider === 'OLLAMA' && (
          <div className="flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '8px' }}>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Ollama Host Connection Endpoint</label>
              <input 
                type="text" 
                placeholder="e.g. http://host.docker.internal:11434" 
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                className="form-input" 
              />
              <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                Use <strong>http://host.docker.internal:11434</strong> to reach Ollama on your host machine from the Docker container.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Model Name</label>
              <input 
                type="text" 
                placeholder="e.g. llama3, mistral, phi3, etc." 
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="form-input" 
              />
            </div>
          </div>
        )}

        {llmProvider === 'OPENAI' && (
          <div className="flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '8px' }}>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">OpenAI API Key</label>
              <input 
                type="password" 
                placeholder="sk-..." 
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="form-input" 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Model Name</label>
              <select 
                value={openaiModel} 
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="form-input"
                style={{ background: '#0a0d17', color: 'white' }}
              >
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              </select>
            </div>
          </div>
        )}

        {llmProvider === 'ANTHROPIC' && (
          <div className="flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '16px', borderRadius: '8px' }}>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Anthropic API Key</label>
              <input 
                type="password" 
                placeholder="sk-ant-..." 
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="form-input" 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Model Name</label>
              <select 
                value={anthropicModel} 
                onChange={(e) => setAnthropicModel(e.target.value)}
                className="form-input"
                style={{ background: '#0a0d17', color: 'white' }}
              >
                <option value="claude-3-5-sonnet-20240620">claude-3-5-sonnet</option>
                <option value="claude-3-opus-20240229">claude-3-opus</option>
                <option value="claude-3-haiku-20240307">claude-3-haiku</option>
              </select>
            </div>
          </div>
        )}

        {/* Additional Settings: Target Channel & Depth */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="form-label">Teams Target Channel</label>
            <input 
              type="text" 
              placeholder="e.g. general, alerts" 
              value={targetTeamsChannel}
              onChange={(e) => setTargetTeamsChannel(e.target.value)}
              className="form-input" 
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="form-label">Analysis Depth</label>
            <select 
              value={analysisDepth} 
              onChange={(e) => setAnalysisDepth(e.target.value)}
              className="form-input"
              style={{ background: '#0a0d17', color: 'white' }}
            >
              <option value="QUICK">Quick Summary (2-3 sentences)</option>
              <option value="DEEP">Deep Log Analysis (Detailed breakdown)</option>
            </select>
          </div>
        </div>

        {/* Connection Test Output */}
        {llmTestResult.success !== null && (
          <div style={{ 
            padding: '10px', 
            background: llmTestResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', 
            border: '1px solid ' + (llmTestResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'), 
            borderRadius: '6px', 
            fontSize: '0.75rem', 
            color: llmTestResult.success ? 'var(--color-success)' : 'var(--color-danger)' 
          }}>
            {llmTestResult.message}
          </div>
        )}

        <div className="flex justify-between gap-3" style={{ marginTop: '8px' }}>
          <button 
            onClick={testLlmConnection} 
            disabled={testingLlm} 
            className="btn-secondary text-xs"
            style={{ flexShrink: 0 }}
          >
            {testingLlm ? (
              <>
                <Loader2 className="animate-spin" style={{ width: '12px', height: '12px' }} />
                Testing connection...
              </>
            ) : (
              'Test LLM Endpoint'
            )}
          </button>
          <button onClick={saveLlmConfig} className="btn-neon text-xs">
            <Send style={{ width: '12px', height: '12px' }} />
            Save Agent Settings
          </button>
        </div>
      </div>
    </div>
  );
}
