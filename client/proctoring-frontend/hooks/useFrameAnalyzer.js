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

import { useRef, useCallback, useEffect } from 'react';
import { detectFaces, preloadModel } from '../lib/faceDetector';
import { checkFacePresence, checkMultipleFaces, checkBrightness, checkHeadRotation } from '../lib/checks';

// Analysis interval in ms (500ms = 2 FPS)
const ANALYSIS_INTERVAL_MS = 500;

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
    // Track if analysis is in progress (prevent overlap)
    const isProcessingRef = useRef(false);

    // Canvas for frame extraction
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    // Interval handle
    const intervalRef = useRef(null);

    // Model loading state
    const modelLoadingRef = useRef(false);
    const modelLoadedRef = useRef(false);

    /**
     * Initialize canvas (OffscreenCanvas or fallback)
     */
    const initCanvas = useCallback((width, height) => {
        // Try OffscreenCanvas first (better performance, doesn't touch DOM)
        if (typeof OffscreenCanvas !== 'undefined') {
            canvasRef.current = new OffscreenCanvas(width, height);
            ctxRef.current = canvasRef.current.getContext('2d');
        } else {
            // Fallback: create hidden canvas
            canvasRef.current = document.createElement('canvas');
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            ctxRef.current = canvasRef.current.getContext('2d');
        }
    }, []);

    /**
     * Load model in background
     */
    const loadModel = useCallback(async () => {
        if (modelLoadedRef.current || modelLoadingRef.current) return;

        modelLoadingRef.current = true;
        try {
            await preloadModel();
            modelLoadedRef.current = true;
        } catch (err) {
        } finally {
            modelLoadingRef.current = false;
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
        const startTime = performance.now();

        try {
            const video = videoRef.current;
            const width = video.videoWidth || 320;
            const height = video.videoHeight || 240;

            // Initialize canvas on first use
            if (!canvasRef.current) {
                initCanvas(width, height);
            }

            // Draw current frame to canvas
            ctxRef.current.drawImage(video, 0, 0, width, height);

            // Get image data for brightness check
            const imageData = ctxRef.current.getImageData(0, 0, width, height);

            // Run face detection
            const faces = await detectFaces(canvasRef.current);

            // Run checks
            const consecutiveMissing = getConsecutiveMissing();
            const { flag: faceFlag, newConsecutiveMissing } = checkFacePresence(faces, consecutiveMissing);
            const multipleFlag = checkMultipleFaces(faces);
            const brightnessFlag = checkBrightness(imageData);

            // Check head rotation (enabled for LOOK_AWAY detection)
            let rotationFlag = null;
            if (faces.length === 1) {
                rotationFlag = checkHeadRotation(faces[0]);
            }

            const processingTime = performance.now() - startTime;

            // Report results
            onAnalysisResult({
                faces,
                faceFlag,
                multipleFlag,
                brightnessFlag,
                rotationFlag,
                processingTime,
                newConsecutiveMissing
            });

        } catch (err) {
        } finally {
            isProcessingRef.current = false;
        }
    }, [videoRef, getConsecutiveMissing, onAnalysisResult, initCanvas]);

    /**
     * Start analysis loop
     */
    const startAnalysis = useCallback(() => {
        // Start model loading
        loadModel();

        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Start new interval
        // Using setInterval instead of requestAnimationFrame for consistent throttling
        // rAF would run at display refresh rate (60+ FPS), wasting CPU
        intervalRef.current = setInterval(() => {
            if (modelLoadedRef.current) {
                analyzeFrame();
            }
        }, ANALYSIS_INTERVAL_MS);
    }, [loadModel, analyzeFrame]);

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
