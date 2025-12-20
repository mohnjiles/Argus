/**
 * usePageVisibility Hook
 * Detects when the browser tab/window is not visible to pause expensive operations
 */

import { useState, useEffect } from 'react';

/**
 * Returns true if the page is currently visible, false if hidden (tab in background, minimized, etc.)
 */
export function usePageVisibility(): boolean {
    const [isVisible, setIsVisible] = useState(() => {
        // SSR safety
        if (typeof document === 'undefined') return true;
        return document.visibilityState === 'visible';
    });

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(document.visibilityState === 'visible');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return isVisible;
}
