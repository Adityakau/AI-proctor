package com.example.proctoring.common.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "proctoring_alerts", indexes = {
        @Index(name = "idx_alerts_session_time", columnList = "session_id, created_at"),
        @Index(name = "idx_alerts_severity", columnList = "severity")
})
public class Alert {

    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id = UUID.randomUUID().toString();

    @Column(name = "session_id", nullable = false, length = 36)
    private String sessionId;

    @Column(name = "severity", nullable = false, length = 16)
    private String severity;

    @Column(name = "type", nullable = false, length = 64)
    private String type;

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

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
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
