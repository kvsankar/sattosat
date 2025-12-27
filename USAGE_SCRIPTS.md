# SatToSat Analysis Scripts Guide

This guide documents the Python and TypeScript scripts for conjunction analysis and verification. These were developed to investigate the Starlink-35956 imaging event and to study satellite conjunction patterns.

For UI documentation, see [USAGE_UI.md](USAGE_UI.md).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Find Conjunctions Using a Profile](#find-conjunctions-using-a-profile)
3. [Find Conjunctions Using Custom TLEs](#find-conjunctions-using-custom-tles)
4. [Compare Python vs TypeScript Results](#compare-python-vs-typescript-results)
5. [Analyze Envelope Periods (Empirical)](#analyze-envelope-periods-empirical)
6. [Calculate Envelope Periods (Theoretical)](#calculate-envelope-periods-theoretical)
7. [Investigate a Specific Conjunction Event](#investigate-a-specific-conjunction-event)
8. [Fetch Historical TLEs](#fetch-historical-tles)
9. [Compare TLE Sources](#compare-tle-sources)
10. [Capture Screenshots](#capture-screenshots)

---

## Prerequisites

<a id="prerequisites"></a>

### Python Scripts

Python scripts use [uv](https://docs.astral.sh/uv/) for dependency management. Run from project root:

```bash
uv sync  # Install dependencies (creates .venv/)
```

### TypeScript Scripts

TypeScript scripts run via `npx tsx`:

```bash
npm install  # Install dependencies
```

### Space-Track.org Access

Some scripts require a Space-Track.org account. Create `.env` in project root:

```
SPACETRACK_USER=your_username
SPACETRACK_PASS=your_password
```

---

## Find Conjunctions Using a Profile

<a id="find-conjunctions-using-a-profile"></a>

Use a pre-configured profile to find close approaches between a known satellite pair.

### Using Python

```bash
# Basic usage - outputs CSV
uv run python python/conjunctions.py --profile WV3-STARLINK35956-Picture

# With detailed report (TLE info + formatted table)
uv run python python/conjunctions.py --profile WV3-STARLINK35956-Picture --report
```

**Script:** `python/conjunctions.py`

### Using TypeScript

```bash
npx tsx scripts/conjunctions.ts --profile WV3-STARLINK35956-Picture
```

**Script:** `scripts/conjunctions.ts`

### Available Profiles

Profiles are defined in `src/lib/profiles.json`:

| Profile | Satellites | Anchor Time |
|---------|------------|-------------|
| `WV3-STARLINK35956-Picture` | WorldView-3 vs Starlink-35956 | 2025-12-19T01:30:19Z |

### Output Format

CSV with columns:
- `time_utc`: Conjunction timestamp
- `distance_km`: Closest approach distance
- `relative_velocity_km_s`: Closing speed
- `sat_a_lat`, `sat_a_lon`: Satellite A ground position
- `sat_b_lat`, `sat_b_lon`: Satellite B ground position

---

## Find Conjunctions Using Custom TLEs

<a id="find-conjunctions-using-custom-tles"></a>

Specify your own TLE files and anchor time instead of using a profile.

### Using Python

```bash
uv run python python/conjunctions.py \
  --tle-a public/data/input/tles/40115.tle \
  --tle-b public/data/input/tles/66620.tle \
  --anchor 2025-12-19T01:30:19Z
```

**Script:** `python/conjunctions.py`

### Using TypeScript

```bash
npx tsx scripts/conjunctions.ts \
  --tle-a public/data/input/tles/40115.tle \
  --tle-b public/data/input/tles/66620.tle \
  --anchor 2025-12-19T01:30:19Z
```

**Script:** `scripts/conjunctions.ts`

### TLE File Format

Standard two-line element format with optional name line:

```
WORLDVIEW-3 (WV-3)
1 40115U 14048A   25351.62495440  .00004193  00000+0  33312-3 0  9993
2 40115  97.8915 317.9817 0005162  63.7251 296.4500 14.85523650549847
```

---

## Compare Python vs TypeScript Results

<a id="compare-python-vs-typescript-results"></a>

Verify that both implementations produce identical results (within 27 meters).

### Compare Profile-Based Results

```bash
# Step 1: Generate Python output
uv run python python/conjunctions.py --profile WV3-STARLINK35956-Picture

# Step 2: Generate TypeScript output
npx tsx scripts/conjunctions.ts --profile WV3-STARLINK35956-Picture

# Step 3: Compare
uv run python scripts/compare-conjunctions.py --verbose
```

### Compare Custom TLE Results

```bash
# Step 1: Generate Python output
uv run python python/conjunctions.py \
  --tle-a public/data/input/tles/40115.tle \
  --tle-b public/data/input/tles/66620.tle \
  --anchor 2025-12-19T01:30:19Z

# Step 2: Generate TypeScript output (same args)
npx tsx scripts/conjunctions.ts \
  --tle-a public/data/input/tles/40115.tle \
  --tle-b public/data/input/tles/66620.tle \
  --anchor 2025-12-19T01:30:19Z

# Step 3: Compare
uv run python scripts/compare-conjunctions.py --verbose
```

**Script:** `scripts/compare-conjunctions.py`

### What Gets Verified

- Same number of conjunctions detected
- Time differences < 1 second
- Distance differences < 30 meters
- Geographic coordinate agreement

---

## Analyze Envelope Periods (Empirical)

<a id="analyze-envelope-periods-empirical"></a>

The "envelope period" is the time between successive closest approaches. Analyze this pattern empirically from actual orbital data.

```bash
uv run python python/envelope_analysis.py
```

**Script:** `python/envelope_analysis.py`

### Satellite Pairs

Pairs are configured in `python/satellite_pairs.json`:

| Pair ID | Satellites | Notes |
|---------|------------|-------|
| `wv3_starlink_healthy` | WorldView-3 vs Starlink-32153 | ~51 hour envelope period |
| `wv3_starlink35956` | WorldView-3 vs Starlink-35956 | Anomalous satellite from Dec 2025 |
| `iss_noaa20` | ISS vs NOAA-20 | ~18 hour envelope period |
| `starlink_same_launch` | Two Starlinks from same launch | Never get close (same orbital plane) |

### Output

JSON files in `public/data/output/envelope_analysis/` containing:
- Orbital elements for both satellites
- Local minima (approach times and distances)
- Envelope periods between successive closest approaches

---

## Calculate Envelope Periods (Theoretical)

<a id="calculate-envelope-periods-theoretical"></a>

Calculate expected envelope periods from orbital mechanics theory.

```bash
uv run python python/envelope_theory.py
```

**Script:** `python/envelope_theory.py`

### Theory

The envelope period follows the synodic period formula:

```
T_envelope = (T_a × T_b) / |T_a - T_b|
```

Where T_a and T_b are the orbital periods. The script also accounts for J2 precession effects on RAAN.

See the [blog post](https://blog.sankara.net/posts/starlink-photo-investigation/) for detailed explanation.

---

## Investigate a Specific Conjunction Event

<a id="investigate-a-specific-conjunction-event"></a>

Scripts created to investigate the Starlink-35956 imaging event and the discrepancy between reported (241 km) and calculated (350 km) distances.

### Deep Verification

Comprehensive analysis of the WV3/Starlink-35956 conjunction:

```bash
uv run python python/verify_conjunction.py
```

**Script:** `python/verify_conjunction.py`

### Scan for Alaska Passes

Find all WV3/Starlink passes over Alaska on Dec 18, 2025:

```bash
uv run python python/scan_alaska.py
```

**Script:** `python/scan_alaska.py`

### Compare Dec 17 vs Dec 18 Geometry

Understand orbital patterns by comparing approaches on consecutive days:

```bash
uv run python python/scan_dec17.py
```

**Script:** `python/scan_dec17.py`

### Back-Propagate Post-Anomaly TLE

Test whether Dec 19 (post-anomaly) TLE can predict Dec 18 imaging conditions:

```bash
uv run python python/backpropagate_dec19.py
```

**Script:** `python/backpropagate_dec19.py`

### Analyze WV3 Maneuver Effects

Study how the Dec 17 WV3 orbital maneuver affected conjunction patterns:

```bash
uv run python python/wv3_maneuver_analysis.py
```

**Script:** `python/wv3_maneuver_analysis.py`

---

## Fetch Historical TLEs

<a id="fetch-historical-tles"></a>

Download TLE history from Space-Track.org (requires account).

```bash
# Requires .env with SPACETRACK_USER and SPACETRACK_PASS
uv run python python/fetch_spacetrack.py
```

**Script:** `python/fetch_spacetrack.py`

---

## Compare TLE Sources

<a id="compare-tle-sources"></a>

Compare conjunction results using Space-Track TLEs vs embedded TLEs.

```bash
uv run python python/compare_with_spacetrack.py
```

**Script:** `python/compare_with_spacetrack.py`

---

## Capture Screenshots

<a id="capture-screenshots"></a>

Playwright scripts for capturing documentation screenshots.

### Usage Screenshots (for README/USAGE docs)

```bash
# Start dev server first
npm run dev &

npx tsx scripts/capture-usage-screenshots.ts
```

**Script:** `scripts/capture-usage-screenshots.ts`

### Blog Screenshots

```bash
npm run dev &

npx tsx scripts/capture-blog-screenshots.ts
```

**Script:** `scripts/capture-blog-screenshots.ts`

Screenshots are saved to the `screenshots/` directory.

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

---

## Algorithm Overview

Both Python and TypeScript implementations use the same algorithm:

1. **Load TLEs** for both satellites
2. **Propagate positions** at 30-second intervals over ±3 days using SGP4
3. **Detect local minima** in the distance function
4. **Refine to 100ms precision** using ternary search
5. **Output results** with geographic coordinates
