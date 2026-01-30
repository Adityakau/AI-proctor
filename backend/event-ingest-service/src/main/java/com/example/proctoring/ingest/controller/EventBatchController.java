package com.example.proctoring.ingest.controller;

import com.example.proctoring.common.dto.AnomalyEventBatchRequest;
import com.example.proctoring.ingest.service.EventIngestService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/proctoring/events")
public class EventBatchController {

    private final EventIngestService ingestService;

    public EventBatchController(EventIngestService ingestService) {
        this.ingestService = ingestService;
    }

    @PostMapping("/batch")
    public ResponseEntity<?> ingestBatch(
            @org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AnomalyEventBatchRequest request) {

        EventIngestService.BatchResult result = ingestService.processBatch(jwt, request);
        return ResponseEntity.ok(Map.of(
                "acceptedEventIds", result.getAcceptedEventIds(),
                "rejectedEventIds", result.getRejectedEventIds(),
                "reasonByEventId", result.getReasonByEventId()));
    }
}
