import type { SeiMetadata } from '../../types';
import { formatSeiForDisplay } from '../sei-decoder';

// Cached steering wheel image
let steeringWheelImage: ImageBitmap | null = null;

/**
 * Load the steering wheel image for export overlays.
 * Should be called once before starting export.
 * Returns the ImageBitmap or null if loading fails.
 */
export async function loadSteeringWheelImage(): Promise<ImageBitmap | null> {
    if (steeringWheelImage) return steeringWheelImage;

    try {
        const response = await fetch('/wheel.png');
        const blob = await response.blob();
        steeringWheelImage = await createImageBitmap(blob);
        return steeringWheelImage;
    } catch (e) {
        console.warn('Failed to load steering wheel image:', e);
        return null;
    }
}

/**
 * Draw a rotating steering wheel icon at the specified position
 */
function drawSteeringWheel(
    ctx: OffscreenCanvasRenderingContext2D,
    image: ImageBitmap,
    x: number,
    y: number,
    size: number,
    angle: number
) {
    ctx.save();

    // Move to the center of where we want to draw
    ctx.translate(x + size / 2, y + size / 2);

    // Rotate by the steering angle (degrees to radians)
    ctx.rotate((angle * Math.PI) / 180);

    // Draw the image centered at the origin
    ctx.drawImage(image, -size / 2, -size / 2, size, size);

    ctx.restore();
}

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
    hideLocation: boolean = false,
    steeringWheelImage: ImageBitmap | null = null
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

        // ========== STEERING WHEEL (right of gear box) ==========
        if (steeringWheelImage) {
            const wheelX = gearX + gearSize + scaledValue(15);
            const wheelSize = scaledValue(45);
            const wheelCenterY = centerY;

            // Draw background circle for the wheel
            ctx.fillStyle = '#374151';
            ctx.beginPath();
            ctx.arc(wheelX + wheelSize / 2, wheelCenterY, wheelSize / 2 + scaledValue(3), 0, Math.PI * 2);
            ctx.fill();

            // Draw the rotating steering wheel
            drawSteeringWheel(
                ctx,
                steeringWheelImage,
                wheelX,
                wheelCenterY - wheelSize / 2,
                wheelSize,
                sei.steeringWheelAngle
            );

            // Draw angle text below the wheel
            ctx.font = `bold ${scaledValue(16)}px system-ui, sans-serif`;
            ctx.fillStyle = '#9ca3af';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(
                `${sei.steeringWheelAngle >= 0 ? '+' : ''}${sei.steeringWheelAngle.toFixed(0)}°`,
                wheelX + wheelSize / 2,
                wheelCenterY + wheelSize / 2 + scaledValue(4)
            );
        }

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
    const baseWidth = 1920;
    const scale = Math.min(videoWidth / baseWidth, 1);
    const scaledValue = (base: number) => Math.round(base * scale);

    if (getChartSlotCount(videoWidth) === 0) return;

    const chartWidth = scaledValue(170);
    const chartHeight = scaledValue(90);
    const padding = { top: scaledValue(4), right: scaledValue(4), bottom: scaledValue(4), left: scaledValue(4) };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const stripHeight = scaledValue(120);
    const barY = videoHeight - stripHeight;
    const chartX = getChartSlotPosition(slotIndex, videoWidth);
    const chartY = barY + (stripHeight - chartHeight) / 2;

    ctx.save();
    ctx.translate(chartX, chartY);

    // Background
    ctx.fillStyle = 'rgba(10, 10, 10, 0.4)';
    ctx.beginPath();
    ctx.roundRect(0, 0, chartWidth, chartHeight, scaledValue(12));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const defaultMax = speedUnit === 'mph' ? 80 : 130;
    const maxSpeed = Math.max(defaultMax, ...history.map(p => p.speed));
    const timeRange = 10000;

    const toCanvasX = (timeOffset: number) => chartWidth - padding.right - ((currentTimeMs - timeOffset) / timeRange) * innerWidth;
    const toCanvasY = (speed: number) => padding.top + innerHeight - (Math.min(speed, maxSpeed) / maxSpeed) * innerHeight;

    const visibleHistory = history.filter(p => currentTimeMs - p.timeOffset <= timeRange);

    if (visibleHistory.length >= 2) {
        // Area fill
        ctx.beginPath();
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + innerHeight);
        gradient.addColorStop(0, 'rgba(34, 211, 238, 0.25)');
        gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.fillStyle = gradient;
        const firstX = toCanvasX(visibleHistory[0].timeOffset);
        ctx.moveTo(firstX, padding.top + innerHeight);
        visibleHistory.forEach(p => ctx.lineTo(toCanvasX(p.timeOffset), toCanvasY(p.speed)));
        ctx.lineTo(toCanvasX(visibleHistory[visibleHistory.length - 1].timeOffset), padding.top + innerHeight);
        ctx.closePath();
        ctx.fill();

        // Glowing Line
        ctx.save();
        ctx.shadowBlur = scaledValue(8);
        ctx.shadowColor = 'rgba(34, 211, 238, 0.5)';
        ctx.beginPath();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = Math.max(2, scaledValue(2.5));
        let started = false;
        visibleHistory.forEach(p => {
            const x = toCanvasX(p.timeOffset);
            const y = toCanvasY(p.speed);
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        });
        ctx.stroke();
        ctx.restore();
    }

    // Legend
    const legendPad = scaledValue(5);
    ctx.font = `900 ${Math.max(10, scaledValue(11))}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const legendText = `SPEED (${speedUnit.toUpperCase()})`;
    const textWidth = ctx.measureText(legendText).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(legendPad - 1, legendPad - 1, textWidth + 2, scaledValue(12) + 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(legendText, legendPad, legendPad);

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
    slotIndex: number = 0
) {
    const baseWidth = 1920;
    const scale = Math.min(videoWidth / baseWidth, 1);
    const scaledValue = (base: number) => Math.round(base * scale);

    if (getChartSlotCount(videoWidth) === 0) return;

    const chartWidth = scaledValue(170);
    const chartHeight = scaledValue(90);
    const padding = { top: scaledValue(4), right: scaledValue(4), bottom: scaledValue(4), left: scaledValue(4) };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const stripHeight = scaledValue(120);
    const barY = videoHeight - stripHeight;
    const chartX = getChartSlotPosition(slotIndex, videoWidth);
    const chartY = barY + (stripHeight - chartHeight) / 2;

    ctx.save();
    ctx.translate(chartX, chartY);

    // Background
    ctx.fillStyle = 'rgba(10, 10, 10, 0.4)';
    ctx.beginPath();
    ctx.roundRect(0, 0, chartWidth, chartHeight, scaledValue(12));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const timeRange = 10000;
    const toCanvasX = (timeOffset: number) => chartWidth - padding.right - ((currentTimeMs - timeOffset) / timeRange) * innerWidth;
    const toCanvasY = (throttle: number) => padding.top + innerHeight - (throttle / 100) * innerHeight;

    const visibleHistory = history.filter(p => currentTimeMs - p.timeOffset <= timeRange);

    if (visibleHistory.length >= 2) {
        // Brake applied background
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        for (let i = 0; i < visibleHistory.length - 1; i++) {
            const p1 = visibleHistory[i];
            const p2 = visibleHistory[i + 1];
            if (p1.brake) {
                const x1 = toCanvasX(p1.timeOffset);
                const x2 = toCanvasX(p2.timeOffset);
                ctx.fillRect(Math.min(x1, x2), padding.top, Math.abs(x2 - x1), innerHeight);
            }
        }

        // Throttle area gradient
        ctx.beginPath();
        const throttleGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + innerHeight);
        throttleGrad.addColorStop(0, 'rgba(74, 222, 128, 0.25)');
        throttleGrad.addColorStop(1, 'rgba(74, 222, 128, 0)');
        ctx.fillStyle = throttleGrad;
        ctx.moveTo(toCanvasX(visibleHistory[0].timeOffset), padding.top + innerHeight);
        visibleHistory.forEach(p => ctx.lineTo(toCanvasX(p.timeOffset), toCanvasY(p.throttle)));
        ctx.lineTo(toCanvasX(visibleHistory[visibleHistory.length - 1].timeOffset), padding.top + innerHeight);
        ctx.closePath();
        ctx.fill();

        // Throttle glowing line
        ctx.save();
        ctx.shadowBlur = scaledValue(8);
        ctx.shadowColor = 'rgba(74, 222, 128, 0.5)';
        ctx.beginPath();
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = Math.max(2, scaledValue(2.5));
        let started = false;
        visibleHistory.forEach(p => {
            const x = toCanvasX(p.timeOffset);
            const y = toCanvasY(p.throttle);
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        });
        ctx.stroke();
        ctx.restore();
    }

    // Legend
    const legendPad = scaledValue(5);
    ctx.font = `900 ${Math.max(10, scaledValue(11))}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const pedalLabel = 'PEDALS';
    const plWidth = ctx.measureText(pedalLabel).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(legendPad - 1, legendPad - 1, plWidth + 2, scaledValue(12) + 2);
    ctx.fillStyle = 'white';
    ctx.fillText(pedalLabel, legendPad, legendPad);

    const subTop = legendPad + scaledValue(15);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(legendPad - 1, subTop - 1, scaledValue(60), scaledValue(12) + 2);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('THR', legendPad, subTop);
    const thrWidth = ctx.measureText('THR').width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(' / ', legendPad + thrWidth, subTop);
    const slashWidth = ctx.measureText(' / ').width;
    ctx.fillStyle = '#ef4444';
    ctx.fillText('BRK', legendPad + thrWidth + slashWidth, subTop);

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

    if (getChartSlotCount(videoWidth) === 0) return;

    const chartWidth = scaledValue(170);
    const chartHeight = scaledValue(90);
    const padding = { top: scaledValue(4), right: scaledValue(4), bottom: scaledValue(4), left: scaledValue(4) };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const stripHeight = scaledValue(120);
    const barY = videoHeight - stripHeight;
    const chartX = getChartSlotPosition(slotIndex, videoWidth);
    const chartY = barY + (stripHeight - chartHeight) / 2;

    ctx.save();
    ctx.translate(chartX, chartY);

    // Background
    ctx.fillStyle = 'rgba(10, 10, 10, 0.4)';
    ctx.beginPath();
    ctx.roundRect(0, 0, chartWidth, chartHeight, scaledValue(12));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const timeRange = 10000;
    const maxG = 1.0;
    const zeroY = padding.top + innerHeight / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(chartWidth - padding.right, zeroY);
    ctx.stroke();

    const toCanvasX = (timeOffset: number) => chartWidth - padding.right - ((currentTimeMs - timeOffset) / timeRange) * innerWidth;
    const toCanvasY = (g: number) => zeroY - (Math.max(-maxG, Math.min(maxG, g)) / maxG) * (innerHeight / 2);

    const visibleHistory = history.filter(p => currentTimeMs - p.timeOffset <= timeRange);

    if (visibleHistory.length >= 2) {
        // Area fills
        ctx.beginPath();
        const lonGradient = ctx.createLinearGradient(0, zeroY - (innerHeight / 2), 0, zeroY + (innerHeight / 2));
        lonGradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
        lonGradient.addColorStop(0.5, 'rgba(239, 68, 68, 0)');
        lonGradient.addColorStop(1, 'rgba(239, 68, 68, 0.1)');
        ctx.fillStyle = lonGradient;
        ctx.moveTo(toCanvasX(visibleHistory[0].timeOffset), zeroY);
        visibleHistory.forEach(p => ctx.lineTo(toCanvasX(p.timeOffset), toCanvasY(p.gLong)));
        ctx.lineTo(toCanvasX(visibleHistory[visibleHistory.length - 1].timeOffset), zeroY);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        const latGradient = ctx.createLinearGradient(0, zeroY - (innerHeight / 2), 0, zeroY + (innerHeight / 2));
        latGradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
        latGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0)');
        latGradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
        ctx.fillStyle = latGradient;
        ctx.moveTo(toCanvasX(visibleHistory[0].timeOffset), zeroY);
        visibleHistory.forEach(p => ctx.lineTo(toCanvasX(p.timeOffset), toCanvasY(p.gLat)));
        ctx.lineTo(toCanvasX(visibleHistory[visibleHistory.length - 1].timeOffset), zeroY);
        ctx.closePath();
        ctx.fill();

        // Glowing lines
        ctx.save();
        ctx.shadowBlur = scaledValue(6);
        ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(2, scaledValue(2.5));
        let started = false;
        visibleHistory.forEach(p => {
            const x = toCanvasX(p.timeOffset);
            const y = toCanvasY(p.gLong);
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        });
        ctx.stroke();

        ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = Math.max(2, scaledValue(2.5));
        started = false;
        visibleHistory.forEach(p => {
            const x = toCanvasX(p.timeOffset);
            const y = toCanvasY(p.gLat);
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        });
        ctx.stroke();
        ctx.restore();
    }

    const legendPad = scaledValue(5);
    ctx.font = `900 ${Math.max(10, scaledValue(11))}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const gTitle = 'G-FORCES';
    const gtWidth = ctx.measureText(gTitle).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(legendPad - 1, legendPad - 1, gtWidth + 2, scaledValue(12) + 2);
    ctx.fillStyle = 'white';
    ctx.fillText(gTitle, legendPad, legendPad);

    const subTop = legendPad + scaledValue(15);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(legendPad - 1, subTop - 1, scaledValue(60), scaledValue(12) + 2);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('LON', legendPad, subTop);
    const lonWidth = ctx.measureText('LON').width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(' / ', legendPad + lonWidth, subTop);
    const slashWidth = ctx.measureText(' / ').width;
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('LAT', legendPad + lonWidth + slashWidth, subTop);

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
