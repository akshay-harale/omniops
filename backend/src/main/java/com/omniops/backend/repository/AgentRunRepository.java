package com.omniops.backend.repository;

import com.omniops.backend.domain.AgentRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AgentRunRepository extends JpaRepository<AgentRun, UUID> {
    Optional<AgentRun> findByIncidentId(UUID incidentId);
}
