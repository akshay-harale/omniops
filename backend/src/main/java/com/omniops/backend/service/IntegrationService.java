package com.omniops.backend.service;

import com.omniops.backend.domain.Integration;
import com.omniops.backend.domain.Tenant;
import com.omniops.backend.repository.IntegrationRepository;
import com.omniops.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IntegrationService {
    private final IntegrationRepository integrationRepository;
    private final TenantRepository tenantRepository;

    public Integration saveIntegration(UUID tenantId, String serviceType, String apiKey) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + tenantId));

        // Basic Base64 encoding as mock encryption for credential storage
        String encryptedKey = Base64.getEncoder().encodeToString(apiKey.getBytes());

        Integration integration = integrationRepository.findByTenantIdAndServiceType(tenantId, serviceType)
                .orElse(Integration.builder()
                        .tenant(tenant)
                        .serviceType(serviceType)
                        .build());

        integration.setEncryptedApiKey(encryptedKey);
        integration.setStatus("ACTIVE");

        return integrationRepository.save(integration);
    }

    public List<Integration> getIntegrationsByTenant(UUID tenantId) {
        return integrationRepository.findByTenantId(tenantId);
    }

    public String decryptKey(String encryptedKey) {
        try {
            return new String(Base64.getDecoder().decode(encryptedKey));
        } catch (Exception e) {
            return encryptedKey;
        }
    }
}
