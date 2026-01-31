/**
 * checks - Proctoring check implementations
 * 
 * These are pure functions that analyze detection results and image data
 * to produce proctoring flags. All checks are designed to be cheap and fast.
 */

// Threshold for consecutive missing samples before flagging
// At 2 FPS, 3 samples = ~1.5 seconds of missing face
export const CONSECUTIVE_MISSING_THRESHOLD = 3;

// Minimum confidence for a face detection to count
export const FACE_CONFIDENCE_THRESHOLD = 0.8;

// Average pixel brightness below this is flagged as low light
// Range: 0-255, 40 is quite dark
export const LOW_LIGHT_THRESHOLD = 40;

/**
 * Check face presence
 * 
 * @param {Array} faces - Detected faces from BlazeFace
 * @param {number} consecutiveMissing - Count of consecutive frames with no face
 * @returns {{ flag: string|null, newConsecutiveMissing: number }}
 */
export function checkFacePresence(faces, consecutiveMissing) {
    // Filter by confidence - ignore low-confidence detections
    const confidentFaces = faces.filter(f => f.probability >= FACE_CONFIDENCE_THRESHOLD);

    if (confidentFaces.length >= 1) {
        // Face found - reset counter and return OK
        return {
            flag: 'FACE_OK',
            newConsecutiveMissing: 0
        };
    }

    // No face detected
    const newCount = consecutiveMissing + 1;

    // Only flag after threshold to avoid false positives from brief glitches
    if (newCount >= CONSECUTIVE_MISSING_THRESHOLD) {
        return {
            flag: 'FACE_MISSING',
            newConsecutiveMissing: newCount
        };
    }

    // Still within grace period - return null flag (no change to display)
    return {
        flag: null,
        newConsecutiveMissing: newCount
    };
}

/**
 * Check for multiple faces
 * Flags immediately when detected (no grace period)
 * 
 * @param {Array} faces - Detected faces from BlazeFace
 * @returns {string|null} - 'MULTIPLE_FACES' or null
 */
export function checkMultipleFaces(faces) {
    const confidentFaces = faces.filter(f => f.probability >= FACE_CONFIDENCE_THRESHOLD);
    return confidentFaces.length > 1 ? 'MULTIPLE_FACES' : null;
}

/**
 * Check brightness/visibility (cheap heuristic)
 * 
 * PERFORMANCE: Samples every 16th pixel to reduce computation
 * For a 320x240 image, this processes ~4800 pixels instead of 76800
 * 
 * @param {ImageData} imageData - Raw pixel data from canvas
 * @returns {string|null} - 'LOW_LIGHT' or null
 */
export function checkBrightness(imageData) {
    const data = imageData.data;
    let totalBrightness = 0;
    let sampleCount = 0;

    // Sample every 16th pixel (4 bytes per pixel: RGBA)
    // This gives us ~6% of pixels - enough for average brightness
    for (let i = 0; i < data.length; i += 64) {
        // Calculate perceived brightness using standard luminance formula
        // Y = 0.299R + 0.587G + 0.114B
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b);
        sampleCount++;
    }

    const averageBrightness = totalBrightness / sampleCount;

    return averageBrightness < LOW_LIGHT_THRESHOLD ? 'LOW_LIGHT' : null;
}

// Head rotation threshold - ratio of distance difference
// If one ear is much closer to nose than the other, head is rotated
// 0.35 = 35% difference threshold (fairly lenient)
export const HEAD_ROTATION_THRESHOLD = 0.35;

/**
 * Check head rotation using BlazeFace landmarks
 * 
 * Uses the distance from nose to each ear to estimate yaw (left-right rotation).
 * When head is rotated, one ear is closer to the nose than the other.
 * 
 * BlazeFace landmarks:
 *   0: rightEye, 1: leftEye, 2: nose, 3: mouth, 4: rightEar, 5: leftEar
 * 
 * @param {Object} face - Face detection with landmarks
 * @returns {string|null} - 'HEAD_ROTATED' or null
 */
export function checkHeadRotation(face) {
    // Need landmarks for rotation check
    if (!face || !face.landmarks || face.landmarks.length < 6) {
        return null;
    }

    const landmarks = face.landmarks;
    const nose = landmarks[2];
    const rightEar = landmarks[4];
    const leftEar = landmarks[5];

    // Calculate distance from nose to each ear
    const distToRightEar = Math.sqrt(
        Math.pow(nose[0] - rightEar[0], 2) +
        Math.pow(nose[1] - rightEar[1], 2)
    );

    const distToLeftEar = Math.sqrt(
        Math.pow(nose[0] - leftEar[0], 2) +
        Math.pow(nose[1] - leftEar[1], 2)
    );

    // Calculate asymmetry ratio
    // When head is straight, both distances should be similar
    // When rotated, one ear is much closer to nose
    const maxDist = Math.max(distToRightEar, distToLeftEar);
    const minDist = Math.min(distToRightEar, distToLeftEar);

    // Avoid division by zero
    if (maxDist === 0) return null;

    const asymmetryRatio = (maxDist - minDist) / maxDist;

    // If asymmetry exceeds threshold, head is rotated
    if (asymmetryRatio > HEAD_ROTATION_THRESHOLD) {
        return 'HEAD_ROTATED';
    }

    return null;
}

/**
 * Check if face is clear (not rotated) for face matching
 * Returns true if face is suitable for matching
 * 
 * @param {Object} face - Face detection with landmarks
 * @returns {boolean}
 */
export function isFaceClearForMatching(face) {
    return checkHeadRotation(face) === null;
}
