/**
 * ExportDialog Component
 * Dialog for configuring and executing video export
 */

import { useState, useCallback, useEffect } from 'react';
import type { ClipGroup, CameraAngle, VideoEvent } from '../../types';
import { CAMERA_LABELS, formatDuration } from '../../types';
import { EventTimeline } from '../Timeline/EventTimeline';
import { ThumbnailStrip } from './ThumbnailStrip';
import { exportVideo, downloadBlob, validateCamerasAcrossClips, QUALITY_PRESETS, CODEC_OPTIONS, type ExportMode, type ExportQuality, type ExportCodec, type ExportResult, type MultiExportResult } from '../../lib/exporter';

interface ExportDialogProps {
  clip: ClipGroup;
  duration: number;
  currentTime: number;
  event?: VideoEvent;
  totalTime?: number;
  totalDuration?: number;
  clipDurations: number[];
  onClose: () => void;
}

export function ExportDialog({
  clip,
  duration,
  currentTime,
  event,
  totalTime,
  totalDuration: _totalDuration,
  clipDurations,
  onClose
}: ExportDialogProps) {
  const availableCameras = Array.from(clip.cameras.keys());
  const hasMultipleClips = event && event.clips.length > 1;

  // Create estimated clip durations for timeline rendering
  // Uses actual durations where available, distributes remaining time across unknown clips
  const estimatedClipDurations = (() => {
    if (!event) return [duration];

    // Count known and unknown clips, sum known durations
    let knownSum = 0;
    let unknownCount = 0;
    for (let i = 0; i < event.clips.length; i++) {
      if (clipDurations[i] && clipDurations[i] > 0) {
        knownSum += clipDurations[i];
      } else {
        unknownCount++;
      }
    }

    // Calculate per-clip estimate for unknown clips
    const remainingDuration = Math.max(0, event.totalDuration - knownSum);
    const estimatePerClip = unknownCount > 0 ? remainingDuration / unknownCount : 60;

    return event.clips.map((_, idx) => {
      if (clipDurations[idx] && clipDurations[idx] > 0) {
        return clipDurations[idx];
      }
      return estimatePerClip;
    });
  })();

  // Total duration is the sum of estimated clip durations (ensures consistency)
  const actualTotalDuration = estimatedClipDurations.reduce((sum, dur) => sum + dur, 0);

  // Multi-camera selection (default to front camera if available)
  const [selectedCameras, setSelectedCameras] = useState<CameraAngle[]>(
    availableCameras.includes('front') ? ['front'] : [availableCameras[0]]
  );
  const [includeOverlay, setIncludeOverlay] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(false);
  const [hideLocation, setHideLocation] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('combined');
  const [quality, setQuality] = useState<ExportQuality>('720p');
  const [videoCodec, setVideoCodec] = useState<ExportCodec>('h264');
  const [exportRange, setExportRange] = useState<'all' | 'selection'>('all');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Cross-clip export state
  const [exportScope, setExportScope] = useState<'single-clip' | 'cross-clip'>('single-clip');
  const [multiClipRange, setMultiClipRange] = useState<'current' | 'all' | 'selection'>('current');
  const [rangeStart, setRangeStart] = useState<number>(totalTime ?? 0);
  const [rangeEnd, setRangeEnd] = useState<number>((totalTime ?? 0) + duration);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [showValidationWarning, setShowValidationWarning] = useState(false);

  // Initialize range based on mode
  useEffect(() => {
    if (hasMultipleClips) {
      // Default to current clip
      const currentClipStart = totalTime ?? 0;
      const currentClipEnd = currentClipStart + duration;
      setRangeStart(currentClipStart);
      setRangeEnd(currentClipEnd);
      setExportScope('cross-clip'); // Multi-clip events always use cross-clip mode
    }
  }, [hasMultipleClips, totalTime, duration]);



  // Convert absolute time to clip index + time
  const absoluteTimeToClipTime = useCallback((absoluteTime: number) => {
    let cumulative = 0;
    for (let i = 0; i < estimatedClipDurations.length; i++) {
      if (cumulative + estimatedClipDurations[i] > absoluteTime) {
        return { clipIndex: i, clipTime: absoluteTime - cumulative };
      }
      cumulative += estimatedClipDurations[i];
    }
    const lastIdx = estimatedClipDurations.length - 1;
    return {
      clipIndex: lastIdx,
      clipTime: estimatedClipDurations[lastIdx] || 0,
    };
  }, [estimatedClipDurations]);

  // Handle range change from timeline
  const handleRangeChange = useCallback((start: number, end: number) => {
    setRangeStart(start);
    setRangeEnd(end);
    setMultiClipRange('selection'); // Auto-switch to selection when handles are dragged
  }, []);

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
      // Check if cross-clip export
      const isCrossClip = exportScope === 'cross-clip' && event && hasMultipleClips;

      let startClipIndex = 0, startClipTime = 0, endClipIndex = 0, endClipTime = duration;

      if (isCrossClip) {
        const start = absoluteTimeToClipTime(rangeStart);
        const end = absoluteTimeToClipTime(rangeEnd);
        startClipIndex = start.clipIndex;
        startClipTime = start.clipTime;
        endClipIndex = end.clipIndex;
        endClipTime = end.clipTime;

        console.log(`Export range: rangeStart=${rangeStart}s, rangeEnd=${rangeEnd}s`);
        console.log(`Converted: clip ${startClipIndex} @ ${startClipTime}s to clip ${endClipIndex} @ ${endClipTime}s`);

        // Validate cameras across clips
        const validation = validateCamerasAcrossClips(
          event!.clips,
          selectedCameras,
          startClipIndex,
          endClipIndex
        );

        if (!validation.valid) {
          setValidationWarnings(validation.warnings);
          setShowValidationWarning(true);
          setIsExporting(false);
          return;
        }
      }

      const result = await exportVideo({
        clip,
        cameras: selectedCameras,
        includeOverlay,
        includeCharts,
        hideLocation,
        exportMode,
        quality,
        codec: videoCodec,
        startTime: exportRange === 'all' ? 0 : startTime,
        endTime: exportRange === 'all' ? duration : endTime,
        onProgress: setProgress,
        // Cross-clip parameters
        clips: isCrossClip ? event!.clips : undefined,
        timeRange: isCrossClip ? {
          startClipIndex,
          startTime: startClipTime,
          endClipIndex,
          endTime: endClipTime,
        } : undefined,
      });

      // Handle single or multiple export results
      if ('results' in result) {
        const multiResult = result as MultiExportResult;
        for (const r of multiResult.results) {
          downloadBlob(r.blob, r.filename);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        downloadBlob((result as ExportResult).blob, (result as ExportResult).filename);
      }

      onClose();
    } catch (e) {
      console.error('Export failed:', e);
      setError((e as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, [clip, selectedCameras, includeOverlay, includeCharts, hideLocation, exportMode, quality, videoCodec, exportRange, startTime, endTime, duration, onClose, exportScope, event, hasMultipleClips, rangeStart, rangeEnd, absoluteTimeToClipTime]);

  const proceedWithExport = useCallback(async () => {
    setShowValidationWarning(false);
    setIsExporting(true);
    setError(null);
    setProgress(0);

    try {
      const isCrossClip = exportScope === 'cross-clip' && event && hasMultipleClips;

      let startClipIndex = 0, startClipTime = 0, endClipIndex = 0, endClipTime = duration;

      if (isCrossClip) {
        const start = absoluteTimeToClipTime(rangeStart);
        const end = absoluteTimeToClipTime(rangeEnd);
        startClipIndex = start.clipIndex;
        startClipTime = start.clipTime;
        endClipIndex = end.clipIndex;
        endClipTime = end.clipTime;
      }

      const result = await exportVideo({
        clip,
        cameras: selectedCameras,
        includeOverlay,
        includeCharts,
        hideLocation,
        exportMode,
        quality,
        codec: videoCodec,
        startTime: exportRange === 'all' ? 0 : startTime,
        endTime: exportRange === 'all' ? duration : endTime,
        onProgress: setProgress,
        clips: isCrossClip ? event!.clips : undefined,
        timeRange: isCrossClip ? {
          startClipIndex,
          startTime: startClipTime,
          endClipIndex,
          endTime: endClipTime,
        } : undefined,
      });

      if ('results' in result) {
        const multiResult = result as MultiExportResult;
        for (const r of multiResult.results) {
          downloadBlob(r.blob, r.filename);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        downloadBlob((result as ExportResult).blob, (result as ExportResult).filename);
      }

      onClose();
    } catch (e) {
      console.error('Export failed:', e);
      setError((e as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, [clip, selectedCameras, includeOverlay, includeCharts, hideLocation, exportMode, quality, videoCodec, exportRange, startTime, endTime, duration, onClose, exportScope, event, hasMultipleClips, rangeStart, rangeEnd, absoluteTimeToClipTime]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-4xl mx-4 border border-gray-700/50 overflow-hidden flex flex-col max-h-[90vh]">
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
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
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
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedCameras.includes(camera) ? 'bg-white border-white' : 'border-gray-500'
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
                    <div className="text-sm opacity-70">{selectedCameras.length} videos</div>
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
                    <div className="text-sm opacity-70">1 video</div>
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
              <p className="mt-2 text-sm text-amber-400">
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
                  <div className="text-sm opacity-70">{opt.description}</div>
                </button>
              ))}
            </div>
            {videoCodec === 'h264' && (
              <p className="mt-2 text-sm text-gray-400">
                ✓ H.264 works everywhere - phones, browsers, video editors
              </p>
            )}
            {videoCodec === 'h265' && (
              <p className="mt-2 text-sm text-blue-400">
                ⚡ H.265 has ~50% smaller files at same quality. Plays on VLC, iPhones, modern devices.
              </p>
            )}
          </div>

          {/* Export Range - only show for single-clip exports */}
          {!hasMultipleClips && (
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
                <div className="mt-3 space-y-4">
                  <div className="relative group">
                    <div className="h-32 bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-inner group-hover:border-gray-500 transition-colors">
                      <ThumbnailStrip
                        clip={clip}
                        camera={selectedCameras[0] || 'front'}
                        count={10}
                        width={480}
                        height={270}
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-[#e82127]/20" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                    <div className="flex-1 space-y-1">
                      <label className="block text-xs uppercase tracking-wider font-bold text-gray-500">Start Time</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={startTime.toFixed(1)}
                          onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
                          min={0}
                          max={endTime - 0.1}
                          step={0.1}
                          disabled={isExporting}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-[#e82127] focus:border-[#e82127] outline-none disabled:opacity-50 transition-all"
                        />
                        <span className="text-xs text-gray-500 font-mono">s</span>
                      </div>
                    </div>

                    <div className="w-px h-10 bg-gray-700 self-end mb-1" />

                    <div className="flex-1 space-y-1">
                      <label className="block text-xs uppercase tracking-wider font-bold text-gray-500">End Time</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={endTime.toFixed(1)}
                          onChange={(e) => setEndTime(parseFloat(e.target.value) || duration)}
                          min={startTime + 0.1}
                          max={duration}
                          step={0.1}
                          disabled={isExporting}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-[#e82127] focus:border-[#e82127] outline-none disabled:opacity-50 transition-all"
                        />
                        <span className="text-xs text-gray-500 font-mono">s</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cross-Clip Timeline (only for multi-clip events) */}
          {hasMultipleClips && event && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Range</label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => {
                    setMultiClipRange('current');
                    const currentClipStart = totalTime ?? 0;
                    const currentClipEnd = currentClipStart + duration;
                    setRangeStart(currentClipStart);
                    setRangeEnd(currentClipEnd);
                  }}
                  disabled={isExporting}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${multiClipRange === 'current'
                      ? 'bg-tesla-red text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                    disabled:opacity-50
                  `}
                >
                  Current Clip
                </button>
                <button
                  onClick={() => {
                    setMultiClipRange('all');
                    setRangeStart(0);
                    setRangeEnd(actualTotalDuration);
                  }}
                  disabled={isExporting}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${multiClipRange === 'all'
                      ? 'bg-tesla-red text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                    disabled:opacity-50
                  `}
                >
                  Full Event ({event.clips.length} clips, {formatDuration(actualTotalDuration)})
                </button>
                <button
                  onClick={() => setMultiClipRange('selection')}
                  disabled={isExporting}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${multiClipRange === 'selection'
                      ? 'bg-tesla-red text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                    disabled:opacity-50
                  `}
                >
                  Selection
                </button>
              </div>

              <label className="block text-sm font-medium text-gray-300 mb-3">
                Export Timeline
                <span className="ml-2 text-sm text-gray-500">
                  ({event.clips.length} clips)
                </span>
              </label>
              <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                <div className="mt-6">
                  <EventTimeline
                    event={event}
                    currentClipIndex={0}
                    currentTime={0}
                    totalTime={totalTime ?? 0}
                    totalDuration={actualTotalDuration}
                    clipDurations={estimatedClipDurations}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onSeek={() => { }}
                    onRangeChange={handleRangeChange}
                    disabled={isExporting}
                    showPlayhead={false}
                    background={
                      <div className="flex w-full h-full">
                        {event.clips.map((c) => (
                          <div key={c.id} className="flex-1 h-full border-r border-black/40 last:border-r-0">
                            <ThumbnailStrip
                              clip={c}
                              camera={selectedCameras[0] || 'front'}
                              count={5}
                              width={240}
                              height={135}
                            />
                          </div>
                        ))}
                      </div>
                    }
                  />
                </div>
                <div className="h-4" /> {/* Spacer */}
              </div>
            </div>
          )}

          {/* Validation Warning */}
          {showValidationWarning && (
            <div className="p-4 bg-amber-900/30 border border-amber-700 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h4 className="font-medium text-amber-400 mb-1">Camera Availability Warning</h4>
                  <ul className="text-sm text-amber-300 space-y-1 mb-3">
                    {validationWarnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-gray-400">
                    Missing cameras will appear as black screens in the exported video.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 justify-end">
                <button
                  onClick={() => setShowValidationWarning(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={proceedWithExport}
                  className="px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Export Anyway
                </button>
              </div>
            </div>
          )}

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
                  <p className="text-sm text-gray-500">For privacy when sharing on social media</p>
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

            {/* Charts Section */}
            {includeOverlay && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-gray-700">
                <div>
                  <span className="text-sm font-medium text-gray-300">Data Charts</span>
                  <p className="text-sm text-gray-500">Include speed, pedals, and G-force</p>
                </div>
                <button
                  onClick={() => setIncludeCharts(!includeCharts)}
                  disabled={isExporting}
                  className={`
                    w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                    ${includeCharts ? 'bg-tesla-red' : 'bg-gray-700'}
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <div
                    className={`
                      w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform
                      ${includeCharts ? 'translate-x-6' : 'translate-x-0.5'}
                    `}
                  />
                </button>
              </div>
            )}


          </div>


        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-[#1a1a1a]">
          {isExporting ? (
            <div className="space-y-2 animate-fade-in">
              <div className="flex justify-between text-sm font-medium text-white mb-1">
                <span>Exporting Video...</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-tesla-red to-red-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(232,33,39,0.5)]"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <p className="text-center text-xs text-gray-500 mt-2">Please wait while we process your video</p>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
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
                <span>Export Video</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

