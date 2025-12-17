/**
 * Controls Component
 * Unified playback controls with seek bar, clip navigation, and speed control
 */

import { formatDuration } from '../../types';

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
}: ControlsProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasMultipleClips = totalClips > 1;
  const hasPrev = clipIndex > 0;
  const hasNext = clipIndex < totalClips - 1;
  const hasEventMarker = eventClipIndex !== undefined && eventTimeOffset !== undefined;
  const isEventClip = hasEventMarker && eventClipIndex === clipIndex;
  const eventMarkerPosition = isEventClip && duration > 0 ? (eventTimeOffset! / duration) * 100 : 0;

  return (
    <div className="px-4 py-3 bg-[#111]">
      {/* Clip Navigation Bar (for multi-clip events) */}
      {hasMultipleClips && (
        <div className="mb-3 bg-gray-900/50 rounded-lg p-2">
          <div className="flex items-center gap-2">
            {/* Prev Button */}
            <button
              onClick={() => onPrevClip?.()}
              disabled={disabled || !hasPrev}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous clip (P)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Clickable Clip Dots */}
            <div className="flex-1 flex items-center justify-center gap-1.5">
              {Array.from({ length: totalClips }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => onSeekToClip?.(i)}
                  disabled={disabled}
                  className={`relative h-2.5 rounded-full transition-all hover:scale-110 disabled:cursor-not-allowed ${
                    i === clipIndex
                      ? 'w-8 bg-tesla-red'
                      : i < clipIndex
                        ? 'w-3 bg-gray-500 hover:bg-gray-400'
                        : 'w-3 bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={`Clip ${i + 1}${hasEventMarker && eventClipIndex === i ? ' (Event)' : ''}`}
                >
                  {/* Event marker on the clip that contains the event */}
                  {hasEventMarker && eventClipIndex === i && (
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-amber-400/40 shadow-sm shadow-amber-400/50"
                      style={{ left: '50%', transform: 'translate(-50%, -50%)' }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={() => onNextClip?.()}
              disabled={disabled || !hasNext}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next clip (N)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Clip info row */}
          <div className="flex items-center justify-center gap-2 mt-1.5 text-xs">
            <span className="text-gray-500">
              Clip {clipIndex + 1} of {totalClips}
            </span>
            {hasEventMarker && (
              <span className="text-amber-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 3L4 14h7v7l9-11h-7V3z" />
                </svg>
                Event in clip {eventClipIndex! + 1}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Seek Bar */}
      <div className="mb-3">
        <div className="relative group">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full h-1.5 appearance-none bg-gray-700 rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10 relative"
            style={{
              background: disabled 
                ? '#374151'
                : `linear-gradient(to right, #e82127 0%, #e82127 ${progress}%, #374151 ${progress}%, #374151 100%)`
            }}
          />
          {/* Event marker on seek bar */}
          {isEventClip && duration > 0 && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-400 rounded-full ring-2 ring-amber-400/50 shadow-lg shadow-amber-400/30 pointer-events-none z-20"
              style={{ left: `${eventMarkerPosition}%`, marginLeft: '-6px' }}
              title="Sentry Event"
            />
          )}
        </div>
        
        {/* Time Display */}
        <div className="flex justify-between mt-1.5 text-xs text-gray-400 font-mono">
          <span>{formatDuration(currentTime)}</span>
          {isEventClip && eventTimeOffset !== undefined && (
            <span className="text-amber-400">
              Event @ {formatDuration(eventTimeOffset)}
            </span>
          )}
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between">
        {/* Left: Jump back */}
        <div className="flex items-center gap-1">
          <button
            onClick={onJumpBackward}
            disabled={disabled}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Jump back 10 seconds (J)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
            <span>-10s</span>
          </button>
        </div>

        {/* Center: Play/Pause + Jump to Event */}
        <div className="flex items-center gap-2">
          {/* Jump to Event button */}
          {hasEventMarker && onJumpToEvent && (
            <button
              onClick={onJumpToEvent}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Jump to Sentry Event (E)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 3L4 14h7v7l9-11h-7V3z" />
              </svg>
              <span>Jump to Event</span>
            </button>
          )}
          
          <button
            onClick={onPlayPause}
            disabled={disabled}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-tesla-red hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Right: Jump forward + Speed */}
        <div className="flex items-center gap-1">
          <button
            onClick={onJumpForward}
            disabled={disabled}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Jump forward 10 seconds (L)"
          >
            <span>+10s</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>

          {/* Speed Control */}
          <select
            value={playbackSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            disabled={disabled}
            className="px-2 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
      <div className="mt-3 text-center">
        <p className="text-xs text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500">Space</kbd> Play/Pause
          <span className="mx-2">|</span>
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500">J</kbd> -10s
          <span className="mx-2">|</span>
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500">L</kbd> +10s
          <span className="mx-2">|</span>
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500">←→</kbd> Seek
        </p>
      </div>
    </div>
  );
}
