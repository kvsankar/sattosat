# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (hot reload)
npm run build        # TypeScript check + production build
npm run lint         # ESLint with zero-warnings enforcement
npm test             # Run vitest tests
npm test -- orbit    # Run single test file matching "orbit"
```

Pre-commit hook runs `npm run lint` automatically via simple-git-hooks.

## Architecture Overview

**SatToSat** is a satellite orbit visualization and conjunction-finder tool. Users select two satellites, and the app finds close approaches between them over a ±3 day window.

### Data Flow

1. **Catalog & TLE Fetching** (`src/hooks/useSatelliteCatalog`, `useTLE`)
   - Fetches satellite catalog and TLEs from Celestrak API
   - Caches in localStorage with 24h TTL, accumulates up to 50 TLE epochs per satellite
   - `src/lib/celestrak.ts` handles all fetching, parsing, and caching logic

2. **Orbit Propagation** (`src/hooks/useSatellitePosition`, `src/lib/orbit.ts`)
   - Wraps `satellite.js` library for SGP4/SDP4 propagation
   - Returns ECI position/velocity and generates 360-point orbit paths
   - Coordinate transform: ECI (Z-up) → Three.js (Y-up)

3. **Conjunction Search** (`src/hooks/useConjunctions`, `src/lib/conjunctions.ts`)
   - Algorithm: coarse scan (30s steps) → local minima detection → ternary refinement to 100ms
   - Automatically switches between TLE epochs as time progresses
   - Runs asynchronously via setTimeout to avoid blocking UI

4. **Profiles** (`src/lib/profiles.ts`, `src/lib/profiles.json`)
   - Pre-configured scenarios with satellite pairs, anchor times, and embedded TLE history
   - Auto-loads first profile on startup
   - Embedded TLEs in `src/lib/embedded/*.tle` are loaded at build time

### Key State in App.tsx

- `currentTime` - simulation time (controlled by slider/playback)
- `anchorTime` - center of ±3 day search window (set by profile)
- `selectedIdA/B` - NORAD IDs of selected satellites
- `activeTleA/B` - TLE closest to anchor time (computed via `pickActiveTle`)

### Component Structure

- **Globe/** - Three.js scene via React-Three-Fiber (Earth, satellites, orbits, terminator)
- **Controls/** - Timeline slider, satellite selectors, distance/parameter graphs
- **Panels/** - Orbital parameters display, conjunction list, A→B relative view

### Relative View Panel

Special 3D canvas showing Satellite B as seen from Satellite A:
- Camera at Sat A, north-up orientation (Z-axis projects to screen up)
- FoV presets: 0.5′, 3′, 20′, 2°, 90° with auto-fit option
- Shows line-of-sight, sun direction, relative orbit track

### Fullscreen Distance Graph

High-resolution zoomable graph (`src/components/Controls/FullscreenDistanceGraph.tsx`):
- D3.js-powered with zoom (1x-50x) and pan
- ~17,000 samples at 30-second intervals
- Shows conjunction points as red markers
- Portal-based fullscreen overlay

## Key Libraries

- **satellite.js** - SGP4/SDP4 orbit propagation
- **tle.js** - TLE parsing utilities
- **@react-three/fiber** + **drei** - React bindings for Three.js
- **D3.js** - Interactive charting for fullscreen distance graph
- **Tailwind CSS** - Styling
- **Playwright** - Screenshot capture for documentation

## Documentation

- `README.md` - Project overview and setup
- `USAGE.md` - Comprehensive feature guide with screenshots
- `screenshots/` - UI screenshots for documentation
- `scripts/capture-usage-screenshots.ts` - Playwright script to regenerate screenshots

To update screenshots after UI changes:
```bash
npm run dev &
npx tsx scripts/capture-usage-screenshots.ts
```

## Conventions

- Functional React components with hooks
- 2-space indentation, ASCII files
- Prefer existing helpers (`useTLE`, `useConjunctions`) over re-implementing propagation
- Use provided cache helpers (`clearTLECache`, `clearAllCache`) rather than clearing localStorage directly
