import type { ClipGroup, CameraAngle } from '../../types';

export type ExportMode = 'separate' | 'combined';
export type ExportQuality = 'original' | '1080p' | '720p' | '480p';
export type ExportCodec = 'h264' | 'h265';

export interface ClipTimeRange {
    startClipIndex: number;
    startTime: number;
    endClipIndex: number;
    endTime: number;
}

export interface CameraValidationResult {
    valid: boolean;
    missingCameras: Map<number, CameraAngle[]>; // clipIndex -> missing cameras
    warnings: string[];
}

export interface ExportOptions {
    clip: ClipGroup;
    clips?: ClipGroup[];     // For cross-clip export
    timeRange?: ClipTimeRange; // For cross-clip export
    cameras: CameraAngle[];
    includeOverlay: boolean;
    includeCharts: boolean;
    hideLocation: boolean;
    exportMode: ExportMode;
    quality: ExportQuality;
    codec: ExportCodec;
    startTime: number;
    endTime: number;
    onProgress: (progress: number) => void;
}

export interface ExportResult {
    blob: Blob;
    filename: string;
    duration: number;
}

export interface MultiExportResult {
    results: ExportResult[];
    totalDuration: number;
}
