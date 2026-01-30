#!/bin/bash
# ============================================================================
# AI EXAM PROCTORING - SMOKE TEST SCRIPT
# ============================================================================
set -e

API_BASE="http://localhost:8082"

echo "========================================"
echo "AI Exam Proctoring - Smoke Test"
echo "========================================"

# Step 1: Generate dev token
echo ""
echo "[1/4] Generating dev token..."
TOKEN_RESPONSE=$(curl -s -X POST "$API_BASE/proctoring/dev/token" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"smoke-tenant","examScheduleId":"smoke-exam","userId":"smoke-user-'$RANDOM'","attemptNo":1}')

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get dev token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi
echo "✅ Got dev token: ${TOKEN:0:50}..."

# Step 2: Start session
echo ""
echo "[2/4] Starting proctoring session..."
SESSION_RESPONSE=$(curl -s -X POST "$API_BASE/proctoring/sessions/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"examConfig":{"maxLookAwaySeconds":5,"maxLookAwayWindowSeconds":30}}')

SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SESSION_ID" ]; then
  echo "❌ Failed to start session"
  echo "Response: $SESSION_RESPONSE"
  exit 1
fi
echo "✅ Session started: $SESSION_ID"

# Step 3: Send test events
echo ""
echo "[3/4] Sending test anomaly events..."
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BATCH_RESPONSE=$(curl -s -X POST "$API_BASE/proctoring/events/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "events": [
      {"eventId": "evt-test-1-'$RANDOM'", "type": "LOOK_AWAY", "timestamp": "'$TIMESTAMP'", "confidence": 0.85, "severity": "MEDIUM", "details": {"durationMs": 3000}},
      {"eventId": "evt-test-2-'$RANDOM'", "type": "MULTI_PERSON", "timestamp": "'$TIMESTAMP'", "confidence": 0.95, "severity": "CRITICAL", "details": {"faceCount": 2}},
      {"eventId": "evt-test-3-'$RANDOM'", "type": "FACE_MISSING", "timestamp": "'$TIMESTAMP'", "confidence": 0.9, "severity": "HIGH", "details": {"durationMs": 5000}}
    ],
    "thumbnails": []
  }')

ACCEPTED=$(echo $BATCH_RESPONSE | grep -o '"acceptedEventIds":\[[^]]*\]')
echo "✅ Batch result: $ACCEPTED"

# Step 4: Retrieve alerts
echo ""
echo "[4/4] Fetching alerts..."
ALERTS_RESPONSE=$(curl -s -X GET "$API_BASE/proctoring/sessions/$SESSION_ID/alerts" \
  -H "Authorization: Bearer $TOKEN")

echo "✅ Alerts: $ALERTS_RESPONSE"

# Step 5: Verify database
echo ""
echo "========================================"
echo "Verifying database records..."
echo "========================================"

echo "Checking events in MySQL..."
docker exec infra-mysql-1 mysql -uproctor -p123 -e "SELECT event_id, event_type, severity FROM proctoring_dev.proctoring_anomaly_events WHERE session_id='$SESSION_ID' ORDER BY event_time DESC LIMIT 5;" 2>/dev/null || echo "(Could not query MySQL directly)"

echo ""
echo "Checking alerts in MySQL..."
docker exec infra-mysql-1 mysql -uproctor -p123 -e "SELECT id, type, severity FROM proctoring_dev.proctoring_alerts WHERE session_id='$SESSION_ID' ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || echo "(Could not query MySQL directly)"

echo ""
echo "========================================"
echo "✅ SMOKE TEST COMPLETE"
echo "========================================"
echo ""
echo "Session ID: $SESSION_ID"
echo "Token (first 80 chars): ${TOKEN:0:80}..."
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3001 in browser"
echo "  2. Grant camera permission"
echo "  3. Observe automatic anomaly detection"
echo "  4. Watch 'Recent Detections' panel for events"
