/**
 * Video Exporter
 * Exports video with SEI overlay baked in using WebCodecs
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ClipGroup, CameraAngle, SeiMetadata } from '../types';
import { DashcamMP4 } from './dashcam-mp4';
import { formatSeiForDisplay } from './sei-decoder';

export type ExportMode = 'separate' | 'combined';
export type ExportQuality = 'original' | '1080p' | '720p' | '480p';
export type ExportCodec = 'h264' | 'h265';

export const QUALITY_PRESETS: Record<ExportQuality, { maxHeight: number; bitrate: number; label: string }> = {
  'original': { maxHeight: 9999, bitrate: 10_000_000, label: 'Original' },
  '1080p': { maxHeight: 1080, bitrate: 8_000_000, label: '1080p' },
  '720p': { maxHeight: 720, bitrate: 5_000_000, label: '720p (Recommended)' },
  '480p': { maxHeight: 480, bitrate: 2_500_000, label: '480p (Fast)' },
};

export const CODEC_OPTIONS: Record<ExportCodec, { label: string; description: string }> = {
  'h264': { label: 'H.264', description: 'Most compatible' },
  'h265': { label: 'H.265/HEVC', description: 'Better compression' },
  // AV1 commented out - browser support is too unreliable
  // 'av1': { label: 'AV1', description: 'Best quality (experimental)' },
};

export interface ExportOptions {
  clip: ClipGroup;
  cameras: CameraAngle[];  // Support multiple cameras
  includeOverlay: boolean;
  hideLocation: boolean;   // Privacy option
  exportMode: ExportMode;  // Separate files or combined grid
  quality: ExportQuality;  // Resolution/quality preset
  codec: ExportCodec;      // H.264 or AV1
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

// Get appropriate codec string based on codec type and resolution
function getCodecString(codec: ExportCodec, width: number, height: number): string {
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

// Get muxer codec type
function getMuxerCodec(codec: ExportCodec): 'avc' | 'hevc' {
  return codec === 'h265' ? 'hevc' : 'avc';
}

// Main export function - handles both single and multi-camera exports
export async function exportVideo(options: ExportOptions): Promise<ExportResult | MultiExportResult> {
  const { cameras, exportMode } = options;
  
  if (cameras.length === 0) {
    throw new Error('No cameras selected for export');
  }
  
  // Single camera or combined mode
  if (cameras.length === 1 || exportMode === 'combined') {
    return exportSingleOrCombined(options);
  }
  
  // Separate mode - export each camera individually
  return exportSeparate(options);
}

// Export multiple cameras as separate files
async function exportSeparate(options: ExportOptions): Promise<MultiExportResult> {
  const { cameras, onProgress } = options;
  const results: ExportResult[] = [];
  let totalDuration = 0;
  
  for (let i = 0; i < cameras.length; i++) {
    const camera = cameras[i];
    const result = await exportSingleCamera({
      ...options,
      camera,
      onProgress: (p) => {
        // Scale progress across all cameras
        const overallProgress = (i + p) / cameras.length;
        onProgress(overallProgress);
      }
    });
    results.push(result);
    totalDuration = Math.max(totalDuration, result.duration);
  }
  
  return { results, totalDuration };
}

// Export single camera or combined grid
async function exportSingleOrCombined(options: ExportOptions): Promise<ExportResult> {
  const { cameras } = options;
  
  if (cameras.length === 1) {
    return exportSingleCamera({ ...options, camera: cameras[0] });
  }
  
  // Combined grid export (exportMode === 'combined' is implied here)
  return exportCombinedGrid(options);
}

// Export single camera video
interface SingleCameraOptions extends Omit<ExportOptions, 'cameras' | 'exportMode'> {
  camera: CameraAngle;
}

async function exportSingleCamera(options: SingleCameraOptions): Promise<ExportResult> {
  const { clip, camera, includeOverlay, hideLocation, quality, codec, startTime, endTime, onProgress } = options;

  const cameraFile = clip.cameras.get(camera);
  if (!cameraFile) {
    throw new Error(`Camera ${camera} not available in this clip`);
  }

  // Load and parse the video
  const buffer = await cameraFile.file.arrayBuffer();
  const mp4 = new DashcamMP4(buffer);
  const config = mp4.getConfig();
  const frames = mp4.parseFrames();

  // Calculate frame range based on time
  // Calculate cumulative time to find exact frame indices
  let startFrame = 0;
  let endFrame = frames.length - 1;
  let cumulativeTime = 0;
  
  for (let i = 0; i < frames.length; i++) {
    const frameDuration = config.durations[i] || config.durations[0] || 33;
    if (cumulativeTime / 1000 >= startTime && startFrame === 0) {
      startFrame = i;
    }
    if (cumulativeTime / 1000 >= endTime) {
      endFrame = i;
      break;
    }
    cumulativeTime += frameDuration;
  }
  
  const totalFrames = endFrame - startFrame + 1;
  console.log(`Export range: ${startTime}s-${endTime}s => frames ${startFrame}-${endFrame} (${totalFrames} frames)`);

  // Apply quality scaling
  const preset = QUALITY_PRESETS[quality];
  let outputWidth = config.width;
  let outputHeight = config.height;
  
  if (config.height > preset.maxHeight) {
    const scale = preset.maxHeight / config.height;
    outputWidth = Math.floor(config.width * scale / 2) * 2; // Round to even
    outputHeight = Math.floor(config.height * scale / 2) * 2;
    console.log(`Scaling single camera from ${config.width}x${config.height} to ${outputWidth}x${outputHeight}`);
  }

  // Create canvas for rendering at output size
  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  const ctx = canvas.getContext('2d')!;

  // Get codec string and check support
  let codecString = getCodecString(codec, outputWidth, outputHeight);
  let actualCodec = codec;
  
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec: codecString,
      width: outputWidth,
      height: outputHeight,
      bitrate: preset.bitrate,
    });
    if (!support.supported) {
      console.warn(`${codec.toUpperCase()} not supported, falling back to H.264`);
      actualCodec = 'h264';
      codecString = getCodecString('h264', outputWidth, outputHeight);
    }
  } catch {
    console.warn('Codec check failed, using H.264');
    actualCodec = 'h264';
    codecString = getCodecString('h264', outputWidth, outputHeight);
  }

  console.log(`Exporting ${outputWidth}x${outputHeight} @ ${quality} with ${actualCodec.toUpperCase()}`);

  // Create encoder and muxer
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: getMuxerCodec(actualCodec),
      width: outputWidth,
      height: outputHeight,
    },
    fastStart: 'in-memory',
  });

  let encodedFrames = 0;
  let encodeError: Error | null = null;
  
  // Calculate average frame duration for constant output framerate
  const avgFrameDuration = config.durations.length > 0
    ? config.durations.slice(startFrame, endFrame + 1).reduce((sum, d) => sum + d, 0) / totalFrames
    : 33;
  const frameDurationUs = Math.round(avgFrameDuration * 1000);
  const frameRate = 1000 / avgFrameDuration;
  
  console.log(`Average frame duration: ${avgFrameDuration.toFixed(2)}ms (${frameRate.toFixed(2)} fps)`);

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
      encodedFrames++;
      // Cap progress at 90% to leave room for flush/finalize steps
      onProgress(Math.min(0.9, encodedFrames / totalFrames));
    },
    error: (e) => {
      console.error('Encoder error:', e);
      encodeError = e instanceof Error ? e : new Error(String(e));
    },
  });

  encoder.configure({
    codec: codecString,
    width: outputWidth,
    height: outputHeight,
    bitrate: preset.bitrate,
    framerate: frameRate,
    hardwareAcceleration: 'prefer-hardware',
  });

  // Create decoder helper
  const decodeFrame = async (frameIndex: number): Promise<ImageBitmap> => {
    return new Promise((resolve, reject) => {
      // Find nearest keyframe
      let keyIdx = frameIndex;
      while (keyIdx >= 0 && !frames[keyIdx].keyframe) keyIdx--;
      if (keyIdx < 0) {
        reject(new Error('No keyframe found'));
        return;
      }

      let count = 0;
      const target = frameIndex - keyIdx + 1;

      const decoder = new VideoDecoder({
        output: async (frame) => {
          count++;
          if (count === target) {
            const bitmap = await createImageBitmap(frame);
            frame.close();
            resolve(bitmap);
          } else {
            frame.close();
          }
        },
        error: reject,
      });

      decoder.configure({
        codec: config.codec,
        codedWidth: config.width,
        codedHeight: config.height,
      });

      for (let i = keyIdx; i <= frameIndex; i++) {
        decoder.decode(DashcamMP4.createVideoChunk(frames[i], config));
      }

      decoder.flush().catch(reject);
    });
  };

  // Calculate initial time offset to startFrame
  let initialOffsetMs = 0;
  for (let i = 0; i < startFrame; i++) {
    initialOffsetMs += config.durations[i] || config.durations[0] || 33;
  }
  
  // Process each frame
  let cumulativeTimeMs = 0;
  for (let i = startFrame; i <= endFrame; i++) {
    // Check for encoding errors
    if (encodeError) {
      throw encodeError;
    }
    
    const frameIndex = i;
    const frame = frames[frameIndex];

    // Decode the video frame
    const bitmap = await decodeFrame(frameIndex);

    // Draw to canvas (scaling if needed)
    ctx.drawImage(bitmap, 0, 0, outputWidth, outputHeight);
    bitmap.close();

    // Draw overlay if enabled
    if (includeOverlay) {
      // Calculate actual video timestamp: clip start + offset to startFrame + frames processed
      const videoTimestamp = new Date(clip.timestamp.getTime() + initialOffsetMs + cumulativeTimeMs);
      drawOverlay(ctx, frame.sei, outputWidth, outputHeight, videoTimestamp, hideLocation);
    }

    // Create video frame for encoding
    const videoFrame = new VideoFrame(canvas, {
      timestamp: (i - startFrame) * frameDurationUs,
      duration: frameDurationUs,
    });

    // Encode with keyframe every 30 frames
    encoder.encode(videoFrame, {
      keyFrame: (i - startFrame) % 30 === 0,
    });

    videoFrame.close();
    
    // Accumulate actual frame duration for next iteration
    cumulativeTimeMs += config.durations[i] || config.durations[0] || 33;
  }

  // Flush and finalize
  onProgress(0.95);
  await encoder.flush();
  encoder.close();
  
  onProgress(0.98);
  muxer.finalize();

  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  const filename = `${clip.timestampStr}_${camera}_export.mp4`;
  const duration = (endFrame - startFrame + 1) * (config.durations[0] || 33) / 1000;

  onProgress(1.0);
  return { blob, filename, duration };
}

// Helper class for memory-efficient sequential decoding
class SequentialFrameBuffer {
  private decoder: VideoDecoder;
  private frameQueue: Promise<ImageBitmap>[] = [];
  private feedIndex: number;
  private startOutputFrame: number;
  private endIndex: number;
  private inputFrames: any[];
  private config: any;
  private flushing = false;
  private error: Error | null = null;
  private framesDecoded: number = 0;

  constructor(config: any, inputFrames: any[], startFrame: number, endFrame: number) {
    this.config = config;
    this.inputFrames = inputFrames;
    this.startOutputFrame = startFrame;
    this.endIndex = Math.min(endFrame, inputFrames.length - 1);

    // Find the nearest keyframe at or before startFrame
    let keyframeIndex = startFrame;
    while (keyframeIndex > 0 && !inputFrames[keyframeIndex]?.keyframe) {
      keyframeIndex--;
    }
    this.feedIndex = keyframeIndex;

    this.decoder = new VideoDecoder({
      output: (frame) => {
        // Only queue frames that are within our target range
        if (this.framesDecoded >= (this.startOutputFrame - keyframeIndex)) {
          const p = createImageBitmap(frame);
          frame.close();
          this.frameQueue.push(p);
        } else {
          // Skip frames before startOutputFrame
          frame.close();
        }
        this.framesDecoded++;
      },
      error: (e) => {
        console.error('Decoder error:', e);
        this.error = e instanceof Error ? e : new Error(String(e));
      },
    });

    this.decoder.configure({
      codec: config.codec,
      codedWidth: config.width,
      codedHeight: config.height,
      hardwareAcceleration: 'prefer-hardware', // Enable hardware decoding
    });

    // Initial pump
    this.pump();
  }

  async getNextFrame(): Promise<ImageBitmap | null> {
    if (this.error) throw this.error;

    // Wait for frame to be available
    while (this.frameQueue.length === 0) {
      if (this.error) throw this.error;
      
      // Check if we are done (all frames fed and decoder queue empty)
      if (this.feedIndex > this.endIndex && this.decoder.decodeQueueSize === 0) {
          // Trigger flush if not already flushing
          if (!this.flushing) {
               this.flushing = true;
               this.decoder.flush().catch(() => {});
               await new Promise(r => setTimeout(r, 50));
               continue;
          }
          // Stream ended - return null (camera ran out of frames)
          return null;
      }
      
      this.pump();
      await new Promise(r => setTimeout(r, 10));
    }

    const bitmap = await this.frameQueue.shift()!;
    this.pump(); // Keep buffer full
    return bitmap;
  }

  private pump() {
    const TARGET_BUFFER = 10;
    
    while (
      !this.error &&
      !this.flushing &&
      this.decoder.decodeQueueSize < TARGET_BUFFER && 
      this.feedIndex <= this.endIndex &&
      this.frameQueue.length < TARGET_BUFFER
    ) {
      try {
        const frame = this.inputFrames[this.feedIndex];
        if (!frame) break; // Safety check - stop if frame doesn't exist
        const chunk = DashcamMP4.createVideoChunk(frame, this.config);
        this.decoder.decode(chunk);
        this.feedIndex++;
      } catch (e) {
        this.error = e instanceof Error ? e : new Error(String(e));
      }
    }
    
    if (this.feedIndex > this.endIndex && !this.flushing) {
        this.flushing = true;
        this.decoder.flush().catch(() => {}); // Ignore flush errors
    }
  }

  close() {
    if (this.decoder.state !== 'closed') {
      try {
        this.decoder.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

// Export multiple cameras combined into a grid layout
async function exportCombinedGrid(options: ExportOptions): Promise<ExportResult> {
  const { clip, cameras, includeOverlay, hideLocation, quality, codec, startTime, endTime, onProgress } = options;
  const preset = QUALITY_PRESETS[quality];
  
  // Load all camera files
  const cameraData: Array<{
    camera: CameraAngle;
    mp4: DashcamMP4;
    config: ReturnType<DashcamMP4['getConfig']>;
    frames: ReturnType<DashcamMP4['parseFrames']>;
  }> = [];
  
  for (const camera of cameras) {
    const cameraFile = clip.cameras.get(camera);
    if (cameraFile) {
      const buffer = await cameraFile.file.arrayBuffer();
      const mp4 = new DashcamMP4(buffer);
      cameraData.push({
        camera,
        mp4,
        config: mp4.getConfig(),
        frames: mp4.parseFrames(),
      });
    }
  }
  
  if (cameraData.length === 0) {
    throw new Error('No valid camera files found');
  }
  
  // Use first camera's dimensions as reference
  const refConfig = cameraData[0].config;
  
  // Smart spatial layout - arrange cameras based on their actual physical positions
  // This matches how they appear in the vehicle and in the web UI
  const createSpatialLayout = (cams: CameraAngle[]): { camera: CameraAngle; row: number; col: number }[] => {
    const layout: { camera: CameraAngle; row: number; col: number }[] = [];
    
    // Define camera positions in a logical grid
    // Top row: left pillar | front | right pillar (more forward-facing)
    // Bottom row: right repeater | back | left repeater (mirrored to match side view)
    const positions: Record<CameraAngle, { row: number; col: number }> = {
      'left_pillar': { row: 0, col: 0 },
      'front': { row: 0, col: 1 },
      'right_pillar': { row: 0, col: 2 },
      'left_repeater': { row: 1, col: 2 },
      'back': { row: 1, col: 1 },
      'right_repeater': { row: 1, col: 0 },
    };
    
    // Get positions for selected cameras
    for (const cam of cams) {
      layout.push({ camera: cam, ...positions[cam] });
    }
    
    return layout;
  };
  
  const spatialLayout = createSpatialLayout(cameras);
  
  // Compact the grid - remove empty columns/rows
  const usedCols = [...new Set(spatialLayout.map(p => p.col))].sort((a, b) => a - b);
  const usedRows = [...new Set(spatialLayout.map(p => p.row))].sort((a, b) => a - b);
  
  // Remap to contiguous grid (e.g., if using cols 0 and 2, remap to 0 and 1)
  const colMap = new Map(usedCols.map((col, idx) => [col, idx]));
  const rowMap = new Map(usedRows.map((row, idx) => [row, idx]));
  
  const compactLayout = spatialLayout.map(item => ({
    ...item,
    col: colMap.get(item.col)!,
    row: rowMap.get(item.row)!,
  }));
  
  let cols = usedCols.length;
  let rows = usedRows.length;
  
  // Special case: for 2 cameras, arrange side-by-side instead of stacked
  let finalLayout = compactLayout;
  if (compactLayout.length === 2) {
    finalLayout = compactLayout.map((item, idx) => ({
      ...item,
      row: 0,
      col: idx,
    }));
    rows = 1;
    cols = 2;
  }
  
  console.log(`Grid layout: ${rows}x${cols} for cameras:`, finalLayout.map(c => `${c.camera}@(${c.row},${c.col})`).join(', '));
  
  // Calculate base dimensions per cell
  let cellWidth = refConfig.width;
  let cellHeight = refConfig.height;
  
  // First apply quality scaling to each cell
  if (cellHeight > preset.maxHeight) {
    const qualityScale = preset.maxHeight / cellHeight;
    cellWidth = Math.floor(cellWidth * qualityScale / 2) * 2;
    cellHeight = Math.floor(cellHeight * qualityScale / 2) * 2;
  }
  
  let outputWidth = cellWidth * cols;
  let outputHeight = cellHeight * rows;
  
  // H.264 max supported area - apply additional scaling if still too large
  const MAX_CODED_AREA = 8_000_000; // Conservative limit for GPU stability
  const MAX_DIMENSION = 3840; // Conservative max dimension
  
  let scaleFactor = 1.0;
  const codedArea = Math.ceil(outputWidth / 16) * 16 * Math.ceil(outputHeight / 16) * 16;
  
  if (codedArea > MAX_CODED_AREA) {
    scaleFactor = Math.sqrt(MAX_CODED_AREA / codedArea);
  }
  if (outputWidth > MAX_DIMENSION) {
    scaleFactor = Math.min(scaleFactor, MAX_DIMENSION / outputWidth);
  }
  if (outputHeight > MAX_DIMENSION) {
    scaleFactor = Math.min(scaleFactor, MAX_DIMENSION / outputHeight);
  }
  
  // Apply additional scaling if needed
  if (scaleFactor < 1.0) {
    cellWidth = Math.floor(cellWidth * scaleFactor / 2) * 2;
    cellHeight = Math.floor(cellHeight * scaleFactor / 2) * 2;
    outputWidth = cellWidth * cols;
    outputHeight = cellHeight * rows;
  }
  
  console.log(`Combined grid: ${cols}x${rows} cells @ ${cellWidth}x${cellHeight} each = ${outputWidth}x${outputHeight} total (${quality})`)
  
  // Create canvas for combined output
  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  const ctx = canvas.getContext('2d')!;
  
  // Calculate frame range based on time using actual frame durations
  const minFrameCount = Math.min(...cameraData.map(c => c.frames.length));
  let startFrame = 0;
  let endFrame = minFrameCount - 1;
  let cumulativeTime = 0;
  
  for (let i = 0; i < minFrameCount; i++) {
    const frameDuration = refConfig.durations[i] || refConfig.durations[0] || 33;
    if (cumulativeTime / 1000 >= startTime && startFrame === 0) {
      startFrame = i;
    }
    if (cumulativeTime / 1000 >= endTime) {
      endFrame = i;
      break;
    }
    cumulativeTime += frameDuration;
  }
  
  const totalFrames = endFrame - startFrame + 1;
  console.log(`Export range: ${startTime}s-${endTime}s => frames ${startFrame}-${endFrame} (${totalFrames} frames)`);
  
  // Calculate average frame duration for constant output framerate
  const avgFrameDuration = refConfig.durations.length > 0
    ? refConfig.durations.slice(startFrame, endFrame + 1).reduce((sum, d) => sum + d, 0) / totalFrames
    : 33;
  const frameDurationUs = Math.round(avgFrameDuration * 1000);
  const frameRate = 1000 / avgFrameDuration;
  
  console.log(`Average frame duration: ${avgFrameDuration.toFixed(2)}ms (${frameRate.toFixed(2)} fps)`);
  
  // Get codec string
  let codecString = getCodecString(codec, outputWidth, outputHeight);
  console.log(`Combined export: ${outputWidth}x${outputHeight} @ ${quality} with ${codec.toUpperCase()}`);
  
  // Check codec support and fallback to H.264 if needed
  let actualCodec = codec;
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec: codecString,
      width: outputWidth,
      height: outputHeight,
      bitrate: preset.bitrate,
    });
    if (!support.supported) {
      console.warn(`${codec.toUpperCase()} not supported, falling back to H.264`);
      actualCodec = 'h264';
      codecString = getCodecString('h264', outputWidth, outputHeight);
    }
  } catch {
    console.warn('Codec check failed, using H.264');
    actualCodec = 'h264';
    codecString = getCodecString('h264', outputWidth, outputHeight);
  }
  
  // Initialize sequential decoders for all cameras
  console.log(`Initializing sequential decoders for ${cameraData.length} cameras...`);
  const decoders: SequentialFrameBuffer[] = [];
  
  for (const camData of cameraData) {
    decoders.push(new SequentialFrameBuffer(
      camData.config,
      camData.frames,
      startFrame,
      endFrame
    ));
  }
  
  console.log(`Encoding ${totalFrames} combined frames...`);
  
  // Helper to create and configure encoder with fallback
  const createEncoder = async (useCodec: ExportCodec): Promise<{
    encoder: VideoEncoder;
    muxer: Muxer<ArrayBufferTarget>;
    target: ArrayBufferTarget;
    usedCodec: ExportCodec;
  }> => {
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: {
        codec: getMuxerCodec(useCodec),
        width: outputWidth,
        height: outputHeight,
      },
      fastStart: 'in-memory',
    });
    
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          muxer.addVideoChunk(chunk, meta);
        },
        error: (e) => {
          if (!resolved) {
            resolved = true;
            reject(e);
          }
        },
      });
      
      const cs = getCodecString(useCodec, outputWidth, outputHeight);
      console.log(`Trying ${useCodec.toUpperCase()} encoder with codec: ${cs}`);
      
      try {
        encoder.configure({
          codec: cs,
          width: outputWidth,
          height: outputHeight,
          bitrate: preset.bitrate * Math.min(cameras.length, 2),
          framerate: frameRate,
          hardwareAcceleration: 'prefer-hardware',
        });
        
        // Give encoder a moment to report any async errors
        setTimeout(() => {
          if (!resolved && encoder.state === 'configured') {
            resolved = true;
            resolve({ encoder, muxer, target, usedCodec: useCodec });
          } else if (!resolved) {
            resolved = true;
            reject(new Error('Encoder failed to configure'));
          }
        }, 100);
      } catch (e) {
        resolved = true;
        reject(e);
      }
    });
  };
  
  // Try to create encoder, with fallback to H.264
  let encoder: VideoEncoder;
  let muxer: Muxer<ArrayBufferTarget>;
  let target: ArrayBufferTarget;
  let finalCodec: ExportCodec;
  
  try {
    const result = await createEncoder(actualCodec);
    encoder = result.encoder;
    muxer = result.muxer;
    target = result.target;
    finalCodec = result.usedCodec;
  } catch (e) {
    if (actualCodec === 'h265') {
      console.warn('H.265 encoder failed, falling back to H.264:', e);
      const result = await createEncoder('h264');
      encoder = result.encoder;
      muxer = result.muxer;
      target = result.target;
      finalCodec = 'h264';
    } else {
      throw e;
    }
  }
  
  console.log(`Using ${finalCodec.toUpperCase()} encoder`);
  
  let encodeError: Error | null = null;
  
  // Set up error handler for encoding phase
  encoder.addEventListener('error', (e) => {
    encodeError = new Error('Encoding error: ' + (e as ErrorEvent).message);
  });
  
  // Calculate initial time offset to startFrame
  let initialOffsetMs = 0;
  for (let i = 0; i < startFrame; i++) {
    initialOffsetMs += refConfig.durations[i] || refConfig.durations[0] || 33;
  }
  
  // Now combine and encode all frames sequentially
  try {
    let cumulativeTimeMs = 0;
    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      // Check for encoding errors
      if (encodeError) {
        throw encodeError;
      }
      const i = startFrame + frameIdx;
      
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, outputWidth, outputHeight);
      
      // Get next frame from each decoder
      const bitmaps = await Promise.all(decoders.map(d => d.getNextFrame()));
      
      // Draw each camera's frame using spatial layout
      for (let camIdx = 0; camIdx < cameraData.length; camIdx++) {
        const camera = cameraData[camIdx].camera;
        const position = finalLayout.find(p => p.camera === camera);
        
        if (position) {
          const x = position.col * cellWidth;
          const y = position.row * cellHeight;
          
          const bitmap = bitmaps[camIdx];
          if (bitmap) {
            ctx.drawImage(bitmap, x, y, cellWidth, cellHeight);
            
            // Draw camera label in top-left corner of each cell
            if (cameraData.length > 1) {
              ctx.save();
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(x + 5, y + 5, 150, 30);
              ctx.fillStyle = '#ffffff';
              ctx.font = '18px system-ui, sans-serif';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              const label = camera.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
              ctx.fillText(label, x + 12, y + 11);
              ctx.restore();
            }
          }
        }
      }
      
      // Close bitmaps immediately
      for (const bitmap of bitmaps) {
        if (bitmap) bitmap.close();
      }
      
      // Draw overlay on bottom (using first camera's SEI data if available)
      if (includeOverlay) {
        const frame = cameraData[0].frames[i];
        // Calculate actual video timestamp: clip start + offset to startFrame + frames processed
        const videoTimestamp = new Date(clip.timestamp.getTime() + initialOffsetMs + cumulativeTimeMs);
        drawOverlay(ctx, frame?.sei, outputWidth, outputHeight, videoTimestamp, hideLocation);
      }
      
      // Create video frame for encoding
      const videoFrame = new VideoFrame(canvas, {
        timestamp: frameIdx * frameDurationUs,
        duration: frameDurationUs,
      });
      
      encoder.encode(videoFrame, {
        keyFrame: frameIdx % 30 === 0,
      });
      
      videoFrame.close();
      
      // Accumulate actual frame duration for next iteration
      cumulativeTimeMs += refConfig.durations[i] || refConfig.durations[0] || 33;
      
      // Report progress
      onProgress((frameIdx + 1) / totalFrames);
    }
  } finally {
    // Clean up decoders
    for (const decoder of decoders) {
      decoder.close();
    }
  }
  
  // Flush encoder
  console.log('Flushing encoder...');
  onProgress(0.99);
  await encoder.flush();
  encoder.close();
  
  // Finalize muxer
  console.log('Finalizing MP4...');
  muxer.finalize();
  
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  const cameraNames = cameras.join('-');
  const filename = `${clip.timestampStr}_${cameraNames}_combined_export.mp4`;
  const duration = (endFrame - startFrame + 1) * (refConfig.durations[0] || 33) / 1000;
  
  onProgress(1.0);
  return { blob, filename, duration };
}

function drawOverlay(
  ctx: OffscreenCanvasRenderingContext2D,
  sei: SeiMetadata | null | undefined,
  width: number,
  height: number,
  videoTimestamp: Date,
  hideLocation: boolean = false
) {
  // Taller strip for bigger text
  const stripHeight = 120;
  const y = height - stripHeight;
  const padding = 40;
  
  // Draw semi-transparent black strip
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, y, width, stripHeight);
  
  // Add subtle top border
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(0, y, width, 3);
  
  // Divide into thirds: LEFT | CENTER | RIGHT
  const leftSection = padding;
  const centerSection = width / 2;
  const rightSection = width - padding;
  
  // If SEI data is available, show vehicle data
  if (sei) {
    const data = formatSeiForDisplay(sei, 'mph');
    
    // ========== LEFT SECTION: Speed & Gear ==========
    ctx.textBaseline = 'middle';
    const centerY = y + stripHeight / 2;
    
    // Speed - BIG and bold
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic'; // Use alphabetic baseline for proper alignment
    const speedNum = data.speed.replace(/[^0-9.]/g, '');
    const speedNumWidth = ctx.measureText(speedNum).width;
    const baselineY = centerY + 18; // Position baseline
    ctx.fillText(speedNum, leftSection, baselineY);
    
    // Speed unit smaller, same baseline for perfect vertical alignment
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('mph', leftSection + speedNumWidth + 10, baselineY);
    
    // Gear box
    ctx.textBaseline = 'middle'; // Reset for gear
    const gearX = leftSection + speedNumWidth + 90;
    const gearSize = 50;
    ctx.fillStyle = '#374151';
    ctx.fillRect(gearX, centerY - gearSize/2, gearSize, gearSize);
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(data.gear, gearX + gearSize/2, centerY);
    
    // ========== CENTER SECTION: Autopilot & Pedals ==========
    ctx.textAlign = 'center';
    
    // Autopilot status (top center)
    if (sei.autopilotState !== 0) {
      ctx.font = 'bold 28px system-ui, sans-serif';
      const apColor = sei.autopilotState === 1 ? '#3b82f6' : 
                      sei.autopilotState === 2 ? '#60a5fa' : 
                      '#10b981';
      ctx.fillStyle = apColor;
      const apText = sei.autopilotState === 1 ? 'Self Driving' : data.autopilot;
      ctx.fillText(apText, centerSection, y + 35);
    }
    
    // Pedals row (bottom center)
    const pedalY = y + 80;
    ctx.font = '22px system-ui, sans-serif';
    
    // Steering (left of center)
    const steeringColor = Math.abs(sei.steeringWheelAngle) > 90 ? '#f59e0b' : '#d1d5db';
    ctx.fillStyle = steeringColor;
    ctx.fillText(`Steering ${data.steering}`, centerSection - 250, pedalY);
    
    // Throttle (center)
    ctx.fillStyle = sei.acceleratorPedalPosition > 50 ? '#22c55e' : '#d1d5db';
    ctx.fillText(`Throttle ${data.accelerator}`, centerSection, pedalY);
    
    // Brake (right of center)
    ctx.fillStyle = sei.brakeApplied ? '#ef4444' : '#d1d5db';
    ctx.fillText(`Brake ${data.brake}`, centerSection + 250, pedalY);
    
    // Blinkers (next to autopilot if active)
    if (sei.blinkerOnLeft || sei.blinkerOnRight) {
      ctx.fillStyle = '#f59e0b';
      const blinkerY = y + 35;
      const arrowSize = 16;
      if (sei.blinkerOnLeft) {
        ctx.beginPath();
        ctx.moveTo(centerSection - 150, blinkerY);
        ctx.lineTo(centerSection - 150 + arrowSize, blinkerY - arrowSize);
        ctx.lineTo(centerSection - 150 + arrowSize, blinkerY + arrowSize);
        ctx.fill();
      }
      if (sei.blinkerOnRight) {
        ctx.beginPath();
        ctx.moveTo(centerSection + 150, blinkerY);
        ctx.lineTo(centerSection + 150 - arrowSize, blinkerY - arrowSize);
        ctx.lineTo(centerSection + 150 - arrowSize, blinkerY + arrowSize);
        ctx.fill();
      }
    }
    
    // ========== RIGHT SECTION: Location & Time ==========
    ctx.textAlign = 'right';
    
    // Location (if available and not hidden for privacy)
    if (!hideLocation && (sei.latitudeDeg !== 0 || sei.longitudeDeg !== 0)) {
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`${data.latitude}, ${data.longitude}`, rightSection, y + 35);
      
      // Heading
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(`Heading ${data.heading}`, rightSection, y + 70);
    }
  }
  
  // ALWAYS show video timestamp (from recording)
  ctx.textAlign = 'right';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#6b7280';
  const timeStr = videoTimestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const dateStr = videoTimestamp.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  ctx.fillText(`${dateStr} ${timeStr}`, rightSection, y + 100);
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

