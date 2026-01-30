package com.example.proctoring.common.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "risk_score_snapshots",
        indexes = {
                @Index(name = "idx_risk_session_time", columnList = "session_id, created_at")
        }
)
public class RiskScoreSnapshot {

    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id = UUID.randomUUID().toString();

    @Column(name = "session_id", nullable = false, length = 36)
    private String sessionId;

    @Column(name = "score", nullable = false)
    private double score;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Lob
    @Column(name = "details_json")
    private String detailsJson;

    public String getId() {
        return id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getDetailsJson() {
        return detailsJson;
    }

    public void setDetailsJson(String detailsJson) {
        this.detailsJson = detailsJson;
    }
}

