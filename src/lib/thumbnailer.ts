/**
 * Thumbnailer Utility
 * Extracts frames from Tesla Dashcam MP4 files using WebCodecs for efficiency.
 */

import { DashcamMP4 } from './dashcam-mp4';
import type { VideoFrame } from '../types';

export interface ThumbnailOptions {
    file: File;
    count: number;
    width?: number;
    height?: number;
    startTime?: number;
    endTime?: number;
}

export interface ThumbnailResult {
    url: string;
    timestamp: number;
}

// LRU cache configuration
const CACHE_MAX_ENTRIES = 50;

// LRU cache for thumbnails - tracks access order for eviction
const thumbnailCache = new Map<string, ThumbnailResult[]>();
const cacheAccessOrder: string[] = [];

/**
 * Add entry to cache with LRU eviction
 */
function addToCache(key: string, value: ThumbnailResult[]) {
    // If key already exists, remove from access order
    const existingIdx = cacheAccessOrder.indexOf(key);
    if (existingIdx !== -1) {
        cacheAccessOrder.splice(existingIdx, 1);
    }

    // Evict oldest entries if at capacity
    while (cacheAccessOrder.length >= CACHE_MAX_ENTRIES) {
        const oldestKey = cacheAccessOrder.shift();
        if (oldestKey) {
            thumbnailCache.delete(oldestKey);
        }
    }

    // Add new entry
    thumbnailCache.set(key, value);
    cacheAccessOrder.push(key);
}

/**
 * Get entry from cache and update access order
 */
function getFromCache(key: string): ThumbnailResult[] | undefined {
    if (!thumbnailCache.has(key)) return undefined;

    // Update access order (move to end)
    const idx = cacheAccessOrder.indexOf(key);
    if (idx !== -1) {
        cacheAccessOrder.splice(idx, 1);
        cacheAccessOrder.push(key);
    }

    return thumbnailCache.get(key);
}

/**
 * Generate a series of thumbnails for a video file
 */
export async function generateThumbnails(options: ThumbnailOptions): Promise<ThumbnailResult[]> {
    const { file, count, width = 160, height = 90, startTime = 0, endTime } = options;

    const cacheKey = `${file.name}-${file.size}-${startTime}-${endTime}-${count}-${width}x${height}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const buffer = await file.arrayBuffer();
        const mp4 = new DashcamMP4(buffer);
        const config = mp4.getConfig();
        const frames = mp4.parseFrames();
        const duration = mp4.getDuration();
        const actualEndTime = endTime || duration;

        // Determine which frames to decode
        const targetTimestamps = [];
        const step = (actualEndTime - startTime) / count;
        for (let i = 0; i < count; i++) {
            targetTimestamps.push(startTime + i * step + step / 2);
        }

        // Map timestamps to closest keyframes (for speed) or just closest frames
        // For thumbnails, seeking to keyframes is much faster but might be less accurate.
        // However, for a filmstrip, performance is key.
        const targetFrames: VideoFrame[] = [];
        for (const ts of targetTimestamps) {
            // Find closest frame to timestamp using actual frame timestamps
            let closest = frames[0];
            let minDiff = Infinity;

            // Estimate starting index but search a wider window to handle VFR or different framerates
            const estimatedIdx = Math.floor(ts * 30);
            const searchStart = Math.max(0, estimatedIdx - 300); // 10 second window
            const searchEnd = Math.min(frames.length - 1, estimatedIdx + 300);

            for (let i = searchStart; i <= searchEnd; i++) {
                const diff = Math.abs(frames[i].timestamp - ts);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = frames[i];
                }
            }
            targetFrames.push(closest);
        }

        // Create canvas and context for rendering
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('Failed to get canvas context');

        // Create a helper to decode a single frame accurately
        const decodeSingleFrame = async (targetFrame: VideoFrame): Promise<ThumbnailResult> => {
            return new Promise((resolve, reject) => {
                const targetIdx = frames.indexOf(targetFrame);

                // Find nearest keyframe
                let keyIdx = targetIdx;
                while (keyIdx > 0 && !frames[keyIdx].keyframe) {
                    keyIdx--;
                }

                let count = 0;
                const targetCount = targetIdx - keyIdx + 1;
                let solved = false;

                const decoder = new VideoDecoder({
                    output: (frame) => {
                        count++;
                        if (count === targetCount) {
                            solved = true;
                            // Draw this frame
                            ctx.drawImage(frame, 0, 0, width, height);
                            const url = canvas.toDataURL('image/jpeg', 0.85); // Increased quality slightly
                            const result = {
                                url,
                                timestamp: frame.timestamp / 1_000_000
                            };
                            frame.close();
                            decoder.close();
                            resolve(result);
                        } else {
                            frame.close();
                        }
                    },
                    error: (e) => {
                        console.error(`Decoder error for frame ${targetIdx}:`, e, {
                            config: {
                                codec: config.codec,
                                width: config.width,
                                height: config.height
                            },
                            keyIdx,
                            targetIdx
                        });
                        decoder.close();
                        reject(e);
                    }
                });

                decoder.configure({
                    codec: config.codec,
                    codedWidth: config.width,
                    codedHeight: config.height
                });

                // Feed from keyframe to target
                for (let i = keyIdx; i <= targetIdx; i++) {
                    const chunk = DashcamMP4.createVideoChunk(frames[i], config);
                    decoder.decode(chunk);
                }

                decoder.flush().then(() => {
                    if (!solved) {
                        decoder.close();
                        reject(new Error(`Decoder flushed but target frame ${targetIdx} not reached (got ${count}/${targetCount})`));
                    }
                }).catch(e => {
                    if (!solved) {
                        decoder.close();
                        reject(e);
                    }
                });
            });
        };

        // Decode selected frames
        const results: ThumbnailResult[] = [];

        console.log(`Generating ${targetFrames.length} thumbnails for ${file.name}...`);

        // Process each target frame sequentially for safety
        for (let i = 0; i < targetFrames.length; i++) {
            try {
                const result = await decodeSingleFrame(targetFrames[i]);
                results.push(result);
                if (i % 5 === 0) console.log(`Progress: ${results.length}/${targetFrames.length} thumbnails`);
            } catch (e) {
                console.warn(`Skipping thumbnail ${i} due to error:`, e);
            }
        }

        console.log(`Successfully generated ${results.length} thumbnails.`);

        // Sort results by timestamp just in case
        results.sort((a, b) => a.timestamp - b.timestamp);

        addToCache(cacheKey, results);
        return results;

    } catch (error) {
        console.error('Thumbnail generation failed:', error);
        return [];
    }
}

/**
 * Clear the thumbnail cache
 */
export function clearThumbnailCache() {
    thumbnailCache.clear();
    cacheAccessOrder.length = 0;
}
