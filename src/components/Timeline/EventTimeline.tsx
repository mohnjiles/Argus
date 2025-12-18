/**
 * EventTimeline Component
 * Timeline UI for selecting time ranges across multiple clips in a VideoEvent
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { VideoEvent } from '../../types';
import { formatDuration } from '../../types';

interface EventTimelineProps {
  event: VideoEvent | null;
  currentClipIndex: number;
  currentTime: number;
  totalTime: number;
  totalDuration: number;
  clipDurations: number[];
  rangeStart: number | null;
  rangeEnd: number | null;
  onSeek: (absoluteTime: number) => void;
  onRangeChange: (start: number, end: number) => void;
  disabled: boolean;
  showPlayhead?: boolean;
  background?: React.ReactNode;
}

export function EventTimeline({
  event,
  currentClipIndex: _currentClipIndex,
  currentTime: _currentTime,
  totalTime,
  totalDuration,
  clipDurations,
  rangeStart,
  rangeEnd,
  onSeek,
  onRangeChange,
  disabled,
  showPlayhead = true,
  background,
}: EventTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);
  const [editingStart, setEditingStart] = useState(false);
  const [editingEnd, setEditingEnd] = useState(false);
  const [tempValue, setTempValue] = useState('');

  // Calculate clip boundaries for rendering
  const clipBoundaries = clipDurations.slice(0, -1).map((_, idx) => {
    const cumulativeTime = clipDurations.slice(0, idx + 1).reduce((a, b) => a + b, 0);
    return {
      time: cumulativeTime,
      percent: totalDuration > 0 ? (cumulativeTime / totalDuration) * 100 : 0,
      clipIndex: idx,
    };
  });

  // Convert time to percentage
  const timeToPercent = useCallback(
    (time: number) => {
      return totalDuration > 0 ? (time / totalDuration) * 100 : 0;
    },
    [totalDuration]
  );

  // Convert percentage to time
  const percentToTime = useCallback(
    (percent: number) => {
      return (percent / 100) * totalDuration;
    },
    [totalDuration]
  );

  // Handle mouse down on timeline (scrubbing)
  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !timelineRef.current) return;

      // Don't interfere with handle dragging
      const target = e.target as HTMLElement;
      if (target.classList.contains('range-handle')) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const time = percentToTime(percent);

      onSeek(time);
      setIsDraggingScrubber(true);
    },
    [disabled, percentToTime, onSeek]
  );

  // Handle mouse move for scrubbing
  useEffect(() => {
    if (!isDraggingScrubber || !timelineRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const time = percentToTime(percent);
      onSeek(time);
    };

    const handleMouseUp = () => {
      setIsDraggingScrubber(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingScrubber, percentToTime, onSeek]);

  // Handle range start drag
  const handleStartDrag = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.stopPropagation();
      e.preventDefault(); // Prevent text selection
      setIsDraggingStart(true);
    },
    [disabled]
  );

  // Handle range end drag
  const handleEndDrag = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.stopPropagation();
      e.preventDefault(); // Prevent text selection
      setIsDraggingEnd(true);
    },
    [disabled]
  );

  // Mouse move handler for range handles
  useEffect(() => {
    if (!isDraggingStart && !isDraggingEnd) return;
    if (!timelineRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      let time = percentToTime(percent);

      // Snapping logic
      const snapPoints = [0, totalDuration, ...clipBoundaries.map(b => b.time)];
      const snapThreshold = totalDuration * 0.008; // 0.8% of total duration

      for (const snapPoint of snapPoints) {
        if (Math.abs(time - snapPoint) < snapThreshold) {
          time = snapPoint;
          break;
        }
      }

      if (isDraggingStart) {
        const newStart = Math.max(0, Math.min(time, rangeEnd ?? totalDuration));
        onRangeChange(newStart, rangeEnd ?? totalDuration);
      } else if (isDraggingEnd) {
        const newEnd = Math.max(rangeStart ?? 0, Math.min(time, totalDuration));
        onRangeChange(rangeStart ?? 0, newEnd);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingStart, isDraggingEnd, rangeStart, rangeEnd, totalDuration, percentToTime, onRangeChange]);

  const currentPercent = timeToPercent(totalTime);
  const rangeStartPercent = rangeStart !== null ? timeToPercent(rangeStart) : null;
  const rangeEndPercent = rangeEnd !== null ? timeToPercent(rangeEnd) : null;

  if (!event) {
    return null;
  }

  return (
    <div className="w-full space-y-2 select-none">
      {/* Timeline bar */}
      <div className="relative">
        <div
          ref={timelineRef}
          className={`relative h-20 bg-gray-800 rounded-lg border border-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          onMouseDown={handleTimelineMouseDown}
        >
          {/* Background / Thumbnails wrapper with rounded corners and overflow hidden */}
          <div className="absolute inset-0 z-0 overflow-hidden rounded-lg">
            {background ? (
              background
            ) : (
              <div className="absolute inset-0 bg-gray-700" />
            )}
          </div>

          {/* Clip boundaries */}
          {clipBoundaries.map((boundary) => (
            <div
              key={boundary.clipIndex}
              className="absolute top-0 bottom-0 w-px bg-gray-600 z-10"
              style={{ left: `${boundary.percent}%` }}
              title={`Clip ${boundary.clipIndex + 1} → ${boundary.clipIndex + 2}`}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 whitespace-nowrap">
                {boundary.clipIndex + 1}
              </span>
            </div>
          ))}

          {/* Selected range highlight */}
          {rangeStartPercent !== null && rangeEndPercent !== null && (
            <div
              className="absolute top-0 bottom-0 bg-[#e82127]/30 pointer-events-none z-20"
              style={{
                left: `${rangeStartPercent}%`,
                width: `${rangeEndPercent - rangeStartPercent}%`,
              }}
            />
          )}

          {/* Progress bar */}
          {showPlayhead && (
            <div
              className="absolute top-0 bottom-0 bg-[#e82127]/50 pointer-events-none z-30"
              style={{ width: `${currentPercent}%` }}
            />
          )}

          {/* Playhead indicator */}
          {showPlayhead && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-40"
              style={{ left: `${currentPercent}%` }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-1">
                <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
              </div>
            </div>
          )}

          {/* Range start handle */}
          {rangeStartPercent !== null && (
            <div
              className="range-handle absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-[#e82127] rounded cursor-ew-resize z-50 hover:scale-110 transition-transform"
              style={{ left: `${rangeStartPercent}%`, marginLeft: '-8px' }}
              onMouseDown={handleStartDrag}
              title={`Start: ${formatDuration(rangeStart ?? 0)}`}
            >
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/50" />
            </div>
          )}

          {/* Range end handle */}
          {rangeEndPercent !== null && (
            <div
              className="range-handle absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-[#e82127] rounded cursor-ew-resize z-50 hover:scale-110 transition-transform"
              style={{ left: `${rangeEndPercent}%`, marginLeft: '-8px' }}
              onMouseDown={handleEndDrag}
              title={`End: ${formatDuration(rangeEnd ?? 0)}`}
            >
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/50" />
            </div>
          )}
        </div>
      </div>

      {/* Time and Selection Labels */}
      <div className="pt-2 space-y-2 font-mono">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-black/20 px-3 py-2 rounded-lg border border-gray-800/50">
          <div className="w-16">
            <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-400">{formatDuration(totalTime)}</span>
          </div>

          {rangeStart !== null && rangeEnd !== null && (
            <div className="flex items-center gap-1.5 text-[#e82127]">
              <span className="opacity-50 font-sans tracking-tight">SELECTED:</span>

              {/* Start Time Editor */}
              {editingStart ? (
                <input
                  autoFocus
                  type="text"
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onBlur={() => {
                    const parts = tempValue.split(':');
                    let seconds = 0;
                    if (parts.length === 2) {
                      seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
                    } else {
                      seconds = parseFloat(tempValue);
                    }

                    if (!isNaN(seconds)) {
                      onRangeChange(Math.max(0, Math.min(seconds, rangeEnd)), rangeEnd);
                    }
                    setEditingStart(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingStart(false);
                  }}
                  className="w-16 bg-gray-900 border border-[#e82127] rounded px-1.5 py-0.5 text-white text-[11px] outline-none focus:ring-1 focus:ring-[#e82127]"
                />
              ) : (
                <button
                  onClick={() => {
                    setTempValue(formatDuration(rangeStart));
                    setEditingStart(true);
                  }}
                  className="hover:bg-gray-800 px-1 rounded transition-colors"
                >
                  {formatDuration(rangeStart)}
                </button>
              )}

              <span className="opacity-40">—</span>

              {/* End Time Editor */}
              {editingEnd ? (
                <input
                  autoFocus
                  type="text"
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onBlur={() => {
                    const parts = tempValue.split(':');
                    let seconds = 0;
                    if (parts.length === 2) {
                      seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
                    } else {
                      seconds = parseFloat(tempValue);
                    }

                    if (!isNaN(seconds)) {
                      onRangeChange(rangeStart, Math.max(rangeStart, Math.min(seconds, totalDuration)));
                    }
                    setEditingEnd(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingEnd(false);
                  }}
                  className="w-16 bg-gray-900 border border-[#e82127] rounded px-1.5 py-0.5 text-white text-[11px] outline-none focus:ring-1 focus:ring-[#e82127]"
                />
              ) : (
                <button
                  onClick={() => {
                    setTempValue(formatDuration(rangeEnd));
                    setEditingEnd(true);
                  }}
                  className="hover:bg-gray-800 px-1 rounded transition-colors"
                >
                  {formatDuration(rangeEnd)}
                </button>
              )}

              <span className="bg-[#e82127]/20 px-1.5 py-0.5 rounded text-[11px]">
                {formatDuration(rangeEnd - rangeStart)}
              </span>
            </div>
          )}

          <div className="w-16 text-right">
            <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-400">{formatDuration(totalDuration)}</span>
          </div>
        </div>

        {event.clips.length > 1 && (
          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 bg-black/20 py-2.5 px-4 rounded-lg border border-gray-800/30">
            <svg className="w-3.5 h-3.5 text-[#e82127] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="font-bold text-gray-300 uppercase tracking-tight">Pro Tip:</span>
            <span>Drag red handles to select across clips. <span className="text-gray-300">Click start/stop times</span> to type exact values.</span>
          </div>
        )}
      </div>
    </div>
  );
}
