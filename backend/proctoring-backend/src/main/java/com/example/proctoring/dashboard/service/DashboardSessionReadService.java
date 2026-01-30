package com.example.proctoring.dashboard.service;

import com.example.proctoring.common.model.Alert;
import com.example.proctoring.common.model.Evidence;
import com.example.proctoring.common.model.ProctoringSession;
import com.example.proctoring.common.repository.AlertRepository;
import com.example.proctoring.common.repository.EvidenceRepository;
import com.example.proctoring.common.repository.ProctoringSessionRepository;
import com.example.proctoring.dashboard.contract.AlertSummaryItem;
import com.example.proctoring.dashboard.contract.DashboardSessionSummaryResponse;
import com.example.proctoring.dashboard.contract.EvidenceSummaryItem;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DashboardSessionReadService {

    private static final Logger log = LoggerFactory.getLogger(DashboardSessionReadService.class);

    private final ProctoringSessionRepository sessionRepository;
    private final AlertRepository alertRepository;
    private final EvidenceRepository evidenceRepository;
    private final ObjectMapper objectMapper;

    public DashboardSessionReadService(ProctoringSessionRepository sessionRepository,
                                     AlertRepository alertRepository,
                                     EvidenceRepository evidenceRepository,
                                     ObjectMapper objectMapper) {
        this.sessionRepository = sessionRepository;
        this.alertRepository = alertRepository;
        this.evidenceRepository = evidenceRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Optional<DashboardSessionSummaryResponse> getSessionSummary(String sessionId, String tenantId) {
        return sessionRepository.findById(sessionId)
                .filter(session -> session.getTenantId().equals(tenantId))
                .map(session -> {
                    List<Alert> alerts = alertRepository.findBySessionIdOrderByCreatedAtDesc(sessionId);
                    List<Evidence> evidenceList = evidenceRepository.findBySessionIdOrderByCreatedAtDesc(sessionId);

                    boolean alertsUpdated = fixEvidenceLinkage(alerts, evidenceList);
                    if (alertsUpdated) {
                        alertRepository.saveAll(alerts);
                    }

                    return assembleResponse(session, alerts, evidenceList);
                });
    }

    private boolean fixEvidenceLinkage(List<Alert> alerts, List<Evidence> evidenceList) {
        if (evidenceList.isEmpty()) {
            return false;
        }

        boolean updated = false;
        for (Alert alert : alerts) {
            if (alert.getEvidenceId() == null) {
                String evidenceId = findMatchingEvidence(alert, evidenceList);
                if (evidenceId != null) {
                    alert.setEvidenceId(evidenceId);
                    updated = true;
                }
            }
        }
        return updated;
    }

    private String findMatchingEvidence(Alert alert, List<Evidence> evidenceList) {
        if (evidenceList.size() == 1) {
            return evidenceList.get(0).getId();
        }

        return evidenceList.stream()
                .min(Comparator.comparing(e -> Duration.between(e.getCreatedAt(), alert.getCreatedAt()).abs()))
                .map(Evidence::getId)
                .orElse(null);
    }

    private DashboardSessionSummaryResponse assembleResponse(ProctoringSession session, List<Alert> alerts, List<Evidence> evidenceList) {
        Map<String, Object> config = parseJson(session.getConfigSnapshotJson());
        
        String userName = (String) config.getOrDefault("username", 
                          config.getOrDefault("displayName", 
                          config.getOrDefault("email", session.getUserId())));
        
        @SuppressWarnings("unchecked")
        Map<String, Object> deviceInfo = (Map<String, Object>) config.get("deviceInfo");

        int trustScorePercent = calculateTrustScore(alerts);
        
        List<AlertSummaryItem> alertSummary = alerts.stream()
                .collect(Collectors.groupingBy(Alert::getType, Collectors.counting()))
                .entrySet().stream()
                .map(entry -> new AlertSummaryItem(entry.getKey(), entry.getValue()))
                .toList();

        List<EvidenceSummaryItem> evidenceSummary = evidenceList.stream()
                .map(e -> new EvidenceSummaryItem(e.getId(), e.getFilePath(), e.getMimeType(), e.getCreatedAt()))
                .toList();

        return new DashboardSessionSummaryResponse(
                session.getId(),
                userName,
                trustScorePercent,
                session.getStartedAt(),
                session.getEndedAt(),
                deviceInfo,
                alertSummary,
                evidenceSummary
        );
    }

    private int calculateTrustScore(List<Alert> alerts) {
        if (alerts.isEmpty()) {
            return 100;
        }

        List<Double> confidences = alerts.stream()
                .map(alert -> {
                    Map<String, Object> details = parseJson(alert.getDetailsJson());
                    Object conf = details.get("confidence");
                    if (conf instanceof Number) {
                        return ((Number) conf).doubleValue();
                    }
                    return null;
                })
                .filter(Objects::nonNull)
                .toList();

        if (confidences.isEmpty()) {
            return 100; // Requirement says: If no alerts -> 100. If alerts exist but no confidence, maybe still 100 or ignore?
            // "If confidence missing -> ignore that alert in average"
            // If all alerts are ignored, I'll return 100.
        }

        double avgConfidence = confidences.stream().mapToDouble(Double::doubleValue).average().orElse(1.0);
        return (int) Math.round(avgConfidence * 100);
    }

    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse JSON: {}", json, e);
            return Collections.emptyMap();
        }
    }
}
