/**
 * useProctoringState - State management for proctoring flags
 * 
 * Maintains current flags, message log, and analysis state.
 * Uses DetectionStateManager for hysteresis-based stabilization.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { DetectionStateManager, resetDetectionStateManager } from '../lib/detectionState';

// Maximum messages to keep in log (prevents memory growth)
const MAX_LOG_ENTRIES = 10;

// Processing time budget in ms - for display/warning only (no auto-disable)
export const PROCESSING_BUDGET_MS = 250;

/**
 * @typedef {'FACE_OK' | 'FACE_MISSING' | 'MULTI_PERSON' | 'LOW_LIGHT' | 'LOOK_AWAY' | 'TAB_SWITCH' | 'SCREEN_SHARE_ACTIVE' | 'CAMERA_BLOCKED'} ProctoringFlag
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {ProctoringFlag} flag - The flag that was set
 * @property {string} message - Human readable message
 */

/**
 * @typedef {Object} AnomalyEvent
 * @property {string} type - Anomaly type
 * @property {boolean} shouldEmit - Whether to emit event to backend
 */

/**
 * Custom hook for proctoring state management
 */
export function useProctoringState() {
    // Current active flags (as object for O(1) lookup)
    const [flags, setFlags] = useState({});

    // Timestamped message log
    const [messageLog, setMessageLog] = useState([]);

    // Whether analysis is enabled (safety mechanism)
    const [analysisEnabled, setAnalysisEnabled] = useState(true);
    const [disableReason, setDisableReason] = useState(null);

    // Consecutive missed face counter (kept for worker compatibility)
    const consecutiveMissingRef = useRef(0);

    // Last processing time for display
    const [lastProcessingTime, setLastProcessingTime] = useState(0);

    // Detection state manager for hysteresis
    const detectionStateRef = useRef(null);

    // Pending anomaly events to emit (for evidence capture)
    const pendingEventsRef = useRef([]);

    // Initialize detection state manager
    useEffect(() => {
        detectionStateRef.current = new DetectionStateManager();
        return () => {
            resetDetectionStateManager();
        };
    }, []);

    /**
     * Human-readable messages for each flag
     */
    const flagMessages = {
        FACE_OK: 'Face detected - OK',
        FACE_MISSING: 'Warning: Face not detected',
        MULTI_PERSON: 'Error: Multiple faces detected',
        LOW_LIGHT: 'Warning: Low light conditions',
        LOOK_AWAY: 'Warning: Looking away from screen',
        TAB_SWITCH: 'Warning: Tab/window switched',
        SCREEN_SHARE_ACTIVE: 'Info: Screen share active',
        CAMERA_BLOCKED: 'Error: Camera appears blocked'
    };

    /**
     * Add a flag (with deduplication and logging)
     */
    const addFlag = useCallback((flag) => {
        setFlags(prev => {
            // Skip if already set
            if (prev[flag]) return prev;
            return { ...prev, [flag]: true };
        });

        // Add to log
        const entry = {
            timestamp: new Date().toISOString(),
            flag,
            message: flagMessages[flag] || flag
        };

        setMessageLog(prev => {
            const newLog = [entry, ...prev];
            return newLog.slice(0, MAX_LOG_ENTRIES);
        });
    }, []);

    /**
     * Remove a flag (auto-clear when condition resolves)
     */
    const removeFlag = useCallback((flag) => {
        setFlags(prev => {
            if (!prev[flag]) return prev;
            const next = { ...prev };
            delete next[flag];
            return next;
        });
    }, []);

    /**
     * Get pending anomaly events (consumed after read)
     */
    const consumePendingEvents = useCallback(() => {
        const events = [...pendingEventsRef.current];
        pendingEventsRef.current = [];
        return events;
    }, []);

    /**
     * Update flags based on analysis results with hysteresis
     * @param {Object} results - Analysis results from worker
     */
    const updateFromAnalysis = useCallback((results) => {
        const {
            faceCount,
            brightness,
            variance,
            rotationFlag,
            processingTime,
            newConsecutiveMissing
        } = results;

        // Update processing time display
        setLastProcessingTime(processingTime);

        // Update consecutive missing counter (for legacy compatibility)
        consecutiveMissingRef.current = newConsecutiveMissing;

        if (!detectionStateRef.current) return;

        const detector = detectionStateRef.current;

        // --- Multi-person detection with hysteresis ---
        // toggledOn = show indicator (1s), shouldEmit = screenshot (5s)
        const multiResult = detector.updateMultiPerson(faceCount);
        if (multiResult.toggledOn) {
            addFlag('MULTI_PERSON');
        }
        if (multiResult.shouldEmit) {
            pendingEventsRef.current.push({ type: 'MULTI_PERSON', shouldEmit: true });
        }
        if (multiResult.toggledOff) {
            removeFlag('MULTI_PERSON');
        }

        // --- Face missing detection with hysteresis ---
        const faceResult = detector.updateFaceMissing(faceCount);
        if (faceResult.triggered) {
            addFlag('FACE_MISSING');
            removeFlag('FACE_OK');
            if (faceResult.shouldEmit) {
                pendingEventsRef.current.push({ type: 'FACE_MISSING', shouldEmit: true });
            }
        } else if (faceResult.cleared) {
            removeFlag('FACE_MISSING');
            addFlag('FACE_OK');
        } else if (faceCount >= 1 && !detector.faceMissingActive) {
            // Face present and not in missing state
            addFlag('FACE_OK');
            removeFlag('FACE_MISSING');
        }

        // --- Camera blocked detection (very dark + low variance) ---
        if (typeof brightness === 'number' && typeof variance === 'number') {
            const blockedResult = detector.updateCameraBlocked(brightness, variance);
            if (blockedResult.triggered) {
                addFlag('CAMERA_BLOCKED');
                if (blockedResult.shouldEmit) {
                    // Map to FACE_MISSING for backend compatibility
                    pendingEventsRef.current.push({ type: 'FACE_MISSING', shouldEmit: true, reason: 'CAMERA_BLOCKED' });
                }
            } else if (blockedResult.cleared) {
                removeFlag('CAMERA_BLOCKED');
            }
        }

        // --- Low light detection with hysteresis ---
        if (typeof brightness === 'number') {
            const lightResult = detector.updateLowLight(brightness, 40);
            if (lightResult.triggered) {
                addFlag('LOW_LIGHT');
                if (lightResult.shouldEmit) {
                    pendingEventsRef.current.push({ type: 'LOW_LIGHT', shouldEmit: true });
                }
            } else if (lightResult.cleared) {
                removeFlag('LOW_LIGHT');
            }
        }

        // --- Look away detection with hysteresis ---
        const isLookingAway = rotationFlag === 'LOOK_AWAY';
        const lookResult = detector.updateLookAway(isLookingAway);
        if (lookResult.triggered) {
            addFlag('LOOK_AWAY');
            if (lookResult.shouldEmit) {
                pendingEventsRef.current.push({ type: 'LOOK_AWAY', shouldEmit: true });
            }
        } else if (lookResult.cleared) {
            removeFlag('LOOK_AWAY');
        }

    }, [addFlag, removeFlag]);

    /**
     * Get current consecutive missing count
     */
    const getConsecutiveMissing = useCallback(() => {
        return consecutiveMissingRef.current;
    }, []);

    /**
     * Reset all state (for restart)
     */
    const reset = useCallback(() => {
        setFlags({});
        setMessageLog([]);
        setAnalysisEnabled(true);
        setDisableReason(null);
        consecutiveMissingRef.current = 0;
        setLastProcessingTime(0);
        pendingEventsRef.current = [];
        if (detectionStateRef.current) {
            detectionStateRef.current.reset();
        }
    }, []);

    return {
        flags,
        messageLog,
        analysisEnabled,
        disableReason,
        lastProcessingTime,
        updateFromAnalysis,
        getConsecutiveMissing,
        consumePendingEvents,
        reset,
        addFlag,
        removeFlag
    };
}
