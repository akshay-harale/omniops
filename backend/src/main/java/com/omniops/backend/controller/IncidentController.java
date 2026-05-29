package com.omniops.backend.controller;

import com.omniops.backend.domain.Incident;
import com.omniops.backend.service.IncidentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class IncidentController {
    private final IncidentService incidentService;

    @GetMapping("/tenant/{tenantId}")
    public ResponseEntity<List<Incident>> getIncidents(@PathVariable UUID tenantId) {
        return ResponseEntity.ok(incidentService.getIncidentsByTenant(tenantId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Incident> getIncidentById(@PathVariable UUID id) {
        return ResponseEntity.ok(incidentService.getIncidentById(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Incident> updateStatus(@PathVariable UUID id, @RequestParam String status) {
        return ResponseEntity.ok(incidentService.updateStatus(id, status));
    }
}
