package com.omniops.backend.service;

import com.omniops.backend.domain.Incident;
import com.omniops.backend.domain.Integration;
import com.omniops.backend.repository.IncidentRepository;
import com.omniops.backend.service.integration.LogProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContextAggregationService {

    private final IncidentRepository incidentRepository;
    private final IntegrationService integrationService;
    private final List<LogProvider> logProviders;

    public Map<String, String> gatherContext(UUID incidentId) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new IllegalArgumentException("Incident not found: " + incidentId));

        List<Integration> integrations = integrationService.getIntegrationsByTenant(incident.getTenant().getId());
        Map<String, String> contextMap = new HashMap<>();

        for (Integration integration : integrations) {
            if (!"ACTIVE".equals(integration.getStatus())) continue;

            for (LogProvider provider : logProviders) {
                if (provider.supports(integration.getServiceType())) {
                    log.info("Fetching logs from provider: {}", provider.getClass().getSimpleName());
                    String logs = provider.fetchLogs(incident, integration);
                    contextMap.put(integration.getServiceType(), logs);
                }
            }
        }

        return contextMap;
    }
}
