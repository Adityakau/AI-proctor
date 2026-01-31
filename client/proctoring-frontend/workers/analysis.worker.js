/**
 * analysis.worker.js
 * 
 * Web Worker for running heavy proctoring analysis off the main thread.
 * Handles face detection and heuristic checks.
 */

import { detectFaces, preloadModel } from '../lib/faceDetector';
import { checkFacePresence, checkMultipleFaces, checkBrightness, checkHeadRotation } from '../lib/checks';

// Initialize context
let isModelLoaded = false;

// Handle messages from main thread
self.onmessage = async (e) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            await handleInit();
            break;
        case 'ANALYZE':
            await handleAnalyze(payload);
            break;
        default:
            console.warn('Unknown message type:', type);
    }
};

/**
 * Initialize model
 */
async function handleInit() {
    try {
        await preloadModel();
        isModelLoaded = true;
        self.postMessage({ type: 'INIT_COMPLETE', success: true });
    } catch (err) {
        console.error('Worker init failed:', err);
        self.postMessage({ type: 'INIT_COMPLETE', success: false, error: err.message });
    }
}

/**
 * Perform analysis on frame data
 */
async function handleAnalyze(payload) {
    const { imageData, consecutiveMissing } = payload;

    if (!isModelLoaded) {
        self.postMessage({ type: 'ERROR', error: 'Model not loaded' });
        return;
    }

    const startTime = performance.now();

    try {
        // Run face detection
        // detectFaces expects HTMLCanvasElement | HTMLVideoElement | ImageData
        // We pass ImageData received from main thread
        const faces = await detectFaces(imageData);

        // Run checks
        const { flag: faceFlag, newConsecutiveMissing } = checkFacePresence(faces, consecutiveMissing);
        const multipleFlag = checkMultipleFaces(faces);
        const brightnessFlag = checkBrightness(imageData);

        // Check head rotation (if enabled/needed)
        let rotationFlag = null;
        if (faces.length === 1) {
            rotationFlag = checkHeadRotation(faces[0]);
        }

        const processingTime = performance.now() - startTime;

        // Post results back
        self.postMessage({
            type: 'ANALYSIS_COMPLETE',
            results: {
                faces,
                faceFlag,
                multipleFlag,
                brightnessFlag,
                rotationFlag,
                processingTime,
                newConsecutiveMissing
            }
        });

    } catch (err) {
        console.error('Analysis failed:', err);
        self.postMessage({ type: 'ERROR', error: err.message });
    }
}
