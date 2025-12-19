/**
 * FileBrowser Component
 * Displays events organized by date and source with expandable clip lists
 */

import { useMemo, useState, useEffect } from 'react';
import type { VideoEvent, ClipGroup, ClipSource } from '../../types';
import { formatEventReason, formatEventCamera } from '../../types';
import { groupEventsByDate, getSourceStyle, formatEventDuration } from '../../lib/file-scanner';
import { RecentFolder, verifyPermission } from '../../lib/recent-folders';

interface FileBrowserProps {
  events: VideoEvent[];
  selectedEvent: VideoEvent | null;
  selectedClipIndex: number;
  onSelectEvent: (event: VideoEvent, clipIndex?: number) => void;
  isLoading: boolean;
  isScanning: boolean;
  rootPath: string;
  onOpenFolder?: (handle?: FileSystemDirectoryHandle) => void;
  recentFolders?: RecentFolder[];
  onRemoveRecent?: (path: string) => void;
}

type SidebarFilter = 'all' | ClipSource | 'AEB' | 'Honk' | 'Panic' | 'Unmatched';

export function FileBrowser({
  events,
  selectedEvent,
  selectedClipIndex,
  onSelectEvent,
  isLoading,
  isScanning,
  rootPath,
  onOpenFolder,
  recentFolders = [],
  onRemoveRecent,
}: FileBrowserProps) {
  const [sourceFilter, setSourceFilter] = useState<SidebarFilter>('all');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Handle opening a recent folder (requires re-verifying permission)
  const handleOpenRecent = async (folder: RecentFolder) => {
    try {
      const granted = await verifyPermission(folder.handle);
      if (granted) {
        onOpenFolder?.(folder.handle);
      }
    } catch (e) {
      console.error('Failed to open recent folder:', e);
    }
  };

  // Auto-expand and scroll selected item
  useEffect(() => {
    if (selectedEvent) {
      // Auto expand selection and collapse others (accordion style)
      setExpandedEvents(new Set([selectedEvent.id]));

      // Scroll into view
      setTimeout(() => {
        const selectedEl = document.querySelector('[data-selected="true"]');
        if (selectedEl) {
          selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }, [selectedEvent?.id, selectedClipIndex]);

  // Count events by source and reason
  const sourceCounts = useMemo(() => {
    const counts = { all: events.length, RecentClips: 0, SentryClips: 0, SavedClips: 0, AEB: 0, Honk: 0, Panic: 0, Unmatched: 0 };
    for (const event of events) {
      if (event.source) {
        counts[event.source]++;
      }

      const reason = event.eventData?.reason;
      if (reason === 'vehicle_auto_emergency_braking') {
        counts.AEB++;
      } else if (reason === 'user_interaction_honk') {
        counts.Honk++;
      } else if (reason?.startsWith('sentry_panic_accel_')) {
        counts.Panic++;
      }

      // Check if the reason is formatted as "unrecognized"
      if (reason && formatEventReason(reason).startsWith('[!]')) {
        counts.Unmatched++;
      }
    }
    return counts;
  }, [events]);

  // Filter events by source or reason
  const filteredEvents = useMemo(() => {
    if (sourceFilter === 'all') return events;
    if (sourceFilter === 'AEB') {
      return events.filter(e => e.eventData?.reason === 'vehicle_auto_emergency_braking');
    }
    if (sourceFilter === 'Honk') {
      return events.filter(e => e.eventData?.reason === 'user_interaction_honk');
    }
    if (sourceFilter === 'Panic') {
      return events.filter(e => e.eventData?.reason?.startsWith('sentry_panic_accel_'));
    }
    if (sourceFilter === 'Unmatched') {
      return events.filter(e => e.eventData?.reason && formatEventReason(e.eventData.reason).startsWith('[!]'));
    }
    return events.filter(event => event.source === sourceFilter);
  }, [events, sourceFilter]);

  const groupedEvents = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);

  const toggleExpanded = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-tesla-red border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-400">Scanning clips...</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center">
          <button
            onClick={() => onOpenFolder?.()}
            className="text-center group p-8 rounded-2xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/10 max-w-sm w-full"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-tesla-red/10 transition-all duration-300">
              <svg className="w-10 h-10 text-gray-500 group-hover:text-tesla-red transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No clips loaded</h3>
            <p className="text-sm text-gray-500 mb-6">Open your TeslaCam folder to get started</p>
            <div className="inline-flex items-center gap-2 px-6 py-2.5 bg-tesla-red text-white text-sm font-bold rounded-full shadow-lg shadow-tesla-red/20 group-hover:scale-105 active:scale-95 transition-all">
              Choose Folder
            </div>
          </button>
        </div>

        {recentFolders.length > 0 && (
          <div className="mt-12 w-full max-w-sm mx-auto">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-4 px-2">Recent Folders</h4>
            <div className="space-y-2">
              {recentFolders.map((folder) => (
                <div
                  key={folder.path}
                  className="group/item flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all"
                >
                  <button
                    onClick={() => handleOpenRecent(folder)}
                    className="flex-1 flex items-center gap-3 text-left overflow-hidden mr-2"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-gray-400 group-hover/item:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-medium text-gray-300 group-hover/item:text-white transition-colors truncate">
                        {folder.path}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(folder.lastOpened).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => onRemoveRecent?.(folder.path)}
                    className="p-2 opacity-0 group-hover/item:opacity-100 text-gray-500 hover:text-red-400 transition-all rounded-lg hover:bg-red-400/10"
                    title="Remove from recents"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-sm font-medium truncate">{rootPath}</span>
          </div>

          {isScanning && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-tesla-red animate-pulse" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scanning</span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Source Filter */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-gray-800/50 flex flex-wrap gap-1">
        <FilterButton
          active={sourceFilter === 'all'}
          onClick={() => setSourceFilter('all')}
          count={sourceCounts.all}
          label="All"
          color="#6b7280"
        />
        <FilterButton
          active={sourceFilter === 'RecentClips'}
          onClick={() => setSourceFilter('RecentClips')}
          count={sourceCounts.RecentClips}
          label="Recent"
          color="#3b82f6"
        />
        <FilterButton
          active={sourceFilter === 'SentryClips'}
          onClick={() => setSourceFilter('SentryClips')}
          count={sourceCounts.SentryClips}
          label="Sentry"
          color="#ef4444"
        />
        <FilterButton
          active={sourceFilter === 'SavedClips'}
          onClick={() => setSourceFilter('SavedClips')}
          count={sourceCounts.SavedClips}
          label="Dashcam"
          color="#22c55e"
        />
        <FilterButton
          active={sourceFilter === 'AEB'}
          onClick={() => setSourceFilter('AEB')}
          count={sourceCounts.AEB}
          label="Braking"
          color="#f59e0b"
        />
        <FilterButton
          active={sourceFilter === 'Honk'}
          onClick={() => setSourceFilter('Honk')}
          count={sourceCounts.Honk}
          label="Honks"
          color="#6366f1"
        />
        <FilterButton
          active={sourceFilter === 'Panic'}
          onClick={() => setSourceFilter('Panic')}
          count={sourceCounts.Panic}
          label="Panic"
          color="#ec4899"
        />
        <FilterButton
          active={sourceFilter === 'Unmatched'}
          onClick={() => setSourceFilter('Unmatched')}
          count={sourceCounts.Unmatched}
          label="Unrecognized"
          color="#94a3b8"
        />
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto border-b border-gray-800/50">
        {Array.from(groupedEvents.entries()).map(([date, dateEvents]) => (
          <div key={date} className="border-b border-gray-800/50">
            {/* Date Header */}
            <div className="sticky top-0 bg-[#0f0f0f] px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide z-10">
              {date}
            </div>

            {/* Events for this date */}
            <div className="space-y-1 px-2 pb-2">
              {dateEvents.map((event) => (
                <EventItem
                  key={event.id}
                  event={event}
                  isSelected={selectedEvent?.id === event.id}
                  selectedClipIndex={selectedEvent?.id === event.id ? selectedClipIndex : -1}
                  isExpanded={expandedEvents.has(event.id)}
                  onToggleExpand={() => toggleExpanded(event.id)}
                  onSelectEvent={onSelectEvent}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Support Footer */}
      <div className="flex-shrink-0 px-4 py-4 bg-black/20 backdrop-blur-sm border-t border-gray-800/50">
        <a
          href="https://ko-fi.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex gap-3 w-full px-4 py-3 bg-gradient-to-r from-tesla-red/10 to-tesla-red/5 border border-tesla-red/30 rounded-xl hover:translate-y-[-2px] hover:shadow-[0_4px_12px_rgba(232,33,39,0.2)] transition-all duration-300"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-tesla-red text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-bold text-white tracking-wide uppercase">Support Argus</span>
            <span className="text-[10px] text-gray-400 font-medium group-hover:text-gray-300 transition-colors">Buy me a coffee</span>
          </div>
          <div className="absolute top-0 left-0 w-full h-full bg-white/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity" />
        </a>
      </div>
    </div>
  );
}

interface EventItemProps {
  event: VideoEvent;
  isSelected: boolean;
  selectedClipIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectEvent: (event: VideoEvent, clipIndex?: number) => void;
}

function EventItem({
  event,
  isSelected,
  selectedClipIndex,
  isExpanded,
  onToggleExpand,
  onSelectEvent
}: EventItemProps) {
  const sourceStyle = getSourceStyle(event.source);
  const hasMultipleClips = event.clips.length > 1;
  const hasCorruption = event.clips.some(clip =>
    Array.from(clip.cameras.values()).some(cam => cam.isCorrupt)
  );

  return (
    <div className={`
      rounded-lg overflow-hidden transition-colors
      ${isSelected
        ? 'bg-tesla-red/10 ring-1 ring-tesla-red/30'
        : 'hover:bg-gray-800/30'
      }
    `}>
      {/* Event Header */}
      <button
        onClick={() => onSelectEvent(event, 0)}
        className="w-full text-left p-3"
      >
        <div className="flex items-start gap-3">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-16 h-12 rounded bg-gray-800 overflow-hidden">
            {event.thumbnailUrl ? (
              <img
                src={event.thumbnailUrl}
                alt="Thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Event name */}
            <div className="text-sm font-medium text-white mb-0.5 truncate">
              {event.name}
            </div>

            {/* Source badge + duration */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${sourceStyle.color}20`,
                  color: sourceStyle.color
                }}
              >
                {sourceStyle.label}
              </span>
              <span className="text-xs text-gray-500">
                {formatEventDuration(event.totalDuration)}
              </span>
              {hasMultipleClips && (
                <span className="text-xs text-gray-500">
                  • {event.clips.length} clips
                </span>
              )}
              {hasCorruption && (
                <span className="text-amber-500 text-xs" title="Contains corrupt or missing files">
                  ⚠️
                </span>
              )}
            </div>

            {/* Event reason and camera if present */}
            {event.eventData?.reason && (
              <div className="text-xs space-y-0.5">
                <div className="text-gray-400 truncate">
                  {formatEventReason(event.eventData.reason)}
                </div>
                {event.eventData.camera && (
                  <div className="text-gray-500">
                    🎥 {formatEventCamera(event.eventData.camera)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expand button for multi-clip events */}
          {hasMultipleClips && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="flex-shrink-0 p-1 rounded hover:bg-gray-700/50 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </button>

      {/* Expanded clip list */}
      {isExpanded && hasMultipleClips && (
        <div className="px-3 pb-2 space-y-0.5">
          <div className="border-l-2 border-gray-700 ml-8 pl-3">
            {event.clips.map((clip, index) => (
              <ClipItem
                key={clip.id}
                clip={clip}
                index={index}
                isSelected={isSelected && selectedClipIndex === index}
                onClick={() => onSelectEvent(event, index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ClipItemProps {
  clip: ClipGroup;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

function ClipItem({ clip, index, isSelected, onClick }: ClipItemProps) {
  const cameraCount = clip.cameras.size;
  const hasCorruption = Array.from(clip.cameras.values()).some(c => c.isCorrupt);

  return (
    <button
      onClick={onClick}
      data-selected={isSelected}
      className={`
        w-full text-left p-2 rounded transition-colors flex items-center gap-2
        ${isSelected
          ? 'bg-tesla-red/20 text-white'
          : 'hover:bg-gray-800/50 text-gray-400'
        }
      `}
    >
      <span className="text-xs font-mono w-6">{index + 1}.</span>
      <span className="text-xs flex-1">
        {clip.timestamp.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}
      </span>
      <span className="text-xs text-gray-500">
        {cameraCount} cam{cameraCount !== 1 ? 's' : ''}
      </span>
      {hasCorruption && (
        <span className="text-amber-500 text-xs" title="Corrupt file detected">
          ⚠️
        </span>
      )}
    </button>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  count: number;
  label: string;
  color: string;
}

function FilterButton({ active, onClick, count, label, color }: FilterButtonProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`
        px-2 py-1 rounded text-xs font-medium transition-all
        ${active
          ? 'text-white'
          : 'text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50'
        }
      `}
      style={active ? { backgroundColor: color } : undefined}
    >
      {label} ({count})
    </button>
  );
}
