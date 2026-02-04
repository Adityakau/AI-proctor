/**
 * useWindowFocus - Detects if the user has left the exam tab/window
 * 
 * Monitors:
 * 1. Page Visibility API (switching tabs, minimizing)
 * 2. Window Focus (clicking outside browser - e.g. dual monitor)
 * 
 * IMPORTANT: onVisibilityHidden fires SYNCHRONOUSLY when tab loses visibility,
 * allowing immediate capture before browser throttles JS or screen changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useWindowFocus({ onFocusLost, onFocusGained, onVisibilityHidden } = {}) {
    const [isFocused, setIsFocused] = useState(true);
    const [lastBlurTime, setLastBlurTime] = useState(null);

    // Track if we've already fired for this blur event (prevent double-fire)
    const firedRef = useRef(false);

    const handleFocusChange = useCallback((focused, isVisibilityEvent = false) => {
        setIsFocused(focused);
        const now = new Date().toISOString();

        if (focused) {
            firedRef.current = false;
            if (onFocusGained) onFocusGained(now);
        } else {
            setLastBlurTime(now);
            if (onFocusLost) onFocusLost(now);
        }
    }, [onFocusLost, onFocusGained]);

    useEffect(() => {
        // 1. Page Visibility API (Tab switch / Minimize)
        const handleVisibilityChange = () => {
            const hidden = document.visibilityState === 'hidden';

            if (hidden && !firedRef.current) {
                firedRef.current = true;
                // Fire synchronous callback BEFORE React state update
                if (onVisibilityHidden) {
                    onVisibilityHidden();
                }
            }

            handleFocusChange(document.visibilityState === 'visible', true);
        };

        // 2. Window Focus (Alt-Tab / Click away)
        const handleWindowBlur = () => handleFocusChange(false);
        const handleWindowFocus = () => handleFocusChange(true);

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [handleFocusChange, onVisibilityHidden]);

    return {
        isFocused,
        lastBlurTime
    };
}
