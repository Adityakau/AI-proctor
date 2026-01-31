/**
 * detectionState.js - Hysteresis-based detection state machine
 * 
 * Provides stabilization for all proctoring detections to avoid
 * false positives from single-frame glitches.
 * 
 * Features:
 * - Consecutive frame counting for triggers and clears
 * - Duration-based triggers for time-sensitive anomalies
 * - Cooldown tracking to prevent event spam
 */

// Configuration defaults
export const CONFIG = {
    // Multi-person: separate thresholds for UI toggle vs screenshot
    MULTI_PERSON_TOGGLE_FRAMES: 2,   // 1s to show indicator (2 frames at 500ms)
    MULTI_PERSON_SCREENSHOT_FRAMES: 10, // 5s to trigger screenshot (10 frames)
    MULTI_PERSON_CLEAR_FRAMES: 2,    // 1s to clear
    MULTI_PERSON_COOLDOWN_MS: 10000, // 10s between events

    // Face missing: duration-based
    FACE_MISSING_MS: 3000,           // 3s to trigger
    FACE_CLEAR_MS: 1000,             // 1s to clear
    FACE_MISSING_COOLDOWN_MS: 30000, // 30s between events

    // Low light: duration-based with hysteresis
    LOW_LIGHT_MS: 5000,              // 5s to trigger
    LOW_LIGHT_CLEAR_MS: 2000,        // 2s to clear
    LOW_LIGHT_HYSTERESIS: 10,        // Clear threshold = trigger + 10
    LOW_LIGHT_COOLDOWN_MS: 60000,    // 60s between events

    // Camera blocked: low brightness + low variance
    CAMERA_BLOCKED_MS: 2500,         // 2.5s to trigger
    CAMERA_BLOCKED_COOLDOWN_MS: 30000,
    BRIGHTNESS_BLOCKED_THRESHOLD: 15,
    VARIANCE_BLOCKED_THRESHOLD: 100,

    // Look away: consecutive frames
    LOOK_AWAY_TRIGGER_FRAMES: 2,
    LOOK_AWAY_CLEAR_FRAMES: 2,
    LOOK_AWAY_COOLDOWN_MS: 15000,
};

/**
 * Detection State Manager
 * Tracks hysteresis state for all anomaly types
 */
export class DetectionStateManager {
    constructor(config = {}) {
        this.config = { ...CONFIG, ...config };

        // Multi-person state
        this.multiPersonCount = 0;
        this.multiPersonActive = false;
        this.multiPersonLastEvent = 0;

        // Face missing state
        this.faceMissingStart = null;
        this.faceOkStart = null;
        this.faceMissingActive = false;
        this.faceMissingLastEvent = 0;

        // Low light state
        this.lowLightStart = null;
        this.normalLightStart = null;
        this.lowLightActive = false;
        this.lowLightLastEvent = 0;

        // Camera blocked state
        this.cameraBlockedStart = null;
        this.cameraBlockedActive = false;
        this.cameraBlockedLastEvent = 0;

        // Look away state
        this.lookAwayCount = 0;
        this.lookAwayActive = false;
        this.lookAwayLastEvent = 0;
    }

    /**
     * Update multi-person detection state
     * @param {number} faceCount - Number of confident faces detected
     * @returns {{ toggledOn: boolean, toggledOff: boolean, shouldEmit: boolean }}
     */
    updateMultiPerson(faceCount) {
        const now = Date.now();
        const isMultiple = faceCount >= 2;

        if (isMultiple) {
            this.multiPersonCount++;

            // Check if should show toggle (fast threshold)
            const justToggledOn = !this.multiPersonActive &&
                this.multiPersonCount >= this.config.MULTI_PERSON_TOGGLE_FRAMES;

            if (justToggledOn) {
                this.multiPersonActive = true;
            }

            // Check if should emit event/screenshot (slow threshold - 5s)
            const shouldEmit = this.multiPersonActive &&
                this.multiPersonCount >= this.config.MULTI_PERSON_SCREENSHOT_FRAMES &&
                (now - this.multiPersonLastEvent) >= this.config.MULTI_PERSON_COOLDOWN_MS;

            if (shouldEmit) {
                this.multiPersonLastEvent = now;
                // Reset count to prevent re-emitting until clear+re-trigger
                this.multiPersonCount = this.config.MULTI_PERSON_TOGGLE_FRAMES;
            }

            return { toggledOn: justToggledOn, toggledOff: false, shouldEmit };
        } else {
            // Decrement count for clearing
            if (this.multiPersonActive) {
                this.multiPersonCount = Math.max(0, this.multiPersonCount - 1);

                if (this.multiPersonCount <= 0) {
                    this.multiPersonActive = false;
                    return { toggledOn: false, toggledOff: true, shouldEmit: false };
                }
            } else {
                this.multiPersonCount = 0;
            }
        }

        return { toggledOn: false, toggledOff: false, shouldEmit: false };
    }

    /**
     * Update face missing detection state
     * @param {number} faceCount - Number of confident faces detected
     * @returns {{ triggered: boolean, cleared: boolean, shouldEmit: boolean }}
     */
    updateFaceMissing(faceCount) {
        const now = Date.now();
        const hasFace = faceCount >= 1;

        if (!hasFace) {
            // Start tracking missing time
            if (!this.faceMissingStart) {
                this.faceMissingStart = now;
            }
            this.faceOkStart = null;

            const duration = now - this.faceMissingStart;

            if (!this.faceMissingActive && duration >= this.config.FACE_MISSING_MS) {
                this.faceMissingActive = true;
                const shouldEmit = (now - this.faceMissingLastEvent) >= this.config.FACE_MISSING_COOLDOWN_MS;
                if (shouldEmit) this.faceMissingLastEvent = now;
                return { triggered: true, cleared: false, shouldEmit };
            }
        } else {
            // Face present
            this.faceMissingStart = null;

            if (this.faceMissingActive) {
                if (!this.faceOkStart) {
                    this.faceOkStart = now;
                }

                const duration = now - this.faceOkStart;
                if (duration >= this.config.FACE_CLEAR_MS) {
                    this.faceMissingActive = false;
                    this.faceOkStart = null;
                    return { triggered: false, cleared: true, shouldEmit: false };
                }
            }
        }

        return { triggered: false, cleared: false, shouldEmit: false };
    }

    /**
     * Update low light detection state
     * @param {number} brightness - Average brightness (0-255)
     * @param {number} threshold - Low light threshold
     * @returns {{ triggered: boolean, cleared: boolean, shouldEmit: boolean }}
     */
    updateLowLight(brightness, threshold = 40) {
        const now = Date.now();
        const isLow = brightness < threshold;
        const clearThreshold = threshold + this.config.LOW_LIGHT_HYSTERESIS;

        if (isLow) {
            if (!this.lowLightStart) {
                this.lowLightStart = now;
            }
            this.normalLightStart = null;

            const duration = now - this.lowLightStart;

            if (!this.lowLightActive && duration >= this.config.LOW_LIGHT_MS) {
                this.lowLightActive = true;
                const shouldEmit = (now - this.lowLightLastEvent) >= this.config.LOW_LIGHT_COOLDOWN_MS;
                if (shouldEmit) this.lowLightLastEvent = now;
                return { triggered: true, cleared: false, shouldEmit };
            }
        } else if (brightness >= clearThreshold) {
            // Above clear threshold (with hysteresis)
            this.lowLightStart = null;

            if (this.lowLightActive) {
                if (!this.normalLightStart) {
                    this.normalLightStart = now;
                }

                const duration = now - this.normalLightStart;
                if (duration >= this.config.LOW_LIGHT_CLEAR_MS) {
                    this.lowLightActive = false;
                    this.normalLightStart = null;
                    return { triggered: false, cleared: true, shouldEmit: false };
                }
            }
        }

        return { triggered: false, cleared: false, shouldEmit: false };
    }

    /**
     * Update camera blocked detection state
     * @param {number} brightness - Average brightness (0-255)
     * @param {number} variance - Pixel variance
     * @returns {{ triggered: boolean, cleared: boolean, shouldEmit: boolean }}
     */
    updateCameraBlocked(brightness, variance) {
        const now = Date.now();
        const isBlocked = brightness < this.config.BRIGHTNESS_BLOCKED_THRESHOLD &&
            variance < this.config.VARIANCE_BLOCKED_THRESHOLD;

        if (isBlocked) {
            if (!this.cameraBlockedStart) {
                this.cameraBlockedStart = now;
            }

            const duration = now - this.cameraBlockedStart;

            if (!this.cameraBlockedActive && duration >= this.config.CAMERA_BLOCKED_MS) {
                this.cameraBlockedActive = true;
                const shouldEmit = (now - this.cameraBlockedLastEvent) >= this.config.CAMERA_BLOCKED_COOLDOWN_MS;
                if (shouldEmit) this.cameraBlockedLastEvent = now;
                return { triggered: true, cleared: false, shouldEmit };
            }
        } else {
            this.cameraBlockedStart = null;
            if (this.cameraBlockedActive) {
                this.cameraBlockedActive = false;
                return { triggered: false, cleared: true, shouldEmit: false };
            }
        }

        return { triggered: false, cleared: false, shouldEmit: false };
    }

    /**
     * Update look away detection state
     * @param {boolean} isLookingAway - Whether head is rotated
     * @returns {{ triggered: boolean, cleared: boolean, shouldEmit: boolean }}
     */
    updateLookAway(isLookingAway) {
        const now = Date.now();

        if (isLookingAway) {
            this.lookAwayCount++;

            if (!this.lookAwayActive &&
                this.lookAwayCount >= this.config.LOOK_AWAY_TRIGGER_FRAMES) {
                this.lookAwayActive = true;
                const shouldEmit = (now - this.lookAwayLastEvent) >= this.config.LOOK_AWAY_COOLDOWN_MS;
                if (shouldEmit) this.lookAwayLastEvent = now;
                return { triggered: true, cleared: false, shouldEmit };
            }
        } else {
            if (this.lookAwayActive) {
                this.lookAwayCount = Math.max(0, this.lookAwayCount - 1);

                if (this.lookAwayCount <= 0) {
                    this.lookAwayActive = false;
                    return { triggered: false, cleared: true, shouldEmit: false };
                }
            } else {
                this.lookAwayCount = 0;
            }
        }

        return { triggered: false, cleared: false, shouldEmit: false };
    }

    /**
     * Get current active states
     */
    getActiveStates() {
        return {
            multiPerson: this.multiPersonActive,
            faceMissing: this.faceMissingActive,
            lowLight: this.lowLightActive,
            cameraBlocked: this.cameraBlockedActive,
            lookAway: this.lookAwayActive,
        };
    }

    /**
     * Reset all states
     */
    reset() {
        this.multiPersonCount = 0;
        this.multiPersonActive = false;
        this.faceMissingStart = null;
        this.faceOkStart = null;
        this.faceMissingActive = false;
        this.lowLightStart = null;
        this.normalLightStart = null;
        this.lowLightActive = false;
        this.cameraBlockedStart = null;
        this.cameraBlockedActive = false;
        this.lookAwayCount = 0;
        this.lookAwayActive = false;
    }
}

// Singleton for use across hooks
let _instance = null;
export function getDetectionStateManager(config) {
    if (!_instance) {
        _instance = new DetectionStateManager(config);
    }
    return _instance;
}

export function resetDetectionStateManager() {
    if (_instance) {
        _instance.reset();
    }
    _instance = null;
}
