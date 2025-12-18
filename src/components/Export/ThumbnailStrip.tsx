import { useEffect, useState, useRef } from 'react';
import { generateThumbnails, ThumbnailResult } from '../../lib/thumbnailer';
import type { CameraAngle, ClipGroup } from '../../types';

interface ThumbnailStripProps {
    clip: ClipGroup;
    camera?: CameraAngle;
    startTime?: number;
    endTime?: number;
    count?: number;
    width?: number;
    height?: number;
    className?: string;
}

export function ThumbnailStrip({
    clip,
    camera = 'front',
    startTime,
    endTime,
    count = 10,
    width = 320,
    height = 180,
    className = '',
}: ThumbnailStripProps) {
    const [thumbnails, setThumbnails] = useState<ThumbnailResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const file = clip.cameras.get(camera)?.file;
        if (!file) {
            setThumbnails([]);
            return;
        }

        let cancelled = false;
        const loadThumbnails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const results = await generateThumbnails({
                    file,
                    count,
                    width,
                    height,
                    startTime,
                    endTime,
                });
                if (!cancelled) {
                    setThumbnails(results);
                }
            } catch (err) {
                if (!cancelled) {
                    setError('Failed to load thumbnails');
                    console.error(err);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadThumbnails();

        return () => {
            cancelled = true;
        };
    }, [clip, camera, startTime, endTime, count]);

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full flex overflow-hidden rounded-lg bg-gray-900 ${className}`}
        >
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
            )}

            {error && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500 z-10">
                    {error}
                </div>
            )}

            <div className="flex w-full h-full">
                {thumbnails.map((thumb, i) => (
                    <div
                        key={`${thumb.timestamp}-${i}`}
                        className="flex-1 h-full relative"
                    >
                        <img
                            src={thumb.url}
                            alt={`Thumbnail at ${thumb.timestamp}s`}
                            className="w-full h-full object-cover border-r border-black/20 last:border-r-0"
                            loading="lazy"
                        />
                    </div>
                ))}

                {/* Placeholder if no thumbnails yet */}
                {!isLoading && thumbnails.length === 0 && !error && (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-full h-full bg-gray-800 animate-pulse" />
                    </div>
                )}
            </div>
        </div>
    );
}
