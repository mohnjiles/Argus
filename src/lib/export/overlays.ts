import type { SeiMetadata } from '../../types';
import { formatSeiForDisplay } from '../sei-decoder';

export interface SpeedHistoryEntry {
    speed: number;     // Speed in the display unit (mph or kph)
    timeOffset: number; // Time offset in ms from start of export
}

export function drawOverlay(
    ctx: OffscreenCanvasRenderingContext2D,
    sei: SeiMetadata | null | undefined,
    width: number,
    height: number,
    videoTimestamp: Date,
    hideLocation: boolean = false
) {
    // Dynamic scaling based on video width (1920px is the reference)
    const baseWidth = 1920;
    const scale = Math.min(width / baseWidth, 1); // Scale down for smaller videos, but don't scale up
    const scaledValue = (base: number) => Math.round(base * scale);

    // Strip height scales with video size
    const stripHeight = scaledValue(120);
    const y = height - stripHeight;
    const padding = scaledValue(40);

    // Draw semi-transparent black strip
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, y, width, stripHeight);

    // Add subtle top border
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, y, width, Math.max(2, scaledValue(3)));

    // Divide into sections based on actual width
    const leftSection = padding;
    const rightSection = width - padding;

    // If SEI data is available, show vehicle data
    if (sei) {
        const data = formatSeiForDisplay(sei, 'mph');

        // ========== LEFT SECTION: Speed & Gear ==========
        ctx.textBaseline = 'middle';
        const centerY = y + stripHeight / 2;

        // Speed - BIG and bold (scaled)
        ctx.font = `bold ${scaledValue(56)}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const speedNum = data.speed.replace(/[^0-9.]/g, '');
        const speedNumWidth = ctx.measureText(speedNum).width;
        const baselineY = centerY + scaledValue(18);
        ctx.fillText(speedNum, leftSection, baselineY);

        // Speed unit smaller
        ctx.font = `bold ${scaledValue(22)}px system-ui, sans-serif`;
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('mph', leftSection + speedNumWidth + scaledValue(10), baselineY);

        // Gear box
        ctx.textBaseline = 'middle';
        const gearX = leftSection + speedNumWidth + scaledValue(90);
        const gearSize = scaledValue(50);
        ctx.fillStyle = '#374151';
        ctx.fillRect(gearX, centerY - gearSize / 2, gearSize, gearSize);
        ctx.font = `bold ${scaledValue(32)}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(data.gear, gearX + gearSize / 2, centerY);

        // ========== RIGHT SECTION: GPS, FSD Status, Controls & Time ==========
        ctx.textAlign = 'right';
        const isCompact = scale < 0.5;

        // Row 1: GPS coordinates
        if (!hideLocation && (sei.latitudeDeg !== 0 || sei.longitudeDeg !== 0)) {
            ctx.font = `${scaledValue(isCompact ? 18 : 24)}px system-ui, sans-serif`;
            ctx.fillStyle = '#60a5fa';
            ctx.fillText(`${data.latitude}, ${data.longitude}`, rightSection, y + scaledValue(isCompact ? 25 : 30));
        }

        // Row 2: Heading
        if (!isCompact && !hideLocation) {
            ctx.font = `${scaledValue(20)}px system-ui, sans-serif`;
            ctx.fillStyle = '#9ca3af';
            ctx.fillText(`Heading ${data.heading}`, rightSection, y + scaledValue(55));
        }

        // Row 3: FSD Status (moved from center)
        ctx.font = `bold ${scaledValue(isCompact ? 20 : 22)}px system-ui, sans-serif`;
        let apColor: string;
        let apText: string;

        if (sei.autopilotState === 0) {
            apColor = '#9ca3af';  // Gray - Manual
            apText = 'Manual';
        } else if (sei.autopilotState === 1) {
            apColor = '#3b82f6';  // Blue
            apText = 'Self Driving';
        } else if (sei.autopilotState === 2) {
            apColor = '#60a5fa';  // Light blue
            apText = data.autopilot;
        } else {
            apColor = '#10b981';  // Green (TACC)
            apText = data.autopilot;
        }
        ctx.fillStyle = apColor;
        ctx.fillText(apText, rightSection, y + scaledValue(isCompact ? 50 : 78));

        // Blinker indicators (show next to FSD status)
        if ((sei.blinkerOnLeft || sei.blinkerOnRight) && scale > 0.4) {
            ctx.fillStyle = '#f59e0b';
            const blinkerY = y + scaledValue(isCompact ? 50 : 78);
            const apTextWidth = ctx.measureText(apText).width;
            if (sei.blinkerOnLeft) {
                ctx.fillText('◄', rightSection - apTextWidth - scaledValue(12), blinkerY);
            }
            if (sei.blinkerOnRight) {
                ctx.textAlign = 'left';
                ctx.fillText('►', rightSection + scaledValue(8), blinkerY);
                ctx.textAlign = 'right';
            }
        }
    }

    // ALWAYS show video timestamp (from recording)
    ctx.textAlign = 'right';
    ctx.font = `${scaledValue(20)}px system-ui, sans-serif`;
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
    ctx.fillText(`${dateStr} ${timeStr}`, rightSection, y + scaledValue(100));
}

export function drawSpeedChart(
    ctx: OffscreenCanvasRenderingContext2D,
    history: SpeedHistoryEntry[],
    currentTimeMs: number,
    videoWidth: number,
    videoHeight: number,
    speedUnit: 'mph' | 'kph' = 'mph',
    slotIndex: number = 0
) {
    // Dynamic scaling based on video width (1920px is the reference)
    const baseWidth = 1920;
    const scale = Math.min(videoWidth / baseWidth, 1);
    const scaledValue = (base: number) => Math.round(base * scale);

    // Don't draw chart if no slots available
    if (getChartSlotCount(videoWidth) === 0) {
        return;
    }

    // Chart dimensions - sized to fit in the scaled bottom bar
    const chartWidth = scaledValue(170);
    const chartHeight = scaledValue(90);
    const padding = {
        top: scaledValue(14),
        right: scaledValue(10),
        bottom: scaledValue(18),
        left: scaledValue(32)
    };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // Position in the bottom bar using slot system
    const stripHeight = scaledValue(120);
    const barY = videoHeight - stripHeight;

    // Use slot-based positioning
    const chartX = getChartSlotPosition(slotIndex, videoWidth);
    const chartY = barY + (stripHeight - chartHeight) / 2;

    // Save context state
    ctx.save();
    ctx.translate(chartX, chartY);

    // Background with rounded corners - semi-transparent to blend with bar
    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.beginPath();
    ctx.roundRect(0, 0, chartWidth, chartHeight, scaledValue(8));
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chart area background
    ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
    ctx.fillRect(padding.left, padding.top, innerWidth, innerHeight);

    // Calculate max speed for scaling (default to 80 mph / 130 kph)
    const defaultMax = speedUnit === 'mph' ? 80 : 130;
    const maxSpeed = Math.max(defaultMax, ...history.map(p => p.speed));

    // Time range is 10 seconds
    const timeRange = 10000;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    const gridLines = speedUnit === 'mph' ? [0, 20, 40, 60, 80] : [0, 30, 60, 90, 120];
    gridLines.forEach(spd => {
        const y = padding.top + innerHeight - (spd / maxSpeed) * innerHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(chartWidth - padding.right, y);
        ctx.stroke();
    });

    // Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `${scaledValue(11)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const labelSpeeds = speedUnit === 'mph' ? [0, 40, 80] : [0, 60, 120];
    labelSpeeds.forEach(spd => {
        const y = padding.top + innerHeight - (spd / maxSpeed) * innerHeight;
        ctx.fillText(spd.toString(), padding.left - scaledValue(6), y);
    });

    // X-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = `${scaledValue(10)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('10s', padding.left, chartHeight - scaledValue(12));
    ctx.fillText('5s', padding.left + innerWidth / 2, chartHeight - scaledValue(12));
    ctx.fillText('now', chartWidth - padding.right, chartHeight - scaledValue(12));

    // Legend
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${scaledValue(12)}px system-ui, sans-serif`;
    ctx.fillStyle = '#60a5fa'; // Blue for speed
    ctx.fillRect(padding.left + scaledValue(30), scaledValue(5), scaledValue(10), scaledValue(10));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`Speed (${speedUnit})`, padding.left + scaledValue(45), scaledValue(11));

    // Draw speed data
    if (history.length >= 2) {
        const toCanvasX = (timeOffset: number) => {
            const age = currentTimeMs - timeOffset;
            return chartWidth - padding.right - (age / timeRange) * innerWidth;
        };

        const toCanvasY = (speed: number) => {
            return padding.top + innerHeight - (Math.min(speed, maxSpeed) / maxSpeed) * innerHeight;
        };

        // Filter to visible history (last 10 seconds)
        const visibleHistory = history.filter(p => currentTimeMs - p.timeOffset <= timeRange);

        if (visibleHistory.length >= 2) {
            // Draw filled area under the line
            const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + innerHeight);
            gradient.addColorStop(0, 'rgba(34, 211, 238, 0.3)');
            gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');

            ctx.beginPath();
            ctx.fillStyle = gradient;

            const firstX = toCanvasX(visibleHistory[0].timeOffset);
            const firstY = toCanvasY(visibleHistory[0].speed);
            ctx.moveTo(firstX, padding.top + innerHeight);
            ctx.lineTo(firstX, firstY);

            visibleHistory.forEach(p => {
                const x = toCanvasX(p.timeOffset);
                const y = toCanvasY(p.speed);
                ctx.lineTo(x, y);
            });

            const lastX = toCanvasX(visibleHistory[visibleHistory.length - 1].timeOffset);
            ctx.lineTo(lastX, padding.top + innerHeight);
            ctx.closePath();
            ctx.fill();

            // Draw speed line (cyan)
            ctx.beginPath();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = Math.max(1.5, scaledValue(2.5));
            let started = false;
            visibleHistory.forEach(p => {
                const x = toCanvasX(p.timeOffset);
                const y = toCanvasY(p.speed);
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
        }
    }

    // Restore context state
    ctx.restore();
}

// ========== PEDAL CHART ==========

export interface PedalHistoryEntry {
    throttle: number;     // 0-100 percentage
    brake: boolean;       // Brake applied
    timeOffset: number;   // Time offset in ms from start of export
}

export function drawPedalChart(
    ctx: OffscreenCanvasRenderingContext2D,
    history: PedalHistoryEntry[],
    currentTimeMs: number,
    videoWidth: number,
    videoHeight: number,
    slotIndex: number = 0  // Slot position for this chart
) {
    // Dynamic scaling based on video width
    const baseWidth = 1920;
    const scale = Math.min(videoWidth / baseWidth, 1);
    const scaledValue = (base: number) => Math.round(base * scale);

    // Don't draw if no slots available
    if (getChartSlotCount(videoWidth) === 0) return;

    // Chart dimensions - consistent with other charts
    const chartWidth = scaledValue(170);
    const chartHeight = scaledValue(90);
    const padding = {
        top: scaledValue(14),
        right: scaledValue(10),
        bottom: scaledValue(18),
        left: scaledValue(10)
    };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // Position in the bottom bar using slot system
    const stripHeight = scaledValue(120);
    const barY = videoHeight - stripHeight;

    // Use slot-based positioning
    const chartX = getChartSlotPosition(slotIndex, videoWidth);
    const chartY = barY + (stripHeight - chartHeight) / 2;

    ctx.save();
    ctx.translate(chartX, chartY);

    // Background
    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.beginPath();
    ctx.roundRect(0, 0, chartWidth, chartHeight, scaledValue(6));
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chart area
    ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
    ctx.fillRect(padding.left, padding.top, innerWidth, innerHeight);

    // X-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = `${scaledValue(10)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('10s', padding.left, chartHeight - scaledValue(12));
    ctx.fillText('5s', padding.left + innerWidth / 2, chartHeight - scaledValue(12));
    ctx.fillText('now', chartWidth - padding.right, chartHeight - scaledValue(12));

    const timeRange = 10000; // 10 seconds

    // Filter to visible history
    const visibleHistory = history.filter(p => currentTimeMs - p.timeOffset <= timeRange);

    if (visibleHistory.length >= 2) {
        const toCanvasX = (timeOffset: number) => {
            const age = currentTimeMs - timeOffset;
            return chartWidth - padding.right - (age / timeRange) * innerWidth;
        };

        // Draw brake zones (red background when braking)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        let brakeStart: number | null = null;
        visibleHistory.forEach((p, i) => {
            const x = toCanvasX(p.timeOffset);
            if (p.brake && brakeStart === null) {
                brakeStart = x;
            } else if (!p.brake && brakeStart !== null) {
                ctx.fillRect(brakeStart, padding.top, x - brakeStart, innerHeight);
                brakeStart = null;
            }
            // Handle end of history
            if (i === visibleHistory.length - 1 && brakeStart !== null) {
                ctx.fillRect(brakeStart, padding.top, x - brakeStart, innerHeight);
            }
        });

        // Draw throttle line (green)
        ctx.beginPath();
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = Math.max(1.5, scaledValue(2));
        let started = false;
        visibleHistory.forEach(p => {
            const x = toCanvasX(p.timeOffset);
            const y = padding.top + innerHeight - (p.throttle / 100) * innerHeight;
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
    ctx.fillRect(padding.left + scaledValue(4), scaledValue(4), scaledValue(10), scaledValue(10));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `bold ${scaledValue(12)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Thr', padding.left + scaledValue(20), scaledValue(11));

    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.fillRect(chartWidth / 2 + scaledValue(10), scaledValue(5), scaledValue(10), scaledValue(10));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Brk', chartWidth / 2 + scaledValue(25), scaledValue(11));

    ctx.restore();
}

// ========== ACCELERATION (G-FORCE) CHART ==========

export interface AccelHistoryEntry {
    gLong: number;        // G-force longitudinal (braking/accel)
    gLat: number;         // G-force lateral (turning)
    timeOffset: number;   // Time offset in ms from start of export
}

const GRAVITY = 9.81;

export function drawAccelChart(
    ctx: OffscreenCanvasRenderingContext2D,
    history: AccelHistoryEntry[],
    currentTimeMs: number,
    videoWidth: number,
    videoHeight: number,
    slotIndex: number = 0
) {
    const baseWidth = 1920;
    const scale = Math.min(videoWidth / baseWidth, 1);
    const scaledValue = (base: number) => Math.round(base * scale);

    // Don't draw if no slots available
    if (getChartSlotCount(videoWidth) === 0) return;

    // Chart dimensions - consistent with other charts
    const chartWidth = scaledValue(170);
    const chartHeight = scaledValue(90);
    const padding = {
        top: scaledValue(14),
        right: scaledValue(10),
        bottom: scaledValue(18),
        left: scaledValue(24)
    };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // Position in the bottom bar using slot system
    const stripHeight = scaledValue(120);
    const barY = videoHeight - stripHeight;

    // Use slot-based positioning
    const chartX = getChartSlotPosition(slotIndex, videoWidth);
    const chartY = barY + (stripHeight - chartHeight) / 2;

    ctx.save();
    ctx.translate(chartX, chartY);

    // Background
    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.beginPath();
    ctx.roundRect(0, 0, chartWidth, chartHeight, scaledValue(6));
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chart area
    ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
    ctx.fillRect(padding.left, padding.top, innerWidth, innerHeight);

    // X-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = `${scaledValue(10)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('10s', padding.left, chartHeight - scaledValue(12));
    ctx.fillText('5s', padding.left + innerWidth / 2, chartHeight - scaledValue(12));
    ctx.fillText('now', chartWidth - padding.right, chartHeight - scaledValue(12));

    const timeRange = 10000;
    const maxG = 1.0;
    const zeroY = padding.top + innerHeight / 2;

    // Zero line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(chartWidth - padding.right, zeroY);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `${scaledValue(10)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('+1G', padding.left - scaledValue(6), padding.top + scaledValue(2));
    ctx.fillText('0G', padding.left - scaledValue(6), zeroY);
    ctx.fillText('-1G', padding.left - scaledValue(6), chartHeight - padding.bottom - scaledValue(2));

    const visibleHistory = history.filter(p => currentTimeMs - p.timeOffset <= timeRange);

    if (visibleHistory.length >= 2) {
        const toCanvasX = (timeOffset: number) => {
            const age = currentTimeMs - timeOffset;
            return chartWidth - padding.right - (age / timeRange) * innerWidth;
        };

        const toCanvasY = (g: number) => {
            const clamped = Math.max(-maxG, Math.min(maxG, g));
            return zeroY - (clamped / maxG) * (innerHeight / 2);
        };

        // Draw longitudinal G (red)
        ctx.beginPath();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = Math.max(1.5, scaledValue(2));
        let started = false;
        visibleHistory.forEach(p => {
            const x = toCanvasX(p.timeOffset);
            const y = toCanvasY(p.gLong);
            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw lateral G (blue)
        ctx.beginPath();
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = Math.max(1.5, scaledValue(2));
        started = false;
        visibleHistory.forEach(p => {
            const x = toCanvasX(p.timeOffset);
            const y = toCanvasY(p.gLat);
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
    ctx.fillRect(padding.left + scaledValue(30), scaledValue(5), scaledValue(10), scaledValue(10));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `bold ${scaledValue(12)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lng', padding.left + scaledValue(45), scaledValue(11));

    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(chartWidth / 2 + scaledValue(10), scaledValue(5), scaledValue(10), scaledValue(10));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Lat', chartWidth / 2 + scaledValue(25), scaledValue(11));

    ctx.restore();
}

// Helper to convert m/s² to G-force
export function toGForce(mps2: number): number {
    return mps2 / GRAVITY;
}

/**
 * Calculate how many chart slots are available based on video dimensions
 * Uses absolute pixel thresholds since charts become unreadable at small sizes
 */
export function getChartSlotCount(_videoWidth: number): number {
    // Always allow all 3 charts - they fit at all resolutions
    // The charts scale proportionally so they fit even at smaller sizes
    return 3;
}

/**
 * Get the X position for a chart at the given slot index
 * Slot 0 is leftmost (after speed/gear), higher slots go right
 */
export function getChartSlotPosition(
    slotIndex: number,
    videoWidth: number
): number {
    const baseWidth = 1920;
    const scale = Math.min(videoWidth / baseWidth, 1);
    const scaledValue = (base: number) => Math.round(base * scale);

    // Chart dimensions
    const chartWidth = scaledValue(170);
    const chartSpacing = scaledValue(12);
    const numSlots = getChartSlotCount(videoWidth);

    // Calculate centering: available space between speed/gear and GPS sections
    const leftReserved = scaledValue(200);   // Speed + gear box
    const rightReserved = scaledValue(250);  // GPS, heading, FSD, time
    const availableWidth = videoWidth - leftReserved - rightReserved;
    const totalChartsWidth = numSlots * chartWidth + (numSlots - 1) * chartSpacing;

    // Center the charts in available space
    const startX = leftReserved + (availableWidth - totalChartsWidth) / 2;

    return startX + (chartWidth + chartSpacing) * slotIndex;
}

/**
 * Chart types that can be placed in slots
 */
export type ChartType = 'speed' | 'pedal' | 'accel';

/**
 * Determine which charts should be enabled based on video dimensions and camera count
 * @deprecated Use getChartSlotCount for more flexible control
 */
export interface ChartVisibility {
    showSpeedChart: boolean;
    showPedalChart: boolean;
    showAccelChart: boolean;
}

export function getChartVisibility(
    videoWidth: number,
    cameraCount: number,
    userWantsCharts: boolean = true
): ChartVisibility {
    if (!userWantsCharts) {
        return { showSpeedChart: false, showPedalChart: false, showAccelChart: false };
    }

    const slots = getChartSlotCount(videoWidth);

    // Default behavior: speed gets priority, then pedal, then accel
    // Grid exports (2+ cameras) are more likely to have room
    const isGrid = cameraCount >= 2;

    return {
        showSpeedChart: slots >= 1,
        showPedalChart: slots >= 2 || (slots >= 1 && isGrid),
        showAccelChart: slots >= 3 || (slots >= 2 && isGrid)
    };
}
