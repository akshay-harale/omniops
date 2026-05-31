package com.omniops.backend.controller;

import com.omniops.backend.domain.Incident;
import com.omniops.backend.service.IncidentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class WebhookController {
    private final IncidentService incidentService;

    @PostMapping("/datadog/{tenantId}")
    public ResponseEntity<Incident> handleDatadogWebhook(
            @PathVariable UUID tenantId,
            @RequestParam(required = false) String alertId,
            @RequestBody String payload) {
        log.info("Received Datadog webhook for tenant: {}, alertId: {}", tenantId, alertId);
        Incident incident = incidentService.createIncident(tenantId, alertId != null ? alertId : UUID.randomUUID().toString(), payload);
        return ResponseEntity.ok(incident);
    }

    @PostMapping("/signoz/{tenantId}")
    public ResponseEntity<Incident> handleSignozWebhook(
            @PathVariable UUID tenantId,
            @RequestParam(required = false) String alertId,
            @RequestBody String payload) {
        log.info("Received SigNoz webhook for tenant: {}, alertId: {}", tenantId, alertId);
        Incident incident = incidentService.createIncident(tenantId, alertId != null ? alertId : UUID.randomUUID().toString(), payload);
        return ResponseEntity.ok(incident);
    }
}
