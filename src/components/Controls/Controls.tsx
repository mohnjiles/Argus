/**
 * Controls Component
 * Unified playback controls with seek bar, clip navigation, and speed control
 */

import { formatDuration, ClipGroup, CameraAngle } from '../../types';
import { ThumbnailStrip } from '../Export/ThumbnailStrip';

interface ControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  clipIndex?: number;
  totalClips?: number;
  eventClipIndex?: number; // Which clip the event occurred in
  eventTimeOffset?: number; // Time offset within that clip
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onJumpForward: () => void;
  onJumpBackward: () => void;
  onPrevClip?: () => boolean;
  onNextClip?: () => boolean;
  onSeekToClip?: (index: number) => void; // Jump to specific clip
  onJumpToEvent?: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  disabled: boolean;
  currentClip?: ClipGroup;
  camera?: CameraAngle;
  onCameraChange?: (camera: CameraAngle) => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

export function Controls({
  isPlaying,
  currentTime,
  duration,
  clipIndex = 0,
  totalClips = 1,
  eventClipIndex,
  eventTimeOffset,
  onPlayPause,
  onSeek,
  onJumpForward,
  onJumpBackward,
  onPrevClip,
  onNextClip,
  onSeekToClip,
  onJumpToEvent,
  playbackSpeed,
  onSpeedChange,
  disabled,
  currentClip,
  camera = 'front',
  onCameraChange,
}: ControlsProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasMultipleClips = totalClips > 1;
  const hasPrev = clipIndex > 0;
  const hasNext = clipIndex < totalClips - 1;
  const hasEventMarker = eventClipIndex !== undefined && eventTimeOffset !== undefined;
  const isEventClip = hasEventMarker && eventClipIndex === clipIndex;
  const eventMarkerPosition = isEventClip && duration > 0 ? (eventTimeOffset! / duration) * 100 : 0;

  return (
    <div className="px-4 py-3 bg-[#0a0a0a] border-t border-white/5">
      {/* Clip Navigation Bar (for multi-clip events) */}
      {/* Compact Clip Navigation Bar */}
      {hasMultipleClips && (
        <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider">
          {/* Left: Clip Counter */}
          <div className="flex-1 text-white/20">
            Clip {clipIndex + 1} <span className="mx-1 opacity-50">/</span> {totalClips}
          </div>

          {/* Center: Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onPrevClip?.()}
              disabled={disabled || !hasPrev}
              className="text-white/20 hover:text-white disabled:opacity-0 transition-all"
              title="Previous clip (P)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalClips }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => onSeekToClip?.(i)}
                  disabled={disabled}
                  className={`relative h-1.5 rounded-full transition-all duration-300 ${i === clipIndex
                    ? 'w-6 bg-tesla-red shadow-[0_0_8px_rgba(232,33,39,0.5)]'
                    : 'w-1.5 bg-white/10 hover:bg-white/30'
                    }`}
                >
                  {hasEventMarker && eventClipIndex === i && (
                    <div className="absolute top-[0px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => onNextClip?.()}
              disabled={disabled || !hasNext}
              className="text-white/20 hover:text-white disabled:opacity-0 transition-all"
              title="Next clip (N)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Right: Event Info */}
          <div className="flex-1 flex justify-end">
            {hasEventMarker && (
              <span className="text-amber-500/60 flex items-center gap-1.5">
                <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                Event Clip {eventClipIndex! + 1}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Seek Bar */}
      <div className="mb-3">
        <div className="relative group/scrubber h-16 flex items-center cursor-pointer">
          {/* Thumbnail Preview Strip */}
          <div className="absolute inset-x-0 h-8 group-hover/scrubber:h-16 transition-all duration-300 overflow-hidden rounded-lg opacity-80 group-hover/scrubber:opacity-100 shadow-xl shadow-black/50">
            {currentClip && (
              <ThumbnailStrip
                clip={currentClip}
                camera={camera}
                count={20}
                className="h-full scale-105 group-hover/scrubber:scale-100 transition-transform duration-500"
              />
            )}

            {/* Played Highlight Overlay - No transition on width to ensure smooth playback tracking */}
            <div
              className="absolute inset-y-0 left-0 bg-tesla-red/15 border-r border-tesla-red/40 pointer-events-none z-10"
              style={{ width: `${progress}%` }}
            />

            {/* Gradient Overlay for a more cinematic look */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none z-20" />
          </div>

          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full h-full appearance-none bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-40 relative px-0"
            style={{
              background: 'transparent',
              outline: 'none',
              /* Kill the default browser track and thumb */
              WebkitAppearance: 'none',
              boxShadow: 'none'
            }}
          />

          {/* Style resets for range input - using inline styles as fallback for CSS modules */}
          <style dangerouslySetInnerHTML={{
            __html: `
            input[type=range].appearance-none::-webkit-slider-runnable-track { background: transparent; border: none; }
            input[type=range].appearance-none::-webkit-slider-thumb { appearance: none; border: none; height: 100%; width: 2px; background: transparent; }
            input[type=range].appearance-none::-moz-range-track { background: transparent; border: none; }
            input[type=range].appearance-none::-moz-range-thumb { appearance: none; border: none; height: 100%; width: 2px; background: transparent; }
          `}} />

          {/* Progress Bar (Bottom Edge Line) - No transition on width to ensure smooth playback tracking */}
          <div
            className="absolute left-0 bottom-0 h-[4px] bg-tesla-red z-50 transition-[height,opacity] pointer-events-none rounded-bl-lg shadow-[0_0_12px_rgba(232,33,39,0.8)]"
            style={{ width: `${progress}%` }}
          />

          {/* Custom Scrubber Thumb Effect (Bright Vertical Needle) */}
          <div
            className="absolute h-full w-[2px] bg-white shadow-[0_0_15px_rgba(255,255,255,1)] pointer-events-none z-50 opacity-0 group-hover/scrubber:opacity-100 transition-opacity duration-200"
            style={{ left: `${progress}%` }}
          />

          {/* Event marker on seek bar */}
          {isEventClip && duration > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-amber-400 rounded-full ring-2 ring-black shadow-[0_0_10px_rgba(251,191,36,0.5)] pointer-events-none z-30 opacity-80 group-hover/scrubber:scale-125 transition-transform"
              style={{ left: `${eventMarkerPosition}%`, marginLeft: '-7px' }}
              title="Sentry Event"
            />
          )}
        </div>

        {/* Time Display */}
        <div className="flex justify-between mt-1.5 text-[11px] font-bold text-white/30 tracking-tight font-mono">
          <span className="text-white/60">{formatDuration(currentTime)}</span>
          {isEventClip && eventTimeOffset !== undefined && (
            <span className="text-amber-500 animate-pulse uppercase tracking-[0.1em]">
              Event @ {formatDuration(eventTimeOffset)}
            </span>
          )}
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="relative flex items-center justify-between min-h-[48px]">
        {/* Left: Jump to Event + Jump back */}
        <div className="flex-1 flex items-center gap-3">
          {hasEventMarker && onJumpToEvent && (
            <button
              onClick={onJumpToEvent}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-sm shadow-amber-900/10"
              title="Jump to Sentry Event (E)"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 3L4 14h7v7l9-11h-7V3z" />
              </svg>
              <span className="hidden sm:inline">Jump to Event</span>
            </button>
          )}

          <button
            onClick={onJumpBackward}
            disabled={disabled}
            className="flex items-center gap-1 px-2 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Jump back 10 seconds (J)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
            <span className="font-mono text-xs">-10s</span>
          </button>
        </div>

        {/* Center: Play/Pause */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
          <button
            onClick={onPlayPause}
            disabled={disabled}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-tesla-red hover:bg-[#ff1a21] shadow-xl shadow-red-950/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-95"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Right: Jump forward + Speed */}
        <div className="flex-1 flex items-center justify-end gap-3">
          <button
            onClick={onJumpForward}
            disabled={disabled}
            className="flex items-center gap-1 px-2 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Jump forward 10 seconds (L)"
          >
            <span className="font-mono text-xs">+10s</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>

          <select
            value={camera}
            onChange={(e) => onCameraChange?.(e.target.value as CameraAngle)}
            disabled={disabled}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800 hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-tesla-red/40 uppercase tracking-tighter"
            title="Thumbnail camera"
          >
            {currentClip && Array.from(currentClip.cameras.keys()).map((cam) => (
              <option key={cam} value={cam}>
                {cam.split('_').join(' ')}
              </option>
            ))}
          </select>

          <select
            value={playbackSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            disabled={disabled}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-900 text-gray-300 border border-gray-800 hover:bg-gray-800 hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-tesla-red/40"
            title="Playback speed"
          >
            {SPEED_OPTIONS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="mt-6 border-t border-white/[0.03] pt-4">
        <div className="flex items-center justify-center gap-6 text-[10px] uppercase tracking-[0.15em] font-bold text-white/20">
          <div className="flex items-center gap-2">
            <kbd className="min-w-[40px] px-1.5 py-1 bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-md text-white/40 shadow-sm">Space</kbd>
            <span>Play/Pause</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="w-8 h-8 flex items-center justify-center bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-md text-white/40 shadow-sm text-sm">J</kbd>
            <span>-10s</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="w-8 h-8 flex items-center justify-center bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-md text-white/40 shadow-sm text-sm">L</kbd>
            <span>+10s</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="w-8 h-8 flex items-center justify-center bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-md text-white/40 shadow-sm text-sm">P</kbd>
            <span>Prev</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="w-8 h-8 flex items-center justify-center bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-md text-white/40 shadow-sm text-sm">N</kbd>
            <span>Next</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="min-w-[44px] px-1.5 py-1 bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-md text-white/40 shadow-sm">← →</kbd>
            <span>Seek</span>
          </div>
        </div>
      </div>
    </div>
  );
}
