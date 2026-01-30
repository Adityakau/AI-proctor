package com.example.proctoring.common.dto;

import java.time.Instant;

public class RiskTimelinePointDTO {

    private Instant timestamp;
    private double score;

    public RiskTimelinePointDTO() {
    }

    public RiskTimelinePointDTO(Instant timestamp, double score) {
        this.timestamp = timestamp;
        this.score = score;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }
}

