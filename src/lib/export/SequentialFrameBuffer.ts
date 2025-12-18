import { DashcamMP4 } from '../dashcam-mp4';

// Helper class for memory-efficient sequential decoding
export class SequentialFrameBuffer {
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
                    this.decoder.flush().catch(() => { });
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
            this.decoder.flush().catch(() => { }); // Ignore flush errors
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
