package com.omniops.backend.service;

import com.omniops.backend.domain.Incident;
import com.omniops.backend.domain.Tenant;
import com.omniops.backend.repository.IncidentRepository;
import com.omniops.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class IncidentService {
    private final IncidentRepository incidentRepository;
    private final TenantRepository tenantRepository;
    private final QueuePublisher queuePublisher;

    public Incident createIncident(UUID tenantId, String externalAlertId, String payload) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + tenantId));

        Incident incident = Incident.builder()
                .tenant(tenant)
                .externalAlertId(externalAlertId)
                .payload(payload)
                .status("PENDING")
                .build();

        Incident saved = incidentRepository.save(incident);
        log.info("Saved incident: {}. Enqueueing task.", saved.getId());
        
        queuePublisher.enqueueIncident(saved.getId().toString());
        return saved;
    }

    public List<Incident> getIncidentsByTenant(UUID tenantId) {
        return incidentRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    public Incident getIncidentById(UUID id) {
        return incidentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Incident not found: " + id));
    }

    public Incident updateStatus(UUID id, String status) {
        Incident incident = getIncidentById(id);
        incident.setStatus(status);
        return incidentRepository.save(incident);
    }
}
