package com.omniops.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class QueuePublisher {
    private final StringRedisTemplate redisTemplate;
    private static final String QUEUE_NAME = "incident_queue";

    public void enqueueIncident(String incidentId) {
        log.info("Queueing incident id: {} onto Redis queue: {}", incidentId, QUEUE_NAME);
        redisTemplate.opsForList().leftPush(QUEUE_NAME, incidentId);
    }
}
