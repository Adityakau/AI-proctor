package com.example.proctoring.ingest.service;

import com.example.proctoring.common.model.ProctoringSession;
import com.example.proctoring.ingest.repository.ProctoringSessionRepository;
import com.example.proctoring.security.JwtClaims;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

@Service
public class SessionService {

    private final ProctoringSessionRepository repository;
    private final ObjectMapper objectMapper;

    public SessionService(ProctoringSessionRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ProctoringSession startSession(JwtClaims claims, Map<String, Object> configSnapshot) {
        ProctoringSession session = repository
                .findByTenantIdAndExamScheduleIdAndUserIdAndAttemptNo(
                        claims.getTenantId(),
                        claims.getExamScheduleId(),
                        claims.getUserId(),
                        claims.getAttemptNo())
                .orElseGet(ProctoringSession::new);

        session.setTenantId(claims.getTenantId());
        session.setExamScheduleId(claims.getExamScheduleId());
        session.setUserId(claims.getUserId());
        session.setAttemptNo(claims.getAttemptNo());
        session.setStatus("ACTIVE");
        session.setStartedAt(Instant.now());
        session.setLastHeartbeatAt(Instant.now());
        try {
            session.setConfigSnapshotJson(objectMapper.writeValueAsString(configSnapshot));
        } catch (Exception e) {
            session.setConfigSnapshotJson("{}");
        }
        return repository.save(session);
    }

    @Transactional
    public ProctoringSession endSession(JwtClaims claims) {
        ProctoringSession session = repository
                .findByTenantIdAndExamScheduleIdAndUserIdAndAttemptNo(
                        claims.getTenantId(),
                        claims.getExamScheduleId(),
                        claims.getUserId(),
                        claims.getAttemptNo())
                .orElseThrow(() -> new IllegalStateException("Session not found for claims"));
        session.setStatus("ENDED");
        session.setEndedAt(Instant.now());
        return repository.save(session);
    }

    @Transactional
    public ProctoringSession heartbeat(JwtClaims claims) {
        ProctoringSession session = repository
                .findByTenantIdAndExamScheduleIdAndUserIdAndAttemptNo(
                        claims.getTenantId(),
                        claims.getExamScheduleId(),
                        claims.getUserId(),
                        claims.getAttemptNo())
                .orElseThrow(() -> new IllegalStateException("Session not found for claims"));
        session.setLastHeartbeatAt(Instant.now());
        return repository.save(session);
    }
}
