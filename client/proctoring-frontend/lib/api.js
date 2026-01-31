/**
 * API Client for Proctoring Backend
 * 
 * Handles all communication with the proctoring-backend service.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8082';
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE !== 'false';

/**
 * Fetch a development JWT token (local dev only)
 */
export async function fetchDevToken() {
    if (!DEV_MODE) return null;

    try {
        const resp = await fetch(`${API_BASE}/proctoring/dev/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: 'dev-tenant',
                examScheduleId: 'dev-exam-' + Date.now(),
                userId: 'dev-user-' + Math.floor(Math.random() * 10000),
                attemptNo: 1,
            }),
        });

        if (!resp.ok) throw new Error('Failed to get dev token');
        const data = await resp.json();
        return data.token;
    } catch (e) {
        console.error('Dev token fetch failed:', e);
        return null;
    }
}

/**
 * Start a proctoring session
 * @param {string} jwt - Authorization token
 * @param {Object} config - Optional exam configuration
 * @returns {Promise<{sessionId: string, status: string}>}
 */
export async function startSession(jwt, config = {}) {
    const resp = await fetch(`${API_BASE}/proctoring/sessions/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ examConfig: config }),
    });

    if (!resp.ok) {
        throw new Error(`Session start failed: ${resp.status}`);
    }

    return resp.json();
}

/**
 * End a proctoring session
 * @param {string} jwt - Authorization token
 */
export async function endSession(jwt) {
    const resp = await fetch(`${API_BASE}/proctoring/sessions/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}` },
    });

    if (!resp.ok) {
        throw new Error(`Session end failed: ${resp.status}`);
    }

    return resp.json();
}

/**
 * Send heartbeat to keep session alive
 * @param {string} jwt - Authorization token
 */
export async function sendHeartbeat(jwt) {
    try {
        await fetch(`${API_BASE}/proctoring/sessions/heartbeat`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${jwt}` },
        });
    } catch (e) {
        console.error('Heartbeat failed:', e);
    }
}

/**
 * Send a batch of events to the backend
 * @param {string} jwt - Authorization token
 * @param {string} sessionId - Current session ID
 * @param {Array} events - Array of event objects
 * @param {Array} thumbnails - Array of thumbnail objects
 * @returns {Promise<{acceptedEventIds: string[], rejectedEventIds: string[], reasonByEventId: Object}>}
 */
export async function sendEventBatch(jwt, sessionId, events, thumbnails = []) {
    const resp = await fetch(`${API_BASE}/proctoring/events/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
            sessionId,
            events: events.map(e => ({
                eventId: e.eventId,
                type: e.type,
                timestamp: e.timestamp,
                confidence: e.confidence,
                severity: e.severity,
                details: e.details || {},
            })),
            thumbnails: thumbnails.map(t => ({
                eventId: t.eventId,
                contentType: 'image/jpeg',
                dataBase64: t.dataBase64,
                sizeBytes: t.sizeBytes,
            })),
        }),
    });

    if (!resp.ok) {
        throw new Error(`Batch send failed: ${resp.status}`);
    }

    return resp.json();
}

/**
 * Fetch alerts for a session
 * @param {string} jwt - Authorization token
 * @param {string} sessionId - Session ID
 */
export async function fetchAlerts(jwt, sessionId) {
    const resp = await fetch(`${API_BASE}/proctoring/sessions/${sessionId}/alerts`, {
        headers: { 'Authorization': `Bearer ${jwt}` },
    });

    if (!resp.ok) {
        throw new Error(`Fetch alerts failed: ${resp.status}`);
    }

    return resp.json();
}

export { API_BASE, DEV_MODE };
