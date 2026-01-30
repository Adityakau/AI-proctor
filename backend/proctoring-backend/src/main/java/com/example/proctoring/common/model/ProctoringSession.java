package com.example.proctoring.common.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "proctoring_sessions", indexes = {
        @Index(name = "idx_session_identity", columnList = "tenant_id, exam_schedule_id, user_id, attempt_no", unique = true),
        @Index(name = "idx_session_status", columnList = "tenant_id, status")
})
public class ProctoringSession {

    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id = UUID.randomUUID().toString();

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "exam_schedule_id", nullable = false, length = 128)
    private String examScheduleId;

    @Column(name = "user_id", nullable = false, length = 128)
    private String userId;

    @Column(name = "attempt_no", nullable = false)
    private int attemptNo;

    @Column(name = "status", nullable = false, length = 24)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "last_heartbeat_at")
    private Instant lastHeartbeatAt;

    @Column(name = "current_risk_score", nullable = false)
    private double currentRiskScore = 0.0;

    @Lob
    @Column(name = "config_snapshot_json")
    private String configSnapshotJson;

    public String getId() {
        return id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getExamScheduleId() {
        return examScheduleId;
    }

    public void setExamScheduleId(String examScheduleId) {
        this.examScheduleId = examScheduleId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public int getAttemptNo() {
        return attemptNo;
    }

    public void setAttemptNo(int attemptNo) {
        this.attemptNo = attemptNo;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(Instant endedAt) {
        this.endedAt = endedAt;
    }

    public Instant getLastHeartbeatAt() {
        return lastHeartbeatAt;
    }

    public void setLastHeartbeatAt(Instant lastHeartbeatAt) {
        this.lastHeartbeatAt = lastHeartbeatAt;
    }

    public double getCurrentRiskScore() {
        return currentRiskScore;
    }

    public void setCurrentRiskScore(double currentRiskScore) {
        this.currentRiskScore = currentRiskScore;
    }

    public String getConfigSnapshotJson() {
        return configSnapshotJson;
    }

    public void setConfigSnapshotJson(String configSnapshotJson) {
        this.configSnapshotJson = configSnapshotJson;
    }
}
