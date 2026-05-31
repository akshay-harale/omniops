-- Update Datadog default integration to be DISABLED
UPDATE integration 
SET status = 'DISABLED' 
WHERE service_type = 'DATADOG';

-- Insert default SigNoz integration for instant functionality
INSERT INTO integration (id, tenant_id, service_type, encrypted_api_key, status, created_at)
VALUES (
    '10000000-0000-0000-0000-000000000003', 
    '00000000-0000-0000-0000-000000000001', 
    'SIGNOZ', 
    'eyJob3N0IjoiaHR0cDovL2hvc3QuZG9ja2VyLmludGVybmFsOjgwODAiLCJ0b2tlbiI6IiJ9', 
    'ACTIVE', 
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

-- Ensure it is active with the default host http://host.docker.internal:8080 if it already exists
UPDATE integration
SET status = 'ACTIVE',
    encrypted_api_key = 'eyJob3N0IjoiaHR0cDovL2hvc3QuZG9ja2VyLmludGVybmFsOjgwODAiLCJ0b2tlbiI6IiJ9'
WHERE service_type = 'SIGNOZ';
