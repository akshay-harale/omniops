package com.omniops.backend.service;

import com.omniops.backend.domain.AgentRun;
import com.omniops.backend.domain.Incident;
import com.omniops.backend.repository.AgentRunRepository;
import com.omniops.backend.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AgentRunService {
    private final AgentRunRepository agentRunRepository;
    private final IncidentRepository incidentRepository;

    public AgentRun saveAgentRun(UUID incidentId, String reasoningSteps, String finalSummary, Integer tokensUsed, String status) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new IllegalArgumentException("Incident not found: " + incidentId));

        AgentRun run = agentRunRepository.findByIncidentId(incidentId)
                .orElse(AgentRun.builder()
                        .incident(incident)
                        .build());

        run.setReasoningSteps(reasoningSteps);
        run.setFinalSummary(finalSummary);
        run.setTokensUsed(tokensUsed);
        run.setStatus(status);
        if ("COMPLETED".equals(status) || "FAILED".equals(status)) {
            run.setCompletedAt(LocalDateTime.now());
        }

        return agentRunRepository.save(run);
    }

    public AgentRun getAgentRunByIncident(UUID incidentId) {
        return agentRunRepository.findByIncidentId(incidentId)
                .orElseThrow(() -> new IllegalArgumentException("AgentRun not found for incident: " + incidentId));
    }
}
