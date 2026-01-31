import { useState, useCallback, useEffect, useRef } from 'react';

export function useFullscreen() {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const manualOverrideRef = useRef(false);

    // Track Fullscreen State
    useEffect(() => {
        const handleFsChange = () => {
            // If manually overridden, ignore API failures
            if (manualOverrideRef.current) return;

            // Check API status first
            const apiFullscreen = !!(document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement);

            if (apiFullscreen) {
                setIsFullscreen(true);
                return;
            }

            const widthDiff = Math.abs(window.innerWidth - window.screen.width);
            const heightDiff = Math.abs(window.innerHeight - window.screen.height);

            // Allow 50px tolerance for scrollbars/browser UI quirks
            if (widthDiff < 50 && heightDiff < 50) {
                setIsFullscreen(true);
            } else {
                setIsFullscreen(false);
            }
        };

        document.addEventListener('fullscreenchange', handleFsChange);
        document.addEventListener('webkitfullscreenchange', handleFsChange);
        document.addEventListener('mozfullscreenchange', handleFsChange);
        document.addEventListener('MSFullscreenChange', handleFsChange);

        // Fallback: Check window dimensions (F11 support) with tolerance
        const checkDimensions = () => {
            if (manualOverrideRef.current) return; // Skip if overridden

            // Check API status first
            const apiFullscreen = !!(document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement);

            if (apiFullscreen) {
                setIsFullscreen(true);
                return;
            }

            const widthDiff = Math.abs(window.innerWidth - window.screen.width);
            const heightDiff = Math.abs(window.innerHeight - window.screen.height);

            // Allow 50px tolerance for scrollbars/browser UI quirks
            if (widthDiff < 50 && heightDiff < 50) {
                setIsFullscreen(true);
            } else {
                setIsFullscreen(false);
            }
        };

        // Check immediately and every second
        checkDimensions();
        const interval = setInterval(checkDimensions, 1000);
        window.addEventListener('resize', checkDimensions);

        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            document.removeEventListener('webkitfullscreenchange', handleFsChange);
            document.removeEventListener('mozfullscreenchange', handleFsChange);
            document.removeEventListener('MSFullscreenChange', handleFsChange);
            window.removeEventListener('resize', checkDimensions);
            clearInterval(interval);
        };
    }, []);

    const enterFullscreen = useCallback(async () => {
        try {
            const el = document.documentElement;

            if (el.requestFullscreen) {
                await el.requestFullscreen();
            } else if (el.webkitRequestFullscreen) {
                await el.webkitRequestFullscreen();
            }
        } catch (err) {
            console.error("Fullscreen rejected:", err);
            // Don't alert automatically, maybe let caller handle or just silent fail + fallback check
            // alert("Fullscreen failed. Please press F11.");
        }
    }, []);

    return { isFullscreen, enterFullscreen };
}
