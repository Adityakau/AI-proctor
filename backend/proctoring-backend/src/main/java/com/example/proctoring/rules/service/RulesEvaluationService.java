package com.example.proctoring.rules.service;

import com.example.proctoring.common.kafka.AnomalyEventMessage;
import com.example.proctoring.common.model.Alert;
import com.example.proctoring.common.model.AnomalyEvent;
import com.example.proctoring.common.model.ProctoringSession;
import com.example.proctoring.common.model.RiskScoreSnapshot;
import com.example.proctoring.common.repository.AlertRepository;
import com.example.proctoring.common.repository.AnomalyEventRepository;
import com.example.proctoring.common.repository.ProctoringSessionRepository;
import com.example.proctoring.common.repository.RiskScoreSnapshotRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class RulesEvaluationService {

    private final SlidingWindowService slidingWindowService;
    private final AlertRepository alertRepository;
    private final AnomalyEventRepository anomalyEventRepository;
    private final RiskScoreSnapshotRepository snapshotRepository;
    private final ProctoringSessionRepository sessionRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RulesEvaluationService(SlidingWindowService slidingWindowService,
                                  AlertRepository alertRepository,
                                  AnomalyEventRepository anomalyEventRepository,
                                  RiskScoreSnapshotRepository snapshotRepository,
                                  ProctoringSessionRepository sessionRepository) {
        this.slidingWindowService = slidingWindowService;
        this.alertRepository = alertRepository;
        this.anomalyEventRepository = anomalyEventRepository;
        this.snapshotRepository = snapshotRepository;
        this.sessionRepository = sessionRepository;
    }

    @Transactional
    public void handleEvent(AnomalyEventMessage event) {
        String type = event.getType();
        String sessionId = event.getSessionId();
        Instant ts = event.getTimestamp();

        if (ts == null || type == null || sessionId == null) {
            return;
        }

        slidingWindowService.addEvent(sessionId, type, ts);
        slidingWindowService.trimOlderThan(sessionId, type, ts.minusSeconds(600));

        double delta = computeScoreDelta(event);
        ProctoringSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalStateException("Session not found: " + sessionId));

        double newScore = Math.max(0.0, session.getCurrentRiskScore() * 0.98 + delta);
        session.setCurrentRiskScore(newScore);
        sessionRepository.save(session);

        String severity = evaluateSeverity(sessionId, type, ts);

        AnomalyEvent persisted = new AnomalyEvent();
        persisted.setEventId(event.getEventId() != null ? event.getEventId() : ("kafka-" + sessionId + "-" + ts.toEpochMilli()));
        persisted.setSessionId(sessionId);
        persisted.setEventType(type);
        persisted.setEventTime(ts);
        persisted.setSeverity(severity != null ? severity : "NONE");
        persisted.setConfidence(event.getConfidence());
        try {
            persisted.setDetailsJson(objectMapper.writeValueAsString(event.getDetails()));
        } catch (Exception e) {
            persisted.setDetailsJson("{}");
        }
        persisted.setThumbnailMetaJson(null);
        anomalyEventRepository.save(persisted);

        if (severity != null) {
            Alert alert = new Alert();
            alert.setSessionId(sessionId);
            alert.setSeverity(severity);
            alert.setType(type);
            try {
                alert.setDetailsJson(objectMapper.writeValueAsString(event.getDetails()));
            } catch (Exception e) {
                alert.setDetailsJson("{}");
            }
            alertRepository.save(alert);
        }

        if (shouldSnapshot(ts)) {
            RiskScoreSnapshot snapshot = new RiskScoreSnapshot();
            snapshot.setSessionId(sessionId);
            snapshot.setScore(newScore);
            snapshot.setDetailsJson("{}");
            snapshotRepository.save(snapshot);
        }
    }

    private String evaluateSeverity(String sessionId, String type, Instant ts) {
        switch (type) {
            case "MULTI_PERSON":
                return "HIGH";
            case "LOOK_AWAY": {
                long count = slidingWindowService.countEventsInWindow(sessionId, type, ts.minusSeconds(30), ts);
                return count >= 5 ? "MEDIUM" : null;
            }
            case "SUSPICIOUS_OBJECT":
                return "MEDIUM";
            case "FACE_MISSING":
            case "CAMERA_BLOCKED": {
                long count = slidingWindowService.countEventsInWindow(sessionId, type, ts.minusSeconds(60), ts);
                return count >= 3 ? "HIGH" : "LOW";
            }
            case "LIGHTING_LOW": {
                long count = slidingWindowService.countEventsInWindow(sessionId, type, ts.minusSeconds(120), ts);
                return count >= 10 ? "LOW" : null;
            }
            default:
                return null;
        }
    }

    private boolean shouldSnapshot(Instant ts) {
        return ts.getEpochSecond() % 60 == 0;
    }

    private double computeScoreDelta(AnomalyEventMessage event) {
        String type = event.getType();
        double base;
        if (type == null) {
            base = 1.0;
        } else {
            switch (type) {
                case "MULTI_PERSON":
                    base = 50;
                    break;
                case "LOOK_AWAY":
                    base = 5;
                    break;
                case "SUSPICIOUS_OBJECT":
                    base = 20;
                    break;
                case "FACE_MISSING":
                case "CAMERA_BLOCKED":
                    base = 15;
                    break;
                case "LIGHTING_LOW":
                    base = 2;
                    break;
                default:
                    base = 1;
            }
        }
        Double conf = event.getConfidence();
        return base * (conf != null ? conf : 1.0);
    }
}
