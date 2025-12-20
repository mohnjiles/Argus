/**
 * useAnimationFrame Hook
 * Efficient shared animation frame management for canvas-based overlays
 * Automatically pauses when not needed to save CPU
 */

import { useRef, useEffect, useCallback } from 'react';

export interface AnimationFrameCallback {
    (timestamp: number, deltaTime: number): void;
}

/**
 * A hook that manages requestAnimationFrame with automatic cleanup
 * and pause/resume functionality based on visibility and playback state.
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

    // Keep callback ref current without triggering effect re-runs
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback, ...deps]);

    useEffect(() => {
        if (!isActive) {
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
    }, [isActive]);
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
