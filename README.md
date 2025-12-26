# SatToSat

A satellite orbit visualization and conjunction analysis tool. Select two satellites to visualize their orbits in 3D and find close approaches between them.

![SatToSat Application](screenshots/full-app.png)

## Features

<a id="features"></a>

### 3D Globe Visualization

<a id="3d-globe"></a>
- Interactive 3D Earth with realistic lighting and day/night terminator
- Real-time satellite position display with orbit tracks
- Camera controls for rotation, zoom, and pan
- Toggle grid, terminator, anti-solar point, and sun line overlays

### Conjunction Analysis

<a id="conjunction-analysis"></a>

- Automatic detection of close approaches between satellite pairs
- Searches ±3 days from anchor time with 30-second resolution
- Ternary search refinement to 100ms precision for exact closest approach times
- Displays distance, relative velocity, phase angle, and Earth relation for each conjunction

### Distance Timeline

<a id="distance-timeline"></a>

- Interactive graph showing inter-satellite distance over the search window
- Click anywhere to jump to that time
- Hover for precise time and distance values
- Expand to fullscreen for detailed analysis

![Fullscreen Distance Graph](screenshots/fullscreen-graph.png)

The fullscreen graph provides:
- High-resolution sampling (~17,000 points over 6 days)
- Mouse wheel zoom (1x to 50x)
- Click-and-drag panning
- Conjunction points marked with red circles
- Current time (blue) and anchor time (yellow) markers

### Relative View (A → B)

<a id="relative-view"></a>

- 3D visualization of Satellite B as seen from Satellite A
- North-up orientation with celestial reference
- Field of view presets: 0.5′, 3′, 20′, 120′, or auto-fit
- Sun direction indicator and velocity vector display
- Relative orbit track projection

### Orbital Parameters
- Side-by-side comparison of both satellites' orbital elements
- Displays: altitude, inclination, eccentricity, RAAN, argument of perigee, mean anomaly, apogee, perigee
- Current lat/long position for each satellite
- Real-time distance and relative velocity

### Pre-configured Profiles
- Built-in scenarios with interesting satellite pairs
- Embedded TLE history for offline analysis
- One-click loading of anchor time and satellite selection

### TLE Management
- Automatic TLE fetching from Celestrak
- Intelligent epoch selection (uses TLE closest to target time)
- Local caching with 24-hour TTL
- Paste custom TLEs for any satellite

## Technology Stack

- **React** + **TypeScript** - UI framework
- **Three.js** via **@react-three/fiber** - 3D rendering
- **D3.js** - Interactive charting for fullscreen distance graph
- **satellite.js** - SGP4/SDP4 orbit propagation
- **Tailwind CSS** - Styling
- **Vite** - Build tooling

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/sattosat.git
cd sattosat

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

## Usage

1. **Select Satellites**: Use the dropdown menus or search to select Satellite A and Satellite B
2. **Set Anchor Time**: The anchor time centers the ±3 day conjunction search window
3. **View Conjunctions**: Close approaches are automatically calculated and listed
4. **Explore Timeline**: Click the distance graph to jump to any time, or expand for detailed zoom/pan analysis
5. **Analyze Geometry**: Use the A → B relative view to understand the visual geometry of approaches

## Development

```bash
npm run dev      # Start dev server with hot reload
npm run build    # TypeScript check + production build
npm run lint     # ESLint with zero-warnings enforcement
npm test         # Run vitest tests
```

## Analysis Scripts

The repository includes Python and TypeScript scripts for conjunction analysis and verification. These were developed to investigate the Starlink-35956 imaging event and to study satellite conjunction patterns.

### Conjunction Analysis

<a id="conjunction-scripts"></a>

| Script | Language | Description |
|--------|----------|-------------|
| `python/conjunctions.py` | Python | Find close approaches between satellite pairs. Supports profile-based or custom TLE input. Outputs CSV with times, distances, and geographic coordinates. |
| `scripts/conjunctions.ts` | TypeScript | Same algorithm as the web app, for cross-validation against Python. |
| `scripts/compare-conjunctions.py` | Python | Compares Python vs TypeScript outputs to verify algorithmic equivalence (within 27 meters). |

```bash
# Using a profile
uv run python python/conjunctions.py --profile WV3-STARLINK35956-Picture

# With report output
uv run python python/conjunctions.py --profile WV3-STARLINK35956-Picture --report

# Compare Python vs TypeScript outputs
uv run python scripts/compare-conjunctions.py --verbose
```

### Envelope Period Analysis

<a id="envelope-scripts"></a>

The "envelope period" is the time between successive closest approaches—the rhythm of imaging opportunities.

| Script | Description |
|--------|-------------|
| `python/envelope_analysis.py` | Analyzes distance envelope patterns for satellite pairs. Outputs JSON with orbital elements, approach times, and envelope periods. |
| `python/envelope_theory.py` | Theoretical calculations of envelope period based on orbital mechanics (synodic period formula, J2 precession effects). |
| `python/satellite_pairs.json` | Pre-defined satellite pairs for envelope analysis with observed vs theoretical periods. |

```bash
# Run envelope analysis
uv run python python/envelope_analysis.py
```

### Investigation Scripts

<a id="investigation-scripts"></a>

These scripts were created to investigate the discrepancy between the reported 241 km imaging distance and the calculated 350 km.

| Script | Purpose |
|--------|---------|
| `python/verify_conjunction.py` | Deep verification of WV3/Starlink-35956 conjunction calculations. Includes embedded TLEs and detailed output. |
| `python/scan_alaska.py` | Scans Dec 18, 2025 for any WV3/Starlink passes over Alaska region. |
| `python/scan_dec17.py` | Compares Dec 17 vs Dec 18 approach geometry to understand orbital patterns. |
| `python/backpropagate_dec19.py` | Tests back-propagating Dec 19 (post-anomaly) TLE to Dec 18 imaging time. |
| `python/fetch_spacetrack.py` | Fetches historical TLEs from Space-Track.org GP_History API. Requires account credentials in `.env`. |
| `python/compare_with_spacetrack.py` | Compares conjunction results using Space-Track TLEs vs embedded TLEs. |

```bash
# Run verification
uv run python python/verify_conjunction.py

# Scan for Alaska passes
uv run python python/scan_alaska.py

# Fetch historical TLEs (requires .env with credentials)
uv run python python/fetch_spacetrack.py
```

### Screenshot Capture

<a id="screenshot-scripts"></a>

Playwright scripts for capturing documentation screenshots.

| Script | Description |
|--------|-------------|
| `scripts/capture-usage-screenshots.ts` | Captures UI screenshots for README/USAGE documentation. |
| `scripts/capture-blog-screenshots.ts` | Captures screenshots for blog post illustrations. |

```bash
npm run dev &
npx tsx scripts/capture-usage-screenshots.ts
```

### Algorithm Verification

<a id="algorithm-verification"></a>

Both Python and TypeScript implementations produce identical results:

```bash
# Run Python implementation
uv run python python/conjunctions.py --profile WV3-STARLINK35956-Picture

# Run TypeScript implementation
npx tsx scripts/conjunctions.ts --profile WV3-STARLINK35956-Picture

# Compare outputs (within 27 meters accuracy)
uv run python scripts/compare-conjunctions.py --verbose
```

## Data Sources

- Satellite catalog and TLEs from [Celestrak](https://celestrak.org/)
- Earth textures from NASA Blue Marble

## License

MIT
