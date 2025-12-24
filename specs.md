# SatToSat Product Specifications

## Overview

SatToSat is a satellite orbit visualization and conjunction-finder tool. Users select two satellites (A and B), and the app finds close approaches between them over a ±3 day window centered on an anchor time. The application supports pre-configured profiles for reproducible historical analysis and real-time tracking with live TLE data.

## Core Concepts

### Anchor Time
The anchor time defines the center of the ±3 day search window. All conjunction searches and timeline ranges are computed relative to this anchor. When a profile is active, the anchor is locked to the profile's timestamp. When no profile is selected, users can set anchor to current time via the "Now" button.

### Satellites A and B
- Satellite A (blue): Primary/reference satellite
- Satellite B (red): Secondary/target satellite
- Both satellites rendered with their full orbital paths and color-coded markers

## Data & TLE Management

### Satellite Catalog
- Fetched from Celestrak covering active satellites, Starlink constellation, and space stations (~14,000+ satellites)
- Cached in localStorage with 24-hour TTL
- Search by name or NORAD ID (limited to 100 results for performance)
- Recent satellites feature stores last 5 selections for quick access

### TLE (Two-Line Element) Handling
- Fetched from Celestrak GP JSON API on-demand per satellite
- Cached in localStorage with 24-hour TTL
- Accumulates up to 50 TLE epochs per satellite for historical analysis
- Active TLE selection: automatically chooses TLE with epoch closest to current simulation time unless manually overridden
- Manual TLE epoch selector shows available epochs within ±3 days of anchor time
- Paste TLE facility allows importing TLEs from external sources with automatic NORAD ID mapping
- TLE validity: approximately ±5 days from epoch for reasonable accuracy

### Profiles
- Pre-configured scenarios bundling satellite pairs, anchor times, and embedded TLE history
- Auto-loads first profile on startup for immediate usability
- Profile satellite names override generic NORAD labels in UI
- Embedded TLEs stored in separate .tle files and loaded at build time for offline operation
- Current profile: WV3-STARLINK35956-Picture (WorldView-3 imaging satellite vs Starlink close approach, December 2025)

## Conjunction Detection

### Algorithm (3-Stage Process)
1. **Coarse Scan**: Sample every 30 seconds over the ±3 day window to identify potential minima
2. **Local Minima Detection**: Find all points where distance was decreasing then starts increasing (identifies closest approach moments)
3. **Ternary Search Refinement**: Narrow each minimum to 100ms precision for accurate timing

### Characteristics
- Finds ALL local minima regardless of distance (no arbitrary threshold)
- Results sorted by closest distance, showing top conjunctions
- Sortable by date (chronological) or distance (closest first) in UI
- Automatically switches between TLE epochs as time progresses during scan
- Asynchronous execution via setTimeout to avoid blocking UI
- Search recalculates only when TLEs or anchor time changes, not during timeline scrubbing

### Output Per Conjunction
- Time of closest approach (full seconds precision)
- Distance in kilometers
- Relative velocity in km/s
- Phase angle (sun-satellite-observer geometry)
- Earth relation: Clear (both visible from each other), Obstructed (Earth blocks line of sight), or Background (one sees Earth behind the other)

## Time Management

### Timeline Controls
- Range slider spanning anchor ±3 days
- Current time display in UTC with offset from anchor (e.g., "+2h 15s from anchor")
- Yellow marker at 50% position indicates anchor location

### Playback
- Play/pause toggle for automatic time progression
- Speed presets: 1x, 10x, 100x, 1000x (cycles through on repeated clicks)
- Update interval: 100ms during playback
- Fine-step buttons: ±5m, ±1m, ±10s for precise navigation

### Navigation Buttons
- **Anchor**: Jump current time back to anchor time
- **Now**: Set anchor to current real time (disabled when profile active to preserve historical scenarios)

## Main Globe Visualization

### Earth Rendering
- NASA Blue Marble textures with day/night contrast
- Proper sun position calculated using Vallado algorithm for accurate lighting direction
- Day side: Strong directional sunlight (intensity 2.5)
- Night side: Low ambient light (0.03) for subtle visibility
- Earth rotation synchronized to simulation time via GMST

### Optional Overlays (Toggleable)
- **Grid**: Latitude/longitude lines at 30° intervals; equator highlighted yellow, prime meridian green
- **Terminator**: Dashed yellow circle showing day/night boundary
- **Anti-solar**: Yellow marker at subsolar point (where sun is directly overhead)
- **LoS A→B**: Cyan line showing line of sight between satellites (requires both selected)
- **Sun line at B**: Dashed yellow line from Satellite B toward Sun (requires both selected)

### Satellites and Orbits
- Satellite markers: Small spheres with glow effect, color-coded (A=blue, B=red)
- Orbit paths: 360-point polylines showing one complete orbital period
- Labels display profile names when available, fallback to "NORAD ID"

### Camera Controls
- Pan, zoom, rotate via orbit controls
- Perspective camera with 45° FOV
- Zoom limits: 1.5 to 20 Earth radii from center
- Starfield background with 5000 stars

## A→B Relative View Panel

### Purpose
Special 3D canvas showing Satellite B as seen from Satellite A's perspective—useful for imaging mission planning and close approach geometry analysis.

### Camera Orientation
- Camera positioned at Satellite A, looking toward Satellite B
- **North-up orientation**: Earth's celestial north (ECI +Z axis) projects to screen up
- "N ↑" indicator confirms orientation
- Handles degenerate cases when looking directly along north axis

### Field of View (FoV)
- Preset buttons: 0.5′, 3′, 20′, 2°, 90° (arcminutes and degrees)
- Auto-fit mode: Calculates FoV to make satellite B fill approximately 50% of view
- FoV span displayed in both arcminutes and physical meters at target distance
- Minimum FoV: 0.001° for very narrow telescope-like views

### Satellite B Representation
- Rendered as 30m × 4.1m rectangular panel (typical satellite bus dimensions)
- Long axis aligned with velocity direction (satellite "flies forward")
- Normal axis oriented toward Sun projection (determines roll/rotation)
- Segmented rendering: Three panels with gaps for visual detail

### Overlays (Toggleable)
- **Sun**: Dashed yellow line showing B→Sun direction
- **Nadir**: Gray dashed line from B toward Earth center
- **Track**: Green line showing B's relative orbit as seen from A (middle segment of trajectory)
- **Velocity**: Orange arrow indicating relative velocity direction (V_B minus V_A)

### Information Display
- Range: Current distance to Satellite B in km
- Phase: Sun-satellite-observer angle in degrees (important for optical observations)
- Span: Physical size of current FoV at B's distance in meters

### Earth in Relative View
- Renders only when within current FoV (automatically handled by camera frustum)
- Blue Marble texture with day/night terminator
- Higher opacity (0.7) for visibility
- 90° FoV preset specifically added to allow Earth visibility during wide-angle views

## Orbital Parameters Panel

### Current State Display
- **Current Distance**: Prominent display of A-B separation in km
- **Relative Velocity**: Closing/separation speed in km/s

### Per-Satellite Information
- Satellite name (from profile or NORAD ID)
- NORAD catalog number
- Current position: Latitude (N/S), Longitude (E/W), Altitude (km)

### Orbital Elements (Side-by-Side Comparison)
- Inclination (degrees)
- Eccentricity
- RAAN (Right Ascension of Ascending Node)
- Argument of Perigee
- Mean Anomaly
- Apogee altitude (km)
- Perigee altitude (km)
- Orbital period (minutes)
- TLE epoch timestamp

## Bottom Panel Graphs

### Tabs Available
Nine parameter graphs showing evolution over the ±3 day window:
- **Distance**: A-B separation (only graph showing both satellites' relationship)
- **SMA**: Semi-major axis (km)
- **Period**: Orbital period (minutes)
- **RAAN**: Right Ascension of Ascending Node (degrees)
- **AoP**: Argument of Perigee (degrees)
- **Apo**: Apogee altitude (km)
- **Peri**: Perigee altitude (km)
- **Ecc**: Eccentricity
- **Inc**: Inclination (degrees)

### Graph Features
- Satellite A values in blue, Satellite B in red (for parameter graphs)
- Distance graph in green
- X-axis: Date labels at day boundaries (e.g., "Dec 19")
- Y-axis: Parameter values with clean tick formatting
- Current time: Solid blue vertical line
- Anchor time: Dashed yellow vertical line
- Click anywhere to jump simulation to that time
- Hover shows tooltip with timestamp and values
- Collapsible panel with reopen button

## Fullscreen Distance Graph

### Purpose
High-resolution, interactive distance analysis with zoom and pan for detailed conjunction examination.

### Features
- Portal-based fullscreen overlay
- ~17,000 data points (30-second sampling intervals over 6 days)
- D3.js-powered rendering with smooth interactions

### Zoom and Pan
- Mouse wheel zoom: 1x to 50x magnification
- Click and drag to pan when zoomed
- Reset Zoom button to return to 1x
- Zoom level indicator (e.g., "Zoom: 2.5x")

### Visual Elements
- Green curve: Inter-satellite distance over time
- Red circles: Detected conjunction points (local minima)
- Blue line: Current time marker
- Yellow dashed: Anchor time marker

### Interaction
- Click anywhere to jump simulation to that time
- Hover shows timestamp and distance at cursor
- Sample count displayed (e.g., "17,281 samples")
- Escape key closes fullscreen view

### Legend
Bottom bar showing: Distance curve, Current time, Anchor time, Conjunction points

## Close Approaches Panel

### Display
- Header shows total count (e.g., "Close Approaches (182)")
- Sort toggle: By date (chronological) or by distance (closest first)
- Each entry shows:
  - Distance in km
  - Relative velocity in km/s
  - Phase angle and visibility condition (Clear/Obstructed/Background)
  - UTC timestamp

### Interaction
- Click any conjunction to jump simulation to that moment
- Current/nearest conjunction highlighted when within 60 seconds
- Loading spinner during search computation

## Technical Foundation

### Orbit Propagation
- SGP4/SDP4 algorithms via satellite.js library
- Kepler's third law for semi-major axis from mean motion
- Apogee/perigee calculated from semi-major axis and eccentricity
- 360-point orbit path generation across one orbital period

### Coordinate Systems
- ECI (Earth-Centered Inertial): Z-axis toward celestial north pole, standard for orbital mechanics
- Three.js: Y-axis up; conversion applied during rendering
- Geodetic: Latitude/longitude/altitude for ground track display
- GMST (Greenwich Mean Sidereal Time) for Earth rotation synchronization

### Sun Position
- Vallado algorithm for accurate ECI sun coordinates
- Julian Date calculation for precise time handling
- Ecliptic coordinates with obliquity correction
- Distance in AU converted to km for lighting calculations

### Caching Strategy
- All cached data in localStorage with configurable TTL
- Graceful degradation when localStorage unavailable
- Cache age displayed in human-readable format
- Manual refresh buttons per-satellite and for catalog

## UI/UX Conventions

### Panel Layout
- Left sidebar (320px): Satellite selection, timeline, parameters, conjunctions
- Main area: 2×2 grid with Earth view, parameter graphs, A→B view, distance timeline
- All major panels collapsible with consistent chevron icons
- Smooth transitions on collapse/expand

### Color Coding
- Satellite A: Blue (#3b82f6)
- Satellite B: Red (#ef4444)
- Distance curve: Green (#22c55e)
- Current time marker: Blue (#60a5fa)
- Anchor time marker: Yellow (#fbbf24)
- Sun direction: Yellow dashed
- Line of sight: Cyan

### Typography and Sizing
- Compact labels for tab buttons
- Human-readable date formats ("Dec 19" not "12-19")
- Degrees shown with ° symbol
- Distances in km with reasonable precision

## Build and Development

### Commands
- npm install: Install dependencies
- npm run dev: Vite dev server with hot reload
- npm run build: TypeScript check + production build
- npm run lint: ESLint with zero-warnings enforcement
- npm test: Run vitest tests

### Quality Gates
- Pre-commit hook runs lint automatically
- TypeScript strict mode
- All floating promises must be handled
- No unused variables allowed

## Files of Interest

- src/App.tsx: Main state, profile loading, panel layout
- src/components/Controls/TimelineSlider.tsx: Timeline and playback controls
- src/components/Controls/DistanceTimeline.tsx: Bottom distance graph
- src/components/Controls/FullscreenDistanceGraph.tsx: D3-powered fullscreen zoom graph
- src/components/Panels/RelativeViewPanel.tsx: A→B view with FoV and overlays
- src/lib/conjunctions.ts: Conjunction search algorithm and distance sampling
- src/lib/orbit.ts: SGP4 propagation helpers and orbit path generation
- src/lib/profiles.ts: Profile loading and TLE embedding
- src/lib/celestrak.ts: API fetching, parsing, and caching logic
