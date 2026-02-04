/**
 * useScreenShare - Manages screen capture for proctoring
 * 
 * Uses getDisplayMedia to capture screen stream.
 * Detects if user stops sharing via 'ended' event on track.
 */

// ... (imports)
import { useState, useCallback, useEffect } from 'react';

export function useScreenShare() {
    const [isSharing, setIsSharing] = useState(false);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);

    const startScreenShare = useCallback(async () => {
        try {
            setError(null);

            // Request screen share (system picker)
            // preferCurrentTab: false prevents infinite mirror effect if they pick same tab
            const mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor' // Hint to browser to prefer monitor
                },
                audio: false
            });

            // Enforce "Entire Screen" selection
            // Get the track settings to check what the user actually selected
            const videoTrack = mediaStream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();

            console.log("Screen Share Settings:", settings); // Debugging

            // Check if displaySurface is supported and if it's not 'monitor'
            // Chrome/Edge/Firefox support this.
            if (settings.displaySurface && settings.displaySurface !== 'monitor') {
                // Stop the stream immediately
                videoTrack.stop();
                setError("Screen sharing restricted: You must select 'Entire Screen'. Detected: " + settings.displaySurface);
                setIsSharing(false);
                return;
            }

            // Handle user manually stopping share via browser UI
            videoTrack.onended = () => {
                stopScreenShare();
            };

            setStream(mediaStream);
            setIsSharing(true);

        } catch (err) {
            console.error('Screen sharing error:', err);
            // User cancelled picker or permission denied
            if (err.name === 'NotAllowedError') {
                setError('Permission denied or cancelled');
            } else if (err.name === 'NotReadableError') {
                setError('System permission denied. Check System Settings > Privacy & Security > Screen Recording.');
            } else {
                setError(err.message);
            }
            setIsSharing(false);
        }
    }, []);

    const stopScreenShare = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsSharing(false);
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
        isSharing,
        stream,
        error,
        startScreenShare,
        stopScreenShare
    };
}
