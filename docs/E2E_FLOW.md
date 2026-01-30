# AI Exam Proctoring: End-to-End Flow Documentation

This document describes the complete event flow from frontend detection to backend storage and alert generation.

---

## 1. Frontend Detection Pipeline

### Key Files
| File | Purpose |
|------|---------|
| `client/nextjs-app/src/pages/index.js` | Main proctoring page with camera capture, MediaPipe detection, and event batching |

### Camera Capture
- Uses `navigator.mediaDevices.getUserMedia()` at 640x360 resolution
- Video element referenced via `videoRef`
- Auto-starts on page load after camera permission granted

### MediaPipe Initialization
- **FaceDetector**: Counts faces using `blaze_face_short_range` model
- **FaceLandmarker**: Provides 468 landmarks for head pose estimation
- Models loaded from CDN (`cdn.jsdelivr.net/npm/@mediapipe/tasks-vision`)
- GPU delegate preferred for performance

### Anomaly Detection Logic (runs at 1 FPS)

| Type | Detection Method | Threshold |
|------|-----------------|-----------|
| `MULTI_PERSON` | `faceCount > 1` for 3+ consecutive frames | frames >= 3 |
| `FACE_MISSING` | `faceCount === 0` | > 3 seconds |
| `LOOK_AWAY` | Head pose (yaw/pitch) beyond threshold | > 5 seconds |
| `LIGHTING_LOW` | Average frame brightness < threshold | > 5 seconds |
| `CAMERA_BLOCKED` | Very low brightness + variance | immediate |
| `SPOOF_SUSPECTED` | Frozen frame (no change in brightness/variance) | > 10 seconds |

### Head Pose Estimation
```javascript
// Landmarks used: nose tip (1), eyes (33, 263), chin (152), forehead (10)
const yaw = (noseTip.x - eyeCenter.x) * 180;
const pitch = (noseTip.y - (forehead.y + chin.y) / 2) * 180;
```

### Event Batching
- Events queued in `trackingRef.current.pendingEvents`
- Batch sent every 5 seconds via `sendBatch()`
- Acknowledged events tracked in `ackedEventIds` Set
- Retry logic: events remain in queue until backend acknowledges

### Thumbnail Capture
- Triggered for `severity >= "HIGH"` events
- Max 1 thumbnail per 30 seconds
- Size: 160x90 JPEG, compressed to ≤10KB
- Sent as Base64 in batch payload

---

## 2. API Call Sequence

### Session Lifecycle
```
1. POST /proctoring/dev/token (dev mode) → Get JWT
2. POST /proctoring/sessions/start → Get sessionId
3. POST /proctoring/events/batch (every 5s) → Send events
4. POST /proctoring/sessions/heartbeat (every 10s) → Keep alive
5. GET /proctoring/sessions/{id}/alerts (every 10s) → Poll alerts
6. POST /proctoring/sessions/end → End session
```

### Files Calling Backend
| Frontend Location | Backend Endpoint |
|-------------------|------------------|
| `fetchDevToken()` | `POST /proctoring/dev/token` |
| `startSession()` | `POST /proctoring/sessions/start` |
| `sendBatch()` | `POST /proctoring/events/batch` |
| `sendHeartbeat()` | `POST /proctoring/sessions/heartbeat` |
| `pollAlerts()` | `GET /proctoring/sessions/{id}/alerts` |
| `endSession()` | `POST /proctoring/sessions/end` |

---

## 3. Backend Internal Flow

### Event Ingest Service
**File**: `backend/event-ingest-service/src/main/java/com/example/proctoring/ingest/`

```
EventBatchController.ingestBatch()
    ↓
EventIngestService.processBatch()
    ├─ Validate JWT claims match session
    ├─ Check idempotency (Redis: event-replay:{eventId})
    ├─ Check rate limit (Redis: rate:{sessionId}:{minute})
    ├─ Save AnomalyEvent to MySQL
    ├─ generateAlertIfNeeded()
    │   └─ Create Alert if severity warrants
    └─ Process thumbnails
        ├─ Decode Base64
        ├─ Save to /tmp/proctoring/thumbnails/{sessionId}/
        ├─ Create Evidence record with SHA256
        └─ Link evidenceId to AnomalyEvent
```

### Alert Generation Rules
| Event Type | Trigger | Alert Severity |
|------------|---------|----------------|
| `MULTI_PERSON` | Any occurrence | CRITICAL |
| `CAMERA_BLOCKED` | 3+ events in 5 min | HIGH |
| `FACE_MISSING` | 3+ events in 5 min | HIGH |
| HIGH/CRITICAL severity | Any | Same as event |

---

## 4. Database Schema

### Tables & Entities

| Table | Entity File |
|-------|-------------|
| `proctoring_sessions` | `shared-common/.../model/ProctoringSession.java` |
| `proctoring_anomaly_events` | `shared-common/.../model/AnomalyEvent.java` |
| `proctoring_alerts` | `shared-common/.../model/Alert.java` |
| `proctoring_evidence` | `shared-common/.../model/Evidence.java` |

### Key Relationships
```
Session (1) ──→ (N) AnomalyEvent
Session (1) ──→ (N) Alert
Session (1) ──→ (N) Evidence
AnomalyEvent (1) ──→ (0..1) Evidence
Alert (1) ──→ (0..1) Evidence
```

---

## 5. Snapshot/Evidence Handling

### Storage Path
```
/tmp/proctoring/thumbnails/{sessionId}/thumb-{eventId}.jpg
```

### Evidence Record Fields
- `id`: UUID
- `session_id`: FK to session
- `file_path`: Absolute path on disk
- `sha256`: Hash of file contents
- `byte_size`: File size
- `mime_type`: `image/jpeg`

### Retrieval
```bash
# If running in Docker:
docker cp <container>:/tmp/proctoring/thumbnails ./thumbnails

# Via API (dev):
GET /proctoring/evidence/{evidenceId}
```

---

## 6. Non-Dashboard Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/proctoring/dev/token` | Dev JWT generation |
| POST | `/proctoring/sessions/start` | Start session |
| POST | `/proctoring/sessions/end` | End session |
| POST | `/proctoring/sessions/heartbeat` | Heartbeat |
| POST | `/proctoring/events/batch` | Ingest events |
| GET | `/proctoring/sessions/{id}/alerts` | Get alerts |
| GET | `/proctoring/sessions/{id}/events` | Get events (debug) |
| GET | `/proctoring/evidence/{id}` | Get thumbnail |
