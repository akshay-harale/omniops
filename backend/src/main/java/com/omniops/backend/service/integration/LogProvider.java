package com.omniops.backend.service.integration;

import com.omniops.backend.domain.Incident;
import com.omniops.backend.domain.Integration;

public interface LogProvider {
    boolean supports(String serviceType);
    String fetchLogs(Incident incident, Integration integrationConfig);
}
