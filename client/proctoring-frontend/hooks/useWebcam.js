/**
 * useWebcam - Custom hook for webcam management
 * 
 * PERFORMANCE NOTES:
 * - Uses low resolution (320x240) to minimize memory/processing overhead
 * - Camera only starts on explicit user action (not auto-start)
 * - Stream is properly cleaned up on unmount to prevent memory leaks
 * - Returns 'stream' object for consumption by Context or UI
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// Low resolution constraints for performance
// 320x240 is sufficient for face detection while minimizing CPU load
const VIDEO_CONSTRAINTS = {
  video: {
    width: { ideal: 320 },
    height: { ideal: 240 },
    facingMode: 'user',
    // Request lower frame rate to reduce GPU load
    frameRate: { ideal: 15, max: 15 }
  },
  audio: false
};

/**
 * @typedef {Object} WebcamState
 * @property {MediaStream|null} stream - Active media stream
 * @property {boolean} isLoading - Camera is being initialized
 * @property {boolean} isActive - Camera stream is active
 * @property {string|null} error - Error message if camera failed
 * @property {Function} startCamera - Call to request camera permission
 * @property {Function} stopCamera - Call to stop camera stream
 */

/**
 * @returns {WebcamState}
 */
export function useWebcam() {
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Request camera permission and start stream
   * Only called on user action to comply with browser policies
   */
  const startCamera = useCallback(async () => {
    // Prevent double initialization
    if (stream || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
      setStream(mediaStream);
      setIsActive(true);
    } catch (err) {
      console.error('Webcam initialization error:', err);
      let msg = err.message;

      // Enhance common error messages
      if (err.name === 'NotAllowedError') {
        msg = 'Camera permission denied. Please allow camera access in browser settings.';
      } else if (err.name === 'NotReadableError') {
        msg = 'Camera is in use by another application or failed to start.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera found on this device.';
      }

      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, stream]);

  /**
   * Stop camera stream and release resources
   */
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsActive(false);
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return {
    stream,
    isLoading,
    isActive,
    error,
    startCamera,
    stopCamera
  };
}
