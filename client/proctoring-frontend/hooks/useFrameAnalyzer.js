/**
 * useFrameAnalyzer - Throttled frame analysis hook
 * 
 * PERFORMANCE STRATEGY:
 * - Uses setInterval (not requestAnimationFrame) for consistent throttling
 * - 500ms interval = 2 FPS max
 * - Skips frame if previous analysis still running
 * - Uses OffscreenCanvas when available (better performance)
 * - Falls back to hidden canvas for broader compatibility
 * - Measures processing time for safety monitoring
 */

/**
 * useFrameAnalyzer - Throttled frame analysis hook (Web Worker Version)
 * 
 * PERFORMANCE STRATEGY:
 * - Offloads heavy calculations to a Web Worker
 * - Uses setInterval for throttling
 * - Manages worker lifecycle
 */

import { useRef, useCallback, useEffect } from 'react';

// Analysis interval in ms (500ms = 2 FPS for responsive detection)
const ANALYSIS_INTERVAL_MS = 500;

// Target resolution for detection (smaller = faster)
const DETECTION_WIDTH = 160;
const DETECTION_HEIGHT = 120;

/**
 * Custom hook for throttled frame analysis
 * 
 * @param {Object} options
 * @param {React.RefObject<HTMLVideoElement>} options.videoRef - Reference to video element
 * @param {boolean} options.isActive - Whether camera is active
 * @param {boolean} options.analysisEnabled - Whether analysis is enabled (safety)
 * @param {Function} options.onAnalysisResult - Callback with analysis results
 * @param {Function} options.getConsecutiveMissing - Get current missing face counter
 */
export function useFrameAnalyzer({
    videoRef,
    isActive,
    analysisEnabled,
    onAnalysisResult,
    getConsecutiveMissing
}) {
    // Worker reference
    const workerRef = useRef(null);

    // Track if analysis is in progress (prevent overlap)
    const isProcessingRef = useRef(false);

    // Canvas for frame extraction
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    // Interval handle
    const intervalRef = useRef(null);

    // Model loading state (managed by worker now)
    const modelLoadingRef = useRef(true);
    const modelLoadedRef = useRef(false);

    /**
     * Initialize worker
     */
    useEffect(() => {
        // Create worker
        workerRef.current = new Worker(new URL('../workers/analysis.worker.js', import.meta.url));

        // Setup listeners
        workerRef.current.onmessage = (e) => {
            const { type, results, success, error } = e.data;

            if (type === 'ANALYSIS_COMPLETE') {
                isProcessingRef.current = false;
                onAnalysisResult(results);
            } else if (type === 'INIT_COMPLETE') {
                modelLoadingRef.current = false;
                modelLoadedRef.current = success;
                if (!success) console.error('Worker init failed:', error);
            } else if (type === 'ERROR') {
                isProcessingRef.current = false;
                console.error('Worker error:', error);
            }
        };

        // Initialize model in worker
        workerRef.current.postMessage({ type: 'INIT' });

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, [onAnalysisResult]);

    /**
     * Initialize canvas (OffscreenCanvas or fallback)
     */
    const initCanvas = useCallback(() => {
        // Use fixed small resolution for fast detection
        const width = DETECTION_WIDTH;
        const height = DETECTION_HEIGHT;

        // Try OffscreenCanvas first (better performance, doesn't touch DOM)
        if (typeof OffscreenCanvas !== 'undefined') {
            canvasRef.current = new OffscreenCanvas(width, height);
            ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
        } else {
            // Fallback: create hidden canvas
            canvasRef.current = document.createElement('canvas');
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
        }
    }, []);

    /**
     * Analyze a single frame
     */
    const analyzeFrame = useCallback(async () => {
        // Skip if already processing (prevents queue buildup)
        if (isProcessingRef.current) {
            return;
        }

        // Skip if video not ready
        if (!videoRef.current || videoRef.current.readyState < 2) {
            return;
        }

        // Skip if model not loaded
        if (!modelLoadedRef.current) {
            return;
        }

        isProcessingRef.current = true;

        try {
            const video = videoRef.current;

            // Initialize canvas on first use (fixed small resolution)
            if (!canvasRef.current) {
                initCanvas();
            }

            // Draw current frame to canvas (downscaled to DETECTION_WIDTH x DETECTION_HEIGHT)
            ctxRef.current.drawImage(video, 0, 0, DETECTION_WIDTH, DETECTION_HEIGHT);

            // Get image data at small resolution
            const imageData = ctxRef.current.getImageData(0, 0, DETECTION_WIDTH, DETECTION_HEIGHT);

            // Get current consecutive count to pass to worker
            const consecutiveMissing = getConsecutiveMissing();

            // Send to worker using transferable buffer for zero-copy transfer
            if (workerRef.current) {
                const buffer = imageData.data.buffer;
                workerRef.current.postMessage({
                    type: 'ANALYZE',
                    payload: {
                        imageData: {
                            data: imageData.data,
                            width: DETECTION_WIDTH,
                            height: DETECTION_HEIGHT
                        },
                        consecutiveMissing
                    }
                }, [buffer]); // Transfer buffer (zero-copy, ~3x faster)
            } else {
                isProcessingRef.current = false;
            }

        } catch (err) {
            console.error('Frame capture failed:', err);
            isProcessingRef.current = false;
        }
    }, [videoRef, getConsecutiveMissing, initCanvas]);

    /**
     * Start analysis loop
     */
    const startAnalysis = useCallback(() => {
        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            if (modelLoadedRef.current) {
                analyzeFrame();
            }
        }, ANALYSIS_INTERVAL_MS);
    }, [analyzeFrame]);

    /**
     * Stop analysis loop
     */
    const stopAnalysis = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Auto-start/stop based on camera and analysis state
    useEffect(() => {
        if (isActive && analysisEnabled) {
            startAnalysis();
        } else {
            stopAnalysis();
        }

        return () => stopAnalysis();
    }, [isActive, analysisEnabled, startAnalysis, stopAnalysis]);

    return {
        isModelLoading: modelLoadingRef.current,
        isModelLoaded: modelLoadedRef.current
    };
}
