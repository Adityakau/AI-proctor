# Frontend-Backend Integration Specification

> **Status**: ✅ FINALIZED (2026-01-31)
> 
> Based on user decisions from Q&A phase.

---

## A) Finalized Event Type Contract

### Event Types
| Type | Severity | Description | FE Trigger | BE Alert Threshold |
|------|----------|-------------|------------|-------------------|
| `MULTI_PERSON` | CRITICAL | Multiple faces detected | Immediate | Immediate |
| `FACE_MISSING` | HIGH | Face not detected | 3+ frames (~1.5s) | 3 occurrences / 5 min |
| `TAB_SWITCH` | MEDIUM | Tab/window switched | Immediate | 2 occurrences / 5 min |
| `LOOK_AWAY` | MEDIUM | Head rotated away | Rotation > 50% asymmetry | 5 occurrences / 5 min |
| `LOW_LIGHT` | LOW | Low light conditions | Brightness < 40 | No alert (stored) |
| `CAMERA_BLOCKED` | CRITICAL | Camera covered/blocked | Immediate | 3 occurrences / 5 min |

### Severity Enum
```
LOW       // Informational
MEDIUM    // Warning
HIGH      // Significant violation
CRITICAL  // Immediate flag
```

---

## B) API Contract

### Session Start
```http
POST /proctoring/sessions/start
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "examConfig": {
    "maxLookAwaySeconds": 5,
    "maxLookAwayWindowSeconds": 30
  }
}

→ 200 OK
{
  "sessionId": "uuid",
  "status": "ACTIVE"
}
```

### Event Batch
```http
POST /proctoring/events/batch
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "sessionId": "uuid",
  "events": [
    {
      "eventId": "evt-{timestamp}-{randomId}",
      "type": "MULTI_PERSON",
      "timestamp": "2026-01-31T12:00:00.000Z",
      "confidence": 0.95,
      "severity": "CRITICAL",
      "details": { "faceCount": 2 }
    }
  ],
  "thumbnails": [
    {
      "eventId": "evt-{timestamp}-{randomId}",
      "contentType": "image/jpeg",
      "dataBase64": "/9j/4AAQ...",
      "sizeBytes": 8500
    }
  ]
}

→ 200 OK
{
  "acceptedEventIds": ["evt-..."],
  "rejectedEventIds": [],
  "reasonByEventId": {}
}
```

### Heartbeat
```http
POST /proctoring/sessions/heartbeat
Authorization: Bearer {jwt}

→ 200 OK
{
  "sessionId": "uuid",
  "lastHeartbeat": "2026-01-31T12:05:00Z"
}
```

---

## C) Frontend Implementation

### New Files Created
| File | Purpose |
|------|---------|
| `lib/api.js` | API client (fetchDevToken, startSession, endSession, sendHeartbeat, sendEventBatch, fetchAlerts) |
| `hooks/useSession.js` | Session lifecycle management with heartbeat |
| `hooks/useEventBatcher.js` | Event batching (10s interval), ACK tracking, severity mapping |

### Modified Files
| File | Changes |
|------|---------|
| `lib/checks.js` | MULTIPLE_FACES→MULTI_PERSON, HEAD_ROTATED→LOOK_AWAY, threshold 0.35→0.50 |
| `hooks/useProctoringState.js` | Updated flag type names |
| `hooks/useFrameAnalyzer.js` | Enabled head rotation detection |
| `context/ProctoringProvider.js` | Added session and eventBatcher hooks |
| `pages/index.js` | Session initialization on exam start |
| `pages/exam.js` | Integrated eventBatcher, combined thumbnail (screen for TAB_SWITCH, webcam for others) |

### Key Decisions Applied
1. **Batch Interval**: 10 seconds, only if at least one event exists
2. **Rotation Threshold**: 50% asymmetry (increased from 35% to reduce false positives)
3. **Thumbnail**: Combined capture - screen image for TAB_SWITCH, webcam for all others
4. **Dev Token**: Auto-fetched from `/proctoring/dev/token` in dev mode

---

## D) Backend Implementation

### Modified Files
| File | Changes |
|------|---------|
| `ingest/service/EventIngestService.java` | Added TAB_SWITCH, LOOK_AWAY alert handling |

### Alert Thresholds
| Event Type | Alert After | Severity |
|------------|-------------|----------|
| MULTI_PERSON | Immediate | CRITICAL |
| FACE_MISSING | 3x in 5 min | HIGH |
| CAMERA_BLOCKED | 3x in 5 min | HIGH |
| TAB_SWITCH | 2x in 5 min | MEDIUM |
| LOOK_AWAY | 5x in 5 min | MEDIUM |
| LOW_LIGHT | No alert | — |

---

## E) Test Verification

### Build Status
- ✅ Frontend: `npm run build` - SUCCESS (Next.js 16.1.6)
- ✅ Backend: `mvn compile` - SUCCESS

### To Start Locally
```bash
# Terminal 1: Backend
cd backend/proctoring-backend
mvn spring-boot:run

# Terminal 2: Frontend
cd client/proctoring-frontend
npm run dev
```

Navigate to http://localhost:3000 to test the flow.
