package com.omniops.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper;

    public Incident createIncident(UUID tenantId, String externalAlertId, String payload) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + tenantId));

        boolean isResolved = checkIfResolved(payload);

        Incident incident = Incident.builder()
                .tenant(tenant)
                .externalAlertId(externalAlertId)
                .payload(payload)
                .status(isResolved ? "RESOLVED" : "PENDING")
                .build();

        Incident saved = incidentRepository.save(incident);
        log.info("Saved incident: {}. Status: {}", saved.getId(), saved.getStatus());
        
        if (!isResolved) {
            log.info("Enqueuing task for incident: {}", saved.getId());
            queuePublisher.enqueueIncident(saved.getId().toString());
        } else {
            log.info("Skipping triage queue enqueueing because alert is already resolved.");
        }
        return saved;
    }

    private boolean checkIfResolved(String payload) {
        if (payload == null || payload.trim().isEmpty()) {
            return false;
        }
        try {
            JsonNode root = objectMapper.readTree(payload);
            
            // Check top-level status
            String status = root.path("status").asText("");
            if ("resolved".equalsIgnoreCase(status)) {
                return true;
            }
            
            // Check alerts array status (Prometheus Alertmanager / SigNoz format)
            JsonNode alerts = root.path("alerts");
            if (alerts.isArray() && !alerts.isEmpty()) {
                for (JsonNode alert : alerts) {
                    String alertStatus = alert.path("status").asText("");
                    if ("resolved".equalsIgnoreCase(alertStatus)) {
                        return true;
                    }
                }
            }
            
            // Check alert_status (e.g. from Datadog alert webhook payload directly)
            String alertStatus = root.path("alert_status").asText("");
            if ("resolved".equalsIgnoreCase(alertStatus) || "ok".equalsIgnoreCase(alertStatus)) {
                return true;
            }
        } catch (Exception e) {
            log.warn("Failed to parse alert payload to check resolved status: {}", e.getMessage());
        }
        return false;
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
