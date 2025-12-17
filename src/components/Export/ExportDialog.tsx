/**
 * ExportDialog Component
 * Dialog for configuring and executing video export
 */

import { useState, useCallback } from 'react';
import type { ClipGroup, CameraAngle } from '../../types';
import { CAMERA_LABELS, formatDuration } from '../../types';
import { exportVideo, downloadBlob, QUALITY_PRESETS, CODEC_OPTIONS, type ExportMode, type ExportQuality, type ExportCodec, type ExportResult, type MultiExportResult } from '../../lib/exporter';

interface ExportDialogProps {
  clip: ClipGroup;
  duration: number;
  currentTime: number;
  onClose: () => void;
}

export function ExportDialog({ clip, duration, currentTime, onClose }: ExportDialogProps) {
  const availableCameras = Array.from(clip.cameras.keys());
  
  // Multi-camera selection (default to front camera if available)
  const [selectedCameras, setSelectedCameras] = useState<CameraAngle[]>(
    availableCameras.includes('front') ? ['front'] : [availableCameras[0]]
  );
  const [includeOverlay, setIncludeOverlay] = useState(true);
  const [hideLocation, setHideLocation] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('combined');
  const [quality, setQuality] = useState<ExportQuality>('720p'); // Default to 720p for performance
  const [videoCodec, setVideoCodec] = useState<ExportCodec>('h264'); // Default to H.264 for compatibility
  const [exportRange, setExportRange] = useState<'all' | 'selection'>('all');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const toggleCamera = (camera: CameraAngle) => {
    setSelectedCameras(prev => {
      if (prev.includes(camera)) {
        // Don't allow deselecting all cameras
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== camera);
      } else {
        return [...prev, camera];
      }
    });
  };
  
  const selectAllCameras = () => {
    setSelectedCameras([...availableCameras]);
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    setProgress(0);

    try {
      const result = await exportVideo({
        clip,
        cameras: selectedCameras,
        includeOverlay,
        hideLocation,
        exportMode,
        quality,
        codec: videoCodec,
        startTime: exportRange === 'all' ? 0 : startTime,
        endTime: exportRange === 'all' ? duration : endTime,
        onProgress: setProgress,
      });

      // Handle single or multiple export results
      if ('results' in result) {
        // Multiple files (separate mode)
        const multiResult = result as MultiExportResult;
        for (const r of multiResult.results) {
          downloadBlob(r.blob, r.filename);
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        // Single file
        downloadBlob((result as ExportResult).blob, (result as ExportResult).filename);
      }
      
      onClose();
    } catch (e) {
      console.error('Export failed:', e);
      setError((e as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, [clip, selectedCameras, includeOverlay, hideLocation, exportMode, quality, videoCodec, exportRange, startTime, endTime, duration, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] rounded-xl shadow-2xl w-full max-w-md mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Export Video</h2>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Camera Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">Cameras</label>
              <button
                onClick={selectAllCameras}
                disabled={isExporting || selectedCameras.length === availableCameras.length}
                className="text-xs text-tesla-red hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {availableCameras.map((camera) => (
                <button
                  key={camera}
                  onClick={() => toggleCamera(camera)}
                  disabled={isExporting}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                    ${selectedCameras.includes(camera)
                      ? 'bg-tesla-red text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                    disabled:opacity-50
                  `}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    selectedCameras.includes(camera) ? 'bg-white border-white' : 'border-gray-500'
                  }`}>
                    {selectedCameras.includes(camera) && (
                      <svg className="w-3 h-3 text-tesla-red" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  {CAMERA_LABELS[camera]}
                </button>
              ))}
            </div>
          </div>

          {/* Export Mode (only show if multiple cameras selected) */}
          {selectedCameras.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Export Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportMode('separate')}
                  disabled={isExporting}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${exportMode === 'separate'
                      ? 'bg-tesla-red text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                    disabled:opacity-50
                  `}
                >
                  <div className="text-center">
                    <div>Separate Files</div>
                    <div className="text-xs opacity-70">{selectedCameras.length} videos</div>
                  </div>
                </button>
                <button
                  onClick={() => setExportMode('combined')}
                  disabled={isExporting}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${exportMode === 'combined'
                      ? 'bg-tesla-red text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                    disabled:opacity-50
                  `}
                >
                  <div className="text-center">
                    <div>Combined Grid</div>
                    <div className="text-xs opacity-70">1 video</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Quality Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Quality</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(QUALITY_PRESETS) as [ExportQuality, typeof QUALITY_PRESETS[ExportQuality]][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setQuality(key)}
                  disabled={isExporting}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${quality === key
                      ? 'bg-tesla-red text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                    disabled:opacity-50
                  `}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {selectedCameras.length > 1 && exportMode === 'combined' && quality === 'original' && (
              <p className="mt-2 text-xs text-amber-400">
                ⚠️ Original quality with multiple cameras may be slow. Try 720p for better performance.
              </p>
            )}
          </div>

          {/* Codec Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Codec</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(CODEC_OPTIONS) as [ExportCodec, typeof CODEC_OPTIONS[ExportCodec]][]).map(([key, opt]) => (
                <button
                  key={key}
                  onClick={() => setVideoCodec(key)}
                  disabled={isExporting}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${videoCodec === key
                      ? 'bg-tesla-red text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                    disabled:opacity-50
                  `}
                >
                  <div>{opt.label}</div>
                  <div className="text-xs opacity-70">{opt.description}</div>
                </button>
              ))}
            </div>
            {videoCodec === 'h264' && (
              <p className="mt-2 text-xs text-gray-400">
                ✓ H.264 works everywhere - phones, browsers, video editors
              </p>
            )}
            {videoCodec === 'h265' && (
              <p className="mt-2 text-xs text-blue-400">
                ⚡ H.265 has ~50% smaller files at same quality. Plays on VLC, iPhones, modern devices.
              </p>
            )}
          </div>

          {/* Export Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Range</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportRange('all')}
                disabled={isExporting}
                className={`
                  flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${exportRange === 'all'
                    ? 'bg-tesla-red text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }
                  disabled:opacity-50
                `}
              >
                Full Clip ({formatDuration(duration)})
              </button>
              <button
                onClick={() => {
                  setExportRange('selection');
                  setStartTime(Math.max(0, currentTime - 5));
                  setEndTime(Math.min(duration, currentTime + 5));
                }}
                disabled={isExporting}
                className={`
                  flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${exportRange === 'selection'
                    ? 'bg-tesla-red text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }
                  disabled:opacity-50
                `}
              >
                Selection
              </button>
            </div>

            {exportRange === 'selection' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start</label>
                  <input
                    type="number"
                    value={startTime.toFixed(1)}
                    onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
                    min={0}
                    max={endTime - 0.1}
                    step={0.1}
                    disabled={isExporting}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">End</label>
                  <input
                    type="number"
                    value={endTime.toFixed(1)}
                    onChange={(e) => setEndTime(parseFloat(e.target.value) || duration)}
                    min={startTime + 0.1}
                    max={duration}
                    step={0.1}
                    disabled={isExporting}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm disabled:opacity-50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Overlay Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Include telemetry overlay</span>
              <button
                onClick={() => setIncludeOverlay(!includeOverlay)}
                disabled={isExporting}
                className={`
                  w-12 h-6 rounded-full transition-colors relative
                  ${includeOverlay ? 'bg-tesla-red' : 'bg-gray-700'}
                  disabled:opacity-50
                `}
              >
                <div
                  className={`
                    w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform
                    ${includeOverlay ? 'translate-x-6' : 'translate-x-0.5'}
                  `}
                />
              </button>
            </div>
            
            {/* Hide Location for privacy */}
            {includeOverlay && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-gray-700">
                <div>
                  <span className="text-sm font-medium text-gray-300">Hide GPS coordinates</span>
                  <p className="text-xs text-gray-500">For privacy when sharing on social media</p>
                </div>
                <button
                  onClick={() => setHideLocation(!hideLocation)}
                  disabled={isExporting}
                  className={`
                    w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                    ${hideLocation ? 'bg-tesla-red' : 'bg-gray-700'}
                    disabled:opacity-50
                  `}
                >
                  <div
                    className={`
                      w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform
                      ${hideLocation ? 'translate-x-6' : 'translate-x-0.5'}
                    `}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Progress */}
          {isExporting && (
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Exporting...</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-tesla-red transition-all duration-200"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedCameras.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-tesla-red text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export {selectedCameras.length > 1 && exportMode === 'separate' 
                  ? `(${selectedCameras.length} files)` 
                  : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

