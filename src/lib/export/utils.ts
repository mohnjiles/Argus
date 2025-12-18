import type { ClipGroup, CameraAngle } from '../../types';
import type { ExportCodec, CameraValidationResult } from './types';

export function getCodecString(codec: ExportCodec, width: number, height: number): string {
    const area = width * height;

    if (codec === 'h265') {
        // HEVC/H.265 codec string: hvc1.P.T.Lxx.Cx
        // Using Main profile, Main tier
        let level: number;
        if (area <= 921600) level = 93; // Level 3.1 (720p)
        else if (area <= 2073600) level = 120; // Level 4.0 (1080p)
        else if (area <= 8847360) level = 150; // Level 5.0 (4K)
        else level = 180; // Level 6.0
        return `hvc1.1.6.L${level}.B0`;
    }

    // H.264/AVC codec string (default)
    const codedWidth = Math.ceil(width / 16) * 16;
    const codedHeight = Math.ceil(height / 16) * 16;
    const codedArea = codedWidth * codedHeight;

    let avcLevel: string;
    if (codedArea <= 921600) {
        avcLevel = '1f'; // Level 3.1 (720p)
    } else if (codedArea <= 2097152) {
        avcLevel = '28'; // Level 4.0 (1080p)
    } else if (codedArea <= 2228224) {
        avcLevel = '2a'; // Level 4.2
    } else if (codedArea <= 5652480) {
        avcLevel = '32'; // Level 5.0
    } else {
        avcLevel = '33'; // Level 5.1
    }

    return `avc1.6400${avcLevel}`;
}

export function getMuxerCodec(codec: ExportCodec): 'avc' | 'hevc' {
    return codec === 'h265' ? 'hevc' : 'avc';
}

export function validateCamerasAcrossClips(
    clips: ClipGroup[],
    selectedCameras: CameraAngle[],
    startClipIndex: number,
    endClipIndex: number
): CameraValidationResult {
    const missingCameras = new Map<number, CameraAngle[]>();
    const warnings: string[] = [];

    for (let clipIdx = startClipIndex; clipIdx <= endClipIndex; clipIdx++) {
        const clip = clips[clipIdx];
        const missing: CameraAngle[] = [];

        for (const camera of selectedCameras) {
            if (!clip.cameras.has(camera)) {
                missing.push(camera);
            }
        }

        if (missing.length > 0) {
            missingCameras.set(clipIdx, missing);
            const clipLabel = `Clip ${clipIdx + 1}`;
            const cameraList = missing.join(', ');
            warnings.push(`${clipLabel}: Missing ${cameraList}`);
        }
    }

    return {
        valid: missingCameras.size === 0,
        missingCameras,
        warnings,
    };
}
