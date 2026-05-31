-- Insert default LLM config so AI worker can run real triage immediately on boot
INSERT INTO integration (id, tenant_id, service_type, encrypted_api_key, status, created_at)
VALUES (
    '10000000-0000-0000-0000-000000000004', 
    '00000000-0000-0000-0000-000000000001', 
    'LLM_CONFIG', 
    'eyJwcm92aWRlciI6Ik9MTEFNQSIsIm9sbGFtYUVuZHBvaW50IjoiaHR0cDovL2hvc3QuZG9ja2VyLmludGVybmFsOjExNDM0Iiwib2xsYW1hTW9kZWwiOiJsbGFtYTMiLCJhZ2VudEVuYWJsZWQiOnRydWUsInRhcmdldFRlYW1zQ2hhbm5lbCI6ImdlbmVyYWwiLCJhbmFseXNpc0RlcHRoIjoiREVFUCJ9', 
    'ACTIVE', 
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

-- Make sure existing LLM config is active with default Ollama host
UPDATE integration
SET status = 'ACTIVE',
    encrypted_api_key = 'eyJwcm92aWRlciI6Ik9MTEFNQSIsIm9sbGFtYUVuZHBvaW50IjoiaHR0cDovL2hvc3QuZG9ja2VyLmludGVybmFsOjExNDM0Iiwib2xsYW1hTW9kZWwiOiJsbGFtYTMiLCJhZ2VudEVuYWJsZWQiOnRydWUsInRhcmdldFRlYW1zQ2hhbm5lbCI6ImdlbmVyYWwiLCJhbmFseXNpc0RlcHRoIjoiREVFUCJ9'
WHERE service_type = 'LLM_CONFIG';
