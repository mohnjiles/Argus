/**
 * useAnimationFrame Hook
 * Efficient shared animation frame management for canvas-based overlays
 * Automatically pauses when not needed to save CPU
 * 
 * Performance optimizations:
 * - Throttles to configurable FPS (default 30fps)
 * - Automatically pauses when page is not visible
 * - Supports skipping frames when data hasn't changed
 */

import { useRef, useEffect, useCallback, useState } from 'react';

export interface AnimationFrameCallback {
    (timestamp: number, deltaTime: number): void;
}

export interface ThrottledAnimationOptions {
    /** Target frames per second (default: 30) */
    targetFps?: number;
    /** Whether the animation should be running */
    isActive: boolean;
}

/**
 * Returns true if the page is currently visible
 */
function usePageVisibilityInternal(): boolean {
    const [isVisible, setIsVisible] = useState(() => {
        if (typeof document === 'undefined') return true;
        return document.visibilityState === 'visible';
    });

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(document.visibilityState === 'visible');
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    return isVisible;
}

/**
 * A hook that manages requestAnimationFrame with automatic cleanup,
 * throttling, and pause/resume functionality based on visibility and playback state.
 * 
 * @param callback - Function to call on each frame
 * @param isActive - Whether the animation should be running
 * @param deps - Additional dependencies that should trigger callback updates
 */
export function useAnimationFrame(
    callback: AnimationFrameCallback,
    isActive: boolean,
    deps: React.DependencyList = []
) {
    const rafRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const callbackRef = useRef<AnimationFrameCallback>(callback);
    const isPageVisible = usePageVisibilityInternal();

    // Keep callback ref current without triggering effect re-runs
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback, ...deps]);

    // Combine isActive with page visibility
    const shouldRun = isActive && isPageVisible;

    useEffect(() => {
        if (!shouldRun) {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
            }
            return;
        }

        const animate = (timestamp: number) => {
            const deltaTime = lastTimeRef.current ? timestamp - lastTimeRef.current : 16.67;
            lastTimeRef.current = timestamp;

            callbackRef.current(timestamp, deltaTime);
            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
            }
        };
    }, [shouldRun]);
}

/**
 * Enhanced animation frame hook with built-in throttling.
 * Runs at a lower FPS to save CPU while still providing smooth animations.
 * 
 * @param callback - Function to call on each frame
 * @param options - Configuration options
 * @param deps - Additional dependencies that should trigger callback updates
 */
export function useThrottledAnimationFrame(
    callback: AnimationFrameCallback,
    options: ThrottledAnimationOptions,
    deps: React.DependencyList = []
) {
    const { targetFps = 30, isActive } = options;
    const rafRef = useRef<number>(0);
    const lastFrameTimeRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const callbackRef = useRef<AnimationFrameCallback>(callback);
    const isPageVisible = usePageVisibilityInternal();

    const frameInterval = 1000 / targetFps;

    // Keep callback ref current
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback, ...deps]);

    const shouldRun = isActive && isPageVisible;

    useEffect(() => {
        if (!shouldRun) {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
            }
            return;
        }

        const animate = (timestamp: number) => {
            // Throttle: only call callback if enough time has passed
            if (timestamp - lastFrameTimeRef.current >= frameInterval) {
                const deltaTime = lastTimeRef.current ? timestamp - lastTimeRef.current : frameInterval;
                lastTimeRef.current = timestamp;
                lastFrameTimeRef.current = timestamp;

                callbackRef.current(timestamp, deltaTime);
            }

            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
            }
        };
    }, [shouldRun, frameInterval]);
}

/**
 * A hook that throttles updates to a target rate, useful for
 * reducing the frequency of expensive operations like canvas draws.
 * 
 * @param targetFps - Target frames per second (default 30)
 */
export function useThrottledFrame(targetFps: number = 30) {
    const lastFrameTimeRef = useRef<number>(0);
    const frameInterval = 1000 / targetFps;

    const shouldUpdate = useCallback((timestamp: number): boolean => {
        if (timestamp - lastFrameTimeRef.current >= frameInterval) {
            lastFrameTimeRef.current = timestamp;
            return true;
        }
        return false;
    }, [frameInterval]);

    return { shouldUpdate };
}
