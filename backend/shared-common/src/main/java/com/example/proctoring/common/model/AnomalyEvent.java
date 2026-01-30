package com.example.proctoring.common.model;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "proctoring_anomaly_events", indexes = {
        @Index(name = "idx_events_session_time", columnList = "session_id, event_time"),
        @Index(name = "idx_events_type", columnList = "event_type")
})
public class AnomalyEvent {

    @Id
    @Column(name = "event_id", nullable = false, updatable = false, length = 128)
    private String eventId;

    @Column(name = "session_id", nullable = false, length = 36)
    private String sessionId;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "event_time", nullable = false)
    private Instant eventTime;

    @Column(name = "severity", nullable = false, length = 16)
    private String severity;

    @Column(name = "confidence")
    private Double confidence;

    @Lob
    @Column(name = "details_json")
    private String detailsJson;

    @Lob
    @Column(name = "thumbnail_meta_json")
    private String thumbnailMetaJson;

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public Instant getEventTime() {
        return eventTime;
    }

    public void setEventTime(Instant eventTime) {
        this.eventTime = eventTime;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public String getDetailsJson() {
        return detailsJson;
    }

    public void setDetailsJson(String detailsJson) {
        this.detailsJson = detailsJson;
    }

    public String getThumbnailMetaJson() {
        return thumbnailMetaJson;
    }

    public void setThumbnailMetaJson(String thumbnailMetaJson) {
        this.thumbnailMetaJson = thumbnailMetaJson;
    }
}
