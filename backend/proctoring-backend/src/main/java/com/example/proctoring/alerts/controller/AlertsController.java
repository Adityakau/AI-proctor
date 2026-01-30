package com.example.proctoring.alerts.controller;

import com.example.proctoring.common.repository.AlertRepository;
import com.example.proctoring.common.repository.AnomalyEventRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/proctoring/sessions")
public class AlertsController {

    private final AlertRepository alertRepository;
    private final AnomalyEventRepository eventRepository;

    public AlertsController(AlertRepository alertRepository, AnomalyEventRepository eventRepository) {
        this.alertRepository = alertRepository;
        this.eventRepository = eventRepository;
    }

    @GetMapping("/{sessionId}/alerts")
    public ResponseEntity<Map<String, Object>> getAlerts(
            @PathVariable("sessionId") String sessionId,
            @AuthenticationPrincipal Jwt jwt) {

        var alerts = alertRepository.findBySessionIdOrderByCreatedAtDesc(sessionId);

        List<Map<String, Object>> alertList = alerts.stream().map(a -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", a.getId());
            m.put("type", a.getType());
            m.put("severity", a.getSeverity());
            m.put("createdAt", a.getCreatedAt().toString());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("alerts", alertList));
    }

    @GetMapping("/{sessionId}/events")
    public ResponseEntity<Map<String, Object>> getEvents(
            @PathVariable("sessionId") String sessionId,
            @AuthenticationPrincipal Jwt jwt) {

        var events = eventRepository.findBySessionIdOrderByEventTimeDesc(sessionId);

        List<Map<String, Object>> eventList = events.stream().map(e -> {
            Map<String, Object> m = new HashMap<>();
            m.put("eventId", e.getEventId());
            m.put("type", e.getEventType());
            m.put("severity", e.getSeverity());
            m.put("confidence", e.getConfidence());
            m.put("eventTime", e.getEventTime().toString());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("events", eventList));
    }
}
