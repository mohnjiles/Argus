import type { ExportQuality, ExportCodec } from './types';

export const QUALITY_PRESETS: Record<ExportQuality, { maxHeight: number; bitrate: number; label: string }> = {
    'original': { maxHeight: 9999, bitrate: 10_000_000, label: 'Original' },
    '1080p': { maxHeight: 1080, bitrate: 8_000_000, label: '1080p' },
    '720p': { maxHeight: 720, bitrate: 5_000_000, label: '720p (Recommended)' },
    '480p': { maxHeight: 480, bitrate: 2_500_000, label: '480p (Fast)' },
};

export const CODEC_OPTIONS: Record<ExportCodec, { label: string; description: string }> = {
    'h264': { label: 'H.264', description: 'Most compatible' },
    'h265': { label: 'H.265/HEVC', description: 'Better compression' },
};
