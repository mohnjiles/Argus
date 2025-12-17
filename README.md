# Argus

**The all-seeing dashcam viewer.** View multiple camera angles simultaneously, extract telemetry data, and export clips with overlays - all locally in your browser. Perfect for Tesla dashcam and Sentry Mode videos.

![Argus](https://img.shields.io/badge/Argus-Dashcam%20Viewer-e82127?style=for-the-badge)

## Features

- **Multi-Camera Playback**: View up to 6 camera angles simultaneously (front, rear, side repeaters, pillar cameras)
- **Flexible Layout**: Drag and resize camera views to your preference
- **SEI Telemetry Overlay**: Display real-time vehicle data including:
  - Speed (mph/kph)
  - Gear state (P/R/N/D)
  - Autopilot/FSD status
  - Steering angle
  - Throttle & brake status
  - Turn signals
  - GPS coordinates
- **Smart File Browser**: Automatically scans and organizes clips from:
  - RecentClips
  - SentryClips (with event data)
  - SavedClips
- **Unified Controls**: Single seek bar controls all cameras with +10s/-10s jump buttons
- **Video Export**: Export clips with telemetry overlay baked in
- **100% Local**: All processing happens in your browser - no uploads, no servers

## Requirements

- **Browser**: Chrome, Edge, or other Chromium-based browser (requires File System Access API and WebCodecs)
- **Tesla Firmware**: SEI data requires firmware 2025.44.25+ and HW3+

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

1. Click **Open Folder** and select your dashcam folder (for Tesla: the TeslaCam folder containing `RecentClips`, `SentryClips`, `SavedClips`)
2. Select a clip from the sidebar
3. Use the playback controls or keyboard shortcuts to navigate
4. Toggle cameras on/off using the camera buttons
5. Click **Export** to save a clip with overlay

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play/Pause |
| `J` | Jump back 10 seconds |
| `L` | Jump forward 10 seconds |
| `←` | Seek back 1 second |
| `→` | Seek forward 1 second |
| `Shift + ←/→` | Seek 5 seconds |
| `↑` / `↓` | Increase/decrease speed |
| `0-9` | Jump to 0%-90% of clip |
| `Home` / `End` | Jump to start/end |

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- WebCodecs API (video decoding/encoding)
- File System Access API (local file access)
- react-grid-layout (draggable camera grid)
- mp4-muxer (video export)

## Project Structure

```
src/
├── components/
│   ├── FileBrowser/    # Clip browser sidebar
│   ├── VideoPlayer/    # Multi-camera grid
│   ├── Controls/       # Playback controls
│   ├── Overlay/        # SEI telemetry display
│   └── Export/         # Export dialog
├── lib/
│   ├── dashcam-mp4.ts  # MP4 parser
│   ├── sei-decoder.ts  # Protobuf SEI decoder
│   ├── file-scanner.ts # Directory scanner
│   └── exporter.ts     # Video export
├── hooks/
│   ├── usePlayback.ts  # Playback state
│   ├── useFileSystem.ts # File system access
│   └── useKeyboardShortcuts.ts
└── types/
    └── index.ts        # TypeScript interfaces
```

## SEI Data Fields

The following telemetry is extracted from videos (when available):

| Field | Description |
|-------|-------------|
| `vehicleSpeedMps` | Vehicle speed in m/s |
| `gearState` | P/R/N/D |
| `autopilotState` | None/FSD/Autosteer/TACC |
| `steeringWheelAngle` | Steering angle in degrees |
| `acceleratorPedalPosition` | Throttle 0-1 |
| `brakeApplied` | Brake pedal state |
| `blinkerOnLeft/Right` | Turn signal state |
| `latitudeDeg/longitudeDeg` | GPS coordinates |
| `headingDeg` | Compass heading |

## Notes

- Not all Tesla clips contain SEI data. Requires firmware 2025.44.25+ and HW3+
- SEI data may not be present while the car is parked
- Video export uses WebCodecs which may be slower than native tools

## License

MIT

## Acknowledgments

Based on Tesla's official [dashcam tools](https://github.com/teslamotors/dashcam) for SEI extraction.

