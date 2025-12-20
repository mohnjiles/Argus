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
    <div className="px-6 pt-2 pb-3 bg-transparent">
      {/* Clip Navigation Bar (for multi-clip events) */}
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
              className="group relative text-white/20 hover:text-white disabled:opacity-0 transition-all"
              title="Previous clip (P)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
              <kbd className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white/40 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-1.5 py-0.5 rounded border border-white/10 pointer-events-none">P</kbd>
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalClips }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => onSeekToClip?.(i)}
                  disabled={disabled}
                  className={`relative h-2.5 flex-shrink-0 rounded-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${i === clipIndex
                    ? 'w-10 bg-tesla-red shadow-[0_0_10px_rgba(232,33,39,0.6)]'
                    : 'w-2.5 bg-white/10 hover:bg-white/30'
                    }`}
                >
                  {hasEventMarker && eventClipIndex === i && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => onNextClip?.()}
              disabled={disabled || !hasNext}
              className="group relative text-white/20 hover:text-white disabled:opacity-0 transition-all"
              title="Next clip (N)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
              <kbd className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white/40 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-1.5 py-0.5 rounded border border-white/10 pointer-events-none">N</kbd>
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
            onMouseUp={(e) => (e.target as HTMLInputElement).blur()}
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

      {/* Control Buttons Cluster */}
      <div className="flex items-center justify-between mt-1.5">
        {/* Left Side: Jump to Event */}
        <div className="flex-1 flex items-center">
          {hasEventMarker && onJumpToEvent && (
            <button
              onClick={onJumpToEvent}
              disabled={disabled}
              className="group flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] bg-amber-500/5 text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10 border border-amber-500/10 hover:border-amber-500/30 transition-all active:scale-95"
              title="Jump to Sentry Event (E)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 3L4 14h7v7l9-11h-7V3z" />
              </svg>
              <span className="hidden xl:inline">Jump to Event</span>
              <kbd className="hidden group-hover:inline-block ml-2 text-[9px] font-mono text-amber-500/60 bg-black/30 px-1.5 py-0.5 rounded border border-amber-500/20 pointer-events-none">E</kbd>
            </button>
          )}
        </div>

        {/* Center Cluster: Main Playback Navigation */}
        <div className="flex items-center gap-3 px-4 py-1.5 bg-white/[0.03] border border-white/[0.05] rounded-full backdrop-blur-xl shadow-2xl">
          <button
            onClick={onJumpBackward}
            disabled={disabled}
            className="group relative p-2 rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            title="Jump back 10 seconds (J)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            <kbd className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white/40 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-1.5 py-0.5 rounded border border-white/10 pointer-events-none">J</kbd>
          </button>

          <button
            onClick={onPlayPause}
            disabled={disabled}
            className={`
              w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 shadow-lg
              ${isPlaying
                ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:shadow-white/5'
                : 'bg-gradient-to-br from-tesla-red to-[#b0181d] text-white shadow-tesla-red/20 ring-4 ring-tesla-red/10 hover:scale-110 hover:shadow-tesla-red/40 hover:brightness-110'
              }
            `}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg className="w-5 h-5 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 6v12l10-6z" />
              </svg>
            )}
          </button>

          <button
            onClick={onJumpForward}
            disabled={disabled}
            className="group relative p-2 rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            title="Jump forward 10 seconds (L)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            <kbd className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white/40 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-1.5 py-0.5 rounded border border-white/10 pointer-events-none">L</kbd>
          </button>
        </div>

        {/* Right Side: Options */}
        <div className="flex-1 flex items-center justify-end gap-2">
          <select
            value={camera}
            onChange={(e) => onCameraChange?.(e.target.value as CameraAngle)}
            disabled={disabled}
            className="px-3 py-2 rounded-xl text-[10px] font-bold bg-white/[0.03] text-white/40 border border-white/5 hover:bg-white/5 hover:text-white/60 transition-all cursor-pointer focus:outline-none uppercase tracking-widest"
          >
            {currentClip && Array.from(currentClip.cameras.keys()).map((cam) => (
              <option key={cam} value={cam} className="bg-[#0f0f0f]">
                {cam.split('_').join(' ')}
              </option>
            ))}
          </select>

          <select
            value={playbackSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            disabled={disabled}
            className="px-3 py-2 rounded-xl text-[10px] font-bold bg-white/[0.03] text-white/40 border border-white/5 hover:bg-white/5 hover:text-white/60 transition-all cursor-pointer focus:outline-none tracking-widest"
          >
            {SPEED_OPTIONS.map((speed) => (
              <option key={speed} value={speed} className="bg-[#0f0f0f]">
                {speed}x
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
