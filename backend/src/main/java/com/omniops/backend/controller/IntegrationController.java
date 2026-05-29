package com.omniops.backend.controller;

import com.omniops.backend.domain.Integration;
import com.omniops.backend.service.IntegrationService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/integrations")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class IntegrationController {
    private final IntegrationService integrationService;

    @GetMapping("/tenant/{tenantId}")
    public ResponseEntity<List<Integration>> getIntegrations(@PathVariable UUID tenantId) {
        return ResponseEntity.ok(integrationService.getIntegrationsByTenant(tenantId));
    }

    @PostMapping("/tenant/{tenantId}")
    public ResponseEntity<Integration> saveIntegration(
            @PathVariable UUID tenantId,
            @RequestBody IntegrationRequest request) {
        Integration integration = integrationService.saveIntegration(tenantId, request.getServiceType(), request.getApiKey());
        return ResponseEntity.ok(integration);
    }

    @Data
    public static class IntegrationRequest {
        private String serviceType;
        private String apiKey;
    }
}
