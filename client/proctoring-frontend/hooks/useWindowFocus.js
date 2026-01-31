/**
 * useWindowFocus - Detects if the user has left the exam tab/window
 * 
 * Monitors:
 * 1. Page Visibility API (switching tabs, minimizing)
 * 2. Window Focus (clicking outside browser - e.g. dual monitor)
 */

import { useState, useEffect, useCallback } from 'react';

export function useWindowFocus({ onFocusLost, onFocusGained } = {}) {
    const [isFocused, setIsFocused] = useState(true);
    const [lastBlurTime, setLastBlurTime] = useState(null);

    const handleFocusChange = useCallback((focused) => {
        setIsFocused(focused);
        const now = new Date().toISOString();

        if (focused) {
            if (onFocusGained) onFocusGained(now);
        } else {
            setLastBlurTime(now);
            if (onFocusLost) onFocusLost(now);
        }
    }, [onFocusLost, onFocusGained]);

    useEffect(() => {
        // 1. Page Visibility API (Tab switch / Minimize)
        const handleVisibilityChange = () => {
            handleFocusChange(document.visibilityState === 'visible');
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
    }, [handleFocusChange]);

    return {
        isFocused,
        lastBlurTime
    };
}
