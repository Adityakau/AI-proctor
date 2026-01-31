/**
 * useProctoringState - State management for proctoring flags
 * 
 * Maintains current flags, message log, and analysis state.
 * Designed to minimize re-renders by batching state updates.
 */

import { useState, useCallback, useRef } from 'react';

// Maximum messages to keep in log (prevents memory growth)
const MAX_LOG_ENTRIES = 10;

// Processing time budget in ms - for display/warning only (no auto-disable)
export const PROCESSING_BUDGET_MS = 250;

/**
 * @typedef {'FACE_OK' | 'FACE_MISSING' | 'MULTI_PERSON' | 'LOW_LIGHT' | 'LOOK_AWAY' | 'TAB_SWITCH' | 'SCREEN_SHARE_ACTIVE'} ProctoringFlag
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

    // Last processing time for display
    const [lastProcessingTime, setLastProcessingTime] = useState(0);

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

        // Log budget overrun but continue processing (no auto-disable)
        if (processingTime > PROCESSING_BUDGET_MS) {
            console.warn(`Frame processing took ${processingTime}ms (budget: ${PROCESSING_BUDGET_MS}ms)`);
        }

        // Handle face status
        if (faceFlag === 'FACE_OK') {
            addFlag('FACE_OK');
            removeFlag('FACE_MISSING');
        } else if (faceFlag === 'FACE_MISSING') {
            addFlag('FACE_MISSING');
            removeFlag('FACE_OK');
        }

        // Handle multiple faces
        if (multipleFlag === 'MULTI_PERSON') {
            addFlag('MULTI_PERSON');
        } else {
            removeFlag('MULTI_PERSON');
        }

        // Handle brightness
        if (brightnessFlag === 'LOW_LIGHT') {
            addFlag('LOW_LIGHT');
        } else {
            removeFlag('LOW_LIGHT');
        }

        // Handle head rotation (looking away)
        if (rotationFlag === 'LOOK_AWAY') {
            addFlag('LOOK_AWAY');
        } else {
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
