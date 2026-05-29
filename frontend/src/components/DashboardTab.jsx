import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Terminal, Cpu, CheckCircle, ThumbsUp, ThumbsDown, Check, 
  AlertTriangle, RefreshCw, Layers
} from 'lucide-react';

export default function DashboardTab({
  liveLogs,
  logGeneratorRunning,
  terminalEndRef,
  fetchIncidents,
  incidents,
  selectedIncident,
  setSelectedIncident,
  agentRun,
  getStatusBadgeElement,
  feedbackGiven,
  handleRLHF
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Live Log Console stream on dashboard */}
      <div className="glass-panel terminal-widget">
        <div className="terminal-header">
          <div className="flex align-center gap-2">
            <Terminal style={{ width: '16px', height: '16px', color: 'var(--color-success)' }} />
            <h3 style={{ fontSize: '0.85rem', color: 'white' }}>Live Shared Log Stream (Fake Integration Console)</h3>
          </div>
          <span className="font-mono text-gray-500 text-xs">/shared/sample-application.log</span>
        </div>
        
        <div className="terminal-console-screen">
          {liveLogs.length === 0 ? (
            <div className="flex flex-col align-center justify-between" style={{ height: '100%', justifyContent: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {logGeneratorRunning 
                ? 'Connecting to log stream file...' 
                : 'Log generator is stopped. Click "Start Simulator" on the left sidebar to generate active logs!'
              }
            </div>
          ) : (
            liveLogs.map((logLine, idx) => (
              <div key={idx} style={{ padding: '2px 4px' }}>{logLine}</div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      <div className="flex justify-between align-center" style={{ marginTop: '8px' }}>
        <div>
          <h2>Triage Incident Audit Feed</h2>
          <p className="text-sm text-gray-400">Review ingested alerts and inspect the agent reasoning loops.</p>
        </div>
        <button onClick={fetchIncidents} className="btn-secondary">
          <RefreshCw style={{ width: '14px', height: '14px' }} />
          Reload Feed
        </button>
      </div>

      {/* Grid Layout: Left is list, Right is detail if selected */}
      <div className="dashboard-grid">
        
        {/* Incident Table List Panel */}
        <div className={`glass-panel feed-left-panel ${selectedIncident ? 'shrinked' : ''}`}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.01)' }}>
            <span className="bold text-xs text-gray-400 uppercase tracking-widest">Ingested Incidents ({incidents.length})</span>
          </div>
          
          {incidents.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle style={{ width: '32px', height: '32px', color: 'var(--text-secondary)' }} />
              <p className="bold text-gray-400">No incidents received</p>
              <p className="text-xs text-gray-500 text-center">Inject a fake alert using the Alert Simulator on the sidebar to test.</p>
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Alert / Service</th>
                  {!selectedIncident && <th>Alert ID</th>}
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(inc => {
                  const payloadObj = inc.payload && typeof inc.payload === 'string' ? JSON.parse(inc.payload) : inc.payload;
                  const title = payloadObj?.event_title || inc.externalAlertId || "Unknown incident";
                  const service = payloadObj?.service || "global";
                  
                  return (
                    <tr 
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      style={selectedIncident?.id === inc.id ? { background: 'rgba(95, 90, 247, 0.12)' } : { cursor: 'pointer' }}
                    >
                      <td>
                        <div className="bold" style={{ color: 'white' }}>{title}</div>
                        <div className="text-xs flex align-center gap-2" style={{ color: 'var(--color-secondary-light)', marginTop: '4px' }}>
                          <Layers style={{ width: '12px', height: '12px' }} />
                          {service}
                        </div>
                      </td>
                      {!selectedIncident && (
                        <td className="font-mono text-xs text-gray-500">{inc.id.substring(0, 8)}...</td>
                      )}
                      <td>{getStatusBadgeElement(inc.status)}</td>
                      <td className="text-xs text-gray-400">
                        {new Date(inc.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Split-screen Agent Audit Log View */}
        {selectedIncident && (
          <div className="audit-right-panel glass-panel">
            <div className="audit-detail-wrapper">
              
              {/* Audit Log Header */}
              <div className="audit-header">
                <div>
                  <div className="flex align-center gap-2">
                    <span className="bold text-xs text-gray-400 uppercase tracking-wider">Triage Audit Log</span>
                    {getStatusBadgeElement(selectedIncident.status)}
                  </div>
                  <h3 style={{ fontSize: '0.95rem', color: 'white', marginTop: '4px' }}>
                    {(() => {
                      const p = typeof selectedIncident.payload === 'string' ? JSON.parse(selectedIncident.payload) : selectedIncident.payload;
                      return p?.event_title || selectedIncident.externalAlertId;
                    })()}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedIncident(null)}
                  className="btn-secondary text-xs"
                  style={{ padding: '4px 8px' }}
                >
                  Close Detail
                </button>
              </div>

              {/* Split view main grid */}
              <div className="audit-split-view">
                
                {/* LEFT: Raw Ingestion Payload */}
                <div className="audit-split-left">
                  <h4 className="bold text-xs text-gray-400 flex align-center gap-2" style={{ textTransform: 'uppercase', marginBottom: '10px' }}>
                    <Terminal style={{ width: '14px', height: '14px', color: 'var(--color-primary-light)' }} />
                    Ingested Webhook Payload
                  </h4>
                  <pre className="font-mono text-xs" style={{ background: '#02040a', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: '#38bdf8', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {typeof selectedIncident.payload === 'string' 
                      ? JSON.stringify(JSON.parse(selectedIncident.payload), null, 2)
                      : JSON.stringify(selectedIncident.payload, null, 2)
                    }
                  </pre>
                </div>

                {/* RIGHT: Agent Reasoning & LLM Triage */}
                <div className="audit-split-right">
                  
                  {/* Agent Run Log */}
                  <div className="flex flex-col gap-3">
                    <h4 className="bold text-xs text-gray-400 flex align-center gap-2" style={{ textTransform: 'uppercase' }}>
                      <Cpu style={{ width: '14px', height: '14px', color: 'var(--color-secondary-light)' }} />
                      AI Agent Execution Graph
                    </h4>
                    
                    <div className="flex flex-col gap-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '14px', marginLeft: '6px' }}>
                      {agentRun && agentRun.reasoningSteps ? (
                        JSON.parse(agentRun.reasoningSteps).map((step, idx) => (
                          <div key={idx} className="text-xs" style={{ color: 'var(--text-primary)', position: 'relative', padding: '4px 0' }}>
                            <div style={{ position: 'absolute', left: '-19px', top: '10px', width: '9px', height: '9px', borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--bg-dark)' }} />
                            <div className="font-sans" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>{step}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500" style={{ fontStyle: 'italic' }}>
                          Initializing reasoning steps from Redis queue...
                        </div>
                      )}
                      {selectedIncident.status === 'PROCESSING' && (
                        <div className="text-xs text-gray-400" style={{ position: 'relative', padding: '4px 0', fontStyle: 'italic' }}>
                          <div style={{ position: 'absolute', left: '-19px', top: '10px', width: '9px', height: '9px', borderRadius: '50%', background: 'var(--color-secondary)', animation: 'pulse-slow 1.5s infinite' }} />
                          Agent reasoning node running...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agent Triage Summary Card */}
                  {agentRun && agentRun.finalSummary && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }} className="flex flex-col gap-4">
                      <div>
                        <h4 className="bold text-xs text-gray-400 flex align-center gap-2" style={{ textTransform: 'uppercase', marginBottom: '8px' }}>
                          <CheckCircle style={{ width: '14px', height: '14px', color: 'var(--color-success)' }} />
                          AI Root Cause Verdict
                        </h4>
                        <div className="markdown-content" style={{ background: 'rgba(95, 90, 247, 0.08)', border: '1px solid rgba(95, 90, 247, 0.15)', padding: '12px 16px', borderRadius: '8px' }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{agentRun.finalSummary}</ReactMarkdown>
                        </div>
                      </div>

                      {/* Teams Integration Preview Card */}
                      <div className="teams-card-preview">
                        <div className="teams-card-header">
                          <span>Microsoft Teams Payload</span>
                          <span>Adaptive Card Preview</span>
                        </div>
                        <div className="teams-card-body">
                          <div className="bold" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f3f4f6' }}>
                            🚨 Alert Triage Completed
                          </div>
                          <div className="text-gray-400 text-xs" style={{ marginTop: '4px' }}>
                            Service: <strong style={{ color: 'var(--color-secondary-light)', fontWeight: '500' }}>
                              {(() => {
                                const p = typeof selectedIncident.payload === 'string' ? JSON.parse(selectedIncident.payload) : selectedIncident.payload;
                                return p?.service || "unknown";
                              })()}
                            </strong>
                          </div>
                          <div className="markdown-content markdown-content-compact" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', marginTop: '8px' }}>
                            <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>AI Analysis Summary:</strong>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{agentRun.finalSummary}</ReactMarkdown>
                          </div>
                        </div>
                      </div>

                      {/* RLHF Feedback Widget */}
                      <div className="flex justify-between align-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '12px' }}>
                        <div>
                          <div className="bold text-xs" style={{ color: 'white' }}>Triage Feedback</div>
                          <div className="text-gray-500" style={{ fontSize: '0.7rem' }}>Was this analysis accurate?</div>
                        </div>
                        <div className="flex gap-2">
                          {feedbackGiven[selectedIncident.id] ? (
                            <span className="text-xs bold" style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Check style={{ width: '12px', height: '12px' }} /> Feedback Saved
                            </span>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleRLHF(selectedIncident.id, 'UP')}
                                className="btn-secondary"
                                style={{ padding: '6px' }}
                              >
                                <ThumbsUp style={{ width: '12px', height: '12px' }} />
                              </button>
                              <button 
                                onClick={() => handleRLHF(selectedIncident.id, 'DOWN')}
                                className="btn-secondary"
                                style={{ padding: '6px' }}
                              >
                                <ThumbsDown style={{ width: '12px', height: '12px' }} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex justify-between text-gray-500" style={{ fontSize: '0.65rem' }}>
                        <span>Tokens: {agentRun.tokensUsed || 0}</span>
                        <span>Completed: {new Date(agentRun.completedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
