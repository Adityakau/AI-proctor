/**
 * frameBuffer.js - Ring buffer for continuous frame capture
 * 
 * Captures frames every 2s into a circular buffer.
 * When anomaly detected, grab latest frame instantly.
 * Completely decouples capture from detection timing.
 */

const BUFFER_SIZE = 5;          // Keep last 5 frames
const CAPTURE_INTERVAL_MS = 2000; // Capture every 2s
const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 180;
const JPEG_QUALITY = 0.75;

class FrameBuffer {
    constructor() {
        this.webcamBuffer = new Array(BUFFER_SIZE).fill(null);
        this.screenBuffer = new Array(BUFFER_SIZE).fill(null);
        this.webcamIndex = 0;
        this.screenIndex = 0;
        this.intervalId = null;
        this.webcamVideo = null;
        this.screenVideo = null;
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Start continuous capture
     * @param {HTMLVideoElement} webcamVideo 
     * @param {HTMLVideoElement} screenVideo 
     */
    start(webcamVideo, screenVideo = null) {
        this.webcamVideo = webcamVideo;
        this.screenVideo = screenVideo;

        // Create canvas for capture
        this.canvas = document.createElement('canvas');
        this.canvas.width = FRAME_WIDTH;
        this.canvas.height = FRAME_HEIGHT;
        this.ctx = this.canvas.getContext('2d');

        // Clear any existing interval
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        // Start capture loop
        this.intervalId = setInterval(() => this.captureFrames(), CAPTURE_INTERVAL_MS);

        // Capture first frame immediately
        this.captureFrames();

        // Listen for visibility changes - capture BEFORE tab loses focus
        if (typeof document !== 'undefined') {
            this.handleVisibilityChange = () => {
                if (document.visibilityState === 'hidden') {
                    // Tab is being hidden - force capture NOW before throttling
                    console.log('[FrameBuffer] Tab hiding - forcing screen capture');
                    this.forceScreenCapture();
                }
            };
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        }

        console.log('[FrameBuffer] Started continuous capture');
    }

    /**
     * Stop capture
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (typeof document !== 'undefined' && this.handleVisibilityChange) {
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }
        console.log('[FrameBuffer] Stopped');
    }

    /**
     * Force immediate screen capture (call when tab switch detected)
     */
    forceScreenCapture() {
        if (this.screenVideo && this.isVideoReady(this.screenVideo)) {
            const frame = this.captureFrame(this.screenVideo);
            if (frame) {
                this.screenBuffer[this.screenIndex] = frame;
                this.screenIndex = (this.screenIndex + 1) % BUFFER_SIZE;
                console.log('[FrameBuffer] Forced screen capture at', frame.timestamp);
                return frame;
            }
        }
        return null;
    }

    /**
     * Force immediate webcam capture
     */
    forceWebcamCapture() {
        if (this.webcamVideo && this.isVideoReady(this.webcamVideo)) {
            const frame = this.captureFrame(this.webcamVideo);
            if (frame) {
                this.webcamBuffer[this.webcamIndex] = frame;
                this.webcamIndex = (this.webcamIndex + 1) % BUFFER_SIZE;
                console.log('[FrameBuffer] Forced webcam capture at', frame.timestamp);
                return frame;
            }
        }
        return null;
    }

    /**
     * Force capture - tries screen first, then webcam, then buffer
     * GUARANTEED to return a frame if any video source is available
     */
    forceCapture() {
        // Try screen first (shows other tab if screen share active)
        let frame = this.forceScreenCapture();
        if (frame) return frame;

        // Try webcam capture
        frame = this.forceWebcamCapture();
        if (frame) return frame;

        // Fall back to buffer
        frame = this.getScreenFrame();
        if (frame) return frame;

        frame = this.getWebcamFrame();
        return frame;
    }

    /**
     * Update screen video reference (for when screen share starts/stops)
     */
    setScreenVideo(screenVideo) {
        this.screenVideo = screenVideo;
    }

    /**
     * Capture frames from both sources
     */
    captureFrames() {
        // Capture webcam
        if (this.webcamVideo && this.isVideoReady(this.webcamVideo)) {
            const frame = this.captureFrame(this.webcamVideo);
            if (frame) {
                this.webcamBuffer[this.webcamIndex] = frame;
                this.webcamIndex = (this.webcamIndex + 1) % BUFFER_SIZE;
            }
        }

        // Capture screen
        if (this.screenVideo && this.isVideoReady(this.screenVideo)) {
            const frame = this.captureFrame(this.screenVideo);
            if (frame) {
                this.screenBuffer[this.screenIndex] = frame;
                this.screenIndex = (this.screenIndex + 1) % BUFFER_SIZE;
            }
        }
    }

    /**
     * Check if video is ready for capture
     */
    isVideoReady(video) {
        return video &&
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.videoHeight > 0;
    }

    /**
     * Capture single frame from video element
     */
    captureFrame(video) {
        try {
            this.ctx.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
            const dataUrl = this.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            return {
                dataUrl,
                base64: dataUrl.split(',')[1],
                timestamp: Date.now()
            };
        } catch (err) {
            console.warn('[FrameBuffer] Capture failed:', err.message);
            return null;
        }
    }

    /**
     * Get latest webcam frame
     * @returns {{ dataUrl: string, base64: string, timestamp: number } | null}
     */
    getWebcamFrame() {
        // Get most recent frame (one before current index)
        const idx = (this.webcamIndex - 1 + BUFFER_SIZE) % BUFFER_SIZE;
        return this.webcamBuffer[idx];
    }

    /**
     * Get latest screen frame
     * @returns {{ dataUrl: string, base64: string, timestamp: number } | null}
     */
    getScreenFrame() {
        const idx = (this.screenIndex - 1 + BUFFER_SIZE) % BUFFER_SIZE;
        return this.screenBuffer[idx];
    }

    /**
     * Get best available frame (prefer screen for tab switch, webcam for others)
     * @param {'webcam' | 'screen' | 'auto'} preference
     */
    getFrame(preference = 'auto') {
        if (preference === 'screen' || preference === 'auto') {
            const screen = this.getScreenFrame();
            if (screen) return screen;
        }
        return this.getWebcamFrame();
    }

    /**
     * Clear all buffers
     */
    clear() {
        this.webcamBuffer.fill(null);
        this.screenBuffer.fill(null);
        this.webcamIndex = 0;
        this.screenIndex = 0;
    }
}

// Singleton instance
let _instance = null;

export function getFrameBuffer() {
    if (!_instance) {
        _instance = new FrameBuffer();
    }
    return _instance;
}

export function destroyFrameBuffer() {
    if (_instance) {
        _instance.stop();
        _instance = null;
    }
}
