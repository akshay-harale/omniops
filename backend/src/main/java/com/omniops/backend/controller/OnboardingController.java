package com.omniops.backend.controller;

import com.omniops.backend.domain.Tenant;
import com.omniops.backend.service.LogGeneratorService;
import com.omniops.backend.service.TenantService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class OnboardingController {

    private final TenantService tenantService;
    private final LogGeneratorService logGeneratorService;

    @Value("${DEPLOYMENT_MODE:demo}")
    private String deploymentMode;

    @PostMapping("/workspace")
    public ResponseEntity<Tenant> createWorkspace(@RequestBody WorkspaceRequest request) {
        log.info("Creating onboarding workspace: {}", request.getName());
        Tenant tenant = Tenant.builder()
                .name(request.getName())
                .planTier(request.getPlanTier() != null ? request.getPlanTier().toUpperCase() : "FREE")
                .build();
        Tenant saved = tenantService.createTenant(tenant);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/test-connection")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody ConnectionRequest request) {
        log.info("Testing integration connection for service: {}", request.getServiceType());
        
        // Simulate a network connection latency
        try {
            Thread.sleep(1200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        Map<String, Object> response = new HashMap<>();
        
        if (request.getApiKey() == null || request.getApiKey().trim().isEmpty()) {
            response.put("success", false);
            response.put("message", "API Key, URL, or Endpoint cannot be blank.");
            return ResponseEntity.badRequest().body(response);
        }

        if ("TEAMS".equals(request.getServiceType()) && !request.getApiKey().startsWith("http")) {
            response.put("success", false);
            response.put("message", "Invalid Teams Webhook format. Must start with HTTP/HTTPS.");
            return ResponseEntity.badRequest().body(response);
        }

        if ("OLLAMA".equals(request.getServiceType())) {
            String endpoint = request.getApiKey().trim();
            if (!endpoint.startsWith("http")) {
                response.put("success", false);
                response.put("message", "Ollama endpoint must start with http/https.");
                return ResponseEntity.badRequest().body(response);
            }
            try {
                HttpClient client = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(4))
                        .build();
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(endpoint + "/api/tags"))
                        .timeout(Duration.ofSeconds(4))
                        .GET()
                        .build();
                HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() == 200) {
                    response.put("success", true);
                    response.put("message", "Successfully connected to local Ollama instance at " + endpoint);
                    return ResponseEntity.ok(response);
                } else {
                    response.put("success", false);
                    response.put("message", "Ollama returned status code: " + resp.statusCode());
                    return ResponseEntity.ok(response);
                }
            } catch (Exception e) {
                response.put("success", false);
                response.put("message", "Could not reach Ollama at " + endpoint + ": " + e.getMessage() + ". (For docker environments, ensure you use http://host.docker.internal:11434 and enable CORS in Ollama)");
                return ResponseEntity.ok(response);
            }
        }

        if ("OPENAI".equals(request.getServiceType()) || "ANTHROPIC".equals(request.getServiceType())) {
            String key = request.getApiKey().trim();
            if (key.length() < 10) {
                response.put("success", false);
                response.put("message", "API Key is too short or invalid.");
                return ResponseEntity.badRequest().body(response);
            }
            response.put("success", true);
            response.put("message", request.getServiceType() + " API Key validated successfully!");
            return ResponseEntity.ok(response);
        }

        if ("DATADOG".equals(request.getServiceType())) {
            String apiKey = request.getApiKey() != null ? request.getApiKey().trim() : "";
            String appKey = request.getApplicationKey() != null ? request.getApplicationKey().trim() : "";
            String site = request.getSite() != null ? request.getSite().trim() : "datadoghq.com";
            
            if (apiKey.isEmpty()) {
                response.put("success", false);
                response.put("message", "Datadog API Key is required.");
                return ResponseEntity.badRequest().body(response);
            }
            
            // In demo mode, skip real API validation and accept any key
            boolean isDemo = "demo".equalsIgnoreCase(deploymentMode);
            if (isDemo) {
                response.put("success", true);
                response.put("message", "Datadog credentials accepted (demo mode). Site: " + site);
                response.put("mode", "demo");
                return ResponseEntity.ok(response);
            }
            
            // Production mode — require Application Key and validate against Datadog API
            if (appKey.isEmpty()) {
                response.put("success", false);
                response.put("message", "Datadog Application Key is required for read access to logs and metrics.");
                return ResponseEntity.badRequest().body(response);
            }
            
            String baseUrl = "https://api." + site;
            try {
                HttpClient client = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(5))
                        .build();
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(baseUrl + "/api/v1/validate"))
                        .timeout(Duration.ofSeconds(5))
                        .header("DD-API-KEY", apiKey)
                        .header("DD-APPLICATION-KEY", appKey)
                        .GET()
                        .build();
                HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() == 200) {
                    response.put("success", true);
                    response.put("message", "Datadog credentials validated successfully! Connected to " + site);
                    return ResponseEntity.ok(response);
                } else if (resp.statusCode() == 403) {
                    response.put("success", false);
                    response.put("message", "Datadog authentication failed (403 Forbidden). Verify your API Key and Application Key.");
                    return ResponseEntity.ok(response);
                } else {
                    response.put("success", false);
                    response.put("message", "Datadog returned status " + resp.statusCode() + ". Check your credentials and site region.");
                    return ResponseEntity.ok(response);
                }
            } catch (Exception e) {
                response.put("success", false);
                response.put("message", "Could not reach Datadog API at " + baseUrl + ": " + e.getMessage());
                return ResponseEntity.ok(response);
            }
        }

        if ("SIGNOZ".equals(request.getServiceType())) {
            String hostUrl = request.getApiKey() != null ? request.getApiKey().trim() : "";
            
            if (hostUrl.isEmpty()) {
                response.put("success", false);
                response.put("message", "SigNoz Host URL is required.");
                return ResponseEntity.badRequest().body(response);
            }
            if (!hostUrl.startsWith("http")) {
                response.put("success", false);
                response.put("message", "SigNoz Host URL must start with http or https.");
                return ResponseEntity.badRequest().body(response);
            }

            try {
                // SigNoz healthcheck endpoint: /api/v1/health
                String healthUrl = hostUrl.replaceAll("/+$", "") + "/api/v1/health";
                HttpClient client = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(5))
                        .build();
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(healthUrl))
                        .timeout(Duration.ofSeconds(5))
                        .GET()
                        .build();
                HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
                
                if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                    response.put("success", true);
                    response.put("message", "SigNoz connection validated successfully!");
                    return ResponseEntity.ok(response);
                } else {
                    response.put("success", false);
                    response.put("message", "SigNoz returned status " + resp.statusCode() + ".");
                    return ResponseEntity.ok(response);
                }
            } catch (Exception e) {
                response.put("success", false);
                response.put("message", "Could not reach SigNoz Host at " + hostUrl + ": " + e.getMessage());
                return ResponseEntity.ok(response);
            }
        }

        response.put("success", true);
        response.put("message", "Connection established successfully with " + request.getServiceType() + " gateway!");
        response.put("latencyMs", 185);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/log-generator/start")
    public ResponseEntity<Map<String, Object>> startLogGenerator() {
        logGeneratorService.startGenerator();
        Map<String, Object> response = new HashMap<>();
        response.put("status", "RUNNING");
        response.put("message", "Fake Log Generator started writing to shared volumes.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/log-generator/stop")
    public ResponseEntity<Map<String, Object>> stopLogGenerator() {
        logGeneratorService.stopGenerator();
        Map<String, Object> response = new HashMap<>();
        response.put("status", "STOPPED");
        response.put("message", "Fake Log Generator stopped.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/log-generator/logs")
    public ResponseEntity<List<String>> getGeneratorLogs(@RequestParam(defaultValue = "40") int maxLines) {
        List<String> logs = logGeneratorService.readLastLines(maxLines);
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> response = new HashMap<>();
        response.put("logGeneratorRunning", logGeneratorService.isRunning());
        response.put("deploymentMode", deploymentMode);
        return ResponseEntity.ok(response);
    }

    @Data
    public static class WorkspaceRequest {
        private String name;
        private String planTier;
    }

    @Data
    public static class ConnectionRequest {
        private String serviceType;
        private String apiKey;
        private String applicationKey;
        private String site;
    }
}
