package com.example.proctoring.dashboard.controller;

import com.example.proctoring.common.dto.AlertDTO;
import com.example.proctoring.common.dto.RiskTimelinePointDTO;
import com.example.proctoring.common.model.AnomalyEvent;
import com.example.proctoring.common.model.Alert;
import com.example.proctoring.common.model.ProctoringSession;
import com.example.proctoring.common.model.RiskScoreSnapshot;
import com.example.proctoring.common.repository.AlertRepository;
import com.example.proctoring.common.repository.AnomalyEventRepository;
import com.example.proctoring.common.repository.ProctoringSessionRepository;
import com.example.proctoring.common.repository.RiskScoreSnapshotRepository;
import com.example.proctoring.security.JwtClaims;
import com.example.proctoring.dashboard.contract.DashboardSessionSummaryResponse;
import com.example.proctoring.dashboard.service.DashboardSessionReadService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Dashboard API controller - PLACEHOLDER for future implementation.
 * Not modified as per user requirements.
 */
@RestController
@RequestMapping("/dashboard")
public class SessionReadController {

    private final ProctoringSessionRepository sessionRepository;
    private final DashboardSessionReadService dashboardService;

    public SessionReadController(ProctoringSessionRepository sessionRepository,
                                DashboardSessionReadService dashboardService) {
        this.sessionRepository = sessionRepository;
        this.dashboardService = dashboardService;
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

    @GetMapping("/sessions/{id}/summary")
    public ResponseEntity<DashboardSessionSummaryResponse> getSessionSummary(
            @org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt,
            @PathVariable String id) {
        JwtClaims claims = JwtClaims.fromJwt(jwt);
        return dashboardService.getSessionSummary(id, claims.getTenantId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
