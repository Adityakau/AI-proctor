# AI Exam Proctoring - Local Development Runbook

## Overview

This system provides real-time AI-powered exam proctoring with:
- **On-device ML detection** using MediaPipe (face detection, landmarks, head pose)
- **Automatic anomaly detection** (no manual buttons)
- **Event batching with retry** and idempotency
- **Backend alert generation** with severity-based escalation

---

## Prerequisites

- **Docker Desktop** running
- **Node.js** 18+ 
- **Java 17** (for backend builds)
- **Maven 3.8+**

---

## Quick Start

### 1. Start Infrastructure (MySQL, Redis, Kafka)

```bash
cd /Users/Aditya/Desktop/PROCTORING/infra
docker compose up -d mysql redis kafka zookeeper
```

Wait for MySQL to be healthy:
```bash
docker compose ps
```

### 2. Start Backend Service

```bash
cd /Users/Aditya/Desktop/PROCTORING/infra
docker compose up -d event-ingest-service
```

Verify it's running:
```bash
curl http://localhost:8082/actuator/health
# Expected: {"status":"UP"}
```

### 3. Start Frontend

```bash
cd /Users/Aditya/Desktop/PROCTORING/client/nextjs-app
npm install
npm run dev -- -p 3001
```

### 4. Open Browser

Navigate to: **http://localhost:3001**

The proctoring will start automatically when you grant camera permission.

---

## API Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/proctoring/dev/token` | POST | Generate dev JWT (local only) | No |
| `/proctoring/sessions/start` | POST | Start proctoring session | JWT |
| `/proctoring/sessions/end` | POST | End proctoring session | JWT |
| `/proctoring/sessions/heartbeat` | POST | Update heartbeat timestamp | JWT |
| `/proctoring/events/batch` | POST | Submit anomaly events | JWT |
| `/proctoring/sessions/{id}/alerts` | GET | Get alerts for session | JWT |
| `/proctoring/sessions/{id}/events` | GET | Get events for session | JWT |
| `/proctoring/evidence/{id}` | GET | Get thumbnail image | JWT |

---

## Smoke Test

Run the automated smoke test:

```bash
cd /Users/Aditya/Desktop/PROCTORING
./smoke_test.sh
```

This will:
1. Generate a dev JWT
2. Start a proctoring session
3. Send test anomaly events
4. Verify alerts were created
5. Query the database for records

---

## Edge Case Testing Checklist

### 1. Multiple Faces (MULTI_PERSON)

**How to test:**
- Have another person enter the camera frame
- Or hold up a photo with a face

**Expected behavior:**
- After 3 consecutive frames with >1 face, a CRITICAL alert is generated
- Event appears in "Recent Detections" panel
- Alert appears in "Server Alerts" panel

**Verify:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8082/proctoring/sessions/$SESSION_ID/alerts | jq '.alerts[] | select(.type=="MULTI_PERSON")'
```

---

### 2. Look Away Sustained (LOOK_AWAY)

**How to test:**
- Look away from the screen for 5+ seconds
- Turn your head left/right >30 degrees

**Expected behavior:**
- MEDIUM severity event after 5 seconds of looking away
- Resets when you look back

**Verify:**
```bash
docker exec infra-mysql-1 mysql -uproctor -p123 -e "SELECT * FROM proctoring_dev.anomaly_events WHERE event_type='LOOK_AWAY' ORDER BY event_time DESC LIMIT 5;"
```

---

### 3. Face Missing (FACE_MISSING)

**How to test:**
- Move out of camera frame completely
- Wait 3+ seconds

**Expected behavior:**
- HIGH severity event after 3 seconds
- Alert generated after 3 consecutive events

**Verify:**
```bash
docker exec infra-mysql-1 mysql -uproctor -p123 -e "SELECT * FROM proctoring_dev.anomaly_events WHERE event_type='FACE_MISSING' ORDER BY event_time DESC LIMIT 5;"
```

---

### 4. Low Lighting (LIGHTING_LOW)

**How to test:**
- Dim your room lights significantly
- Cover part of the camera lens with translucent material

**Expected behavior:**
- LOW severity event after 5 seconds of brightness < 50

**Verify in UI:**
- Watch the "💡 Light: X%" indicator drop below 50

---

### 5. Camera Blocked (CAMERA_BLOCKED)

**How to test:**
- Cover the camera completely with your hand/paper
- Wait 1 second

**Expected behavior:**
- HIGH severity event immediately (brightness < 10, variance < 5)
- Thumbnail captured for evidence

**Verify:**
```bash
docker exec infra-mysql-1 mysql -uproctor -p123 -e "SELECT * FROM proctoring_dev.proctoring_alerts WHERE type='CAMERA_BLOCKED' ORDER BY created_at DESC LIMIT 5;"
```

---

### 6. Network Drop → Recovery

**How to test:**
1. Open DevTools → Network → Offline mode
2. Wait 10-20 seconds (events queue locally)
3. Go back online

**Expected behavior:**
- Connection status changes to "DISCONNECTED"
- Events accumulate in queue (shown in UI)
- When online, batch is sent with retry
- Accepted events are marked as acked

**Verify:**
- Watch "Event Queue" counter increase when offline
- Watch it drain when back online

---

### 7. Duplicate Batch Retry (Idempotency)

**How to test:**
```bash
# Send same batch twice
curl -X POST http://localhost:8082/proctoring/events/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"'$SESSION_ID'","events":[{"eventId":"dup-test-123","type":"LOOK_AWAY","timestamp":"2026-01-29T12:00:00Z","confidence":0.8,"severity":"MEDIUM","details":{}}],"thumbnails":[]}'

# Send again
curl -X POST http://localhost:8082/proctoring/events/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"'$SESSION_ID'","events":[{"eventId":"dup-test-123","type":"LOOK_AWAY","timestamp":"2026-01-29T12:00:00Z","confidence":0.8,"severity":"MEDIUM","details":{}}],"thumbnails":[]}'
```

**Expected behavior:**
- First request: `"acceptedEventIds":["dup-test-123"]`
- Second request: `"rejectedEventIds":["dup-test-123"]` with reason "duplicate"

---

### 8. High-Frequency Detections (Rate Limiting)

**How to test:**
```bash
# Send 700 events in quick succession (limit is 600/minute)
for i in {1..700}; do
  curl -s -X POST http://localhost:8082/proctoring/events/batch \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"'$SESSION_ID'","events":[{"eventId":"rate-'$i'-'$RANDOM'","type":"LOOK_AWAY","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","confidence":0.5,"severity":"LOW","details":{}}],"thumbnails":[]}'
done
```

**Expected behavior:**
- First 600 events accepted
- Remaining events rejected with reason "rate_limited"

---

### 9. Token Expiry → Refresh (Dev Mode)

**How to test:**
- Dev tokens expire in 1 hour
- To test faster, modify `DevTokenController.java` to use shorter expiry

**Expected behavior:**
- Client automatically re-requests token before expiry
- No manual intervention needed

---

## Database Schema

### proctoring_sessions
```sql
CREATE TABLE proctoring_sessions (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  exam_schedule_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  attempt_no INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  current_risk_score DOUBLE DEFAULT 0
);
```

### proctoring_anomaly_events
```sql
CREATE TABLE proctoring_anomaly_events (
  event_id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  event_time TIMESTAMP NOT NULL,
  severity VARCHAR(16),
  confidence DOUBLE,
  details_json TEXT,
  thumbnail_meta_json TEXT
);
```

### proctoring_alerts
```sql
CREATE TABLE proctoring_alerts (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  details_json TEXT
);
```

---

## Debugging Commands

### View Backend Logs
```bash
docker logs -f infra-event-ingest-service-1
```

### Query MySQL Directly
```bash
docker exec -it infra-mysql-1 mysql -uproctor -p123 proctoring_dev
```

### Check Redis Keys
```bash
docker exec -it infra-redis-1 redis-cli KEYS "*"
```

### Restart Services
```bash
cd /Users/Aditya/Desktop/PROCTORING/infra
docker compose restart event-ingest-service
```

### Full Rebuild
```bash
cd /Users/Aditya/Desktop/PROCTORING/backend
mvn clean package -DskipTests
cd ../infra
docker compose up -d --build event-ingest-service
```

### View Thumbnails
```bash
# Copy thumbnails from container to local folder
docker cp infra-event-ingest-service-1:/tmp/proctoring/thumbnails ./thumbnails
```

---

## Anomaly Detection Thresholds (Configurable)

| Anomaly | Threshold | Severity |
|---------|-----------|----------|
| MULTI_PERSON | 3 consecutive frames with >1 face | CRITICAL |
| FACE_MISSING | No face for 3+ seconds | HIGH |
| LOOK_AWAY | Yaw/pitch >30° for 5+ seconds | MEDIUM |
| LIGHTING_LOW | Brightness <50 for 5+ seconds | LOW |
| CAMERA_BLOCKED | Brightness <10 AND variance <5 | HIGH |

---

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  Next.js Client │───▶│  Event-Ingest   │───▶│     MySQL       │
│  (MediaPipe ML) │    │    Service      │    │  (proctoring_   │
│                 │    │   (Spring)      │    │      dev)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                      │
        │                      ▼
        │              ┌─────────────────┐
        │              │                 │
        └─────────────▶│     Redis       │
           Dev Token   │  (Rate Limit,   │
                       │   Idempotency)  │
                       └─────────────────┘
```

---

## Production Considerations

1. **JWT**: Use real exam platform RS256 JWTs (disable dev token endpoint)
2. **CORS**: Restrict to actual production domains
3. **HTTPS**: Enable TLS for all endpoints
4. **Thumbnails**: Store in S3/MinIO, not filesystem
5. **Alerts**: Add Kafka consumer for async processing

---

## Evidence/Thumbnail Extraction

Thumbnails are stored at `/tmp/proctoring/thumbnails/{sessionId}/`.

### Local Access
```bash
ls /tmp/proctoring/thumbnails/
```

### From Docker Container
```bash
# Find container ID
docker ps | grep event-ingest

# Copy thumbnails out
docker cp <container_id>:/tmp/proctoring/thumbnails ./thumbnails

# Example:
docker cp proctoring-event-ingest-service-1:/tmp/proctoring/thumbnails ./thumbnails
```

### Via API
```bash
# Get evidence ID from event
curl http://localhost:8082/proctoring/sessions/{sessionId}/events \
  -H "Authorization: Bearer $TOKEN" | jq '.events[0]'

# Download thumbnail
curl http://localhost:8082/proctoring/evidence/{evidenceId} \
  -H "Authorization: Bearer $TOKEN" --output thumb.jpg
```

---

## Additional Documentation

- **[E2E_FLOW.md](docs/E2E_FLOW.md)** - Complete flow from frontend to database
- **[ENDPOINTS.md](docs/ENDPOINTS.md)** - API reference with curl examples
6. **Scaling**: Deploy event-ingest-service behind load balancer
