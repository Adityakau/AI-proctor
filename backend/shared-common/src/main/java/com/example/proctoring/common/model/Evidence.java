package com.example.proctoring.common.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "proctoring_evidence", indexes = {
        @Index(name = "idx_evidence_session", columnList = "session_id")
})
public class Evidence {

    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id = UUID.randomUUID().toString();

    @Column(name = "session_id", nullable = false, length = 36)
    private String sessionId;

    @Column(name = "file_path", nullable = false, length = 512)
    private String filePath;

    @Column(name = "sha256", nullable = false, length = 64)
    private String sha256;

    @Column(name = "byte_size", nullable = false)
    private long byteSize;

    @Column(name = "mime_type", nullable = false, length = 64)
    private String mimeType;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public String getId() {
        return id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getSha256() {
        return sha256;
    }

    public void setSha256(String sha256) {
        this.sha256 = sha256;
    }

    public long getByteSize() {
        return byteSize;
    }

    public void setByteSize(long byteSize) {
        this.byteSize = byteSize;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
