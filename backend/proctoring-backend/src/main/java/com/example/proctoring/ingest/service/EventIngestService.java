package com.example.proctoring.ingest.service;

import com.example.proctoring.common.dto.AnomalyEventBatchRequest;
import com.example.proctoring.common.dto.AnomalyEventDTO;
import com.example.proctoring.common.model.Alert;
import com.example.proctoring.common.model.AnomalyEvent;
import com.example.proctoring.common.model.Evidence;
import com.example.proctoring.common.model.ProctoringSession;
import com.example.proctoring.common.repository.AlertRepository;
import com.example.proctoring.common.repository.AnomalyEventRepository;
import com.example.proctoring.common.repository.EvidenceRepository;
import com.example.proctoring.common.repository.ProctoringSessionRepository;
import com.example.proctoring.security.JwtClaims;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class EventIngestService {

    private final ProctoringSessionRepository sessionRepository;
    private final AnomalyEventRepository anomalyEventRepository;
    private final AlertRepository alertRepository;
    private final EvidenceRepository evidenceRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${proctoring.events.max-batch-size-bytes:65536}")
    private int maxBatchSizeBytes;

    @Value("${proctoring.rate-limit.max-events-per-minute:600}")
    private int maxEventsPerMinute;

    @Value("${proctoring.replay.event-ttl-seconds:3600}")
    private int eventTtlSeconds;

    public EventIngestService(ProctoringSessionRepository sessionRepository,
            AnomalyEventRepository anomalyEventRepository,
            AlertRepository alertRepository,
            EvidenceRepository evidenceRepository,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper) {
        this.sessionRepository = sessionRepository;
        this.anomalyEventRepository = anomalyEventRepository;
        this.alertRepository = alertRepository;
        this.evidenceRepository = evidenceRepository;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public BatchResult processBatch(Jwt jwt, AnomalyEventBatchRequest request) {
        JwtClaims claims = JwtClaims.fromJwt(jwt);

        ProctoringSession session = sessionRepository
                .findById(request.getSessionId())
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        if (!Objects.equals(session.getTenantId(), claims.getTenantId()) ||
                !Objects.equals(session.getExamScheduleId(), claims.getExamScheduleId()) ||
                !Objects.equals(session.getUserId(), claims.getUserId()) ||
                session.getAttemptNo() != claims.getAttemptNo()) {
            throw new IllegalArgumentException("JWT claims do not match session identity");
        }

        int approximateSize = approximateBatchSize(request);
        if (approximateSize > maxBatchSizeBytes) {
            throw new IllegalArgumentException("Batch too large");
        }

        List<String> accepted = new ArrayList<>();
        List<String> rejected = new ArrayList<>();
        Map<String, String> reason = new HashMap<>();

        for (AnomalyEventDTO eventDTO : request.getEvents()) {
            String eventId = eventDTO.getEventId();
            if (eventId == null || eventId.isBlank()) {
                continue;
            }
            try {
                if (isReplay(eventId)) {
                    rejected.add(eventId);
                    reason.put(eventId, "duplicate");
                    continue;
                }
                if (!withinTimeSkew(eventDTO.getTimestamp())) {
                    rejected.add(eventId);
                    reason.put(eventId, "timestamp_out_of_range");
                    continue;
                }
                if (!rateLimit(session.getId())) {
                    rejected.add(eventId);
                    reason.put(eventId, "rate_limited");
                    continue;
                }

                AnomalyEvent entity = toEntity(session, eventDTO);
                anomalyEventRepository.save(entity);

                // Generate alert if severity warrants it
                generateAlertIfNeeded(session.getId(), eventDTO);

                markSeen(eventId);
                accepted.add(eventId);
            } catch (Exception e) {
                rejected.add(eventId);
                reason.put(eventId, "internal_error");
            }
        }

        // Process thumbnails and create Evidence records
        if (request.getThumbnails() != null) {
            for (var thumb : request.getThumbnails()) {
                try {
                    String eventId = thumb.getEventId();
                    if (!accepted.contains(eventId))
                        continue;

                    // Decode and save to disk
                    byte[] data = Base64.getDecoder().decode(thumb.getDataBase64());
                    String sha256 = computeSha256(data);
                    String filename = "thumb-" + eventId + ".jpg";
                    java.nio.file.Path dir = java.nio.file.Paths.get("/tmp/proctoring/thumbnails", session.getId());
                    java.nio.file.Files.createDirectories(dir);
                    java.nio.file.Path filePath = dir.resolve(filename);
                    java.nio.file.Files.write(filePath, data);

                    // Create Evidence record
                    Evidence evidence = new Evidence();
                    evidence.setSessionId(session.getId());
                    evidence.setFilePath(filePath.toString());
                    evidence.setSha256(sha256);
                    evidence.setByteSize(data.length);
                    evidence.setMimeType("image/jpeg");
                    evidenceRepository.save(evidence);

                    // Link evidence to event
                    var event = anomalyEventRepository.findById(eventId).orElse(null);
                    if (event != null) {
                        event.setEvidenceId(evidence.getId());
                        event.setThumbnailMetaJson(objectMapper.writeValueAsString(Map.of(
                                "path", filePath.toString(),
                                "size", data.length,
                                "sha256", sha256)));
                        anomalyEventRepository.save(event);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }

        return new BatchResult(accepted, rejected, reason);
    }

    private void generateAlertIfNeeded(String sessionId, AnomalyEventDTO event) {
        String severity = event.getSeverity();
        String type = event.getType();

        boolean shouldAlert = false;
        String alertSeverity = "MEDIUM";

        if ("CRITICAL".equals(severity) || "HIGH".equals(severity)) {
            shouldAlert = true;
            alertSeverity = severity;
        } else if ("MULTI_PERSON".equals(type)) {
            shouldAlert = true;
            alertSeverity = "CRITICAL";
        } else if ("CAMERA_BLOCKED".equals(type) || "FACE_MISSING".equals(type)) {
            String countKey = "alert-count:" + sessionId + ":" + type;
            Long count = redisTemplate.opsForValue().increment(countKey);
            if (count != null && count == 1L) {
                redisTemplate.expire(countKey, Duration.ofMinutes(5));
            }
            if (count != null && count >= 3) {
                shouldAlert = true;
                alertSeverity = "HIGH";
            }
        } else if ("TAB_SWITCH".equals(type)) {
            // TAB_SWITCH: alert after 2 occurrences in 5 minutes
            String countKey = "alert-count:" + sessionId + ":" + type;
            Long count = redisTemplate.opsForValue().increment(countKey);
            if (count != null && count == 1L) {
                redisTemplate.expire(countKey, Duration.ofMinutes(5));
            }
            if (count != null && count >= 2) {
                shouldAlert = true;
                alertSeverity = "MEDIUM";
            }
        } else if ("LOOK_AWAY".equals(type)) {
            // LOOK_AWAY: alert after 5 occurrences in 5 minutes to reduce noise
            String countKey = "alert-count:" + sessionId + ":" + type;
            Long count = redisTemplate.opsForValue().increment(countKey);
            if (count != null && count == 1L) {
                redisTemplate.expire(countKey, Duration.ofMinutes(5));
            }
            if (count != null && count >= 5) {
                shouldAlert = true;
                alertSeverity = "MEDIUM";
            }
        }
        // LOW_LIGHT: stored but no alert generated (informational)

        if (shouldAlert) {
            Alert alert = new Alert();
            alert.setSessionId(sessionId);
            alert.setType(type);
            alert.setSeverity(alertSeverity);
            try {
                alert.setDetailsJson(objectMapper.writeValueAsString(Map.of(
                        "eventId", event.getEventId(),
                        "confidence", event.getConfidence(),
                        "details", event.getDetails() != null ? event.getDetails() : Map.of())));
            } catch (Exception e) {
                alert.setDetailsJson("{}");
            }
            alertRepository.save(alert);
        }
    }

    private boolean withinTimeSkew(Instant ts) {
        if (ts == null)
            return false;
        Instant now = Instant.now();
        long skewSeconds = Math.abs(now.getEpochSecond() - ts.getEpochSecond());
        return skewSeconds <= 300;
    }

    private boolean isReplay(String eventId) {
        String key = "event-replay:" + eventId;
        Boolean exists = redisTemplate.hasKey(key);
        return Boolean.TRUE.equals(exists);
    }

    private void markSeen(String eventId) {
        String key = "event-replay:" + eventId;
        redisTemplate.opsForValue().set(key, "1", Duration.ofSeconds(eventTtlSeconds));
    }

    private boolean rateLimit(String sessionId) {
        String key = "rate:" + sessionId + ":" + (Instant.now().getEpochSecond() / 60);
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redisTemplate.expire(key, Duration.ofMinutes(2));
        }
        return count == null || count <= maxEventsPerMinute;
    }

    private int approximateBatchSize(AnomalyEventBatchRequest request) {
        try {
            return objectMapper.writeValueAsBytes(request).length;
        } catch (Exception e) {
            return Integer.MAX_VALUE;
        }
    }

    private String computeSha256(byte[] data) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private AnomalyEvent toEntity(ProctoringSession session, AnomalyEventDTO dto) {
        AnomalyEvent entity = new AnomalyEvent();
        entity.setEventId(dto.getEventId());
        entity.setSessionId(session.getId());
        entity.setEventType(dto.getType());
        entity.setEventTime(dto.getTimestamp());
        entity.setConfidence(dto.getConfidence());
        entity.setSeverity(dto.getSeverity() != null ? dto.getSeverity() : "MEDIUM");
        try {
            entity.setDetailsJson(objectMapper.writeValueAsString(dto.getDetails()));
        } catch (Exception e) {
            entity.setDetailsJson("{}");
        }
        return entity;
    }

    public static class BatchResult {
        private final List<String> acceptedEventIds;
        private final List<String> rejectedEventIds;
        private final Map<String, String> reasonByEventId;

        public BatchResult(List<String> acceptedEventIds, List<String> rejectedEventIds,
                Map<String, String> reasonByEventId) {
            this.acceptedEventIds = acceptedEventIds;
            this.rejectedEventIds = rejectedEventIds;
            this.reasonByEventId = reasonByEventId;
        }

        public List<String> getAcceptedEventIds() {
            return acceptedEventIds;
        }

        public List<String> getRejectedEventIds() {
            return rejectedEventIds;
        }

        public Map<String, String> getReasonByEventId() {
            return reasonByEventId;
        }
    }
}
