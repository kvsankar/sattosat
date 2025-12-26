# SatToSat Analysis Scripts Guide

This guide documents the Python and TypeScript scripts for conjunction analysis and verification. These were developed to investigate the Starlink-35956 imaging event and to study satellite conjunction patterns.

For UI documentation, see [USAGE_UI.md](USAGE_UI.md).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Conjunction Analysis](#conjunction-analysis)
3. [Envelope Period Analysis](#envelope-period-analysis)
4. [Investigation Scripts](#investigation-scripts)
5. [Screenshot Capture](#screenshot-capture)
6. [Algorithm Verification](#algorithm-verification)

---

## Prerequisites

<a id="prerequisites"></a>

### Python Scripts

Python scripts use [uv](https://docs.astral.sh/uv/) for dependency management:

```bash
cd python
uv sync  # Install dependencies
```

### TypeScript Scripts

TypeScript scripts run via `npx tsx`:

```bash
npm install  # Install dependencies
```

### Space-Track.org Access

Some scripts require a Space-Track.org account. Create `python/.env`:

```
SPACETRACK_USER=your_username
SPACETRACK_PASS=your_password
```

---

## Conjunction Analysis

<a id="conjunction-scripts"></a>

Scripts for finding close approaches between satellite pairs.

| Script | Language | Description |
|--------|----------|-------------|
| `python/conjunctions.py` | Python | Find close approaches between satellite pairs. Supports profile-based or custom TLE input. Outputs CSV with times, distances, and geographic coordinates. |
| `scripts/conjunctions.ts` | TypeScript | Same algorithm as the web app, for cross-validation against Python. |
| `scripts/compare-conjunctions.py` | Python | Compares Python vs TypeScript outputs to verify algorithmic equivalence (within 27 meters). |

### Usage

```bash
# Using a profile
uv run python python/conjunctions.py --profile WV3-STARLINK35956-Picture

# With report output (detailed TLE info and conjunction table)
uv run python python/conjunctions.py --profile WV3-STARLINK35956-Picture --report

# Using custom TLE files
uv run python python/conjunctions.py \
  --tle-a path/to/sat_a.tle \
  --tle-b path/to/sat_b.tle \
  --anchor 2025-12-19T01:30:19Z

# TypeScript version
npx tsx scripts/conjunctions.ts --profile WV3-STARLINK35956-Picture
```

### Output Format

CSV with columns:
- `time_utc`: Conjunction timestamp
- `distance_km`: Closest approach distance
- `relative_velocity_km_s`: Closing speed
- `sat_a_lat`, `sat_a_lon`: Satellite A ground position
- `sat_b_lat`, `sat_b_lon`: Satellite B ground position

---

## Envelope Period Analysis

<a id="envelope-scripts"></a>

The "envelope period" is the time between successive closest approaches—the rhythm of imaging opportunities between two satellites.

| Script | Description |
|--------|-------------|
| `python/envelope_analysis.py` | Analyzes distance envelope patterns for satellite pairs. Outputs JSON with orbital elements, approach times, and envelope periods. |
| `python/envelope_theory.py` | Theoretical calculations of envelope period based on orbital mechanics (synodic period formula, J2 precession effects). |
| `python/satellite_pairs.json` | Pre-defined satellite pairs for envelope analysis with observed vs theoretical periods. |

### Usage

```bash
# Run envelope analysis for all configured pairs
uv run python python/envelope_analysis.py

# Run theoretical analysis
uv run python python/envelope_theory.py
```

### Satellite Pairs

The `satellite_pairs.json` file defines pairs for analysis:

| Pair ID | Satellites | Notes |
|---------|------------|-------|
| `wv3_starlink_healthy` | WorldView-3 vs Starlink-32153 | ~51 hour envelope period |
| `wv3_starlink35956` | WorldView-3 vs Starlink-35956 | Anomalous satellite from Dec 2025 |
| `iss_noaa20` | ISS vs NOAA-20 | ~18 hour envelope period |
| `starlink_same_launch` | Two Starlinks from same launch | Never get close (same orbital plane) |

### Theory

The envelope period follows the synodic period formula:

```
T_envelope ≈ (T_a × T_b) / |T_a - T_b|
```

Where T_a and T_b are the orbital periods. See the [blog post](https://blog.sankara.net/posts/starlink-photo-investigation/) for detailed explanation.

---

## Investigation Scripts

<a id="investigation-scripts"></a>

These scripts were created to investigate the discrepancy between the reported 241 km imaging distance and the calculated 350 km for the Starlink-35956 photo.

| Script | Purpose |
|--------|---------|
| `python/verify_conjunction.py` | Deep verification of WV3/Starlink-35956 conjunction calculations. Includes embedded TLEs and detailed output. |
| `python/scan_alaska.py` | Scans Dec 18, 2025 for any WV3/Starlink passes over Alaska region. |
| `python/scan_dec17.py` | Compares Dec 17 vs Dec 18 approach geometry to understand orbital patterns. |
| `python/backpropagate_dec19.py` | Tests back-propagating Dec 19 (post-anomaly) TLE to Dec 18 imaging time. |
| `python/fetch_spacetrack.py` | Fetches historical TLEs from Space-Track.org GP_History API. Requires account credentials in `.env`. |
| `python/compare_with_spacetrack.py` | Compares conjunction results using Space-Track TLEs vs embedded TLEs. |

### Usage

```bash
# Run deep verification
uv run python python/verify_conjunction.py

# Scan for Alaska passes on Dec 18
uv run python python/scan_alaska.py

# Compare Dec 17 vs Dec 18 geometry
uv run python python/scan_dec17.py

# Back-propagate post-anomaly TLE
uv run python python/backpropagate_dec19.py

# Fetch historical TLEs (requires .env with credentials)
uv run python python/fetch_spacetrack.py

# Compare Space-Track vs embedded TLEs
uv run python python/compare_with_spacetrack.py
```

### Key Findings

The investigation revealed:
- Calculated closest approach: **350.4 km** at 2025-12-19 01:30:19 UTC over the Sea of Okhotsk
- Reported distance: **241 km** over Alaska
- The 110 km discrepancy is due to public TLEs not capturing the satellite's true post-anomaly orbit

---

## Screenshot Capture

<a id="screenshot-scripts"></a>

Playwright scripts for capturing documentation screenshots.

| Script | Description |
|--------|-------------|
| `scripts/capture-usage-screenshots.ts` | Captures UI screenshots for README/USAGE documentation. |
| `scripts/capture-blog-screenshots.ts` | Captures screenshots for blog post illustrations. |

### Usage

```bash
# Start dev server first
npm run dev &

# Capture usage screenshots
npx tsx scripts/capture-usage-screenshots.ts

# Capture blog screenshots
npx tsx scripts/capture-blog-screenshots.ts
```

Screenshots are saved to the `screenshots/` directory.

---

## Algorithm Verification

<a id="algorithm-verification"></a>

Both Python and TypeScript implementations use the same algorithm and produce identical results within 27 meters accuracy.

### Running Verification

```bash
# Run Python implementation
uv run python python/conjunctions.py --profile WV3-STARLINK35956-Picture

# Run TypeScript implementation
npx tsx scripts/conjunctions.ts --profile WV3-STARLINK35956-Picture

# Compare outputs
uv run python scripts/compare-conjunctions.py --verbose
```

### Algorithm Overview

1. **Load TLEs** for both satellites
2. **Propagate positions** at 30-second intervals over ±3 days using SGP4
3. **Detect local minima** in the distance function
4. **Refine to 100ms precision** using ternary search
5. **Output results** with geographic coordinates

### Verification Results

The comparison script verifies:
- Same number of conjunctions detected
- Time differences < 1 second
- Distance differences < 30 meters
- Geographic coordinate agreement

---

## Output Files

Analysis outputs are written to `public/data/output/`:

```
public/data/output/
├── conjunctions-*.csv           # Conjunction finder outputs
├── conjunctions-*.txt           # Report format outputs
└── envelope_analysis/
    └── envelope_*.json          # Envelope analysis results
```
