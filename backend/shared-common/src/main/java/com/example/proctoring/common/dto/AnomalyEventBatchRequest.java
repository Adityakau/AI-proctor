package com.example.proctoring.common.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public class AnomalyEventBatchRequest {

    @NotBlank
    private String sessionId;

    @NotEmpty
    private List<AnomalyEventDTO> events;

    private List<ThumbnailDTO> thumbnails;

    public static class ThumbnailDTO {
        @NotBlank
        private String eventId;
        @NotBlank
        private String contentType;
        @NotBlank
        private String dataBase64;
        private long sizeBytes;

        public String getEventId() {
            return eventId;
        }

        public void setEventId(String eventId) {
            this.eventId = eventId;
        }

        public String getContentType() {
            return contentType;
        }

        public void setContentType(String contentType) {
            this.contentType = contentType;
        }

        public String getDataBase64() {
            return dataBase64;
        }

        public void setDataBase64(String dataBase64) {
            this.dataBase64 = dataBase64;
        }

        public long getSizeBytes() {
            return sizeBytes;
        }

        public void setSizeBytes(long sizeBytes) {
            this.sizeBytes = sizeBytes;
        }
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public List<AnomalyEventDTO> getEvents() {
        return events;
    }

    public void setEvents(List<AnomalyEventDTO> events) {
        this.events = events;
    }

    public List<ThumbnailDTO> getThumbnails() {
        return thumbnails;
    }

    public void setThumbnails(List<ThumbnailDTO> thumbnails) {
        this.thumbnails = thumbnails;
    }
}

