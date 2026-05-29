import React from 'react';
import { Terminal, Layers, ChevronRight } from 'lucide-react';

export default function SimulatorTab({ triggerSimulation, simulating }) {
  return (
    <div className="flex flex-col gap-6 animate-slide-in">
      <div>
        <h2>Datadog Monitoring Webhook Ingestion Gateway</h2>
        <p className="text-sm text-gray-400">Trigger simulated incidents to evaluate the triage execution graph.</p>
      </div>

      <div className="simulator-grid">
        {/* Simulator Card 1 */}
        <div onClick={() => triggerSimulation('db_leak')} className="glass-panel glass-panel-interactive simulator-card">
          <div className="flex align-center gap-3">
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)' }}>
              <Terminal style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'white' }}>Hikari Pool Connection Leak</h3>
              <p className="text-gray-500" style={{ fontSize: '0.75rem' }}>auth-service | DB Timeout Alert</p>
            </div>
          </div>
          <p className="text-gray-400 text-xs" style={{ lineHeight: '1.4' }}>
            Simulates connections depletion. The agent analyzes JVM connection allocations, detecting unclosed result sets.
          </p>
          <div className="bold text-xs" style={{ color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '8px' }}>
            Trigger Webhook <ChevronRight style={{ width: '12px', height: '12px' }} />
          </div>
        </div>

        {/* Simulator Card 2 */}
        <div onClick={() => triggerSimulation('npe')} className="glass-panel glass-panel-interactive simulator-card">
          <div className="flex align-center gap-3">
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
              <Terminal style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'white' }}>NullPointerException (NPE) Stack Trace</h3>
              <p className="text-gray-500" style={{ fontSize: '0.75rem' }}>gateway-service | Controller Error</p>
            </div>
          </div>
          <p className="text-gray-400 text-xs" style={{ lineHeight: '1.4' }}>
            Simulates controller exception throw. The agent extracts file paths and line numbers from stack traces.
          </p>
          <div className="bold text-xs" style={{ color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '8px' }}>
            Trigger Webhook <ChevronRight style={{ width: '12px', height: '12px' }} />
          </div>
        </div>

        {/* Simulator Card 3 */}
        <div onClick={() => triggerSimulation('cpu')} className="glass-panel glass-panel-interactive simulator-card">
          <div className="flex align-center gap-3">
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
              <Terminal style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'white' }}>CPU Thread Contention</h3>
              <p className="text-gray-500" style={{ fontSize: '0.75rem' }}>order-service | CPU Load Spike</p>
            </div>
          </div>
          <p className="text-gray-400 text-xs" style={{ lineHeight: '1.4' }}>
            Simulates system spikes. The agent identifies locking threads or heavy GC processes driving JVM overhead.
          </p>
          <div className="bold text-xs" style={{ color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '8px' }}>
            Trigger Webhook <ChevronRight style={{ width: '12px', height: '12px' }} />
          </div>
        </div>

        {/* Simulator Card 4 */}
        <div onClick={() => triggerSimulation('oom')} className="glass-panel glass-panel-interactive simulator-card">
          <div className="flex align-center gap-3">
            <div style={{ background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.2)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-secondary)' }}>
              <Layers style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'white' }}>OutOfMemoryError Heap crash</h3>
              <p className="text-gray-500" style={{ fontSize: '0.75rem' }}>payment-service | Memory Leak Crash</p>
            </div>
          </div>
          <p className="text-gray-400 text-xs" style={{ lineHeight: '1.4' }}>
            Simulates memory threshold exhaustion. The agent analyzes JVM garbage collection lines and heap dumps.
          </p>
          <div className="bold text-xs" style={{ color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '8px' }}>
            Trigger Webhook <ChevronRight style={{ width: '12px', height: '12px' }} />
          </div>
        </div>

      </div>

      {simulating && (
        <div style={{ padding: '16px', background: 'rgba(95, 90, 247, 0.08)', border: '1px solid rgba(95, 90, 247, 0.2)', borderRadius: '8px', color: 'var(--color-primary-light)', textAlign: 'center', fontSize: '0.85rem' }} className="animate-pulse bold">
          Injecting Datadog incident webhook and queuing process tasks...
        </div>
      )}
    </div>
  );
}
