import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { DashcamMP4 } from '../dashcam-mp4';
import type { ExportOptions, ExportResult } from './types';
import { QUALITY_PRESETS } from './constants';
import { getCodecString, getMuxerCodec } from './utils';
import { createSpatialLayout, compactLayout } from './layout';
import { drawOverlay, drawSpeedChart, drawPedalChart, drawAccelChart, getChartSlotCount, toGForce, loadSteeringWheelImage, type SpeedHistoryEntry, type PedalHistoryEntry, type AccelHistoryEntry, type ChartType } from './overlays';
import { SequentialFrameBuffer } from './SequentialFrameBuffer';

export async function runExportPipeline(options: ExportOptions): Promise<ExportResult> {
    const {
        cameras,
        includeOverlay,
        includeCharts,
        hideLocation,
        quality,
        codec,
        onProgress
    } = options;

    // 1. Normalize Clips & Time Range
    // Support both single-clip (legacy/simple) and multi-clip (cross-clip) modes
    const clips = options.clips || [options.clip];

    // Determine start/end indices and times
    let startClipIndex: number, endClipIndex: number;
    let startTime: number, endTime: number;

    if (options.timeRange) {
        ({ startClipIndex, startTime, endClipIndex, endTime } = options.timeRange);
    } else {
        // Single clip mode defaults
        startClipIndex = 0;
        endClipIndex = 0;
        startTime = options.startTime;
        endTime = options.endTime;
    }

    // 2. Setup Dimensions & Layout
    // Load first valid clip/camera to determine base dimensions
    const firstClip = clips[startClipIndex];
    const firstCamera = cameras[0];
    const firstCameraFile = firstClip.cameras.get(firstCamera);

    if (!firstCameraFile) {
        throw new Error(`Camera ${firstCamera} not available in first clip`);
    }

    const firstBuffer = await firstCameraFile.file.arrayBuffer();
    const firstMp4 = new DashcamMP4(firstBuffer);
    const refConfig = firstMp4.getConfig();

    // Create layout (even for single camera)
    const rawLayout = createSpatialLayout(cameras);
    const layout = compactLayout(rawLayout);

    const preset = QUALITY_PRESETS[quality];

    // Calculate base dimensions per cell
    let cellWidth = refConfig.width;
    let cellHeight = refConfig.height;

    // Apply quality scaling to cell
    if (cellHeight > preset.maxHeight) {
        const qualityScale = preset.maxHeight / cellHeight;
        cellWidth = Math.floor(cellWidth * qualityScale / 2) * 2;
        cellHeight = Math.floor(cellHeight * qualityScale / 2) * 2;
    }

    let outputWidth = cellWidth * layout.cols;
    let outputHeight = cellHeight * layout.rows;

    // Apply H.264/Hardware limits (Max 4K-ish, max area)
    // Only strictly necessary if dimensions are huge, but good safety
    const MAX_CODED_AREA = 8_900_000; // slightly above 4K
    const MAX_DIMENSION = 4096;

    let scaleFactor = 1.0;
    const codedArea = outputWidth * outputHeight;

    if (codedArea > MAX_CODED_AREA) {
        scaleFactor = Math.sqrt(MAX_CODED_AREA / codedArea);
    }
    if (outputWidth > MAX_DIMENSION) {
        scaleFactor = Math.min(scaleFactor, MAX_DIMENSION / outputWidth);
    }
    if (outputHeight > MAX_DIMENSION) {
        scaleFactor = Math.min(scaleFactor, MAX_DIMENSION / outputHeight);
    }

    if (scaleFactor < 1.0) {
        cellWidth = Math.floor(cellWidth * scaleFactor / 2) * 2;
        cellHeight = Math.floor(cellHeight * scaleFactor / 2) * 2;
        outputWidth = cellWidth * layout.cols;
        outputHeight = cellHeight * layout.rows;
    }

    console.log(`Export Layout: ${layout.cols}x${layout.rows}, Output: ${outputWidth}x${outputHeight} (${quality})`);

    // 3. Initialize Encoder & Muxer
    const target = new ArrayBufferTarget();
    let actualCodec = codec;
    let codecString = getCodecString(codec, outputWidth, outputHeight);

    // Check support
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

    const muxer = new Muxer({
        target,
        video: {
            codec: getMuxerCodec(actualCodec),
            width: outputWidth,
            height: outputHeight,
        },
        fastStart: 'in-memory',
    });

    // Calculate framerate
    // We assume all clips have roughly same framerate (Tesla cams are consistent)
    // Use first clip's average duration
    const avgFrameDuration = refConfig.durations.length > 0
        ? refConfig.durations.reduce((sum, d) => sum + d, 0) / refConfig.durations.length
        : (1000 / 30);
    const frameDurationUs = Math.round(avgFrameDuration * 1000);
    const frameRate = 1000 / avgFrameDuration;

    let encodeError: Error | null = null;
    const encoder = new VideoEncoder({
        output: (chunk, meta) => {
            muxer.addVideoChunk(chunk, meta);
        },
        error: (e) => {
            console.error('Encoder error:', e);
            encodeError = e instanceof Error ? e : new Error(String(e));
        },
    });

    const bitrateMultiplier = Math.min(cameras.length, 2.5); // Increase bitrate for grid, but dimishing returns

    encoder.configure({
        codec: codecString,
        width: outputWidth,
        height: outputHeight,
        bitrate: preset.bitrate * bitrateMultiplier,
        framerate: frameRate,
        hardwareAcceleration: 'prefer-hardware',
    });

    // 4. Processing Loop
    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const ctx = canvas.getContext('2d')!;

    // Load steering wheel image for overlay
    const steeringWheelImage = includeOverlay ? await loadSteeringWheelImage() : null;

    // State across clips
    let globalFrameIndex = 0;
    let globalCumulativeTimeMs = 0;
    const speedHistory: SpeedHistoryEntry[] = [];
    const pedalHistory: PedalHistoryEntry[] = [];
    const accelHistory: AccelHistoryEntry[] = [];

    // Determine how many chart slots are available at this output size
    const availableSlots = getChartSlotCount(outputWidth);

    // Build list of enabled charts in order of user preference
    // (order: speed, pedal, accel)
    const enabledCharts: ChartType[] = [];
    if (includeCharts) {
        enabledCharts.push('speed');
        enabledCharts.push('pedal');
        enabledCharts.push('accel');
    }

    // Limit to available slots
    const chartsToRender = enabledCharts.slice(0, availableSlots);

    // Calculate total frames for progress
    // estimation: sum of durations / avg duration
    // This is an estimation because we don't open all files yet
    let estimatedTotalFrames = 0;
    for (let i = startClipIndex; i <= endClipIndex; i++) {
        const duration = (i === startClipIndex ? (clips[i].duration || 60) - startTime :
            i === endClipIndex ? endTime : (clips[i].duration || 60));
        estimatedTotalFrames += duration * frameRate;
    }

    try {
        for (let clipIdx = startClipIndex; clipIdx <= endClipIndex; clipIdx++) {
            const clip = clips[clipIdx];
            const isFirstClip = (clipIdx === startClipIndex);
            const isLastClip = (clipIdx === endClipIndex);
            const clipStartTime = isFirstClip ? startTime : 0;
            const clipEndTime = isLastClip ? endTime : (clip.duration ?? 60);

            // Load cameras for this clip
            const activeCameras: {
                camera: typeof cameras[number],
                mp4: DashcamMP4,
                config: any,
                frames: any[]
            }[] = [];

            // We need at least one camera to drive timing
            // If a camera is missing in a clip, we just don't draw it (black)
            // But we need a "primary" camera to get frame timings. use the first available one.

            for (const cam of cameras) {
                const camFile = clip.cameras.get(cam);
                if (camFile) {
                    const buf = await camFile.file.arrayBuffer();
                    const mp4 = new DashcamMP4(buf);
                    activeCameras.push({
                        camera: cam,
                        mp4,
                        config: mp4.getConfig(),
                        frames: mp4.parseFrames()
                    });
                }
            }

            if (activeCameras.length === 0) {
                console.warn(`No cameras found for clip ${clipIdx}, skipping`);
                continue;
            }

            const primaryCam = activeCameras[0];
            const clipConfig = primaryCam.config;
            const clipFrames = primaryCam.frames;

            // Determine frame range
            let clipStartFrame = 0;
            let clipEndFrame = clipFrames.length - 1;
            let cumTime = 0;
            let foundStart = false;

            for (let i = 0; i < clipFrames.length; i++) {
                const d = clipConfig.durations[i] || avgFrameDuration;
                const t = cumTime / 1000;
                if (!foundStart && t >= clipStartTime) {
                    clipStartFrame = i;
                    foundStart = true;
                }
                if (t >= clipEndTime) {
                    clipEndFrame = i;
                    break;
                }
                cumTime += d;
            }

            // Initialize decoders
            const decoders = new Map<string, SequentialFrameBuffer>();
            for (const ac of activeCameras) {
                decoders.set(ac.camera, new SequentialFrameBuffer(ac.config, ac.frames, clipStartFrame, clipEndFrame));
            }

            // Initial offset for overlay timestamp
            let clipInitialOffsetMs = 0;
            for (let i = 0; i < clipStartFrame; i++) {
                clipInitialOffsetMs += clipConfig.durations[i] || avgFrameDuration;
            }

            // Render loop for this clip
            let currentClipTimeMs = 0;

            for (let frameIdx = clipStartFrame; frameIdx <= clipEndFrame; frameIdx++) {
                if (encodeError) throw encodeError;

                // Clear canvas
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, outputWidth, outputHeight);

                // Fetch frames
                const bitmaps = new Map<string, ImageBitmap>();
                await Promise.all(activeCameras.map(async (ac) => {
                    const decoder = decoders.get(ac.camera);
                    if (decoder) {
                        try {
                            const bmp = await decoder.getNextFrame();
                            if (bmp) bitmaps.set(ac.camera, bmp);
                        } catch (e) {
                            console.error('Error getting frame from decoder:', e, 'Decoder object:', decoder);
                            throw e;
                        }
                    } else {
                        console.warn(`Decoder not found for camera ${ac.camera}`);
                    }
                }));

                // Draw Cameras
                for (const item of layout.items) {
                    const bitmap = bitmaps.get(item.camera);
                    if (bitmap) {
                        const x = item.col * cellWidth;
                        const y = item.row * cellHeight;
                        ctx.drawImage(bitmap, x, y, cellWidth, cellHeight);
                        bitmap.close(); // Close immediately after drawing

                        // Draw label if grid
                        if (cameras.length > 1) {
                            ctx.save();
                            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                            ctx.fillRect(x + 5, y + 5, 150, 30);
                            ctx.fillStyle = '#ffffff';
                            ctx.font = '18px system-ui, sans-serif';
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'top';
                            const label = item.camera.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                            ctx.fillText(label, x + 12, y + 11);
                            ctx.restore();
                        }
                    }
                }

                // Draw Overlay (using primary camera metadata)
                const primaryFrame = primaryCam.frames[frameIdx];
                const hasCharts = chartsToRender.length > 0;
                if (includeOverlay || hasCharts) {
                    const sei = primaryFrame?.sei;
                    const videoTimestamp = new Date(clip.timestamp.getTime() + clipInitialOffsetMs + currentClipTimeMs);

                    if (includeOverlay) {
                        drawOverlay(ctx, sei, outputWidth, outputHeight, videoTimestamp, hideLocation, steeringWheelImage);
                    }

                    if (sei && chartsToRender.length > 0) {
                        // Prune history > 10s
                        const cutoff = globalCumulativeTimeMs - 10000;
                        while (speedHistory.length > 0 && speedHistory[0].timeOffset < cutoff) {
                            speedHistory.shift();
                        }
                        while (pedalHistory.length > 0 && pedalHistory[0].timeOffset < cutoff) {
                            pedalHistory.shift();
                        }
                        while (accelHistory.length > 0 && accelHistory[0].timeOffset < cutoff) {
                            accelHistory.shift();
                        }

                        // Always collect data if charts are enabled (even if not rendering this frame or slot)
                        if (includeCharts) {
                            // Speed
                            const speedMph = sei.vehicleSpeedMps * 2.23694;
                            speedHistory.push({ speed: speedMph, timeOffset: globalCumulativeTimeMs });

                            // Pedals
                            pedalHistory.push({
                                throttle: sei.acceleratorPedalPosition,
                                brake: sei.brakeApplied,
                                timeOffset: globalCumulativeTimeMs
                            });

                            // Accel (G-force)
                            accelHistory.push({
                                gLong: toGForce(sei.linearAccelerationMps2Y),
                                gLat: -toGForce(sei.linearAccelerationMps2X),
                                timeOffset: globalCumulativeTimeMs
                            });
                        }

                        // Render charts in slot order
                        chartsToRender.forEach((chartType, slotIndex) => {
                            switch (chartType) {
                                case 'speed':
                                    drawSpeedChart(ctx, speedHistory, globalCumulativeTimeMs, outputWidth, outputHeight, 'mph', slotIndex);
                                    break;
                                case 'pedal':
                                    drawPedalChart(ctx, pedalHistory, globalCumulativeTimeMs, outputWidth, outputHeight, slotIndex);
                                    break;
                                case 'accel':
                                    drawAccelChart(ctx, accelHistory, globalCumulativeTimeMs, outputWidth, outputHeight, slotIndex);
                                    break;
                            }
                        });
                    }
                }

                // Encode
                const videoFrame = new VideoFrame(canvas, {
                    timestamp: globalFrameIndex * frameDurationUs,
                    duration: frameDurationUs,
                });

                encoder.encode(videoFrame, {
                    keyFrame: (globalFrameIndex % Math.round(frameRate) === 0) || (frameIdx === clipStartFrame && !isFirstClip)
                });
                videoFrame.close();

                // Update times
                const d = clipConfig.durations[frameIdx] || avgFrameDuration;
                currentClipTimeMs += d;
                globalCumulativeTimeMs += d;
                globalFrameIndex++;

                // Progress
                // Simple progress: globalFrameIndex / estimatedTotalFrames
                // Cap at 0.95
                onProgress(Math.min(0.95, globalFrameIndex / estimatedTotalFrames));
            }

            // Cleanup decoders for this clip
            for (const d of decoders.values()) d.close();
        }
    } catch (e) {
        throw e;
    } finally {
        // Ensuring cleanup? Decoders are cleaned up per clip loop
    }

    // Finalize
    console.log('Flushing encoder...');
    await encoder.flush();
    encoder.close();

    console.log('Finalizing Muxer...');
    muxer.finalize();

    const blob = new Blob([target.buffer], { type: 'video/mp4' });

    // Generate filename
    let filename = `${firstClip.timestampStr}`;
    if (cameras.length > 1) filename += `_combined`;
    else filename += `_${cameras[0]}`;

    if (clips.length > 1) filename += `_merged`;

    filename += '_export.mp4';

    const duration = globalCumulativeTimeMs / 1000;
    onProgress(1.0);

    return { blob, filename, duration };
}
