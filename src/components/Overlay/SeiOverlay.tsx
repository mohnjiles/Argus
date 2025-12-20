/**
 * SeiOverlay Component
 * Displays SEI telemetry data as an overlay on the video
 */

import { useRef, useEffect, useCallback } from 'react';
import type { SeiMetadata, SpeedUnit } from '../../types';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import {
  AutopilotState,
  GEAR_LABELS,
  AUTOPILOT_LABELS,
  convertSpeed,
} from '../../types';

import { MiniMap } from '../Map/MiniMap';

interface SeiOverlayProps {
  data: SeiMetadata;
  speedUnit: SpeedUnit;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export function SeiOverlay({ data, speedUnit }: SeiOverlayProps) {

  const speed = convertSpeed(data.vehicleSpeedMps, speedUnit);
  const gear = GEAR_LABELS[data.gearState] || '?';
  const autopilot = data.autopilotState;

  // Log raw speed precision for debugging
  // console.log('Raw speed (m/s):', data.vehicleSpeedMps, '| Converted:', speed.toFixed(3), speedUnit);

  const autopilotLabel = AUTOPILOT_LABELS[autopilot] || 'Unknown';

  // Determine autopilot styling
  const getAutopilotStyle = () => {
    switch (autopilot) {
      case AutopilotState.SELF_DRIVING:
        return 'bg-blue-500 text-white';
      case AutopilotState.AUTOSTEER:
        return 'bg-blue-400 text-white';
      case AutopilotState.TACC:
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-600 text-gray-300';
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-full px-4 py-2 text-white shadow-2xl border border-white/10 pointer-events-auto flex items-center gap-4">
      {/* Group 1: Speed & Gear */}
      <div className="flex items-center gap-3">
        {/* Speed */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums leading-none tracking-tight">{Math.round(speed)}</span>
          <span className="text-[10px] text-gray-400 uppercase font-bold">{speedUnit}</span>
        </div>

        {/* Compact Gear */}
        <div className="w-7 h-7 flex items-center justify-center bg-white/10 rounded-full border border-white/5">
          <span className="text-xs font-black">{gear}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Group 2: Autopilot */}
      <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${getAutopilotStyle()}`}>
        {autopilotLabel}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Group 3: Metrics Row */}
      <div className="flex items-center gap-5">
        {/* Steering */}
        <div className="flex items-center gap-2">
          <SteeringIcon angle={data.steeringWheelAngle} size={16} />
          <span className="text-xs font-bold tabular-nums">{data.steeringWheelAngle.toFixed(0)}°</span>
        </div>

        {/* Accelerator */}
        <div className="flex items-center gap-2 text-green-400">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L4 12h5v10h6V12h5z" />
          </svg>
          <span className="text-xs font-bold tabular-nums">{data.acceleratorPedalPosition.toFixed(0)}%</span>
        </div>

        {/* Brake */}
        <div className={`flex items-center gap-2 ${data.brakeApplied ? 'text-red-500 underline decoration-2 underline-offset-4' : 'text-gray-500'}`}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="8" width="12" height="8" rx="1" />
          </svg>
          <span className="text-xs font-bold">{data.brakeApplied ? 'ON' : 'OFF'}</span>
        </div>

        {/* Turn Signals */}
        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
          <TurnSignal active={data.blinkerOnLeft} direction="left" />
          <TurnSignal active={data.blinkerOnRight} direction="right" />
        </div>
      </div>
    </div>
  );
}

interface MapOverlayProps {
  data: SeiMetadata;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export function MapOverlay({ data }: MapOverlayProps) {
  if (data.latitudeDeg === 0 && data.longitudeDeg === 0) return null;

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-2 text-white shadow-2xl border border-white/10 w-[300px] overflow-hidden">
      {/* Header / Drag Handle */}
      <div className="map-drag-handle flex items-center justify-between gap-2 text-[10px] mb-1.5 px-1 cursor-move hover:bg-white/5 rounded-lg py-1 transition-colors">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-mono text-gray-300 truncate whitespace-nowrap">
            {data.latitudeDeg.toFixed(6)}, {data.longitudeDeg.toFixed(6)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 border-l border-white/10 pl-2">
          <CompassIcon heading={data.headingDeg} />
          <span className="font-mono text-gray-300">{data.headingDeg.toFixed(0)}°</span>
        </div>
      </div>

      <div className="h-48 w-full rounded-lg overflow-hidden border border-white/10 relative z-10 bg-gray-900/50">
        <MiniMap
          lat={data.latitudeDeg}
          long={data.longitudeDeg}
          heading={data.headingDeg}
        />
      </div>
    </div>
  );
}

// Steering wheel icon that rotates using PNG image
function SteeringIcon({ angle, size = 20 }: { angle: number; size?: number }) {
  return (
    <div
      className="flex items-center justify-center bg-gray-700/50 rounded-full"
      style={{ width: size + 8, height: size + 8 }}
    >
      <img
        src="/wheel.png"
        alt="Steering Wheel"
        style={{
          width: size,
          height: size,
          transform: `rotate(${angle}deg)`,
          transition: 'transform 0.1s ease-out',
        }}
        className="brightness-0 invert opacity-80"
      />
    </div>
  );
}

// Turn signal indicator
function TurnSignal({ active, direction }: { active: boolean; direction: 'left' | 'right' }) {
  return (
    <div className={`
      w-3 h-3 rounded transition-all
      ${active
        ? 'bg-amber-400 shadow-md shadow-amber-400/40'
        : 'bg-gray-600/50'
      }
    `}>
      <svg
        className={`w-full h-full ${active ? 'text-amber-900' : 'text-gray-700'}`}
        fill="currentColor"
        viewBox="0 0 24 24"
        style={{ transform: direction === 'left' ? 'scaleX(-1)' : undefined }}
      >
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
      </svg>
    </div>
  );
}

// Compass direction indicator
function CompassIcon({ heading }: { heading: number }) {
  return (
    <div
      className="w-4 h-4 flex items-center justify-center"
      style={{ transform: `rotate(${heading}deg)` }}
    >
      <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L19 21L12 17L5 21L12 2Z" />
      </svg>
    </div>
  );
}

// Compact version for export/smaller displays
export function SeiOverlayCompact({ data }: { data: SeiMetadata }) {
  const speed = convertSpeed(data.vehicleSpeedMps, 'mph');
  const gear = GEAR_LABELS[data.gearState] || '?';
  const autopilot = AUTOPILOT_LABELS[data.autopilotState] || '';

  return (
    <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm flex items-center gap-4">
      <span className="font-bold tabular-nums">{Math.round(speed)} mph</span>
      <span className="text-gray-400">|</span>
      <span className="font-medium">{gear}</span>
      {data.autopilotState !== AutopilotState.NONE && (
        <>
          <span className="text-gray-400">|</span>
          <span className="text-blue-400 font-medium">{autopilot}</span>
        </>
      )}
      {data.blinkerOnLeft && <span className="text-amber-400">◀</span>}
      {data.blinkerOnRight && <span className="text-amber-400">▶</span>}
      {data.brakeApplied && <span className="text-red-400">●</span>}
    </div>
  );
}

// Constants for G-force conversion
const GRAVITY = 9.81; // m/s²

// Convert m/s² to G-force
function toG(mps2: number): number {
  return mps2 / GRAVITY;
}

// Get color based on G-force magnitude
function getGColor(g: number): string {
  const absG = Math.abs(g);
  if (absG < 0.3) return 'text-green-400';
  if (absG < 0.6) return 'text-yellow-400';
  if (absG < 1.0) return 'text-orange-400';
  return 'text-red-400';
}

// Debug overlay for acceleration data exploration
export function AccelDebugOverlay({ data }: { data: SeiMetadata }) {
  const gX = toG(data.linearAccelerationMps2X);
  const gY = toG(data.linearAccelerationMps2Y);
  const gZ = toG(data.linearAccelerationMps2Z);

  // Calculate total G magnitude (useful for detecting if gravity is included)
  const totalG = Math.sqrt(gX * gX + gY * gY + gZ * gZ);

  return (
    <div className="bg-black/85 backdrop-blur-md rounded-xl p-4 text-white shadow-2xl border border-white/10 min-w-[220px]">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-sm font-semibold text-gray-300">Acceleration Debug</span>
      </div>

      <div className="space-y-2 font-mono text-sm">
        {/* X Axis */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">X (Long):</span>
          <div className="text-right">
            <span className={`font-semibold ${getGColor(gX)}`}>
              {gX >= 0 ? '+' : ''}{gX.toFixed(3)} G
            </span>
            <span className="text-gray-500 text-xs ml-2">
              ({data.linearAccelerationMps2X.toFixed(2)} m/s²)
            </span>
          </div>
        </div>

        {/* Y Axis */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Y (Lat):</span>
          <div className="text-right">
            <span className={`font-semibold ${getGColor(gY)}`}>
              {gY >= 0 ? '+' : ''}{gY.toFixed(3)} G
            </span>
            <span className="text-gray-500 text-xs ml-2">
              ({data.linearAccelerationMps2Y.toFixed(2)} m/s²)
            </span>
          </div>
        </div>

        {/* Z Axis */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Z (Vert):</span>
          <div className="text-right">
            <span className={`font-semibold ${getGColor(gZ - 1)}`}>
              {gZ >= 0 ? '+' : ''}{gZ.toFixed(3)} G
            </span>
            <span className="text-gray-500 text-xs ml-2">
              ({data.linearAccelerationMps2Z.toFixed(2)} m/s²)
            </span>
          </div>
        </div>

        {/* Total magnitude - helps identify if gravity is included */}
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/10">
          <span className="text-gray-400">Total:</span>
          <span className="font-semibold text-purple-400">
            {totalG.toFixed(3)} G
          </span>
        </div>
      </div>

      {/* Hint about what to look for */}
      <div className="mt-3 pt-2 border-t border-white/10 text-xs text-gray-500">
        <p>💡 If Z ≈ 1G when parked → raw (includes gravity)</p>
        <p>💡 If Z ≈ 0G when parked → compensated</p>
      </div>
    </div>
  );
}

// Get color for G-force dot based on magnitude with more premium colors
function getGDotColor(g: number): string {
  if (g < 0.2) return '#4ade80'; // Emerald/Green
  if (g < 0.4) return '#fbbf24'; // Amber/Yellow
  if (g < 0.7) return '#f97316'; // Orange
  return '#ef4444';               // Red
}

// Smooth interpolation factor (0-1, higher = faster response)
const SMOOTHING = 0.15;

// Lerp helper
function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

// Circular G-Meter visualization with smooth animation
export function GMeter({ data, paused = false, videoTimestamp }: { data: SeiMetadata; paused?: boolean; videoTimestamp?: number }) {
  const trailRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const peakRef = useRef<{ x: number; y: number; magnitude: number }>({ x: 0, y: 0, magnitude: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastVideoTimestampRef = useRef<number | undefined>(undefined);
  const pauseTimeRef = useRef<number>(0);
  const wasPausedRef = useRef<boolean>(false);

  // Smooth animation state - displayed position interpolates toward target
  const displayPosRef = useRef({ lat: 0, long: 0 });
  const targetPosRef = useRef({ lat: 0, long: 0 });
  const displayMagnitudeRef = useRef(0);

  // Convert to G and apply Tesla's coordinate system
  // Display shows the force you FEEL (opposite of motion direction):
  // - Left turn → you feel pushed RIGHT → dot goes right
  // - Braking → you feel pushed FORWARD → dot goes up
  const gLat = -toG(data.linearAccelerationMps2X);  // Flip for intuitive display
  const gLong = toG(data.linearAccelerationMps2Y);  // Flip for intuitive display
  const magnitude = Math.sqrt(gLong * gLong + gLat * gLat);

  // Detect clip jumps/discontinuities (when videoTimestamp jumps backward or forward significantly)
  useEffect(() => {
    if (videoTimestamp !== undefined && lastVideoTimestampRef.current !== undefined) {
      const timeDiff = Math.abs(videoTimestamp - lastVideoTimestampRef.current);
      // If time jumped more than 2 seconds, clear history (clip change or seek)
      if (timeDiff > 2000) {
        trailRef.current = [];
        peakRef.current = { x: 0, y: 0, magnitude: 0 };
      }
    }
    lastVideoTimestampRef.current = videoTimestamp;
  }, [videoTimestamp]);

  // Update target position when data changes
  useEffect(() => {
    targetPosRef.current = { lat: gLat, long: gLong };

    // Only update trail and peak when not paused
    if (!paused) {
      // Update trail with actual data (not smoothed)
      const now = Date.now();
      trailRef.current.push({ x: gLat, y: gLong, time: now });
      trailRef.current = trailRef.current.filter(p => now - p.time < 1000);

      // Update peak if current is higher (peak never decays - sticks until exceeded)
      if (magnitude > peakRef.current.magnitude) {
        peakRef.current = { x: gLat, y: gLong, magnitude };
      }
    }
  }, [gLat, gLong, magnitude, paused]);

  // Canvas draw function - memoized for performance
  const drawGMeter = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const realNow = Date.now();

    // Handle pause/unpause transitions
    if (paused && !wasPausedRef.current) {
      pauseTimeRef.current = realNow;
      wasPausedRef.current = true;
    } else if (!paused && wasPausedRef.current) {
      wasPausedRef.current = false;
    }

    // Use frozen time when paused, real time when playing
    const now = paused ? pauseTimeRef.current : realNow;

    // Only interpolate and update if not paused
    if (!paused) {
      // Smoothly interpolate toward target
      displayPosRef.current.lat = lerp(displayPosRef.current.lat, targetPosRef.current.lat, SMOOTHING);
      displayPosRef.current.long = lerp(displayPosRef.current.long, targetPosRef.current.long, SMOOTHING);
    }

    const size = 120;
    const center = size / 2;
    const maxG = 1.0;
    const scale = (center - 12) / maxG;

    const displayLat = displayPosRef.current.lat;
    const displayLong = displayPosRef.current.long;
    const displayMag = Math.sqrt(displayLat * displayLat + displayLong * displayLong);
    if (!paused) {
      displayMagnitudeRef.current = lerp(displayMagnitudeRef.current, displayMag, SMOOTHING);
    }

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Clear and draw background
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, 'rgba(10, 10, 10, 0.4)');
    gradient.addColorStop(1, 'rgba(10, 10, 10, 0.6)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();

    // Draw grid rings
    const ringGs = [0.25, 0.5, 0.75, 1.0];
    ringGs.forEach((g, i) => {
      ctx.strokeStyle = i === 3 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = i === 3 ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(center, center, g * scale, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw crosshairs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center, 10);
    ctx.lineTo(center, size - 10);
    ctx.moveTo(10, center);
    ctx.lineTo(size - 10, center);
    ctx.stroke();

    // Draw labels - premium styling
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '900 8px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('BRK', center, 14);
    ctx.fillText('ACC', center, size - 6);
    ctx.textAlign = 'left';
    ctx.fillText('L', 8, center + 3);
    ctx.textAlign = 'right';
    ctx.fillText('R', size - 8, center + 3);

    // Draw trail (fading) - uses actual data points
    const trail = trailRef.current;
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const p = trail[i];
        const age = (now - p.time) / 1000;
        const alpha = Math.max(0, 0.4 - age * 0.4);

        const x = center + p.x * scale;
        const y = center - p.y * scale;

        ctx.fillStyle = `rgba(147, 51, 234, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw peak indicator
    if (peakRef.current.magnitude > 0.1) {
      const peakX = center + peakRef.current.x * scale;
      const peakY = center - peakRef.current.y * scale;
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(peakX, peakY, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw current position dot - uses SMOOTHED position
    const dotX = center + displayLat * scale;
    const dotY = center - displayLong * scale;
    const dotColor = getGDotColor(displayMagnitudeRef.current);

    // Glow effect - more intense for premium feel
    ctx.shadowBlur = 15;
    ctx.shadowColor = dotColor;

    const dotGradient = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 12);
    dotGradient.addColorStop(0, dotColor);
    dotGradient.addColorStop(0.4, dotColor + '88');
    dotGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = dotGradient;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Solid dot with inner shine
    ctx.shadowBlur = 0;
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Core shine
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(dotX, dotY, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }, [paused]);

  // Animation loop - automatically stops when paused
  useAnimationFrame(drawGMeter, !paused);

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-2.5 text-white shadow-2xl border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">G-FORCE</span>
        <span
          className="text-xs font-black tabular-nums filter drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]"
          style={{ color: getGDotColor(magnitude) }}
        >
          {magnitude.toFixed(2)}<span className="text-[9px] ml-0.5 opacity-70">G</span>
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={120}
        height={120}
        className="block"
      />

      {/* Values row */}
      <div className="flex justify-between mt-1.5 text-[9px]">
        <div className="text-center">
          <div className="text-gray-500">Long</div>
          <div className={`font-mono font-bold ${gLong >= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {gLong >= 0 ? '+' : ''}{gLong.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Lat</div>
          <div className="font-mono font-bold text-blue-400">
            {gLat >= 0 ? '+' : ''}{gLat.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Peak</div>
          <div className="font-mono font-bold text-orange-400">
            {peakRef.current.magnitude.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Time-series chart for acceleration data
const CHART_HISTORY_SECONDS = 10;
const CHART_SAMPLE_RATE = 30; // samples per second

export function AccelChart({ data, paused = false, videoTimestamp }: { data: SeiMetadata; paused?: boolean; videoTimestamp?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<{ long: number; lat: number; time: number }[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const targetRef = useRef({ long: 0, lat: 0 });
  const lastVideoTimestampRef = useRef<number | undefined>(undefined);
  const pauseTimeRef = useRef<number>(0);
  const wasPausedRef = useRef<boolean>(false);

  // Convert to G
  const gLat = -toG(data.linearAccelerationMps2X);
  const gLong = toG(data.linearAccelerationMps2Y);

  // Detect clip jumps/discontinuities
  useEffect(() => {
    if (videoTimestamp !== undefined && lastVideoTimestampRef.current !== undefined) {
      const timeDiff = Math.abs(videoTimestamp - lastVideoTimestampRef.current);
      if (timeDiff > 2000) {
        historyRef.current = [];
      }
    }
    lastVideoTimestampRef.current = videoTimestamp;
  }, [videoTimestamp]);

  // Update target values when data changes
  useEffect(() => {
    targetRef.current = { long: gLong, lat: gLat };
  }, [gLong, gLat]);

  // Canvas draw function
  const drawAccelChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 200;
    const height = 100;
    const maxG = 1.0;

    const realNow = Date.now();

    // Handle pause/unpause transitions
    if (paused && !wasPausedRef.current) {
      pauseTimeRef.current = realNow;
      wasPausedRef.current = true;
    } else if (!paused && wasPausedRef.current) {
      wasPausedRef.current = false;
    }

    // Use frozen time when paused, real time when playing
    const now = paused ? pauseTimeRef.current : realNow;

    // Only update values when not paused
    if (!paused) {
      const minInterval = 1000 / CHART_SAMPLE_RATE;
      if (now - lastSampleTimeRef.current >= minInterval) {
        historyRef.current.push({
          long: targetRef.current.long,
          lat: targetRef.current.lat,
          time: now
        });
        lastSampleTimeRef.current = now;

        // Keep only last N seconds
        const cutoff = now - (CHART_HISTORY_SECONDS * 1000);
        historyRef.current = historyRef.current.filter(p => p.time > cutoff);
      }
    }

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'rgba(20, 20, 20, 0.4)';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 8);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Minimal padding
    const pad = 4;
    const chartWidth = width - pad * 2;
    const chartHeight = height - pad * 2;
    const zeroY = pad + chartHeight / 2;

    // Zero line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, zeroY);
    ctx.lineTo(width - pad, zeroY);
    ctx.stroke();

    // Draw data
    const history = historyRef.current;
    if (history.length >= 2) {
      const timeRange = CHART_HISTORY_SECONDS * 1000;

      const toCanvasX = (time: number) => {
        const timeOffset = now - time;
        return width - pad - (timeOffset / timeRange) * chartWidth;
      };

      const toCanvasY = (g: number) => {
        const clamped = Math.max(-maxG, Math.min(maxG, g));
        return zeroY - (clamped / maxG) * (chartHeight / 2);
      };

      // Draw area fills for LON and LAT
      // LON (Red) area
      ctx.beginPath();
      const lonGradient = ctx.createLinearGradient(0, zeroY - (chartHeight / 2), 0, zeroY + (chartHeight / 2));
      lonGradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
      lonGradient.addColorStop(0.5, 'rgba(239, 68, 68, 0)');
      lonGradient.addColorStop(1, 'rgba(239, 68, 68, 0.1)');
      ctx.fillStyle = lonGradient;
      let firstX = toCanvasX(history[0].time);
      ctx.moveTo(firstX, zeroY);
      history.forEach(p => ctx.lineTo(toCanvasX(p.time), toCanvasY(p.long)));
      ctx.lineTo(toCanvasX(history[history.length - 1].time), zeroY);
      ctx.closePath();
      ctx.fill();

      // LAT (Blue) area
      ctx.beginPath();
      const latGradient = ctx.createLinearGradient(0, zeroY - (chartHeight / 2), 0, zeroY + (chartHeight / 2));
      latGradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
      latGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0)');
      latGradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
      ctx.fillStyle = latGradient;
      ctx.moveTo(firstX, zeroY);
      history.forEach(p => ctx.lineTo(toCanvasX(p.time), toCanvasY(p.lat)));
      ctx.lineTo(toCanvasX(history[history.length - 1].time), zeroY);
      ctx.closePath();
      ctx.fill();

      // Draw longitudinal (red) with glowing line
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      let started = false;
      history.forEach(p => {
        const x = toCanvasX(p.time);
        const y = toCanvasY(p.long);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw lateral (blue) with glowing line
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      started = false;
      history.forEach(p => {
        const x = toCanvasX(p.time);
        const y = toCanvasY(p.lat);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Compact legend - Updated to clarify G-Forces
    ctx.font = '900 9px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const legendTitle = 'G-FORCES';
    const titleWidth = ctx.measureText(legendTitle).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(pad, pad, titleWidth + 6, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(legendTitle, pad + 2, pad + 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(pad, pad + 14, 60, 12);

    ctx.fillStyle = '#ef4444';
    ctx.fillText('LON', pad + 2, pad + 16);
    const lonWidth = ctx.measureText('LON').width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(' / ', pad + 2 + lonWidth, pad + 16);
    const slashWidth = ctx.measureText(' / ').width;
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('LAT', pad + 2 + lonWidth + slashWidth, pad + 16);
  }, [paused]);

  // Animation loop - automatically stops when paused
  useAnimationFrame(drawAccelChart, !paused);

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-1.5 text-white shadow-2xl border border-white/10">
      <canvas
        ref={canvasRef}
        width={180}
        height={80}
        className="block rounded"
      />
    </div>
  );
}

// Pedal input chart (throttle & brake)
export function PedalChart({ data, paused = false, videoTimestamp }: { data: SeiMetadata; paused?: boolean; videoTimestamp?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<{ throttle: number; brake: boolean; time: number }[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const targetRef = useRef({ throttle: 0, brake: false });
  const lastVideoTimestampRef = useRef<number | undefined>(undefined);
  const pauseTimeRef = useRef<number>(0);
  const wasPausedRef = useRef<boolean>(false);

  const throttle = data.acceleratorPedalPosition;
  const brake = data.brakeApplied;

  useEffect(() => {
    if (videoTimestamp !== undefined && lastVideoTimestampRef.current !== undefined) {
      const timeDiff = Math.abs(videoTimestamp - lastVideoTimestampRef.current);
      if (timeDiff > 2000) {
        historyRef.current = [];
      }
    }
    lastVideoTimestampRef.current = videoTimestamp;
  }, [videoTimestamp]);

  useEffect(() => {
    targetRef.current = { throttle, brake };
  }, [throttle, brake]);

  const drawPedalChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 180;
    const height = 80;
    const realNow = Date.now();

    if (paused && !wasPausedRef.current) {
      pauseTimeRef.current = realNow;
      wasPausedRef.current = true;
    } else if (!paused && wasPausedRef.current) {
      wasPausedRef.current = false;
    }

    const now = paused ? pauseTimeRef.current : realNow;

    if (!paused) {
      const minInterval = 1000 / CHART_SAMPLE_RATE;
      if (now - lastSampleTimeRef.current >= minInterval) {
        historyRef.current.push({
          throttle: targetRef.current.throttle,
          brake: targetRef.current.brake,
          time: now
        });
        lastSampleTimeRef.current = now;
        const cutoff = now - (CHART_HISTORY_SECONDS * 1000);
        historyRef.current = historyRef.current.filter(p => p.time > cutoff);
      }
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(10, 10, 10, 0.4)';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const pad = 5;
    const chartWidth = width - pad * 2;
    const chartHeight = height - pad * 2;
    const history = historyRef.current;

    if (history.length >= 2) {
      const timeRange = CHART_HISTORY_SECONDS * 1000;
      const toCanvasX = (time: number) => width - pad - ((now - time) / timeRange) * chartWidth;
      const toCanvasY = (throttle: number) => pad + chartHeight - (throttle / 100) * chartHeight;

      // Brake applied background pulse
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      for (let i = 0; i < history.length - 1; i++) {
        const p1 = history[i];
        const p2 = history[i + 1];
        if (p1.brake) {
          const x1 = toCanvasX(p1.time);
          const x2 = toCanvasX(p2.time);
          ctx.fillRect(Math.min(x1, x2), pad, Math.abs(x2 - x1), chartHeight);
        }
      }

      // Throttle area gradient
      ctx.beginPath();
      const throttleGrad = ctx.createLinearGradient(0, pad, 0, pad + chartHeight);
      throttleGrad.addColorStop(0, 'rgba(74, 222, 128, 0.25)');
      throttleGrad.addColorStop(1, 'rgba(74, 222, 128, 0)');
      ctx.fillStyle = throttleGrad;
      const initialX = toCanvasX(history[0].time);
      ctx.moveTo(initialX, pad + chartHeight);
      history.forEach(p => ctx.lineTo(toCanvasX(p.time), toCanvasY(p.throttle)));
      ctx.lineTo(toCanvasX(history[history.length - 1].time), pad + chartHeight);
      ctx.closePath();
      ctx.fill();

      // Throttle glowing line
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(74, 222, 128, 0.5)';
      ctx.beginPath();
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2.5;
      let started = false;
      history.forEach(p => {
        const x = toCanvasX(p.time);
        const y = toCanvasY(p.throttle);
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.font = '900 9px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const legendText = 'PEDALS';
    const textWidth = ctx.measureText(legendText).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(pad, pad, textWidth + 6, 12);
    ctx.fillStyle = 'white';
    ctx.fillText(legendText, pad + 2, pad + 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(pad, pad + 14, 60, 12);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('THR', pad + 2, pad + 16);
    const thrWidth = ctx.measureText('THR').width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(' / ', pad + 2 + thrWidth, pad + 16);
    const slashWidth = ctx.measureText(' / ').width;
    ctx.fillStyle = '#ef4444';
    ctx.fillText('BRK', pad + 2 + thrWidth + slashWidth, pad + 16);
  }, [paused]);

  useAnimationFrame(drawPedalChart, !paused);

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-1.5 text-white shadow-2xl border border-white/10">
      <canvas
        ref={canvasRef}
        width={180}
        height={80}
        className="block rounded"
      />
    </div>
  );
}

// Speed chart showing velocity over time
export function SpeedChart({ data, speedUnit, paused = false, videoTimestamp }: { data: SeiMetadata; speedUnit: SpeedUnit; paused?: boolean; videoTimestamp?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<{ speed: number; time: number }[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const targetRef = useRef({ speed: 0 });
  const lastVideoTimestampRef = useRef<number | undefined>(undefined);
  const pauseTimeRef = useRef<number>(0);
  const wasPausedRef = useRef<boolean>(false);

  const speed = convertSpeed(data.vehicleSpeedMps, speedUnit);

  useEffect(() => {
    if (videoTimestamp !== undefined && lastVideoTimestampRef.current !== undefined) {
      const timeDiff = Math.abs(videoTimestamp - lastVideoTimestampRef.current);
      if (timeDiff > 2000) {
        historyRef.current = [];
      }
    }
    lastVideoTimestampRef.current = videoTimestamp;
  }, [videoTimestamp]);

  useEffect(() => {
    targetRef.current = { speed };
  }, [speed]);

  const drawSpeedChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 180;
    const height = 80;
    const realNow = Date.now();

    if (paused && !wasPausedRef.current) {
      pauseTimeRef.current = realNow;
      wasPausedRef.current = true;
    } else if (!paused && wasPausedRef.current) {
      wasPausedRef.current = false;
    }

    const now = paused ? pauseTimeRef.current : realNow;

    if (!paused) {
      const minInterval = 1000 / CHART_SAMPLE_RATE;
      if (now - lastSampleTimeRef.current >= minInterval) {
        historyRef.current.push({ speed: targetRef.current.speed, time: now });
        lastSampleTimeRef.current = now;
        const cutoff = now - (CHART_HISTORY_SECONDS * 1000);
        historyRef.current = historyRef.current.filter(p => p.time > cutoff);
      }
    }

    const maxSpeed = Math.max(speedUnit === 'mph' ? 80 : 130, ...historyRef.current.map(p => p.speed));

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(20, 20, 20, 0.4)';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const pad = 4;
    const chartWidth = width - pad * 2;
    const chartHeight = height - pad * 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    const gridSpeeds = speedUnit === 'mph' ? [40, 80] : [60, 120];
    gridSpeeds.forEach(spd => {
      const y = pad + chartHeight - (spd / maxSpeed) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
    });

    const history = historyRef.current;
    if (history.length >= 2) {
      const timeRange = CHART_HISTORY_SECONDS * 1000;
      const toCanvasX = (time: number) => width - pad - ((now - time) / timeRange) * chartWidth;
      const toCanvasY = (spd: number) => pad + chartHeight - (Math.min(spd, maxSpeed) / maxSpeed) * chartHeight;

      if (history.length > 0) {
        const gradient = ctx.createLinearGradient(0, pad, 0, height - pad);
        gradient.addColorStop(0, 'rgba(34, 211, 238, 0.25)');
        gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.beginPath();
        ctx.fillStyle = gradient;
        const firstX = toCanvasX(history[0].time);
        const firstY = toCanvasY(history[0].speed);
        ctx.moveTo(firstX, height - pad);
        ctx.lineTo(firstX, firstY);
        history.forEach(p => ctx.lineTo(toCanvasX(p.time), toCanvasY(p.speed)));
        const lastX = toCanvasX(history[history.length - 1].time);
        ctx.lineTo(lastX, height - pad);
        ctx.closePath();
        ctx.fill();
      }

      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(34, 211, 238, 0.5)';
      ctx.beginPath();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      let started = false;
      history.forEach(p => {
        const x = toCanvasX(p.time);
        const y = toCanvasY(p.speed);
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.font = '900 9px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const legendText = `SPEED (${speedUnit.toUpperCase()})`;
    const textWidth = ctx.measureText(legendText).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(pad, pad, textWidth + 6, 12);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(legendText, pad + 2, pad + 2);
  }, [speedUnit, paused]);

  useAnimationFrame(drawSpeedChart, !paused);

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-1.5 text-white shadow-2xl border border-white/10">
      <canvas
        ref={canvasRef}
        width={180}
        height={80}
        className="block rounded"
      />
    </div>
  );
}

