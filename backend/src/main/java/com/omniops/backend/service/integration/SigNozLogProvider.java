package com.omniops.backend.service.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniops.backend.domain.Incident;
import com.omniops.backend.domain.Integration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SigNozLogProvider implements LogProvider {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public boolean supports(String serviceType) {
        return "SIGNOZ".equalsIgnoreCase(serviceType);
    }

    @Override
    public String fetchLogs(Incident incident, Integration integrationConfig) {
        try {
            // 1. Parse Integration Config
            String configJson = new String(Base64.getDecoder().decode(integrationConfig.getEncryptedApiKey()));
            JsonNode config = objectMapper.readTree(configJson);
            String signozHost = config.path("host").asText("http://localhost:3301");
            String signozToken = config.path("token").asText("");

            // 2. Parse Incident Payload to find related_logs
            JsonNode payload = objectMapper.readTree(incident.getPayload());
            JsonNode alerts = payload.path("alerts");
            if (alerts.isMissingNode() || !alerts.isArray() || alerts.isEmpty()) {
                return "No alerts array found in payload.";
            }

            JsonNode firstAlert = alerts.get(0);
            String relatedLogsUrl = firstAlert.path("annotations").path("related_logs").asText("");

            if (relatedLogsUrl.isEmpty()) {
                return "No related_logs URL found in the alert payload.";
            }

            // 3. Extract compositeQuery from relatedLogsUrl
            String compositeQueryParam = "compositeQuery=";
            int startIndex = relatedLogsUrl.indexOf(compositeQueryParam);
            if (startIndex == -1) {
                return "compositeQuery parameter not found in related_logs URL.";
            }

            startIndex += compositeQueryParam.length();
            int endIndex = relatedLogsUrl.indexOf("&", startIndex);
            if (endIndex == -1) {
                endIndex = relatedLogsUrl.length();
            }

            String encodedCompositeQuery = relatedLogsUrl.substring(startIndex, endIndex);
            String decodedCompositeQuery = URLDecoder.decode(encodedCompositeQuery, StandardCharsets.UTF_8);
            // SigNoz often double-encodes the query in the URL
            while (decodedCompositeQuery.contains("%7B") || decodedCompositeQuery.contains("%22")) {
                decodedCompositeQuery = URLDecoder.decode(decodedCompositeQuery, StandardCharsets.UTF_8);
            }

            com.fasterxml.jackson.databind.node.ObjectNode compositeQueryNode = (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper
                    .readTree(decodedCompositeQuery);
            compositeQueryNode.remove("queryType");
            compositeQueryNode.remove("panelType");

            // 4. Extract time range (start, end)
            // URL might have startTime and endTime
            long startTime = extractTimeParam(relatedLogsUrl, "startTime=");
            long endTime = extractTimeParam(relatedLogsUrl, "endTime=");

            if (startTime == 0 || endTime == 0) {
                // fallback to something reasonable, e.g. last 15 minutes
                endTime = System.currentTimeMillis();
                startTime = endTime - (15 * 60 * 1000);
            }

            // 5. Construct request to SigNoz API
            String apiUrl = signozHost.replaceAll("/+$", "") + "/api/v5/query_range";
            
            com.fasterxml.jackson.databind.node.ArrayNode queriesNode = objectMapper.createArrayNode();
            JsonNode builderNode = compositeQueryNode.path("builder");
            JsonNode queryDataArray = builderNode.isMissingNode() ? compositeQueryNode.path("queryData") : builderNode.path("queryData");
            
            if (!queryDataArray.isMissingNode() && queryDataArray.isArray()) {
                for (JsonNode qd : queryDataArray) {
                    com.fasterxml.jackson.databind.node.ObjectNode queryNode = objectMapper.createObjectNode();
                    queryNode.put("type", "builder_query");
                    
                    com.fasterxml.jackson.databind.node.ObjectNode specNode = objectMapper.createObjectNode();
                    specNode.put("name", qd.path("queryName").asText("A"));
                    specNode.put("signal", qd.path("dataSource").asText("logs"));
                    specNode.put("stepInterval", qd.path("stepInterval").asInt(60));
                    specNode.put("disabled", qd.path("disabled").asBoolean(false));
                    specNode.set("filter", qd.path("filter"));
                    specNode.put("limit", 100);
                    specNode.put("offset", 0);
                    
                    queryNode.set("spec", specNode);
                    queriesNode.add(queryNode);
                }
            }

            com.fasterxml.jackson.databind.node.ObjectNode newCompositeQuery = objectMapper.createObjectNode();
            newCompositeQuery.set("queries", queriesNode);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("schemaVersion", "v1");
            requestBody.put("start", startTime);
            requestBody.put("end", endTime);
            requestBody.put("requestType", "raw");
            requestBody.put("compositeQuery", newCompositeQuery);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (!signozToken.isEmpty()) {
                headers.set("SIGNOZ-API-KEY", signozToken);
            }

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);

            log.info("Fetching logs from SigNoz: {}", apiUrl);
            String response = restTemplate.postForObject(apiUrl, requestEntity, String.class);

            // 6. Simplify the response for the LLM
            return extractLogsFromResponse(response);

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Failed to fetch logs from SigNoz: {}", e.getMessage(), e);
            return "Failed to fetch logs from SigNoz: " + e.getMessage();
        } catch (Exception e) {
            log.error("Failed to fetch logs from SigNoz: {}", e.getMessage(), e);
            return "Failed to fetch logs from SigNoz: " + e.getMessage();
        }
    }

    private long extractTimeParam(String url, String param) {
        int idx = url.indexOf(param);
        if (idx == -1)
            return 0;
        idx += param.length();
        int endIdx = url.indexOf("&", idx);
        if (endIdx == -1)
            endIdx = url.length();
        try {
            return Long.parseLong(url.substring(idx, endIdx));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String extractLogsFromResponse(String responseJson) {
        try {
            log.info("logs : {}", responseJson);
            JsonNode root = objectMapper.readTree(responseJson);
            
            JsonNode dataNode = root.path("data");
            JsonNode results = dataNode.path("data").path("results");
            if (results.isMissingNode() || !results.isArray()) {
                results = dataNode.path("results");
            }

            StringBuilder sb = new StringBuilder();

            if (results.isArray()) {
                for (JsonNode resultItem : results) {
                    JsonNode rows = resultItem.path("rows");
                    if (rows.isArray()) {
                        for (JsonNode rowItem : rows) {
                            JsonNode rowData = rowItem.path("data");
                            String body = rowData.path("body").asText("");
                            if (!body.isEmpty()) {
                                sb.append(body).append("\n");
                            }
                            JsonNode attributes = rowData.path("attributes_string");
                            if (!attributes.isMissingNode()) {
                                String exceptionMsg = attributes.path("exception.message").asText("");
                                String stacktrace = attributes.path("exception.stacktrace").asText("");
                                if (!exceptionMsg.isEmpty()) {
                                    sb.append("Exception: ").append(exceptionMsg).append("\n");
                                }
                                if (!stacktrace.isEmpty()) {
                                    sb.append("Stacktrace:\n").append(stacktrace).append("\n");
                                }
                            }
                        }
                    }
                }
            } else {
                // Fallback to legacy format
                JsonNode legacyResult = dataNode.path("result");
                if (legacyResult.isArray()) {
                    for (JsonNode item : legacyResult) {
                        JsonNode list = item.path("list");
                        if (list.isArray()) {
                            for (JsonNode logItem : list) {
                                JsonNode itemData = logItem.path("data");
                                String body = itemData.path("body").asText("");
                                if (!body.isEmpty()) {
                                    sb.append(body).append("\n");
                                }
                            }
                        }
                    }
                }
            }

            String result = sb.toString().trim();
            return result.isEmpty() ? "Log query returned empty results." : result;

        } catch (Exception e) {
            log.error("Failed to parse SigNoz API response: {}", e.getMessage(), e);
            return "Failed to parse SigNoz API response: " + e.getMessage();
        }
    }
}
