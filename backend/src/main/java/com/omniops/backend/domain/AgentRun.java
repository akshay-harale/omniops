package com.omniops.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "agent_run")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentRun {
    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "incident_id", nullable = false)
    private Incident incident;

    @Column(name = "reasoning_steps", columnDefinition = "TEXT")
    private String reasoningSteps;

    @Column(name = "final_summary", columnDefinition = "TEXT")
    private String finalSummary;

    @Column(name = "tokens_used")
    private Integer tokensUsed;

    @Column(nullable = false)
    private String status;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
