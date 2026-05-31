-- init.sql
CREATE TABLE IF NOT EXISTS tenant (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan_tier VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integration (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    external_alert_id VARCHAR(255),
    payload TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_run (
    id UUID PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
    reasoning_steps TEXT,
    final_summary TEXT,
    tokens_used INTEGER,
    status VARCHAR(50) NOT NULL,
    completed_at TIMESTAMP
);

-- Insert a default tenant and integrations for instant MVP functionality
INSERT INTO tenant (id, name, plan_tier, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Enterprise Tenant', 'ENTERPRISE', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO integration (id, tenant_id, service_type, encrypted_api_key, status, created_at)
VALUES 
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'DATADOG', 'mock_datadog_api_key_12345', 'ACTIVE', CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'TEAMS', 'https://mock.teams.microsoft.com/webhook/12345', 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
