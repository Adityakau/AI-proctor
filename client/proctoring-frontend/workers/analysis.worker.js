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
    const { imageData: rawImageData, consecutiveMissing } = payload;

    if (!isModelLoaded) {
        self.postMessage({ type: 'ERROR', error: 'Model not loaded' });
        return;
    }

    const startTime = performance.now();

    try {
        // Reconstruct ImageData from transferred buffer
        // rawImageData contains: { data: Uint8ClampedArray, width, height }
        const imageData = new ImageData(
            new Uint8ClampedArray(rawImageData.data),
            rawImageData.width,
            rawImageData.height
        );

        // Run face detection
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

        // Calculate brightness stats for detection state
        const brightnessStats = calculateBrightnessStats(imageData);

        const processingTime = performance.now() - startTime;

        // Count confident faces
        const confidentFaces = faces.filter(f => f.probability >= 0.8);

        // Post results back
        self.postMessage({
            type: 'ANALYSIS_COMPLETE',
            results: {
                faces,
                faceCount: confidentFaces.length,
                faceFlag,
                multipleFlag,
                brightnessFlag,
                rotationFlag,
                brightness: brightnessStats.mean,
                variance: brightnessStats.variance,
                processingTime,
                newConsecutiveMissing
            }
        });

    } catch (err) {
        console.error('Analysis failed:', err);
        self.postMessage({ type: 'ERROR', error: err.message });
    }
}

/**
 * Calculate brightness mean and variance for camera blocked detection
 */
function calculateBrightnessStats(imageData) {
    const data = imageData.data;
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    // Sample every 64th pixel for efficiency
    for (let i = 0; i < data.length; i += 256) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += brightness;
        sumSq += brightness * brightness;
        count++;
    }

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);

    return { mean, variance };
}
