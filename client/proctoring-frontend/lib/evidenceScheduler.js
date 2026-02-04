/**
 * evidenceScheduler.js - Production-grade evidence capture scheduler
 * 
 * Features:
 * - Visibility-aware (Page Visibility API)
 * - Camera readiness checks
 * - Capture delay for stable frames
 * - Rate limiting per session and per anomaly type
 * - Automatic JPEG quality reduction to stay <= 10KB
 */

// Configuration
export const EVIDENCE_CONFIG = {
    CAPTURE_DELAY_MS: 800,          // Delay after trigger before capture
    STABLE_MS: 250,                 // Wait for stable frame after conditions met
    MAX_RETRIES: 3,                 // Max retries if camera not ready
    RETRY_DELAY_MS: 200,            // Delay between retries
    SESSION_COOLDOWN_MS: 10000,     // Min 10s between any snapshots
    ANOMALY_COOLDOWN_MS: 15000,     // Min 15s between same anomaly type
    MAX_THUMBNAIL_KB: 20,           // Max thumbnail size in KB (increased)
    THUMBNAIL_WIDTH: 320,           // Thumbnail width (increased)
    THUMBNAIL_HEIGHT: 180,          // Thumbnail height (increased)
    INITIAL_QUALITY: 0.75,          // Initial JPEG quality (increased)
    MIN_QUALITY: 0.4,               // Minimum JPEG quality
};

/**
 * Evidence Capture Scheduler
 */
export class EvidenceScheduler {
    constructor(config = {}) {
        this.config = { ...EVIDENCE_CONFIG, ...config };

        // State
        this.isVisible = typeof document !== 'undefined' ?
            document.visibilityState === 'visible' : true;
        this.pendingJobs = [];
        this.lastCaptureTime = 0;
        this.lastCaptureByType = {};
        this.isProcessing = false;

        // Bind visibility handler
        if (typeof document !== 'undefined') {
            this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        }
    }

    /**
     * Handle page visibility changes
     */
    handleVisibilityChange() {
        this.isVisible = document.visibilityState === 'visible';

        if (this.isVisible && this.pendingJobs.length > 0) {
            // Tab became visible, process pending jobs after delay
            setTimeout(() => this.processPendingJobs(), this.config.CAPTURE_DELAY_MS);
        }
    }

    /**
     * Queue a snapshot capture job
     * @param {string} anomalyType - Type of anomaly (e.g., 'MULTI_PERSON')
     * @param {HTMLVideoElement} videoElement - Video element to capture from
     * @param {Function} onCapture - Callback with captured base64 data
     * @param {Object} options - Additional options
     */
    queue(anomalyType, videoElement, onCapture, options = {}) {
        const now = Date.now();

        // Check session cooldown
        if (now - this.lastCaptureTime < this.config.SESSION_COOLDOWN_MS) {
            console.log(`[EvidenceScheduler] Session cooldown active, skipping ${anomalyType}`);
            // Still call callback with null to allow event without snapshot
            if (options.allowWithoutSnapshot) {
                onCapture(null);
            }
            return;
        }

        // Check per-anomaly cooldown
        const lastTypeCapture = this.lastCaptureByType[anomalyType] || 0;
        if (now - lastTypeCapture < this.config.ANOMALY_COOLDOWN_MS) {
            console.log(`[EvidenceScheduler] Anomaly cooldown active for ${anomalyType}`);
            if (options.allowWithoutSnapshot) {
                onCapture(null);
            }
            return;
        }

        // Add to pending jobs
        const job = {
            id: `${anomalyType}-${now}`,
            anomalyType,
            videoElement,
            onCapture,
            queuedAt: now,
            retries: 0,
            options,
        };

        this.pendingJobs.push(job);

        // Start processing after delay
        setTimeout(() => this.processPendingJobs(), this.config.CAPTURE_DELAY_MS);
    }

    /**
     * Process pending capture jobs
     */
    async processPendingJobs() {
        if (this.isProcessing || this.pendingJobs.length === 0) {
            return;
        }

        // Check visibility
        if (!this.isVisible) {
            console.log('[EvidenceScheduler] Tab hidden, pausing capture');
            return;
        }

        this.isProcessing = true;

        const job = this.pendingJobs.shift();
        if (!job) {
            this.isProcessing = false;
            return;
        }

        try {
            // Wait for stable frame
            await this.waitMs(this.config.STABLE_MS);

            // Check visibility again after wait
            if (!this.isVisible) {
                this.pendingJobs.unshift(job); // Put back
                this.isProcessing = false;
                return;
            }

            // Attempt capture
            const result = await this.captureWithRetry(job);

            if (result) {
                this.lastCaptureTime = Date.now();
                this.lastCaptureByType[job.anomalyType] = Date.now();
                job.onCapture(result);
            } else if (job.options.allowWithoutSnapshot) {
                job.onCapture(null);
            }

        } catch (err) {
            console.error('[EvidenceScheduler] Capture failed:', err);
            if (job.options.allowWithoutSnapshot) {
                job.onCapture(null);
            }
        }

        this.isProcessing = false;

        // Process next job if any
        if (this.pendingJobs.length > 0) {
            setTimeout(() => this.processPendingJobs(), 100);
        }
    }

    /**
     * Capture with retry logic
     */
    async captureWithRetry(job) {
        const { videoElement } = job;

        for (let attempt = 0; attempt <= this.config.MAX_RETRIES; attempt++) {
            // Check video readiness
            if (!this.isVideoReady(videoElement)) {
                if (attempt < this.config.MAX_RETRIES) {
                    await this.waitMs(this.config.RETRY_DELAY_MS);
                    continue;
                }
                console.warn('[EvidenceScheduler] Video not ready after retries');
                return null;
            }

            // Capture frame
            const base64 = await this.captureFrame(videoElement);
            if (base64) {
                return base64;
            }
        }

        return null;
    }

    /**
     * Check if video element is ready for capture
     */
    isVideoReady(videoElement) {
        if (!videoElement) return false;
        if (videoElement.readyState < 2) return false; // HAVE_CURRENT_DATA
        if (!videoElement.videoWidth || !videoElement.videoHeight) return false;
        return true;
    }

    /**
     * Capture a frame and compress to target size
     */
    async captureFrame(videoElement) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = this.config.THUMBNAIL_WIDTH;
            canvas.height = this.config.THUMBNAIL_HEIGHT;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // Try to get within size limit with quality reduction
            let quality = this.config.INITIAL_QUALITY;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            let sizeKB = this.getBase64SizeKB(dataUrl);

            while (sizeKB > this.config.MAX_THUMBNAIL_KB && quality > this.config.MIN_QUALITY) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
                sizeKB = this.getBase64SizeKB(dataUrl);
            }

            // Extract base64 without prefix
            const base64 = dataUrl.split(',')[1];

            console.log(`[EvidenceScheduler] Captured ${sizeKB.toFixed(1)}KB at quality ${quality.toFixed(1)}`);

            return base64;

        } catch (err) {
            console.error('[EvidenceScheduler] Frame capture error:', err);
            return null;
        }
    }

    /**
     * Get size of base64 data URL in KB
     */
    getBase64SizeKB(dataUrl) {
        const base64 = dataUrl.split(',')[1] || dataUrl;
        const padding = (base64.match(/=/g) || []).length;
        const sizeBytes = (base64.length * 0.75) - padding;
        return sizeBytes / 1024;
    }

    /**
     * Wait helper
     */
    waitMs(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear all pending jobs
     */
    clearPending() {
        this.pendingJobs = [];
    }

    /**
     * Cleanup
     */
    destroy() {
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }
        this.clearPending();
    }

    /**
     * Check if capture is allowed (for pre-flight checks)
     */
    canCapture(anomalyType) {
        const now = Date.now();

        if (now - this.lastCaptureTime < this.config.SESSION_COOLDOWN_MS) {
            return false;
        }

        const lastTypeCapture = this.lastCaptureByType[anomalyType] || 0;
        if (now - lastTypeCapture < this.config.ANOMALY_COOLDOWN_MS) {
            return false;
        }

        return true;
    }
}

// Singleton
let _scheduler = null;

export function getEvidenceScheduler(config) {
    if (!_scheduler) {
        _scheduler = new EvidenceScheduler(config);
    }
    return _scheduler;
}

export function destroyEvidenceScheduler() {
    if (_scheduler) {
        _scheduler.destroy();
        _scheduler = null;
    }
}
