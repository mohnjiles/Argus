// Camera types available on Tesla vehicles
export type CameraAngle =
  | 'front'
  | 'back'
  | 'left_repeater'
  | 'right_repeater'
  | 'left_pillar'
  | 'right_pillar';

export const CAMERA_ANGLES: CameraAngle[] = [
  'front',
  'back',
  'left_repeater',
  'right_repeater',
  'left_pillar',
  'right_pillar'
];

export const CAMERA_LABELS: Record<CameraAngle, string> = {
  front: 'Front',
  back: 'Rear',
  left_repeater: 'Left Repeater',
  right_repeater: 'Right Repeater',
  left_pillar: 'Left Pillar',
  right_pillar: 'Right Pillar',
};

// Clip source types
export type ClipSource = 'RecentClips' | 'SentryClips' | 'SavedClips';

// Gear state enum matching protobuf
export enum GearState {
  GEAR_PARK = 0,
  GEAR_DRIVE = 1,
  GEAR_REVERSE = 2,
  GEAR_NEUTRAL = 3,
}

export const GEAR_LABELS: Record<GearState, string> = {
  [GearState.GEAR_PARK]: 'P',
  [GearState.GEAR_DRIVE]: 'D',
  [GearState.GEAR_REVERSE]: 'R',
  [GearState.GEAR_NEUTRAL]: 'N',
};

// Autopilot state enum matching protobuf
export enum AutopilotState {
  NONE = 0,
  SELF_DRIVING = 1,
  AUTOSTEER = 2,
  TACC = 3,
}

export const AUTOPILOT_LABELS: Record<AutopilotState, string> = {
  [AutopilotState.NONE]: 'Off',
  [AutopilotState.SELF_DRIVING]: 'Self Driving',
  [AutopilotState.AUTOSTEER]: 'Autosteer',
  [AutopilotState.TACC]: 'TACC',
};

// SEI Metadata extracted from video frames
export interface SeiMetadata {
  version: number;
  gearState: GearState;
  frameSeqNo: bigint;
  vehicleSpeedMps: number;
  acceleratorPedalPosition: number;
  steeringWheelAngle: number;
  blinkerOnLeft: boolean;
  blinkerOnRight: boolean;
  brakeApplied: boolean;
  autopilotState: AutopilotState;
  latitudeDeg: number;
  longitudeDeg: number;
  headingDeg: number;
  linearAccelerationMps2X: number;
  linearAccelerationMps2Y: number;
  linearAccelerationMps2Z: number;
}

// Video configuration extracted from MP4
export interface VideoConfig {
  width: number;
  height: number;
  codec: string;
  sps: Uint8Array;
  pps: Uint8Array;
  timescale: number;
  durations: number[];
}

// Parsed video frame
export interface VideoFrame {
  index: number;
  timestamp: number; // in seconds
  keyframe: boolean;
  data: Uint8Array;
  sei: SeiMetadata | null;
  sps: Uint8Array;
  pps: Uint8Array;
}

// Single camera file info
export interface CameraFile {
  camera: CameraAngle;
  file: File;
  fileHandle?: FileSystemFileHandle;
  isCorrupt?: boolean;
}

// A group of clips at the same timestamp (all camera angles) - represents ~1 minute
export interface ClipGroup {
  id: string;
  timestamp: Date;
  timestampStr: string; // Original format: YYYY-MM-DD_HH-MM-SS
  source: ClipSource;
  eventFolder?: string; // For Sentry/Saved clips
  cameras: Map<CameraAngle, CameraFile>;
  eventData?: EventData;
  thumbnailUrl?: string;
  duration?: number; // Duration in seconds (set after loading)
}

// An event groups multiple sequential ClipGroups from the same event folder
export interface VideoEvent {
  id: string;
  name: string; // Display name (folder name or time range)
  source: ClipSource;
  eventFolder?: string;
  clips: ClipGroup[]; // Sorted by timestamp
  startTime: Date;
  endTime: Date;
  totalDuration: number; // Estimated total duration in seconds
  eventData?: EventData;
  thumbnailUrl?: string;
  // For Sentry events: which clip and time offset the event occurred at
  eventClipIndex?: number; // Index of clip where event occurred
  eventTimeOffset?: number; // Seconds into that clip where event occurred
}

// Event data from event.json
export interface EventData {
  timestamp: string;
  city?: string;
  reason?: string;
  camera?: string;
  latitude?: number;
  longitude?: number;
}

// Format event reason into human-readable label
export function formatEventReason(reason?: string): string {
  if (!reason) return '';

  // Check exact matches first, then prefixes (most specific to least specific)
  // Using startsWith for prefix matching

  // Exact matches
  if (reason === 'sentry_aware_object_detection') return 'Sentry Mode (Object)';
  if (reason === 'sentry_locked_handle_pulled') return 'Sentry Mode (Handle Pulled)';
  if (reason === 'user_interaction_dashcam_icon_tapped') return 'Saved (via Dashcam icon)';
  if (reason === 'user_interaction_dashcam_panel_save') return 'Saved (via Dashcam panel)';
  if (reason === 'user_interaction_dashcam_launcher_action_tapped') return 'Saved (via Launcher)';
  if (reason === 'user_interaction_honk') return 'Horn Honked';
  if (reason === 'vehicle_auto_emergency_braking') return 'Auto Emergency Braking';

  // Prefix matches (check more specific prefixes first)
  if (reason.startsWith('sentry_aware_accel_')) return 'Sentry Mode (Accelerometer)';
  if (reason.startsWith('sentry_panic_accel_')) return 'Sentry Mode (Panic Accel)';
  if (reason.startsWith('user_interaction_')) return 'General User Interaction';
  if (reason.startsWith('sentry_')) return 'General Sentry';

  // Fallback: convert snake_case to Title Case and mark as unrecognized
  const prettified = reason
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `[!] ${prettified}`;
}

// Format camera index from event.json into human-readable label
export function formatEventCamera(camera?: string | number): string {
  if (camera === undefined || camera === null) return '';

  const cameraNum = typeof camera === 'string' ? parseInt(camera, 10) : camera;

  const cameraMap: Record<number, string> = {
    0: 'Front',
    1: 'Fisheye',
    2: 'Narrow',
    3: 'Left Pillar',
    4: 'Right Pillar',
    5: 'Left Repeater',
    6: 'Right Repeater',
    7: 'Rear',
    8: 'Cabin',
  };

  return cameraMap[cameraNum] || `Camera ${cameraNum}`;
}

// Playback state
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  currentClip: ClipGroup | null;
  visibleCameras: Set<CameraAngle>;
  currentSeiData: SeiMetadata | null;
}

// File browser state
export interface FileSystemState {
  rootHandle: FileSystemDirectoryHandle | null;
  rootPath: string;
  events: VideoEvent[];
  isLoading: boolean;
  isScanning: boolean;
  error: string | null;
}

// Layout configuration for camera grid
export interface CameraLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  camera: CameraAngle;
}

// Export options
export interface ExportOptions {
  cameras: CameraAngle[];
  includeOverlay: boolean;
  startTime: number;
  endTime: number;
  quality: 'low' | 'medium' | 'high';
}

// Units preference
export type SpeedUnit = 'mph' | 'kph';

// Utility function to convert m/s to mph or kph
export function convertSpeed(mps: number, unit: SpeedUnit): number {
  if (unit === 'mph') {
    return mps * 2.23694;
  }
  return mps * 3.6;
}

// Parse timestamp from Tesla filename format
export function parseTimestamp(filename: string): { timestamp: Date; camera: CameraAngle } | null {
  // Format: 2025-12-16_13-19-15-front.mp4
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})-(.+)\.mp4$/i);
  if (!match) return null;

  const [, datePart, timePart, camera] = match;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split('-').map(Number);

  const timestamp = new Date(year, month - 1, day, hour, minute, second);

  if (!CAMERA_ANGLES.includes(camera as CameraAngle)) {
    return null;
  }

  return { timestamp, camera: camera as CameraAngle };
}

// Format timestamp for display
export function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Format duration in MM:SS or HH:MM:SS
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

