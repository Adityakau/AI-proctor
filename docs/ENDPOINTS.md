# AI Exam Proctoring: API Endpoints Reference

All endpoints require JWT authentication (except dev token generation).

---

## Authentication

### Generate Dev Token (Local Only)
```bash
curl -X POST http://localhost:8082/proctoring/dev/token \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "dev-tenant",
    "examScheduleId": "exam-001",
    "userId": "user-123",
    "attemptNo": 1
  }'
```

**Response:**
```json
{
  "token": "eyJhbG..."
}
```

---

## Session Management

### Start Session
```bash
curl -X POST http://localhost:8082/proctoring/sessions/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "examConfig": {
      "maxLookAwaySeconds": 5
    }
  }'
```

**Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ACTIVE"
}
```

### End Session
```bash
curl -X POST http://localhost:8082/proctoring/sessions/end \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ENDED"
}
```

### Heartbeat
```bash
curl -X POST http://localhost:8082/proctoring/sessions/heartbeat \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "lastHeartbeat": "2026-01-30T07:30:00Z"
}
```

---

## Event Ingestion

### Submit Event Batch
```bash
curl -X POST http://localhost:8082/proctoring/events/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "events": [
      {
        "eventId": "evt-1706600000000-abc123",
        "type": "LOOK_AWAY",
        "timestamp": "2026-01-30T07:30:00.000Z",
        "confidence": 0.85,
        "severity": "MEDIUM",
        "details": {"durationMs": 6000}
      }
    ],
    "thumbnails": [
      {
        "eventId": "evt-1706600000000-abc123",
        "contentType": "image/jpeg",
        "dataBase64": "/9j/4AAQSkZJRg...",
        "sizeBytes": 5000
      }
    ]
  }'
```

**Response:**
```json
{
  "acceptedEventIds": ["evt-1706600000000-abc123"],
  "rejectedEventIds": [],
  "reasonByEventId": {}
}
```

---

## Alerts & Events

### Get Session Alerts
```bash
curl http://localhost:8082/proctoring/sessions/{sessionId}/alerts \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert-uuid",
      "type": "LOOK_AWAY",
      "severity": "MEDIUM",
      "createdAt": "2026-01-30T07:30:05Z"
    }
  ]
}
```

### Get Session Events (Debug)
```bash
curl http://localhost:8082/proctoring/sessions/{sessionId}/events \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "events": [
    {
      "eventId": "evt-1706600000000-abc123",
      "type": "LOOK_AWAY",
      "severity": "MEDIUM",
      "confidence": 0.85,
      "eventTime": "2026-01-30T07:30:00Z"
    }
  ]
}
```

---

## Evidence

### Get Evidence Thumbnail
```bash
curl http://localhost:8082/proctoring/evidence/{evidenceId} \
  -H "Authorization: Bearer $TOKEN" \
  --output thumbnail.jpg
```

**Response:** Binary JPEG image

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Session not found"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid or expired token"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded"
}
```
