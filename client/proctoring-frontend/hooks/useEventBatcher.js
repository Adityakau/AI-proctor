/**
 * useEventBatcher - Event batching and submission hook
 * 
 * Collects events and sends them in batches to the backend.
 * - 10 second interval if at least one event exists
 * - Idempotent eventId tracking
 * - Retry with ACK tracking
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { sendEventBatch } from '../lib/api';

const BATCH_INTERVAL_MS = 10000; // 10 seconds

/**
 * Generate unique event ID
 */
function generateEventId() {
    return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Severity levels for anomaly types
 */
const SEVERITY_MAP = {
    MULTI_PERSON: 'CRITICAL',
    FACE_MISSING: 'HIGH',
    CAMERA_BLOCKED: 'CRITICAL',
    TAB_SWITCH: 'MEDIUM',
    LOW_LIGHT: 'LOW',
    LOOK_AWAY: 'MEDIUM',
};

export function useEventBatcher({ jwt, sessionId, isActive }) {
    const [pendingCount, setPendingCount] = useState(0);
    const [connectionStatus, setConnectionStatus] = useState('IDLE'); // IDLE, CONNECTED, RECONNECTING, DISCONNECTED

    const pendingEventsRef = useRef([]);
    const ackedEventIdsRef = useRef(new Set());
    const batchIntervalRef = useRef(null);

    /**
     * Add an event to the queue
     * @param {string} type - Event type (MULTI_PERSON, FACE_MISSING, etc.)
     * @param {number} confidence - Detection confidence (0-1)
     * @param {Object} details - Additional event details
     * @param {string|null} thumbnailBase64 - Optional thumbnail (raw base64, no prefix)
     */
    const addEvent = useCallback((type, confidence, details = {}, thumbnailBase64 = null) => {
        const eventId = generateEventId();
        const severity = SEVERITY_MAP[type] || 'MEDIUM';

        const event = {
            eventId,
            type,
            timestamp: new Date().toISOString(),
            confidence,
            severity,
            details,
            thumbnail: thumbnailBase64 ? {
                eventId,
                dataBase64: thumbnailBase64,
                sizeBytes: Math.round((thumbnailBase64.length * 3) / 4),
            } : null,
        };

        pendingEventsRef.current.push(event);
        setPendingCount(pendingEventsRef.current.length);

        return eventId;
    }, []);

    /**
     * Send pending events batch
     */
    const sendBatch = useCallback(async () => {
        if (!jwt || !sessionId) return;

        // Filter out already ACKed events
        const toSend = pendingEventsRef.current.filter(
            e => !ackedEventIdsRef.current.has(e.eventId)
        );

        if (toSend.length === 0) return;

        try {
            const events = toSend.map(e => ({
                eventId: e.eventId,
                type: e.type,
                timestamp: e.timestamp,
                confidence: e.confidence,
                severity: e.severity,
                details: e.details,
            }));

            const thumbnails = toSend
                .filter(e => e.thumbnail)
                .map(e => e.thumbnail);

            const result = await sendEventBatch(jwt, sessionId, events, thumbnails);

            // Track ACKed events
            result.acceptedEventIds?.forEach(id => {
                ackedEventIdsRef.current.add(id);
            });

            // Remove ACKed from pending
            pendingEventsRef.current = pendingEventsRef.current.filter(
                e => !ackedEventIdsRef.current.has(e.eventId)
            );
            setPendingCount(pendingEventsRef.current.length);

            setConnectionStatus('CONNECTED');
        } catch (e) {
            console.error('Batch send failed:', e);
            setConnectionStatus('RECONNECTING');
        }
    }, [jwt, sessionId]);

    /**
     * Batch interval effect
     */
    useEffect(() => {
        if (!isActive) {
            if (batchIntervalRef.current) {
                clearInterval(batchIntervalRef.current);
                batchIntervalRef.current = null;
            }
            return;
        }

        setConnectionStatus('CONNECTED');

        batchIntervalRef.current = setInterval(() => {
            // Only send if there are pending events
            if (pendingEventsRef.current.length > 0) {
                sendBatch();
            }
        }, BATCH_INTERVAL_MS);

        return () => {
            if (batchIntervalRef.current) {
                clearInterval(batchIntervalRef.current);
            }
        };
    }, [isActive, sendBatch]);

    /**
     * Flush all pending events immediately
     */
    const flush = useCallback(async () => {
        if (pendingEventsRef.current.length > 0) {
            await sendBatch();
        }
    }, [sendBatch]);

    /**
     * Clear all pending events
     */
    const clear = useCallback(() => {
        pendingEventsRef.current = [];
        ackedEventIdsRef.current.clear();
        setPendingCount(0);
    }, []);

    return {
        addEvent,
        flush,
        clear,
        pendingCount,
        connectionStatus,
    };
}

export { SEVERITY_MAP, generateEventId };
