/**
 * CameraView Component
 * Individual camera video player using native <video> element for maximum performance
 */

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { CameraAngle, SeiMetadata } from '../../types';
import { CAMERA_LABELS } from '../../types';
import { DashcamMP4 } from '../../lib/dashcam-mp4';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export interface CameraViewHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
}

interface CameraViewProps {
  camera: CameraAngle;
  file: File | null;
  isPlaying: boolean;
  playbackSpeed: number;
  initialTime?: number;
  onSeiData?: (sei: SeiMetadata | null) => void;
  onDurationChange?: (duration: number) => void;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void; // Called when video ends
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(function CameraView({
  camera,
  file,
  isPlaying,
  playbackSpeed,
  initialTime = 0,
  onSeiData,
  onDurationChange,
  onTimeUpdate,
  onEnded,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const seiDataRef = useRef<(SeiMetadata | null)[]>([]);
  const frameStartsRef = useRef<number[]>([]);
  const lastSeiIndexRef = useRef<number>(-1);
  const initialTimeAppliedRef = useRef<boolean>(false);

  // Store callbacks in refs to avoid triggering effect re-runs
  const onDurationChangeRef = useRef(onDurationChange);
  const onSeiDataRef = useRef(onSeiData);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);

  // Keep refs up to date
  useEffect(() => { onDurationChangeRef.current = onDurationChange; }, [onDurationChange]);
  useEffect(() => { onSeiDataRef.current = onSeiData; }, [onSeiData]);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  // Expose imperative handle for parent control
  useImperativeHandle(ref, () => ({
    play: () => {
      videoRef.current?.play().catch(() => { });
    },
    pause: () => {
      videoRef.current?.pause();
    },
    seek: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
  }), []);

  // Cleanup blob URL
  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // Load Video - ONLY depends on file and camera, NOT on callbacks
  useEffect(() => {
    if (!file) {
      cleanupBlobUrl();
      seiDataRef.current = [];
      frameStartsRef.current = [];
      lastSeiIndexRef.current = -1;
      initialTimeAppliedRef.current = false;
      setError(null);
      setIsVideoReady(false);
      return;
    }

    let cancelled = false;
    const currentFile = file; // Capture for closure

    async function load() {
      setIsLoading(true);
      setError(null);
      setIsVideoReady(false);
      initialTimeAppliedRef.current = false;
      cleanupBlobUrl();

      try {
        // Create blob URL for native video playback
        const blobUrl = URL.createObjectURL(currentFile);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        blobUrlRef.current = blobUrl;

        // Set video source immediately for fast load
        const video = videoRef.current;
        if (video && !cancelled) {
          video.src = blobUrl;
          video.load();
        }

        // Parse SEI data in background (doesn't block video loading)
        const buffer = await currentFile.arrayBuffer();
        if (cancelled) return;

        const mp4 = new DashcamMP4(buffer);
        const config = mp4.getConfig();
        const frames = mp4.parseFrames();
        const duration = mp4.getDuration();

        if (cancelled) return;

        // Store SEI data for each frame (preserving null for frames without SEI)
        seiDataRef.current = frames.map(f => f.sei ?? null);

        // Precompute frame start times for SEI sync
        const starts: number[] = [];
        let t = 0;
        for (let i = 0; i < config.durations.length; i++) {
          starts.push(t);
          t += config.durations[i] / 1000;
        }
        frameStartsRef.current = starts;

        // Call duration callback via ref (doesn't trigger re-render loop)
        onDurationChangeRef.current?.(duration);

      } catch (e) {
        console.error(`Failed to load video for ${camera}:`, e);
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      cleanupBlobUrl();
    };
  }, [file, camera, cleanupBlobUrl]); // REMOVED onDurationChange from deps!

  // Handle play/pause state - NOW DEPENDS ON isVideoReady
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoReady) return;

    if (isPlaying) {
      video.play().catch((e) => {
        // Autoplay might be blocked, that's ok
        console.warn(`Play failed for ${camera}:`, e);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, isVideoReady, camera]);

  // High-frequency time updates using requestAnimationFrame (for smooth seek bar)
  useEffect(() => {
    if (!isPlaying || !isVideoReady) return;
    // Only run if we have a time update callback
    if (!onTimeUpdateRef.current) return;

    let rafId: number;
    const updateTime = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        onTimeUpdateRef.current?.(video.currentTime);
      }
      rafId = requestAnimationFrame(updateTime);
    };
    rafId = requestAnimationFrame(updateTime);

    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isVideoReady]);

  // Handle playback speed
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Handle time updates for SEI sync
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const currentTime = video.currentTime;

    // Update SEI data based on current time
    if (onSeiDataRef.current && frameStartsRef.current.length > 0) {
      const starts = frameStartsRef.current;
      // Binary search for current frame
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        if (starts[mid] <= currentTime) lo = mid;
        else hi = mid - 1;
      }

      if (lo !== lastSeiIndexRef.current) {
        lastSeiIndexRef.current = lo;
        const sei = seiDataRef.current[lo];
        onSeiDataRef.current(sei);
      }
    }
  }, []);

  // Handle video can play - this fires when the video has buffered enough to start playing
  const handleCanPlay = useCallback(() => {
    if (!isVideoReady) {
      setIsVideoReady(true);
      setIsLoading(false);
    }
  }, [isVideoReady]);

  // Fallback: also mark ready on loadeddata event
  const handleLoadedData = useCallback(() => {
    if (!isVideoReady) {
      setIsVideoReady(true);
      setIsLoading(false);
    }
  }, [isVideoReady]);

  // Handle video metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video && !initialTimeAppliedRef.current) {
      video.currentTime = initialTime;
      initialTimeAppliedRef.current = true;
    }
  }, [initialTime]);

  // Handle video errors
  const handleError = useCallback(() => {
    const video = videoRef.current;
    if (video?.error) {
      console.error(`Video error for ${camera}:`, video.error.message);
      setError(video.error.message || 'Video playback error');
    }
  }, [camera]);

  // Handle video ended - for continuous playback
  const handleEnded = useCallback(() => {
    onEndedRef.current?.();
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none">
      {/* Camera Label */}
      <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-xs font-medium text-white pointer-events-none z-10">
        {CAMERA_LABELS[camera]}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none z-20">
          <div className="text-center">
            <div className="animate-spin w-6 h-6 border-2 border-tesla-red border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-xs text-gray-400">Loading...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none z-20">
          <div className="text-center px-4">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* No File State */}
      {!file && !isLoading && (
        <div className="text-center pointer-events-none z-10">
          <p className="text-xs text-gray-500">No video</p>
        </div>
      )}

      {/* Native Video Element - THE KEY TO SMOOTH PLAYBACK */}
      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={8}
        centerOnInit={true}
        wheel={{ step: 0.2 }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-contain pointer-events-none"
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={handleLoadedData}
            onCanPlay={handleCanPlay}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onError={handleError}
            style={{ display: file ? 'block' : 'none' }}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
});
