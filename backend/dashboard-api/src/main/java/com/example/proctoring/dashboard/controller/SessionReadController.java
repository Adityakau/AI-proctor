package com.example.proctoring.dashboard.controller;

import com.example.proctoring.common.dto.AlertDTO;
import com.example.proctoring.common.dto.RiskTimelinePointDTO;
import com.example.proctoring.common.model.AnomalyEvent;
import com.example.proctoring.common.model.Alert;
import com.example.proctoring.common.model.ProctoringSession;
import com.example.proctoring.common.model.RiskScoreSnapshot;
import com.example.proctoring.dashboard.repository.AlertRepository;
import com.example.proctoring.dashboard.repository.AnomalyEventRepository;
import com.example.proctoring.dashboard.repository.ProctoringSessionRepository;
import com.example.proctoring.dashboard.repository.RiskScoreSnapshotRepository;
import com.example.proctoring.security.JwtClaims;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping
public class SessionReadController {

    private final ProctoringSessionRepository sessionRepository;
    private final AnomalyEventRepository eventRepository;
    private final AlertRepository alertRepository;
    private final RiskScoreSnapshotRepository snapshotRepository;

    public SessionReadController(ProctoringSessionRepository sessionRepository,
            AnomalyEventRepository eventRepository,
            AlertRepository alertRepository,
            RiskScoreSnapshotRepository snapshotRepository) {
        this.sessionRepository = sessionRepository;
        this.eventRepository = eventRepository;
        this.alertRepository = alertRepository;
        this.snapshotRepository = snapshotRepository;
    }

    @GetMapping("/sessions")
    public Page<ProctoringSession> listSessions(
            @org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt,
            @RequestParam String tenantId,
            @RequestParam String examScheduleId,
            Pageable pageable) {

        JwtClaims claims = JwtClaims.fromJwt(jwt);
        if (!claims.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("Tenant mismatch");
        }
        return sessionRepository.findByTenantIdAndExamScheduleId(tenantId, examScheduleId, pageable);
    }

    @GetMapping("/sessions/{id}")
    public ResponseEntity<ProctoringSession> getSession(
            @org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt,
            @PathVariable String id) {
        JwtClaims claims = JwtClaims.fromJwt(jwt);
        return sessionRepository.findById(id)
                .filter(s -> s.getTenantId().equals(claims.getTenantId()))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/sessions/{id}/events")
    public Page<AnomalyEvent> getEvents(
            @org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt,
            @PathVariable String id,
            Pageable pageable) {
        JwtClaims claims = JwtClaims.fromJwt(jwt);
        ProctoringSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        if (!session.getTenantId().equals(claims.getTenantId())) {
            throw new IllegalArgumentException("Tenant mismatch");
        }
        return eventRepository.findBySessionId(id, pageable);
    }

    @GetMapping("/sessions/{id}/alerts")
    public Page<AlertDTO> getAlerts(
            @org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt,
            @PathVariable String id,
            Pageable pageable) {
        JwtClaims claims = JwtClaims.fromJwt(jwt);
        ProctoringSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        if (!session.getTenantId().equals(claims.getTenantId())) {
            throw new IllegalArgumentException("Tenant mismatch");
        }

        Page<Alert> page = alertRepository.findBySessionId(id, pageable);
        return page.map(a -> {
            AlertDTO dto = new AlertDTO();
            dto.setId(a.getId());
            dto.setSessionId(a.getSessionId());
            dto.setSeverity(a.getSeverity());
            dto.setType(a.getType());
            dto.setCreatedAt(a.getCreatedAt());
            dto.setDetailsJson(a.getDetailsJson());
            return dto;
        });
    }

    @GetMapping("/sessions/{id}/risk-timeline")
    public List<RiskTimelinePointDTO> getRiskTimeline(
            @org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt,
            @PathVariable String id) {

        JwtClaims claims = JwtClaims.fromJwt(jwt);
        ProctoringSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        if (!session.getTenantId().equals(claims.getTenantId())) {
            throw new IllegalArgumentException("Tenant mismatch");
        }

        List<RiskScoreSnapshot> snapshots = snapshotRepository.findBySessionIdOrderByCreatedAtAsc(id);
        return snapshots.stream()
                .map(s -> new RiskTimelinePointDTO(s.getCreatedAt(), s.getScore()))
                .collect(Collectors.toList());
    }
}
