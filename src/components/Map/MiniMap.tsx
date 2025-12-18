/**
 * MiniMap Component
 * Displays vehicle location and heading on an interactive map
 * Uses Stadia Alidade Smooth Dark tiles for a sleek dark theme with readable labels
 * 
 * Features position smoothing and transition detection to prevent jarring jumps
 * when clips change during playback.
 */

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState, useMemo } from 'react';

// Fix for default marker icon in React Leaflet
// @ts-expect-error - Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MiniMapProps {
    lat: number;
    long: number;
    heading: number;
    zoom?: number;
}

// Calculate distance between two GPS coordinates in meters (Haversine formula)
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Thresholds for position filtering
const JUMP_THRESHOLD_METERS = 100;
const STABILITY_FRAMES = 5;
const SMOOTH_FLY_DURATION = 0.5;

interface StablePosition {
    lat: number;
    long: number;
    heading: number;
}

// Hook to manage stable position with jump detection
function useStablePosition(lat: number, long: number, heading: number): { stablePos: StablePosition | null; shouldAnimate: boolean } {
    const [stablePos, setStablePos] = useState<StablePosition | null>(null);

    // Use refs for tracking to avoid infinite loops
    const lastStableRef = useRef<StablePosition | null>(null);
    const pendingPosition = useRef<{ lat: number; long: number } | null>(null);
    const stabilityCount = useRef(0);
    const shouldAnimateRef = useRef(false);

    useEffect(() => {
        // Skip invalid coordinates
        if (lat === 0 && long === 0) return;

        const lastStable = lastStableRef.current;

        // First valid position - accept immediately
        if (!lastStable) {
            const newPos = { lat, long, heading };
            lastStableRef.current = newPos;
            setStablePos(newPos);
            return;
        }

        const distance = getDistanceMeters(lastStable.lat, lastStable.long, lat, long);

        if (distance <= JUMP_THRESHOLD_METERS) {
            // Normal movement - accept immediately
            stabilityCount.current = 0;
            pendingPosition.current = null;
            shouldAnimateRef.current = false;

            const newPos = { lat, long, heading };
            lastStableRef.current = newPos;
            setStablePos(newPos);
        } else {
            // Large jump detected - need stability confirmation
            if (pendingPosition.current) {
                const distFromPending = getDistanceMeters(
                    pendingPosition.current.lat, pendingPosition.current.long,
                    lat, long
                );

                if (distFromPending <= JUMP_THRESHOLD_METERS) {
                    // Consistent with pending position
                    stabilityCount.current++;

                    if (stabilityCount.current >= STABILITY_FRAMES) {
                        // Confirmed! Update to new position
                        shouldAnimateRef.current = true;
                        pendingPosition.current = null;
                        stabilityCount.current = 0;

                        const newPos = { lat, long, heading };
                        lastStableRef.current = newPos;
                        setStablePos(newPos);
                    }
                } else {
                    // Position changed again, reset tracking
                    pendingPosition.current = { lat, long };
                    stabilityCount.current = 1;
                }
            } else {
                // Start tracking potential jump
                pendingPosition.current = { lat, long };
                stabilityCount.current = 1;
            }
            // While waiting, stablePos stays unchanged (no setStablePos call)
        }
    }, [lat, long, heading]); // Removed stablePos from deps - use ref instead

    return { stablePos, shouldAnimate: shouldAnimateRef.current };
}

// Simple map updater that syncs view to position
function MapUpdater({ center, animate }: { center: [number, number]; animate: boolean }) {
    const map = useMap();
    const lastCenter = useRef<[number, number] | null>(null);

    useEffect(() => {
        if (!lastCenter.current) {
            map.setView(center, undefined, { animate: false });
            lastCenter.current = center;
            return;
        }

        const distance = getDistanceMeters(
            lastCenter.current[0], lastCenter.current[1],
            center[0], center[1]
        );

        if (distance > JUMP_THRESHOLD_METERS && animate) {
            map.flyTo(center, undefined, { duration: SMOOTH_FLY_DURATION });
        } else if (distance > 0.5) { // Only pan if moved more than 0.5m
            map.panTo(center, { animate: true, duration: 0.15 });
        }

        lastCenter.current = center;
    }, [map, center, animate]);

    return null;
}

// Custom Tesla-style arrow icon for the car
const createCarIcon = (heading: number) => {
    return L.divIcon({
        className: 'car-marker',
        html: `
      <div style="
        transform: rotate(${heading}deg);
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8));
        transition: transform 0.15s ease-out;
      ">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <defs>
            <linearGradient id="carGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#60a5fa;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
            </linearGradient>
          </defs>
          <path d="M12 2L4 20L12 16L20 20L12 2Z" fill="url(#carGradient)" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>
    `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
};

// Map themes
const MAP_THEMES = {
    stadiaDark: {
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
        attribution: '&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap',
    },
} as const;

const CURRENT_THEME = MAP_THEMES.stadiaDark;

export function MiniMap({ lat, long, heading, zoom = 16 }: MiniMapProps) {
    const { stablePos, shouldAnimate } = useStablePosition(lat, long, heading);

    // Memoize icon based on heading
    const carIcon = useMemo(() => {
        return stablePos ? createCarIcon(stablePos.heading) : null;
    }, [stablePos?.heading]);

    if (!stablePos) {
        return (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center text-gray-500 text-xs text-center p-4">
                <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p>No GPS Data</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative z-0">
            <MapContainer
                center={[stablePos.lat, stablePos.long]}
                zoom={zoom}
                scrollWheelZoom={true}
                style={{ width: '100%', height: '100%', backgroundColor: '#171a20' }}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer
                    url={CURRENT_THEME.url}
                    attribution={CURRENT_THEME.attribution}
                    keepBuffer={8}
                />
                {carIcon && <Marker position={[stablePos.lat, stablePos.long]} icon={carIcon} />}
                <MapUpdater center={[stablePos.lat, stablePos.long]} animate={shouldAnimate} />
            </MapContainer>

            <div className="absolute bottom-0 right-0 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[7px] text-gray-400 pointer-events-none z-[400] rounded-tl">
                © Stadia © OSM
            </div>
        </div>
    );
}
