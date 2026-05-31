package com.omniops.backend.controller;

import com.omniops.backend.service.ContextAggregationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/context")
@RequiredArgsConstructor
public class ContextController {

    private final ContextAggregationService contextAggregationService;

    @GetMapping("/incident/{incidentId}")
    public ResponseEntity<Map<String, String>> getContext(@PathVariable UUID incidentId) {
        try {
            Map<String, String> context = contextAggregationService.gatherContext(incidentId);
            return ResponseEntity.ok(context);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
