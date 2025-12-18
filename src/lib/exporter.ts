/**
 * Video Exporter
 * Exports video with SEI overlay baked in using WebCodecs
 */

import { runExportPipeline } from './export/ExportPipeline';
import type { ExportOptions, ExportResult, MultiExportResult } from './export/types';

// Re-export types and constants for consumers
export * from './export/types';
export * from './export/constants';
export * from './export/utils'; // exports validateCamerasAcrossClips
export { getChartVisibility, getChartSlotCount } from './export/overlays';

// Main export function
export async function exportVideo(options: ExportOptions): Promise<ExportResult | MultiExportResult> {
  const { cameras, exportMode, onProgress } = options;

  if (cameras.length === 0) {
    throw new Error('No cameras selected for export');
  }

  // Case 1: Separate files (Multi-file export)
  if (cameras.length > 1 && exportMode === 'separate') {
    const results: ExportResult[] = [];
    let totalDuration = 0;

    for (let i = 0; i < cameras.length; i++) {
      const camera = cameras[i];

      // Create options for this specific camera
      // Note: We share the same clip/timeRange info
      const singleCamOptions: ExportOptions = {
        ...options,
        cameras: [camera],
        // We need to scale progress:
        // segment size = 1 / count
        // start = i / count
        onProgress: (p) => {
          const overallProgress = (i + p) / cameras.length;
          onProgress(overallProgress);
        }
      };

      const result = await runExportPipeline(singleCamOptions);
      results.push(result);
      totalDuration = Math.max(totalDuration, result.duration);
    }

    return { results, totalDuration };
  }

  // Case 2: Combined Grid OR Single Camera (Single file export)
  return runExportPipeline(options);
}

// Download helper
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
