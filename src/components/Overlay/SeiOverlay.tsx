/**
 * SeiOverlay Component
 * Displays SEI telemetry data as an overlay on the video
 */

import { useRef, useEffect } from 'react';
import type { SeiMetadata, SpeedUnit } from '../../types';
import { 
  AutopilotState, 
  GEAR_LABELS, 
  AUTOPILOT_LABELS,
  convertSpeed,
} from '../../types';

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
    <div className="bg-black/85 backdrop-blur-md rounded-xl p-4 text-white shadow-2xl border border-white/10 min-w-[280px]">
      {/* Header Row: Speed + Gear + Autopilot */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
        {/* Speed */}
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold tabular-nums leading-none">{Math.round(speed)}</span>
            <span className="text-sm text-gray-400 uppercase font-medium">{speedUnit}</span>
          </div>
        </div>

        {/* Gear */}
        <div className="w-14 h-11 flex items-center justify-center bg-gray-700/80 rounded-lg">
          <span className="text-xl font-bold">{gear}</span>
        </div>

        {/* Autopilot State */}
        <div className={`px-3 h-11 flex items-center justify-center rounded-lg text-xs font-semibold whitespace-nowrap ${getAutopilotStyle()}`}>
          {autopilotLabel}
        </div>
      </div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Steering */}
        <div className="flex items-center gap-2.5">
          <SteeringIcon angle={data.steeringWheelAngle} />
          <div className="flex-1">
            <div className="text-gray-400 text-xs font-medium">Steering</div>
            <div className="font-semibold tabular-nums">{data.steeringWheelAngle.toFixed(1)}°</div>
          </div>
        </div>

        {/* Accelerator */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center bg-gray-700/50 rounded-lg">
            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 12h5v10h6V12h5z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-gray-400 text-xs font-medium">Throttle</div>
            <div className="font-semibold tabular-nums">{data.acceleratorPedalPosition.toFixed(0)}%</div>
          </div>
        </div>

        {/* Brake */}
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            data.brakeApplied ? 'bg-red-500' : 'bg-gray-700/50'
          }`}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="8" width="12" height="8" rx="1" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-gray-400 text-xs font-medium">Brake</div>
            <div className={`font-semibold ${data.brakeApplied ? 'text-red-400' : 'text-gray-300'}`}>
              {data.brakeApplied ? 'Applied' : 'Released'}
            </div>
          </div>
        </div>

        {/* Turn Signals */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center gap-0.5">
            <TurnSignal active={data.blinkerOnLeft} direction="left" />
            <TurnSignal active={data.blinkerOnRight} direction="right" />
          </div>
          <div className="flex-1">
            <div className="text-gray-400 text-xs font-medium">Signals</div>
            <div className="font-semibold">
              {data.blinkerOnLeft && data.blinkerOnRight 
                ? 'Hazard' 
                : data.blinkerOnLeft 
                  ? 'Left' 
                  : data.blinkerOnRight 
                    ? 'Right' 
                    : 'Off'}
            </div>
          </div>
        </div>
      </div>

      {/* GPS Section */}
      {(data.latitudeDeg !== 0 || data.longitudeDeg !== 0) && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-mono text-gray-300">
              {data.latitudeDeg.toFixed(6)}, {data.longitudeDeg.toFixed(6)}
            </span>
            <span className="text-gray-500">|</span>
            <CompassIcon heading={data.headingDeg} />
            <span className="font-mono text-gray-300">{data.headingDeg.toFixed(0)}°</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Steering wheel icon that rotates using PNG image
function SteeringIcon({ angle }: { angle: number }) {
  // Tesla steering wheels have ~900° of rotation (2.5 turns lock-to-lock)
  // Show the full rotation without clamping
  return (
    <div 
      className="w-7 h-7 flex items-center justify-center bg-gray-700/50 rounded-lg"
      style={{ 
        transform: `rotate(${angle}deg)`,
        // Smooth out the rotation with a longer transition and cubic-bezier easing
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform',
      }}
    >
      <img 
        src="/wheel.png" 
        alt="Steering wheel" 
        className="w-5 h-5 object-contain opacity-90"
        draggable={false}
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

// Get color for G-force dot based on magnitude
function getGDotColor(g: number): string {
  if (g < 0.25) return '#4ade80'; // green-400
  if (g < 0.5) return '#facc15';  // yellow-400
  if (g < 0.75) return '#fb923c'; // orange-400
  return '#f87171';               // red-400
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
  const rafRef = useRef<number>(0);
  
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
  
  // Animation loop - runs at 60fps for smooth display
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = 140;
    const center = size / 2;
    const maxG = 1.0;
    const scale = (center - 15) / maxG;
    
    const animate = () => {
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
      
      const displayLat = displayPosRef.current.lat;
      const displayLong = displayPosRef.current.long;
      const displayMag = Math.sqrt(displayLat * displayLat + displayLong * displayLong);
      if (!paused) {
        displayMagnitudeRef.current = lerp(displayMagnitudeRef.current, displayMag, SMOOTHING);
      }
      
      // Clear canvas
      ctx.clearRect(0, 0, size, size);
      
      // Draw background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.arc(center, center, center - 2, 0, Math.PI * 2);
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(center, 10);
      ctx.lineTo(center, size - 10);
      ctx.moveTo(10, center);
      ctx.lineTo(size - 10, center);
      ctx.stroke();
      
      // Draw labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('BRAKE', center, 18);
      ctx.fillText('ACCEL', center, size - 10);
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
          const alpha = Math.max(0, 0.6 - age * 0.6);
          
          const x = center + p.x * scale;
          const y = center - p.y * scale;
          
          ctx.fillStyle = `rgba(147, 51, 234, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Draw peak indicator
      if (peakRef.current.magnitude > 0.1) {
        const peakX = center + peakRef.current.x * scale;
        const peakY = center - peakRef.current.y * scale;
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(peakX, peakY, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw current position dot - uses SMOOTHED position
      const dotX = center + displayLat * scale;
      const dotY = center - displayLong * scale;
      const dotColor = getGDotColor(displayMagnitudeRef.current);
      
      // Glow effect
      const gradient = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 12);
      gradient.addColorStop(0, dotColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Solid dot
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // White center
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Continue animation loop
      rafRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    rafRef.current = requestAnimationFrame(animate);
    
    // Cleanup
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [paused]); // Re-run when pause state changes
  
  return (
    <div className="bg-black/85 backdrop-blur-md rounded-xl p-3 text-white shadow-2xl border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400">G-FORCE</span>
        <span 
          className="text-sm font-bold tabular-nums"
          style={{ color: getGDotColor(magnitude) }}
        >
          {magnitude.toFixed(2)} G
        </span>
      </div>
      
      {/* Canvas */}
      <canvas 
        ref={canvasRef} 
        width={140} 
        height={140}
        className="block"
      />
      
      {/* Values row */}
      <div className="flex justify-between mt-2 text-xs">
        <div className="text-center">
          <div className="text-gray-500">Long</div>
          <div className={`font-mono font-semibold ${gLong >= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {gLong >= 0 ? '+' : ''}{gLong.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Lat</div>
          <div className="font-mono font-semibold text-blue-400">
            {gLat >= 0 ? '+' : ''}{gLat.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Peak</div>
          <div className="font-mono font-semibold text-orange-400">
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
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ long: 0, lat: 0 });
  const smoothedRef = useRef({ long: 0, lat: 0 });
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
  
  // Continuous animation loop for smooth rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = 200;
    const height = 100;
    const padding = { top: 15, right: 10, bottom: 20, left: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxG = 1.0;
    
    const animate = () => {
      const realNow = Date.now();
      
      // Handle pause/unpause transitions
      if (paused && !wasPausedRef.current) {
        // Just paused - capture the current time
        pauseTimeRef.current = realNow;
        wasPausedRef.current = true;
      } else if (!paused && wasPausedRef.current) {
        // Just unpaused - no action needed, just update flag
        wasPausedRef.current = false;
      }
      
      // Use frozen time when paused, real time when playing
      const now = paused ? pauseTimeRef.current : realNow;
      
      // Only update values when not paused
      if (!paused) {
        // Smooth current values
        smoothedRef.current.long = lerp(smoothedRef.current.long, targetRef.current.long, SMOOTHING);
        smoothedRef.current.lat = lerp(smoothedRef.current.lat, targetRef.current.lat, SMOOTHING);
        
        // Add samples at our target rate using smoothed values
        const minInterval = 1000 / CHART_SAMPLE_RATE;
        if (now - lastSampleTimeRef.current >= minInterval) {
          historyRef.current.push({ 
            long: smoothedRef.current.long, 
            lat: smoothedRef.current.lat, 
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, width, height);
      
      // Chart area background
      ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
      ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);
      
      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      // Horizontal grid lines at -0.5, 0, 0.5 G
      const yPositions = [-0.5, 0, 0.5];
      yPositions.forEach(g => {
        const y = padding.top + chartHeight / 2 - (g / maxG) * (chartHeight / 2);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      });
      
      // Zero line (more visible)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      const zeroY = padding.top + chartHeight / 2;
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(width - padding.right, zeroY);
      ctx.stroke();
      
      // Y-axis labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('+1G', padding.left - 4, padding.top + 4);
      ctx.fillText('0', padding.left - 4, zeroY + 3);
      ctx.fillText('-1G', padding.left - 4, height - padding.bottom);
      
      // X-axis labels
      ctx.textAlign = 'center';
      ctx.fillText('10s', padding.left, height - 4);
      ctx.fillText('5s', padding.left + chartWidth / 2, height - 4);
      ctx.fillText('now', width - padding.right, height - 4);
      
      // Draw data
      const history = historyRef.current;
      if (history.length >= 2) {
        const timeRange = CHART_HISTORY_SECONDS * 1000;
        
        // Helper to convert data point to canvas coords
        const toCanvasX = (time: number) => {
          const timeOffset = now - time;
          return width - padding.right - (timeOffset / timeRange) * chartWidth;
        };
        
        // Draw longitudinal (red for brake/accel)
        ctx.beginPath();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        let started = false;
        history.forEach(p => {
          const x = toCanvasX(p.time);
          const y = padding.top + chartHeight / 2 - (Math.max(-maxG, Math.min(maxG, p.long)) / maxG) * (chartHeight / 2);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        
        // Draw lateral (blue)
        ctx.beginPath();
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        started = false;
        history.forEach(p => {
          const x = toCanvasX(p.time);
          const y = padding.top + chartHeight / 2 - (Math.max(-maxG, Math.min(maxG, p.lat)) / maxG) * (chartHeight / 2);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      }
      
      // Legend
      ctx.fillStyle = '#f87171';
      ctx.fillRect(padding.left + 5, 4, 8, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '8px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Long', padding.left + 16, 11);
      
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(padding.left + 50, 4, 8, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('Lat', padding.left + 61, 11);
      
      // Continue animation
      rafRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [paused]); // Re-run when pause state changes
  
  return (
    <div className="bg-black/85 backdrop-blur-md rounded-xl p-2 text-white shadow-2xl border border-white/10">
      <canvas 
        ref={canvasRef} 
        width={200} 
        height={100}
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
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ throttle: 0, brake: false });
  const smoothedRef = useRef({ throttle: 0 });
  const lastVideoTimestampRef = useRef<number | undefined>(undefined);
  const pauseTimeRef = useRef<number>(0);
  const wasPausedRef = useRef<boolean>(false);
  
  // Get current values
  const throttle = data.acceleratorPedalPosition;
  const brake = data.brakeApplied;
  
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
    targetRef.current = { throttle, brake };
  }, [throttle, brake]);
  
  // Continuous animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = 200;
    const height = 100;
    const padding = { top: 15, right: 10, bottom: 20, left: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const animate = () => {
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
        // Smooth throttle (brake is binary so don't smooth)
        smoothedRef.current.throttle = lerp(smoothedRef.current.throttle, targetRef.current.throttle, SMOOTHING);
        
        // Add samples at target rate
        const minInterval = 1000 / CHART_SAMPLE_RATE;
        if (now - lastSampleTimeRef.current >= minInterval) {
          historyRef.current.push({ 
            throttle: smoothedRef.current.throttle, 
            brake: targetRef.current.brake,
            time: now 
          });
          lastSampleTimeRef.current = now;
          
          // Keep only last 10 seconds
          const cutoff = now - (CHART_HISTORY_SECONDS * 1000);
          historyRef.current = historyRef.current.filter(p => p.time > cutoff);
        }
      }
      
      // Clear
      ctx.clearRect(0, 0, width, height);
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, width, height);
      
      // Chart area background
      ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
      ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);
      
      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      // Horizontal grid lines at 0%, 50%, 100%
      const percentages = [0, 50, 100];
      percentages.forEach(pct => {
        const y = padding.top + chartHeight - (pct / 100) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      });
      
      // Y-axis labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('100%', padding.left - 4, padding.top + 4);
      ctx.fillText('50%', padding.left - 4, padding.top + chartHeight / 2 + 3);
      ctx.fillText('0%', padding.left - 4, height - padding.bottom);
      
      // X-axis labels
      ctx.textAlign = 'center';
      ctx.fillText('10s', padding.left, height - 4);
      ctx.fillText('5s', padding.left + chartWidth / 2, height - 4);
      ctx.fillText('now', width - padding.right, height - 4);
      
      // Draw data
      const history = historyRef.current;
      if (history.length >= 2) {
        const timeRange = CHART_HISTORY_SECONDS * 1000;
        
        const toCanvasX = (time: number) => {
          const timeOffset = now - time;
          return width - padding.right - (timeOffset / timeRange) * chartWidth;
        };
        
        // Draw brake as filled areas (red when braking)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; // red with transparency
        for (let i = 0; i < history.length - 1; i++) {
          const p1 = history[i];
          const p2 = history[i + 1];
          
          if (p1.brake) {
            const x1 = toCanvasX(p1.time);
            const x2 = toCanvasX(p2.time);
            ctx.fillRect(
              Math.min(x1, x2),
              padding.top,
              Math.abs(x2 - x1),
              chartHeight
            );
          }
        }
        
        // Draw throttle line (green)
        ctx.beginPath();
        ctx.strokeStyle = '#4ade80'; // green-400
        ctx.lineWidth = 2;
        let started = false;
        history.forEach(p => {
          const x = toCanvasX(p.time);
          const y = padding.top + chartHeight - (p.throttle / 100) * chartHeight;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      }
      
      // Legend
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(padding.left + 5, 4, 8, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '8px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Throttle', padding.left + 16, 11);
      
      ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.fillRect(padding.left + 60, 4, 8, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('Brake', padding.left + 71, 11);
      
      // Continue animation
      rafRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [paused]);
  
  return (
    <div className="bg-black/85 backdrop-blur-md rounded-xl p-2 text-white shadow-2xl border border-white/10">
      <canvas 
        ref={canvasRef} 
        width={200} 
        height={100}
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
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ speed: 0 });
  const smoothedRef = useRef({ speed: 0 });
  const lastVideoTimestampRef = useRef<number | undefined>(undefined);
  const pauseTimeRef = useRef<number>(0);
  const wasPausedRef = useRef<boolean>(false);
  
  // Get current speed in the desired unit
  const speed = convertSpeed(data.vehicleSpeedMps, speedUnit);
  
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
    targetRef.current = { speed };
  }, [speed]);
  
  // Continuous animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = 200;
    const height = 100;
    const padding = { top: 15, right: 10, bottom: 20, left: 35 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const animate = () => {
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
        // Smooth speed
        smoothedRef.current.speed = lerp(smoothedRef.current.speed, targetRef.current.speed, SMOOTHING);
        
        // Add samples at target rate
        const minInterval = 1000 / CHART_SAMPLE_RATE;
        if (now - lastSampleTimeRef.current >= minInterval) {
          historyRef.current.push({ 
            speed: smoothedRef.current.speed,
            time: now 
          });
          lastSampleTimeRef.current = now;
          
          // Keep only last 10 seconds
          const cutoff = now - (CHART_HISTORY_SECONDS * 1000);
          historyRef.current = historyRef.current.filter(p => p.time > cutoff);
        }
      }
      
      // Find max speed for scaling (or default to 80 mph / 130 kph)
      const maxSpeed = Math.max(
        speedUnit === 'mph' ? 80 : 130,
        ...historyRef.current.map(p => p.speed)
      );
      
      // Clear
      ctx.clearRect(0, 0, width, height);
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, width, height);
      
      // Chart area background
      ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
      ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);
      
      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      // Horizontal grid lines
      const gridLines = speedUnit === 'mph' ? [0, 20, 40, 60, 80] : [0, 30, 60, 90, 120];
      gridLines.forEach(spd => {
        const y = padding.top + chartHeight - (spd / maxSpeed) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      });
      
      // Y-axis labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      const labelSpeeds = speedUnit === 'mph' ? [0, 40, 80] : [0, 60, 120];
      labelSpeeds.forEach(spd => {
        const y = padding.top + chartHeight - (spd / maxSpeed) * chartHeight;
        ctx.fillText(spd.toString(), padding.left - 4, y + 3);
      });
      
      // X-axis labels
      ctx.textAlign = 'center';
      ctx.fillText('10s', padding.left, height - 4);
      ctx.fillText('5s', padding.left + chartWidth / 2, height - 4);
      ctx.fillText('now', width - padding.right, height - 4);
      
      // Draw data
      const history = historyRef.current;
      if (history.length >= 2) {
        const timeRange = CHART_HISTORY_SECONDS * 1000;
        
        const toCanvasX = (time: number) => {
          const timeOffset = now - time;
          return width - padding.right - (timeOffset / timeRange) * chartWidth;
        };
        
        // Draw speed line with gradient (cyan to blue)
        ctx.beginPath();
        ctx.strokeStyle = '#22d3ee'; // cyan-400
        ctx.lineWidth = 2.5;
        let started = false;
        history.forEach(p => {
          const x = toCanvasX(p.time);
          const y = padding.top + chartHeight - (Math.min(p.speed, maxSpeed) / maxSpeed) * chartHeight;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        
        // Fill area under the line with gradient
        if (history.length > 0) {
          const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
          gradient.addColorStop(0, 'rgba(34, 211, 238, 0.3)'); // cyan with transparency
          gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
          
          ctx.beginPath();
          ctx.fillStyle = gradient;
          const firstX = toCanvasX(history[0].time);
          const firstY = padding.top + chartHeight - (Math.min(history[0].speed, maxSpeed) / maxSpeed) * chartHeight;
          ctx.moveTo(firstX, height - padding.bottom);
          ctx.lineTo(firstX, firstY);
          
          history.forEach(p => {
            const x = toCanvasX(p.time);
            const y = padding.top + chartHeight - (Math.min(p.speed, maxSpeed) / maxSpeed) * chartHeight;
            ctx.lineTo(x, y);
          });
          
          const lastX = toCanvasX(history[history.length - 1].time);
          ctx.lineTo(lastX, height - padding.bottom);
          ctx.closePath();
          ctx.fill();
        }
      }
      
      // Legend
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(padding.left + 5, 4, 8, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '8px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`Speed (${speedUnit})`, padding.left + 16, 11);
      
      // Continue animation
      rafRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [speedUnit, paused]);
  
  return (
    <div className="bg-black/85 backdrop-blur-md rounded-xl p-2 text-white shadow-2xl border border-white/10">
      <canvas 
        ref={canvasRef} 
        width={200} 
        height={100}
        className="block rounded"
      />
    </div>
  );
}

