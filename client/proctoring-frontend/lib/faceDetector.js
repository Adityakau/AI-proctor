/**
 * faceDetector - BlazeFace wrapper for face detection
 * 
 * PERFORMANCE NOTES:
 * - BlazeFace is chosen for its small size (~400KB) and speed
 * - Model loads lazily on first detection call
 * - Single model instance is reused across all detections
 * - No landmarks/mesh - just bounding boxes (minimal output)
 */

import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

let model = null;
let isLoading = false;
let loadPromise = null;

/**
 * Load BlazeFace model (lazy, singleton)
 * Uses WebGL backend for GPU acceleration when available
 */
async function loadModel() {
    // Return cached model if available
    if (model) return model;

    // Prevent parallel loading
    if (isLoading) return loadPromise;

    isLoading = true;
    loadPromise = (async () => {
        try {
            // Prefer WebGL backend for GPU acceleration
            // Falls back to CPU (slower) if WebGL unavailable
            await tf.setBackend('webgl');
            await tf.ready();

            model = await blazeface.load();

            return model;
        } catch (err) {
            throw err;
        } finally {
            isLoading = false;
        }
    })();

    return loadPromise;
}

/**
 * Detect faces in an image/canvas/video element
 * 
 * @param {HTMLCanvasElement|HTMLVideoElement|ImageData} input - Image source
 * @returns {Promise<Array<{topLeft: [number, number], bottomRight: [number, number], probability: number, landmarks: Array}>>}
 * 
 * BlazeFace landmarks (6 points):
 *   0: rightEye
 *   1: leftEye
 *   2: nose
 *   3: mouth
 *   4: rightEar (right side of face, actually left ear when mirrored)
 *   5: leftEar (left side of face, actually right ear when mirrored)
 * 
 * PERFORMANCE: Each call takes ~10-30ms on modern GPUs
 * Caller is responsible for throttling to avoid CPU spikes
 */
export async function detectFaces(input) {
    const detector = await loadModel();

    // BlazeFace returns array of predictions
    // Each has: topLeft, bottomRight, landmarks, probability
    const predictions = await detector.estimateFaces(input, false /* returnTensors */);

    // Return format with landmarks for head rotation detection
    return predictions.map(pred => ({
        topLeft: pred.topLeft,
        bottomRight: pred.bottomRight,
        probability: pred.probability[0],
        // Landmarks: rightEye, leftEye, nose, mouth, rightEar, leftEar
        landmarks: pred.landmarks || []
    }));
}

/**
 * Check if model is ready (useful for UI loading states)
 */
export function isModelLoaded() {
    return model !== null;
}

/**
 * Pre-warm the model (optional, call during idle time)
 */
export async function preloadModel() {
    return loadModel();
}
