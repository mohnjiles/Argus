/**
 * VideoPlayer Component
 * Multi-camera grid with synchronized playback
 */

import { useEffect, useRef, useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import Draggable from 'react-draggable';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { ClipGroup, CameraAngle, SeiMetadata, SpeedUnit } from '../../types';
import { CAMERA_ANGLES, CAMERA_LABELS } from '../../types';
import { CameraView, CameraViewHandle } from './CameraView';
import { SeiOverlay, AccelDebugOverlay, GMeter, AccelChart, PedalChart, SpeedChart, MapOverlay } from '../Overlay/SeiOverlay';
import type { OverlayPosition } from '../../hooks/useSettings';

export interface VideoPlayerHandle {
  seekAll: (time: number) => void;
}

interface VideoPlayerProps {
  clip: ClipGroup | null;
  clipIndex?: number;
  totalClips?: number;
  isPlaying: boolean;
  playbackSpeed: number;
  visibleCameras: Set<CameraAngle>;
  onToggleCamera: (camera: CameraAngle) => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onClipEnded?: () => void;
  seiData: SeiMetadata | null;
  speedUnit: SpeedUnit;
  overlayPosition: OverlayPosition;
  showOverlay: boolean;
  showGMeter: boolean;
  showAccelChart: boolean;
  showPedalChart: boolean;
  showSpeedChart: boolean;
  showAccelDebug: boolean;
  showMap: boolean;
  currentTime?: number; // Current playback time in ms for charts
  onSetAllCamerasVisible?: (visible: boolean) => void;
  onOverlayDragChange?: (isDragging: boolean) => void;
}

// Create dynamic layout based on visible cameras
function createLayout(visibleCameras: CameraAngle[]): GridLayout.Layout[] {
  const count = visibleCameras.length;

  if (count === 0) return [];

  // Single camera - full screen
  if (count === 1) {
    return [{ i: visibleCameras[0], x: 0, y: 0, w: 12, h: 12, minW: 12, maxW: 12, minH: 12, maxH: 12 }];
  }

  // Two cameras - side by side
  if (count === 2) {
    return [
      { i: visibleCameras[0], x: 0, y: 0, w: 6, h: 12, minW: 6, maxW: 6, minH: 12, maxH: 12 },
      { i: visibleCameras[1], x: 6, y: 0, w: 6, h: 12, minW: 6, maxW: 6, minH: 12, maxH: 12 },
    ];
  }

  // Three cameras - one large on left, two stacked on right
  if (count === 3) {
    return [
      { i: visibleCameras[0], x: 0, y: 0, w: 8, h: 12, minW: 8, maxW: 8, minH: 12, maxH: 12 },
      { i: visibleCameras[1], x: 8, y: 0, w: 4, h: 6, minW: 4, maxW: 4, minH: 6, maxH: 6 },
      { i: visibleCameras[2], x: 8, y: 6, w: 4, h: 6, minW: 4, maxW: 4, minH: 6, maxH: 6 },
    ];
  }

  // Four cameras - 2x2 grid
  if (count === 4) {
    return [
      { i: visibleCameras[0], x: 0, y: 0, w: 6, h: 6, minW: 6, maxW: 6, minH: 6, maxH: 6 },
      { i: visibleCameras[1], x: 6, y: 0, w: 6, h: 6, minW: 6, maxW: 6, minH: 6, maxH: 6 },
      { i: visibleCameras[2], x: 0, y: 6, w: 6, h: 6, minW: 6, maxW: 6, minH: 6, maxH: 6 },
      { i: visibleCameras[3], x: 6, y: 6, w: 6, h: 6, minW: 6, maxW: 6, minH: 6, maxH: 6 },
    ];
  }

  // Five cameras - two on top, three on bottom
  if (count === 5) {
    return [
      { i: visibleCameras[0], x: 0, y: 0, w: 6, h: 8, minW: 6, maxW: 6, minH: 8, maxH: 8 },
      { i: visibleCameras[1], x: 6, y: 0, w: 6, h: 8, minW: 6, maxW: 6, minH: 8, maxH: 8 },
      { i: visibleCameras[2], x: 0, y: 8, w: 4, h: 4, minW: 4, maxW: 4, minH: 4, maxH: 4 },
      { i: visibleCameras[3], x: 4, y: 8, w: 4, h: 4, minW: 4, maxW: 4, minH: 4, maxH: 4 },
      { i: visibleCameras[4], x: 8, y: 8, w: 4, h: 4, minW: 4, maxW: 4, minH: 4, maxH: 4 },
    ];
  }
  // 6 cameras - 3x2 grid layout
  const cameraOrder: Record<CameraAngle, { x: number, y: number }> = {
    left_pillar: { x: 0, y: 0 },
    front: { x: 4, y: 0 },
    right_pillar: { x: 8, y: 0 },
    left_repeater: { x: 0, y: 6 },
    back: { x: 4, y: 6 },
    right_repeater: { x: 8, y: 6 },
  };

  return visibleCameras.map((camera) => ({
    i: camera,
    x: cameraOrder[camera]?.x ?? 0,
    y: cameraOrder[camera]?.y ?? 0,
    w: 4,
    h: 6,
    minW: 4,
    maxW: 4,
    minH: 6,
    maxH: 6,
  }));
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer({
  clip,
  clipIndex: _clipIndex = 0,
  totalClips: _totalClips = 1,
  isPlaying,
  playbackSpeed,
  visibleCameras,
  onToggleCamera,
  onTimeUpdate,
  onDurationChange,
  onClipEnded,
  seiData: _seiData,
  speedUnit,
  overlayPosition,
  showOverlay,
  showGMeter,
  showAccelChart,
  showPedalChart,
  showSpeedChart,
  showAccelDebug,
  showMap,
  currentTime = 0,
  onSetAllCamerasVisible,
  onOverlayDragChange,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRefs = useRef<Map<CameraAngle, CameraViewHandle>>(new Map());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [localSeiData, setLocalSeiData] = useState<SeiMetadata | null>(null);

  // Refs for draggable overlays to avoid StrictMode warnings
  const seiOverlayRef = useRef<HTMLDivElement>(null);
  const chartsOverlayRef = useRef<HTMLDivElement>(null);
  const mapOverlayRef = useRef<HTMLDivElement>(null);

  // Expose seekAll to parent
  useImperativeHandle(ref, () => ({
    seekAll: (time: number) => {
      cameraRefs.current.forEach((handle) => {
        handle.seek(time);
      });
    },
  }), []);

  // Update container size on resize
  useEffect(() => {
    if (!clip) return;

    const el = containerRef.current;
    if (!el) return;

    const setSize = (width: number, height: number) => {
      const nextW = Math.max(0, Math.round(width));
      const nextH = Math.max(0, Math.round(height));
      setContainerSize(prev => {
        if (prev.width !== nextW || prev.height !== nextH) {
          return { width: nextW, height: nextH };
        }
        return prev;
      });
    };

    const measureNow = () => {
      const rect = el.getBoundingClientRect();
      setSize(rect.width, rect.height);
    };

    measureNow();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        setSize(entry.contentRect.width, entry.contentRect.height);
      });
      ro.observe(el);
    }

    window.addEventListener('resize', measureNow);

    let raf = 0;
    const poll = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize(rect.width, rect.height);
        return;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('resize', measureNow);
      if (ro) ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [clip]);

  // Get available cameras from current clip
  const availableCameras = clip
    ? CAMERA_ANGLES.filter(cam => clip.cameras.has(cam))
    : [];

  // Get currently visible + available cameras in a consistent order
  const activeVisibleCameras = useMemo(() => {
    return CAMERA_ANGLES.filter(
      cam => visibleCameras.has(cam) && availableCameras.includes(cam)
    );
  }, [visibleCameras, availableCameras]);

  // Generate layout based on visible cameras
  const layout = useMemo(() => {
    return createLayout(activeVisibleCameras);
  }, [activeVisibleCameras]);

  // Handle time update from primary camera
  const handleTimeUpdate = useCallback((time: number) => {
    onTimeUpdate(time);
  }, [onTimeUpdate]);

  // Handle duration change from first camera
  const handleDurationChange = useCallback((duration: number) => {
    onDurationChange(duration);
  }, [onDurationChange]);

  // Calculate row height
  const totalMargins = (11 * 4) + (4 * 2);
  const availableHeight = containerSize.height > 0 ? containerSize.height : 600;
  const rowHeight = Math.max(40, Math.floor((availableHeight - totalMargins) / 12));

  // Store ref for camera
  const setCameraRef = useCallback((camera: CameraAngle, handle: CameraViewHandle | null) => {
    if (handle) {
      cameraRefs.current.set(camera, handle);
    } else {
      cameraRefs.current.delete(camera);
    }
  }, []);

  if (!clip) {
    return (
      <div className="h-full flex items-center justify-center bg-black/50 rounded-xl">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 text-lg font-medium">No clip selected</p>
          <p className="text-gray-600 text-sm mt-1">Select a clip from the sidebar to start viewing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Camera Toggle Bar */}
      <div className="flex-shrink-0 flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          {onSetAllCamerasVisible && (
            <button
              onClick={() => {
                const allVisible = availableCameras.every(cam => visibleCameras.has(cam));
                onSetAllCamerasVisible(!allVisible);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white/[0.03] text-white/40 hover:bg-white/10 hover:text-white/80 border border-white/[0.05] flex items-center gap-1.5 group"
            >
              <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
              {availableCameras.every(cam => visibleCameras.has(cam)) ? "Hide All" : "Show All"}
            </button>
          )}

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          {CAMERA_ANGLES.map((camera) => {
            const isAvailable = availableCameras.includes(camera);
            const isVisible = visibleCameras.has(camera);

            return (
              <button
                key={camera}
                onClick={() => onToggleCamera(camera)}
                disabled={!isAvailable}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${!isAvailable
                    ? 'opacity-30 cursor-not-allowed bg-gray-800 text-gray-500'
                    : isVisible
                      ? 'bg-tesla-red text-white shadow-lg shadow-tesla-red/20'
                      : 'bg-white/[0.03] text-white/40 hover:bg-white/10 hover:text-white/60 border border-white/[0.05]'
                  }
                `}
                title={isAvailable ? `Toggle ${CAMERA_LABELS[camera]}` : `${CAMERA_LABELS[camera]} not available`}
              >
                {CAMERA_LABELS[camera]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Video Grid */}
      <div
        ref={containerRef}
        onDoubleClick={() => {
          if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch((err) => {
              console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
          } else {
            document.exitFullscreen();
          }
        }}
        className="flex-1 min-h-0 relative bg-black rounded-xl overflow-hidden cursor-pointer"
      >
        {activeVisibleCameras.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            <p className="font-medium">All cameras hidden</p>
            <p className="text-sm opacity-60">Enable a camera above to view</p>
          </div>
        ) : !clip ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-8 opacity-40">
              <svg className="w-24 h-24 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-400 mb-2">Ready to Watch</h3>
              <p className="text-gray-500">Select a clip from the sidebar to start playback</p>
            </div>
          </div>
        ) : containerSize.width === 0 || containerSize.height === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-pulse text-gray-600 font-medium tracking-wider text-xs uppercase">
              Initializing Layout...
            </div>
          </div>
        ) : layout.length > 0 ? (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={rowHeight}
            width={containerSize.width}
            isDraggable={false}
            isResizable={false}
            compactType={null}
            preventCollision={false}
            isBounded={true}
            margin={[4, 4]}
            containerPadding={[4, 4]}
          >
            {layout.map((_item, index) => {
              const camera = layout[index].i as CameraAngle;
              const cameraFile = clip.cameras.get(camera);
              const isPrimary = index === 0;

              return (
                <div
                  key={camera}
                  className="bg-gray-900 rounded-lg overflow-hidden group/camera relative"
                  style={{ width: '100%', height: '100%' }}
                >

                  <CameraView
                    ref={(handle) => setCameraRef(camera, handle)}
                    camera={camera}
                    file={cameraFile?.file || null}
                    isPlaying={isPlaying}
                    playbackSpeed={playbackSpeed}
                    initialTime={currentTime}
                    onSeiData={isPrimary ? setLocalSeiData : undefined}
                    onDurationChange={isPrimary ? handleDurationChange : undefined}
                    onTimeUpdate={isPrimary ? handleTimeUpdate : undefined}
                    onEnded={isPrimary ? onClipEnded : undefined}
                  />
                </div>
              );
            })}
          </GridLayout>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">Preparing layout…</p>
          </div>
        )}


        {/* SEI Overlay (Centered at top by default) */}
        {showOverlay && localSeiData && (
          <Draggable
            bounds="parent"
            nodeRef={seiOverlayRef}
            onStart={() => onOverlayDragChange?.(true)}
            onStop={() => onOverlayDragChange?.(false)}
          >
            <div
              ref={seiOverlayRef}
              className="absolute top-6 left-1/2 z-30 cursor-move pointer-events-auto"
            >
              {/* Internal wrapper to handle centering without interfering with Draggable's transform */}
              <div className="-translate-x-1/2">
                <SeiOverlay data={localSeiData} speedUnit={speedUnit} position={overlayPosition} />
              </div>
            </div>
          </Draggable>
        )}

        {/* G-Force Overlays - horizontal layout, positioned to minimize video blocking */}
        {localSeiData && (showGMeter || showAccelChart || showPedalChart || showSpeedChart || showAccelDebug) && (
          <Draggable
            bounds="parent"
            nodeRef={chartsOverlayRef}
            onStart={() => onOverlayDragChange?.(true)}
            onStop={() => onOverlayDragChange?.(false)}
          >
            <div
              ref={chartsOverlayRef}
              className={`absolute z-20 cursor-move flex gap-2 items-start ${overlayPosition === 'top-left' ? 'top-4 right-4' :
                overlayPosition === 'top-right' ? 'top-4 left-4' :
                  overlayPosition === 'bottom-right' ? 'bottom-4 left-4 items-end' :
                    'bottom-4 right-4 items-end' // opposite of default bottom-left
                }`}
            >
              {/* G-Meter on the left - align to top of container */}
              {showGMeter && (
                <div className="self-start">
                  <GMeter data={localSeiData} paused={!isPlaying} videoTimestamp={currentTime * 1000} />
                </div>
              )}

              {/* Charts stacked vertically on the right */}
              {(showAccelChart || showPedalChart || showSpeedChart || showAccelDebug) && (
                <div className="flex flex-col gap-2">
                  {showAccelChart && <AccelChart data={localSeiData} paused={!isPlaying} videoTimestamp={currentTime * 1000} />}
                  {showPedalChart && <PedalChart data={localSeiData} paused={!isPlaying} videoTimestamp={currentTime * 1000} />}
                  {showSpeedChart && <SpeedChart data={localSeiData} speedUnit={speedUnit} paused={!isPlaying} videoTimestamp={currentTime * 1000} />}
                  {showAccelDebug && <AccelDebugOverlay data={localSeiData} />}
                </div>
              )}
            </div>
          </Draggable>
        )}

        {/* Map Overlay */}
        {showMap && localSeiData && (
          <Draggable
            bounds="parent"
            nodeRef={mapOverlayRef}
            handle=".map-drag-handle"
            onStart={() => onOverlayDragChange?.(true)}
            onStop={() => onOverlayDragChange?.(false)}
          >
            <div
              ref={mapOverlayRef}
              className={`absolute z-20 ${overlayPosition === 'top-left' ? 'bottom-4 right-4' :
                overlayPosition === 'top-right' ? 'bottom-4 left-4' :
                  overlayPosition === 'bottom-right' ? 'top-4 left-4' :
                    'top-4 right-4' // opposite of default bottom-left
                }`}
            >
              <MapOverlay data={localSeiData} position={overlayPosition} />
            </div>
          </Draggable>
        )}
      </div>
    </div>
  );
});
