/**
 * usePlayback Hook
 * Manages video playback state across multiple cameras with continuous playback support
 */

import { useState, useCallback } from 'react';
import type { ClipGroup, CameraAngle, SeiMetadata, VideoEvent } from '../types';
import { CAMERA_ANGLES } from '../types';

export interface PlaybackController {
  // Current state
  currentEvent: VideoEvent | null;
  currentClipIndex: number;
  currentClip: ClipGroup | null;
  isPlaying: boolean;
  currentTime: number; // Time within current clip
  totalTime: number; // Time across entire event
  duration: number; // Duration of current clip
  totalDuration: number; // Total duration of event
  clipDurations: number[]; // Durations of each clip in event
  playbackSpeed: number;
  visibleCameras: Set<CameraAngle>;
  currentSeiData: SeiMetadata | null;
  currentFrameIndex: number;

  // Event marker info (for Sentry events)
  eventClipIndex: number | undefined;
  eventTimeOffset: number | undefined;

  // Actions
  loadEvent: (event: VideoEvent, clipIndex?: number) => void;
  unloadEvent: () => void;
  togglePlayPause: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  seekToClip: (clipIndex: number) => void;
  seekToClipAndTime: (clipIndex: number, time: number) => void;
  jumpToEvent: () => void; // Jump to the event marker
  nextClip: () => boolean; // Returns true if there was a next clip
  prevClip: () => boolean;
  seekToFrame: (frameIndex: number) => void;
  jump: (seconds: number) => void;
  stepFrame: (direction: 1 | -1) => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleCamera: (camera: CameraAngle) => void;
  setCameraVisible: (camera: CameraAngle, visible: boolean) => void;
  setAllCamerasVisible: (visible: boolean) => void;
  setSeiData: (sei: SeiMetadata | null) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  onClipEnded: () => void; // Called when a clip ends, to auto-advance
}

export function usePlayback(): PlaybackController {
  const [currentEvent, setCurrentEvent] = useState<VideoEvent | null>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [visibleCameras, setVisibleCameras] = useState<Set<CameraAngle>>(
    new Set(CAMERA_ANGLES)
  );
  const [currentSeiData, setCurrentSeiData] = useState<SeiMetadata | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [clipDurations, setClipDurations] = useState<number[]>([]);

  // Derived state
  const currentClip = currentEvent?.clips[currentClipIndex] ?? null;

  // Calculate smart per-clip estimate for unknown durations
  // Distributes remaining time across unknown clips for consistency
  const getEstimatePerClip = () => {
    if (!currentEvent) return 60;

    let knownSum = 0;
    let unknownCount = 0;
    for (let i = 0; i < currentEvent.clips.length; i++) {
      if (clipDurations[i] && clipDurations[i] > 0) {
        knownSum += clipDurations[i];
      } else {
        unknownCount++;
      }
    }

    if (unknownCount === 0) return 60;
    const remainingDuration = Math.max(0, currentEvent.totalDuration - knownSum);
    return remainingDuration / unknownCount;
  };

  const estimatePerClip = getEstimatePerClip();

  // Calculate total time across event (sum of previous clip durations + current time)
  const totalTime = (() => {
    let cumulative = 0;
    for (let i = 0; i < currentClipIndex; i++) {
      cumulative += (clipDurations[i] && clipDurations[i] > 0) ? clipDurations[i] : estimatePerClip;
    }
    return cumulative + currentTime;
  })();

  // Total duration: sum known durations + estimate for unknown
  const totalDuration = (() => {
    if (!currentEvent) return 0;
    let sum = 0;
    for (let i = 0; i < currentEvent.clips.length; i++) {
      sum += (clipDurations[i] && clipDurations[i] > 0) ? clipDurations[i] : estimatePerClip;
    }
    return sum;
  })();

  const loadEvent = useCallback((event: VideoEvent, clipIndex: number = 0) => {
    setIsPlaying(false);
    setCurrentEvent(event);
    setCurrentClipIndex(Math.min(clipIndex, event.clips.length - 1));
    setCurrentTime(0);
    setCurrentFrameIndex(0);
    setCurrentSeiData(null);
    setDuration(0);
    setClipDurations([]); // Will be populated as clips load

    // Enable all available cameras by default (from first clip)
    const firstClip = event.clips[0];
    if (firstClip) {
      const available = new Set<CameraAngle>();
      for (const camera of CAMERA_ANGLES) {
        if (firstClip.cameras.has(camera)) {
          available.add(camera);
        }
      }
      setVisibleCameras(available);
    }
  }, []);

  const unloadEvent = useCallback(() => {
    setIsPlaying(false);
    setCurrentEvent(null);
    setCurrentClipIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setCurrentFrameIndex(0);
    setCurrentSeiData(null);
    setClipDurations([]);
  }, []);

  const play = useCallback(() => {
    if (!currentEvent) return;
    setIsPlaying(true);
  }, [currentEvent]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(clampedTime);
  }, [duration]);

  const seekToClip = useCallback((clipIndex: number) => {
    if (!currentEvent) return;
    const idx = Math.max(0, Math.min(clipIndex, currentEvent.clips.length - 1));
    setCurrentClipIndex(idx);
    setCurrentTime(0);
    setDuration(0); // Will be set when clip loads
  }, [currentEvent]);

  const seekToClipAndTime = useCallback((clipIndex: number, time: number) => {
    if (!currentEvent) return;
    const idx = Math.max(0, Math.min(clipIndex, currentEvent.clips.length - 1));
    setCurrentClipIndex(idx);
    setCurrentTime(time);
    setDuration(0); // Will be set when clip loads
  }, [currentEvent]);

  const jumpToEvent = useCallback(() => {
    if (!currentEvent) return;
    if (currentEvent.eventClipIndex !== undefined && currentEvent.eventTimeOffset !== undefined) {
      seekToClipAndTime(currentEvent.eventClipIndex, currentEvent.eventTimeOffset);
    }
  }, [currentEvent, seekToClipAndTime]);

  const nextClip = useCallback((): boolean => {
    if (!currentEvent) return false;
    if (currentClipIndex >= currentEvent.clips.length - 1) return false;

    // Clear SEI data immediately to prevent stale GPS position
    setCurrentSeiData(null);
    setCurrentClipIndex(prev => prev + 1);
    setCurrentTime(0);
    setDuration(0);
    return true;
  }, [currentEvent, currentClipIndex]);

  const prevClip = useCallback((): boolean => {
    if (!currentEvent) return false;
    if (currentClipIndex <= 0) return false;

    // Clear SEI data immediately to prevent stale GPS position
    setCurrentSeiData(null);
    setCurrentClipIndex(prev => prev - 1);
    setCurrentTime(0);
    setDuration(0);
    return true;
  }, [currentEvent, currentClipIndex]);

  // Called when a clip ends - auto-advance to next
  const onClipEnded = useCallback(() => {
    if (!currentEvent) return;

    const hasNext = nextClip();
    if (!hasNext) {
      // No more clips, stop at end
      setIsPlaying(false);
    }
    // If there was a next clip, it will start playing automatically
    // because isPlaying is still true
  }, [currentEvent, nextClip]);

  const seekToFrame = useCallback((frameIndex: number) => {
    setCurrentFrameIndex(frameIndex);
  }, []);

  const jump = useCallback((seconds: number) => {
    setCurrentTime(prev => {
      const newTime = prev + seconds;
      return Math.max(0, Math.min(newTime, duration));
    });
  }, [duration]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
  }, []);

  const stepFrame = useCallback((direction: 1 | -1) => {
    if (isPlaying) pause();

    // Assume 30fps = ~33ms per frame
    const frameDuration = 1 / 30; // seconds

    // If we have precise frame data, we could be smarter here,
    // but fixed step is usually sufficient for visual inspection.
    setCurrentTime(prev => {
      const newTime = prev + (direction * frameDuration);
      return Math.max(0, Math.min(newTime, duration));
    });
  }, [isPlaying, pause, duration]);

  const toggleCamera = useCallback((camera: CameraAngle) => {
    setVisibleCameras(prev => {
      const next = new Set(prev);
      if (next.has(camera)) {
        next.delete(camera);
      } else {
        next.add(camera);
      }
      return next;
    });
  }, []);

  const setCameraVisible = useCallback((camera: CameraAngle, visible: boolean) => {
    setVisibleCameras(prev => {
      const next = new Set(prev);
      if (visible) {
        next.add(camera);
      } else {
        next.delete(camera);
      }
      return next;
    });
  }, []);

  const setAllCamerasVisible = useCallback((visible: boolean) => {
    if (visible && currentClip) {
      const available = new Set<CameraAngle>();
      for (const camera of CAMERA_ANGLES) {
        if (currentClip.cameras.has(camera)) {
          available.add(camera);
        }
      }
      setVisibleCameras(available);
    } else {
      setVisibleCameras(new Set());
    }
  }, [currentClip]);

  const setSeiData = useCallback((sei: SeiMetadata | null) => {
    setCurrentSeiData(sei);
  }, []);

  // When duration is set, update the clip durations array
  const handleSetDuration = useCallback((dur: number) => {
    setDuration(dur);
    setClipDurations(prev => {
      const updated = [...prev];
      updated[currentClipIndex] = dur;
      return updated;
    });
  }, [currentClipIndex]);

  return {
    currentEvent,
    currentClipIndex,
    currentClip,
    isPlaying,
    currentTime,
    totalTime,
    duration,
    totalDuration,
    clipDurations,
    playbackSpeed,
    visibleCameras,
    currentSeiData,
    currentFrameIndex,

    // Event marker info
    eventClipIndex: currentEvent?.eventClipIndex,
    eventTimeOffset: currentEvent?.eventTimeOffset,

    loadEvent,
    unloadEvent,
    togglePlayPause,
    play,
    pause,
    seek,
    seekToClip,
    seekToClipAndTime,
    jumpToEvent,
    nextClip,
    prevClip,
    seekToFrame,
    jump,
    stepFrame,
    setPlaybackSpeed,
    toggleCamera,
    setCameraVisible,
    setAllCamerasVisible,
    setSeiData,
    setDuration: handleSetDuration,
    setCurrentTime,
    onClipEnded,
  };
}
