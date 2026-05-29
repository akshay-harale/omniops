package com.omniops.backend.controller;

import com.omniops.backend.domain.AgentRun;
import com.omniops.backend.service.AgentRunService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/agent-runs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AgentRunController {
    private final AgentRunService agentRunService;

    @GetMapping("/incident/{incidentId}")
    public ResponseEntity<AgentRun> getAgentRun(@PathVariable UUID incidentId) {
        try {
            return ResponseEntity.ok(agentRunService.getAgentRunByIncident(incidentId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<AgentRun> saveAgentRun(@RequestBody AgentRunRequest request) {
        AgentRun run = agentRunService.saveAgentRun(
                request.getIncidentId(),
                request.getReasoningSteps(),
                request.getFinalSummary(),
                request.getTokensUsed(),
                request.getStatus()
        );
        return ResponseEntity.ok(run);
    }

    @Data
    public static class AgentRunRequest {
        private UUID incidentId;
        private String reasoningSteps;
        private String finalSummary;
        private Integer tokensUsed;
        private String status;
    }
}
