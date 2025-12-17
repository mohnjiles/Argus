/**
 * File Scanner for Tesla Dashcam directories
 * Uses File System Access API to browse and organize clips
 */

import type { 
  ClipGroup, 
  CameraFile, 
  CameraAngle, 
  ClipSource, 
  EventData,
  VideoEvent
} from '../types';
import { parseTimestamp, CAMERA_ANGLES } from '../types';

// Check if File System Access API is supported
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

// Open a directory picker and return the handle
export async function openDirectoryPicker(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    alert('Your browser does not support the File System Access API. Please use Chrome or Edge.');
    return null;
  }

  try {
    return await window.showDirectoryPicker({
      mode: 'read',
    });
  } catch (e) {
    // User cancelled the picker
    if ((e as Error).name === 'AbortError') {
      return null;
    }
    throw e;
  }
}

// Scan a directory handle for Tesla dashcam clips and group them into events
export async function scanDirectory(
  rootHandle: FileSystemDirectoryHandle,
  onProgress?: (message: string) => void
): Promise<VideoEvent[]> {
  const clipMap = new Map<string, ClipGroup>();

  onProgress?.('Scanning directory structure...');

  // Look for known Tesla folders
  const teslaDirs: { name: ClipSource; handle: FileSystemDirectoryHandle }[] = [];
  
  for await (const entry of rootHandle.values()) {
    if (entry.kind === 'directory') {
      const name = entry.name;
      if (name === 'RecentClips' || name === 'SentryClips' || name === 'SavedClips') {
        teslaDirs.push({ 
          name: name as ClipSource, 
          handle: entry as FileSystemDirectoryHandle 
        });
      }
    }
  }

  // If no Tesla folders found, check if we're already in one
  if (teslaDirs.length === 0) {
    const rootName = rootHandle.name;
    if (rootName === 'RecentClips' || rootName === 'SentryClips' || rootName === 'SavedClips') {
      teslaDirs.push({ 
        name: rootName as ClipSource, 
        handle: rootHandle 
      });
    } else {
      // Scan current directory for mp4 files directly
      await scanLooseFiles(rootHandle, 'RecentClips', clipMap, onProgress);
    }
  }

  // Scan each Tesla folder
  for (const { name, handle } of teslaDirs) {
    onProgress?.(`Scanning ${name}...`);
    
    if (name === 'RecentClips') {
      // RecentClips has loose files
      await scanLooseFiles(handle, name, clipMap, onProgress);
    } else {
      // SentryClips and SavedClips have event folders
      await scanEventFolders(handle, name, clipMap, onProgress);
    }
  }

  // Convert clips to events
  const events = groupClipsIntoEvents(Array.from(clipMap.values()));
  
  // Sort events by start time (most recent first)
  events.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  onProgress?.(`Found ${events.length} events with ${clipMap.size} total clips`);
  return events;
}

// Group clips into events based on eventFolder or time proximity
function groupClipsIntoEvents(clips: ClipGroup[]): VideoEvent[] {
  const eventMap = new Map<string, ClipGroup[]>();
  
  for (const clip of clips) {
    // Key by source + eventFolder (or just source for RecentClips)
    const eventKey = clip.eventFolder 
      ? `${clip.source}-${clip.eventFolder}` 
      : `${clip.source}-recent`;
    
    const existing = eventMap.get(eventKey) || [];
    existing.push(clip);
    eventMap.set(eventKey, existing);
  }

  const events: VideoEvent[] = [];

  for (const [eventKey, eventClips] of eventMap) {
    // Sort clips by timestamp within event
    eventClips.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const firstClip = eventClips[0];
    const lastClip = eventClips[eventClips.length - 1];
    
    // For RecentClips, further split into sessions (gaps > 5 minutes)
    if (firstClip.source === 'RecentClips' && !firstClip.eventFolder) {
      const sessions = splitIntoSessions(eventClips, 5 * 60 * 1000); // 5 minute gap
      for (const session of sessions) {
        events.push(createEventFromClips(session));
      }
    } else {
      events.push(createEventFromClips(eventClips));
    }
  }

  return events;
}

// Split clips into sessions based on time gaps
function splitIntoSessions(clips: ClipGroup[], maxGapMs: number): ClipGroup[][] {
  if (clips.length === 0) return [];
  
  const sessions: ClipGroup[][] = [];
  let currentSession: ClipGroup[] = [clips[0]];

  for (let i = 1; i < clips.length; i++) {
    const prevClip = clips[i - 1];
    const currentClip = clips[i];
    const gap = currentClip.timestamp.getTime() - prevClip.timestamp.getTime();

    if (gap > maxGapMs) {
      // Start new session
      sessions.push(currentSession);
      currentSession = [currentClip];
    } else {
      currentSession.push(currentClip);
    }
  }

  sessions.push(currentSession);
  return sessions;
}

// Create an event from a list of clips
function createEventFromClips(clips: ClipGroup[]): VideoEvent {
  const firstClip = clips[0];
  const lastClip = clips[clips.length - 1];
  
  // Estimate total duration (each clip is ~1 minute)
  const estimatedDuration = clips.length * 60;
  
  // Create event name
  let name: string;
  if (firstClip.eventFolder) {
    // Use event folder as name, format nicely
    name = formatEventFolderName(firstClip.eventFolder);
  } else {
    // Use time range
    const startTime = firstClip.timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const endTime = lastClip.timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    name = clips.length === 1 ? startTime : `${startTime} - ${endTime}`;
  }

  // Calculate event position within clips (for Sentry events)
  let eventClipIndex: number | undefined;
  let eventTimeOffset: number | undefined;
  
  if (firstClip.eventData?.timestamp) {
    const eventTime = parseEventTimestamp(firstClip.eventData.timestamp);
    if (eventTime) {
      // Find which clip contains the event timestamp
      for (let i = 0; i < clips.length; i++) {
        const clipStart = clips[i].timestamp.getTime();
        const clipEnd = clipStart + 60 * 1000; // Assume ~1 minute per clip
        
        if (eventTime.getTime() >= clipStart && eventTime.getTime() < clipEnd) {
          eventClipIndex = i;
          eventTimeOffset = (eventTime.getTime() - clipStart) / 1000; // Convert to seconds
          break;
        }
      }
      
      // If event is before first clip, mark it at the start
      if (eventClipIndex === undefined && eventTime.getTime() < clips[0].timestamp.getTime()) {
        eventClipIndex = 0;
        eventTimeOffset = 0;
      }
      
      // If event is after last clip start, mark it in the last clip
      if (eventClipIndex === undefined) {
        eventClipIndex = clips.length - 1;
        const lastClipStart = clips[clips.length - 1].timestamp.getTime();
        eventTimeOffset = Math.max(0, (eventTime.getTime() - lastClipStart) / 1000);
      }
    }
  }

  return {
    id: `event-${firstClip.id}`,
    name,
    source: firstClip.source,
    eventFolder: firstClip.eventFolder,
    clips,
    startTime: firstClip.timestamp,
    endTime: lastClip.timestamp,
    totalDuration: estimatedDuration,
    eventData: firstClip.eventData,
    thumbnailUrl: firstClip.thumbnailUrl,
    eventClipIndex,
    eventTimeOffset,
  };
}

// Parse event.json timestamp format (e.g., "2025-12-16T12:41:58")
function parseEventTimestamp(timestamp: string): Date | null {
  try {
    // Handle ISO format: "2025-12-16T12:41:58"
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date;
    }
    return null;
  } catch {
    return null;
  }
}

// Format event folder name nicely
function formatEventFolderName(folderName: string): string {
  // Format: 2024-01-15_10-30-00 -> Jan 15, 10:30 AM
  const match = folderName.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return folderName;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(+year, +month - 1, +day, +hour, +minute);
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Scan loose files (RecentClips style)
async function scanLooseFiles(
  dirHandle: FileSystemDirectoryHandle,
  source: ClipSource,
  clipMap: Map<string, ClipGroup>,
  _onProgress?: (message: string) => void
): Promise<void> {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.mp4')) {
      const parsed = parseTimestamp(entry.name);
      if (!parsed) continue;

      const timestampStr = entry.name.substring(0, 19); // YYYY-MM-DD_HH-MM-SS
      const clipId = `${source}-${timestampStr}`;

      let clipGroup = clipMap.get(clipId);
      if (!clipGroup) {
        clipGroup = {
          id: clipId,
          timestamp: parsed.timestamp,
          timestampStr,
          source,
          cameras: new Map<CameraAngle, CameraFile>(),
        };
        clipMap.set(clipId, clipGroup);
      }

      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      
      clipGroup.cameras.set(parsed.camera, {
        camera: parsed.camera,
        file,
        fileHandle,
      });
    }
  }
}

// Scan event folders (SentryClips/SavedClips style)
async function scanEventFolders(
  dirHandle: FileSystemDirectoryHandle,
  source: ClipSource,
  clipMap: Map<string, ClipGroup>,
  _onProgress?: (message: string) => void
): Promise<void> {
  for await (const entry of dirHandle.values()) {
    if (entry.kind !== 'directory') continue;

    const eventFolder = entry.name;
    const eventHandle = entry as FileSystemDirectoryHandle;
    
    // Parse folder name as timestamp (YYYY-MM-DD_HH-MM-SS)
    const match = eventFolder.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})$/);
    if (!match) continue;

    _onProgress?.(`Scanning ${source}/${eventFolder}...`);

    // Read event.json if present
    let eventData: EventData | undefined;
    let thumbnailUrl: string | undefined;

    for await (const fileEntry of eventHandle.values()) {
      if (fileEntry.kind !== 'file') continue;
      
      const fileName = fileEntry.name;
      const fileHandle = fileEntry as FileSystemFileHandle;

      if (fileName === 'event.json') {
        try {
          const file = await fileHandle.getFile();
          const text = await file.text();
          eventData = JSON.parse(text) as EventData;
        } catch (e) {
          console.warn('Failed to parse event.json:', e);
        }
      } else if (fileName === 'thumb.png') {
        try {
          const file = await fileHandle.getFile();
          thumbnailUrl = URL.createObjectURL(file);
        } catch (e) {
          console.warn('Failed to load thumbnail:', e);
        }
      } else if (fileName.toLowerCase().endsWith('.mp4') && fileName !== 'event.mp4') {
        const parsed = parseTimestamp(fileName);
        if (!parsed) continue;

        const timestampStr = fileName.substring(0, 19);
        const clipId = `${source}-${eventFolder}-${timestampStr}`;

        let clipGroup = clipMap.get(clipId);
        if (!clipGroup) {
          clipGroup = {
            id: clipId,
            timestamp: parsed.timestamp,
            timestampStr,
            source,
            eventFolder,
            cameras: new Map<CameraAngle, CameraFile>(),
          };
          clipMap.set(clipId, clipGroup);
        }

        const file = await fileHandle.getFile();
        clipGroup.cameras.set(parsed.camera, {
          camera: parsed.camera,
          file,
          fileHandle,
        });
      }
    }

    // Add event data and thumbnail to all clips in this event folder
    for (const [, clip] of clipMap) {
      if (clip.eventFolder === eventFolder) {
        clip.eventData = eventData;
        clip.thumbnailUrl = thumbnailUrl;
      }
    }
  }
}

// Get available cameras for a clip group
export function getAvailableCameras(clip: ClipGroup): CameraAngle[] {
  return CAMERA_ANGLES.filter(camera => clip.cameras.has(camera));
}

// Group events by date for display
export function groupEventsByDate(events: VideoEvent[]): Map<string, VideoEvent[]> {
  const grouped = new Map<string, VideoEvent[]>();

  for (const event of events) {
    const dateKey = event.startTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const existing = grouped.get(dateKey) || [];
    existing.push(event);
    grouped.set(dateKey, existing);
  }

  return grouped;
}

// Get source icon/color
export function getSourceStyle(source: ClipSource): { color: string; icon: string; label: string } {
  switch (source) {
    case 'RecentClips':
      return { color: '#3b82f6', icon: '🎬', label: 'Recent' };
    case 'SentryClips':
      return { color: '#ef4444', icon: '👁', label: 'Sentry' };
    case 'SavedClips':
      return { color: '#22c55e', icon: '💾', label: 'Saved' };
  }
}

// Format duration for display
export function formatEventDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs}h ${remainingMins}m`;
}
