/**
 * useProctoringState - State management for proctoring flags
 * 
 * Maintains current flags, message log, and analysis state.
 * Designed to minimize re-renders by batching state updates.
 */

import { useState, useCallback, useRef } from 'react';

// Maximum messages to keep in log (prevents memory growth)
const MAX_LOG_ENTRIES = 10;

// Processing time budget in ms - exceed this triggers safety disable
export const PROCESSING_BUDGET_MS = 250;

// Number of consecutive budget overruns before disabling
const BUDGET_OVERRUN_THRESHOLD = 3;

/**
 * @typedef {'FACE_OK' | 'FACE_MISSING' | 'MULTIPLE_FACES' | 'LOW_LIGHT' | 'HEAD_ROTATED' | 'TAB_FOCUS_LOST' | 'SCREEN_SHARE_ACTIVE'} ProctoringFlag
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {ProctoringFlag} flag - The flag that was set
 * @property {string} message - Human readable message
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

    // Consecutive missed face counter
    const consecutiveMissingRef = useRef(0);

    // Budget overrun counter
    const budgetOverrunCountRef = useRef(0);

    // Last processing time for display
    const [lastProcessingTime, setLastProcessingTime] = useState(0);

    /**
     * Human-readable messages for each flag
     */
    const flagMessages = {
        FACE_OK: 'Face detected - OK',
        FACE_MISSING: 'Warning: Face not detected',
        MULTIPLE_FACES: 'Error: Multiple faces detected',
        LOW_LIGHT: 'Warning: Low light conditions',
        LOW_LIGHT: 'Warning: Low light conditions',
        HEAD_ROTATED: 'Warning: Head rotated - face not clear',
        TAB_FOCUS_LOST: 'Warning: Tab focus lost (switched tab/window)',
        SCREEN_SHARE_ACTIVE: 'Info: Screen share active'
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
     * Update flags based on analysis results
     * Call this with each analysis cycle's results
     * 
     * @param {Object} results - Analysis results
     * @param {Array} results.faces - Detected faces
     * @param {string|null} results.faceFlag - Result from checkFacePresence
     * @param {string|null} results.multipleFlag - Result from checkMultipleFaces  
     * @param {string|null} results.brightnessFlag - Result from checkBrightness
     * @param {number} results.processingTime - Time taken in ms
     * @param {number} results.newConsecutiveMissing - Updated counter
     */
    const updateFromAnalysis = useCallback((results) => {
        const {
            faceFlag,
            multipleFlag,
            brightnessFlag,
            rotationFlag,
            processingTime,
            newConsecutiveMissing
        } = results;

        // Update processing time display
        setLastProcessingTime(processingTime);

        // Update consecutive missing counter
        consecutiveMissingRef.current = newConsecutiveMissing;

        // Check processing budget
        // NOTE: With Web Worker, high processing time doesn't block UI.
        // We log it but don't strictly disable analysis anymore unless it's extreme (e.g. > 1000ms)
        if (processingTime > 1000) {
            // Optional: could still track extreme lags
        }

        // Original strict safety check disabled as per user request to not stop analysis
        /*
        if (processingTime > PROCESSING_BUDGET_MS) {
            budgetOverrunCountRef.current++;

            if (budgetOverrunCountRef.current >= BUDGET_OVERRUN_THRESHOLD) {
                // Safety: disable analysis
                setAnalysisEnabled(false);
                setDisableReason(`Processing exceeded ${PROCESSING_BUDGET_MS}ms budget`);
                return;
            }
        } else {
            // Reset overrun counter on good frame
            budgetOverrunCountRef.current = 0;
        }
        */

        // Handle face status
        if (faceFlag === 'FACE_OK') {
            addFlag('FACE_OK');
            removeFlag('FACE_MISSING');
        } else if (faceFlag === 'FACE_MISSING') {
            addFlag('FACE_MISSING');
            removeFlag('FACE_OK');
        }

        // Handle multiple faces
        if (multipleFlag === 'MULTIPLE_FACES') {
            addFlag('MULTIPLE_FACES');
        } else {
            removeFlag('MULTIPLE_FACES');
        }

        // Handle brightness
        if (brightnessFlag === 'LOW_LIGHT') {
            addFlag('LOW_LIGHT');
        } else {
            removeFlag('LOW_LIGHT');
        }

        // Handle head rotation
        if (rotationFlag === 'HEAD_ROTATED') {
            addFlag('HEAD_ROTATED');
        } else {
            removeFlag('HEAD_ROTATED');
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
        budgetOverrunCountRef.current = 0;
        setLastProcessingTime(0);
    }, []);

    return {
        flags,
        messageLog,
        analysisEnabled,
        disableReason,
        lastProcessingTime,
        updateFromAnalysis,
        getConsecutiveMissing,
        reset,
        addFlag,
        removeFlag
    };
}
