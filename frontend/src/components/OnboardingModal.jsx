import React from 'react';
import { Sparkles, Loader2, ArrowRight, Database, AlertTriangle, Terminal } from 'lucide-react';

export default function OnboardingModal({
  onboardingStep,
  setOnboardingStep,
  onboardingMessage,
  obTenantName,
  setObTenantName,
  obPlanTier,
  setObPlanTier,
  handleOnboardingNext,
  connectionSuccess,
  obDatadogKey,
  setObDatadogKey,
  obTeamsWebhook,
  setObTeamsWebhook,
  testingConnection,
  testOnboardingConnection,
  liveLogs,
  terminalEndRef,
  setShowOnboarding,
  triggerSimulation
}) {
  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content-panel">
        
        {/* Close Button */}
        <button 
          onClick={() => setShowOnboarding(false)}
          className="btn-secondary text-xs"
          style={{ position: 'absolute', top: '16px', right: '16px', padding: '4px 8px' }}
        >
          Skip
        </button>

        {/* Stepper Header */}
        <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
          <div className="flex align-center gap-2">
            <Sparkles style={{ width: '18px', height: '18px', color: 'var(--color-primary-light)' }} />
            <h3 style={{ color: 'white' }}>Onboarding Workspace Setup</h3>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(s => (
              <span 
                key={s} 
                style={{ 
                  display: 'inline-block',
                  width: '32px', 
                  height: '6px', 
                  borderRadius: '3px',
                  background: onboardingStep === s ? 'var(--color-primary-light)' : onboardingStep > s ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.3s'
                }} 
              />
            ))}
          </div>
        </div>

        {onboardingMessage && (
          <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--color-danger)', marginBottom: '16px' }}>
            {onboardingMessage}
          </div>
        )}

        {/* STEP 1: CREATE TENANT WORKSPACE */}
        {onboardingStep === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h4 style={{ color: 'white', fontSize: '0.95rem' }}>Step 1: Create Organization Workspace</h4>
              <p className="text-gray-400 text-xs" style={{ lineHeight: '1.4', marginTop: '4px' }}>
                Enter your organization name. This initializes partition structures in the Postgres DB to enforce multi-tenant context isolation.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="form-label">Workspace Name</label>
              <input 
                type="text" 
                placeholder="e.g. Acme DevOps Org" 
                value={obTenantName}
                onChange={(e) => setObTenantName(e.target.value)}
                className="form-input" 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="form-label">Subscription Tier</label>
              <div className="flex gap-3">
                {['FREE', 'GROWTH', 'ENTERPRISE'].map(tier => (
                  <div 
                    key={tier}
                    onClick={() => setObPlanTier(tier)}
                    style={{ 
                      flex: 1, 
                      padding: '12px', 
                      border: '1px solid ' + (obPlanTier === tier ? 'var(--color-primary)' : 'var(--border-glass)'),
                      background: obPlanTier === tier ? 'rgba(95,90,247,0.08)' : 'rgba(0,0,0,0.15)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div className="bold text-xs" style={{ color: obPlanTier === tier ? 'white' : 'var(--text-secondary)' }}>{tier}</div>
                    <div className="text-gray-500" style={{ fontSize: '0.6rem', marginTop: '4px' }}>
                      {tier === 'FREE' && '5 triages/mo'}
                      {tier === 'GROWTH' && '100 triages/mo'}
                      {tier === 'ENTERPRISE' && 'Unlimited runs'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end" style={{ marginTop: '16px' }}>
              <button onClick={handleOnboardingNext} className="btn-neon text-xs">
                Create Workspace
                <ArrowRight style={{ width: '12px', height: '12px' }} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CONNECT MOCK INTEGRATIONS */}
        {onboardingStep === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h4 style={{ color: 'white', fontSize: '0.95rem' }}>Step 2: Connect Integration Credentials</h4>
              <p className="text-gray-400 text-xs" style={{ lineHeight: '1.4', marginTop: '4px' }}>
                Test connections to your monitoring and communication hubs. Prefilled values connect to our local sandbox.
              </p>
            </div>

            {/* Datadog connect */}
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="flex justify-between align-center">
                <span className="bold text-xs" style={{ color: 'white' }}>Datadog API Gateway</span>
                {connectionSuccess.DD === true && <span className="bold text-xs" style={{ color: 'var(--color-success)' }}>Connected</span>}
                {connectionSuccess.DD === false && <span className="bold text-xs" style={{ color: 'var(--color-danger)' }}>Failed</span>}
              </div>
              <div className="flex gap-2">
                <input 
                  type="password"
                  value={obDatadogKey}
                  onChange={(e) => setObDatadogKey(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.75rem', padding: '8px' }} 
                />
                <button 
                  onClick={() => testOnboardingConnection('DD')}
                  disabled={testingConnection.DD}
                  className="btn-secondary text-xs"
                  style={{ flexShrink: 0 }}
                >
                  {testingConnection.DD ? <Loader2 style={{ width: '12px', height: '12px' }} className="animate-spin" /> : 'Test'}
                </button>
              </div>
            </div>

            {/* Teams connect */}
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="flex justify-between align-center">
                <span className="bold text-xs" style={{ color: 'white' }}>Microsoft Teams Webhook URL</span>
                {connectionSuccess.TEAMS === true && <span className="bold text-xs" style={{ color: 'var(--color-success)' }}>Connected</span>}
                {connectionSuccess.TEAMS === false && <span className="bold text-xs" style={{ color: 'var(--color-danger)' }}>Failed</span>}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={obTeamsWebhook}
                  onChange={(e) => setObTeamsWebhook(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.75rem', padding: '8px' }} 
                />
                <button 
                  onClick={() => testOnboardingConnection('TEAMS')}
                  disabled={testingConnection.TEAMS}
                  className="btn-secondary text-xs"
                  style={{ flexShrink: 0 }}
                >
                  {testingConnection.TEAMS ? <Loader2 style={{ width: '12px', height: '12px' }} className="animate-spin" /> : 'Test'}
                </button>
              </div>
            </div>

            <div className="flex justify-between" style={{ marginTop: '16px' }}>
              <button onClick={() => setOnboardingStep(1)} className="btn-secondary text-xs">Back</button>
              <button onClick={handleOnboardingNext} className="btn-neon text-xs">
                Save Credentials
                <ArrowRight style={{ width: '12px', height: '12px' }} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: START LOCAL FAKE LOG FLOW */}
        {onboardingStep === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <h4 style={{ color: 'white', fontSize: '0.95rem' }}>Step 3: Enable Server Log Streaming</h4>
              <p className="text-gray-400 text-xs" style={{ lineHeight: '1.4', marginTop: '4px' }}>
                The AIOps agent monitors live log output to debug issues. Click below to boot the mock microservice log stream.
              </p>
            </div>

            <div className="flex justify-between align-center" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <div className="flex align-center gap-2">
                <Terminal style={{ width: '18px', height: '18px', color: 'var(--color-primary-light)' }} />
                <div>
                  <div className="bold text-xs" style={{ color: 'white' }}>Mock Log Generator Service</div>
                  <div className="text-gray-500" style={{ fontSize: '0.65rem' }}>Writing simulated server transactions</div>
                </div>
              </div>
              <span className="badge badge-processing">active</span>
            </div>

            <div className="terminal-console-screen" style={{ height: '120px' }}>
              {liveLogs.length === 0 ? (
                <div className="flex align-center justify-center italic text-gray-500" style={{ height: '100%' }}>
                  Connecting to log writer...
                </div>
              ) : (
                liveLogs.map((logLine, idx) => (
                  <div key={idx}>{logLine}</div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>

            <div className="flex justify-between" style={{ marginTop: '16px' }}>
              <button onClick={() => setOnboardingStep(2)} className="btn-secondary text-xs">Back</button>
              <button onClick={handleOnboardingNext} className="btn-neon text-xs">
                Setup Completed
                <ArrowRight style={{ width: '12px', height: '12px' }} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: TRIGGER SIMULATED TRIAGE */}
        {onboardingStep === 4 && (
          <div className="flex flex-col gap-4">
            <div>
              <h4 style={{ color: 'white', fontSize: '0.95rem' }}>Step 4: Trigger Simulation Alert</h4>
              <p className="text-gray-400 text-xs" style={{ lineHeight: '1.4', marginTop: '4px' }}>
                All done! Click below to send a mock alert. The AI worker will append the stack trace to the terminal logs and run triage in real-time.
              </p>
            </div>

            <div className="flex gap-4" style={{ marginTop: '8px' }}>
              <button 
                onClick={() => { setShowOnboarding(false); triggerSimulation('db_leak'); }}
                className="btn-secondary"
                style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', height: 'auto', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Database style={{ width: '20px', height: '20px', color: 'var(--color-warning)' }} />
                <span className="bold text-xs" style={{ color: 'white' }}>Post DB connection leak</span>
              </button>
              
              <button 
                onClick={() => { setShowOnboarding(false); triggerSimulation('npe'); }}
                className="btn-secondary"
                style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', height: 'auto', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <AlertTriangle style={{ width: '20px', height: '20px', color: 'var(--color-danger)' }} />
                <span className="bold text-xs" style={{ color: 'white' }}>Post NullPointerException</span>
              </button>
            </div>

            <div className="flex justify-between" style={{ marginTop: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
              <button onClick={() => setOnboardingStep(3)} className="btn-secondary text-xs">Back</button>
              <button onClick={() => setShowOnboarding(false)} className="btn-secondary text-xs">Close</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
