/**
 * VideoPlayer Component
 * Multi-camera grid with synchronized playback
 */

import { useEffect, useRef, useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { ClipGroup, CameraAngle, SeiMetadata, SpeedUnit } from '../../types';
import { CAMERA_ANGLES, CAMERA_LABELS } from '../../types';
import { CameraView, CameraViewHandle } from './CameraView';
import { SeiOverlay, AccelDebugOverlay, GMeter, AccelChart, PedalChart, SpeedChart } from '../Overlay/SeiOverlay';
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
  currentTime?: number; // Current playback time in ms for charts
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
  currentTime = 0,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRefs = useRef<Map<CameraAngle, CameraViewHandle>>(new Map());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [customLayout, setCustomLayout] = useState<GridLayout.Layout[] | null>(null);
  const [localSeiData, setLocalSeiData] = useState<SeiMetadata | null>(null);

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
    if (customLayout && customLayout.length === activeVisibleCameras.length) {
      const customCameras = new Set(customLayout.map(l => l.i));
      if (activeVisibleCameras.every(cam => customCameras.has(cam))) {
        return customLayout;
      }
    }
    const generatedLayout = createLayout(activeVisibleCameras);
    return generatedLayout;
  }, [activeVisibleCameras, customLayout]);

  // Swap-on-drop handler
  const handleDragStop = useCallback((
    _newLayout: GridLayout.Layout[],
    _oldItem: GridLayout.Layout,
    newItem: GridLayout.Layout,
  ) => {
    const current = customLayout ?? layout;
    const movedId = String(newItem.i);
    const moved = current.find(i => String(i.i) === movedId);
    if (!moved) return;

    let targetSlot: GridLayout.Layout | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const slot of current) {
      const dist = Math.abs(slot.x - newItem.x) + Math.abs(slot.y - newItem.y);
      if (dist < bestDist) {
        bestDist = dist;
        targetSlot = slot;
      }
    }
    if (!targetSlot) return;

    if (moved.x === targetSlot.x && moved.y === targetSlot.y) return;

    const occupant = current.find(i => i.x === targetSlot!.x && i.y === targetSlot!.y);

    const next = current.map(i => {
      if (String(i.i) === movedId) {
        return { ...i, x: targetSlot!.x, y: targetSlot!.y };
      }
      if (occupant && String(i.i) === String(occupant.i)) {
        return { ...i, x: moved.x, y: moved.y };
      }
      return i;
    });

    const key = (l: GridLayout.Layout[]) =>
      JSON.stringify(l.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })).sort((a, b) => String(a.i).localeCompare(String(b.i))));

    if (key(next) !== key(current)) {
      setCustomLayout(next);
    }
  }, [customLayout, layout]);

  // Reset custom layout when visible cameras change
  useEffect(() => {
    setCustomLayout(null);
  }, [activeVisibleCameras.length]);

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
      <div className="flex-shrink-0 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
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
                      ? 'bg-tesla-red text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
        className="flex-1 min-h-0 relative bg-black rounded-xl overflow-hidden"
      >
        {activeVisibleCameras.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">No cameras visible. Click a camera button above to show it.</p>
          </div>
        ) : !clip ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">No clip selected.</p>
          </div>
        ) : containerSize.width === 0 || containerSize.height === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">
              Measuring layout… ({containerSize.width}×{containerSize.height})
            </p>
          </div>
        ) : layout.length > 0 ? (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={rowHeight}
            width={containerSize.width}
            onDragStop={handleDragStop}
            isDraggable={true}
            isResizable={false}
            compactType={null}
            preventCollision={false}
            isBounded={true}
            margin={[4, 4]}
            containerPadding={[4, 4]}
          >
            {layout.map((item, index) => {
              const camera = item.i as CameraAngle;
              const cameraFile = clip.cameras.get(camera);
              const isPrimary = index === 0;
              
              return (
                <div 
                  key={camera} 
                  className="bg-gray-900 rounded-lg overflow-hidden cursor-move"
                  style={{ width: '100%', height: '100%' }}
                >
                  <CameraView
                    ref={(handle) => setCameraRef(camera, handle)}
                    camera={camera}
                    file={cameraFile?.file || null}
                    isPlaying={isPlaying}
                    playbackSpeed={playbackSpeed}
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

        {/* SEI Overlay */}
        {showOverlay && localSeiData && (
          <div 
            className={`absolute z-20 pointer-events-none ${
              overlayPosition === 'top-left' ? 'top-4 left-4' :
              overlayPosition === 'top-right' ? 'top-4 right-4' :
              overlayPosition === 'bottom-right' ? 'bottom-4 right-4' :
              'bottom-4 left-4' // default bottom-left
            }`}
          >
            <SeiOverlay data={localSeiData} speedUnit={speedUnit} position={overlayPosition} />
          </div>
        )}

        {/* G-Force Overlays - horizontal layout, positioned to minimize video blocking */}
        {showOverlay && localSeiData && (showGMeter || showAccelChart || showPedalChart || showSpeedChart || showAccelDebug) && (
          <div 
            className={`absolute z-20 pointer-events-none flex gap-2 items-start ${
              overlayPosition === 'top-left' ? 'top-4 right-4' :
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
        )}
      </div>
    </div>
  );
});
