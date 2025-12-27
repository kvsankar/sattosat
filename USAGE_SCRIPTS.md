# SatToSat Analysis Scripts Guide

This guide documents the Python and TypeScript scripts for conjunction analysis and verification. These were developed to investigate the Starlink-35956 imaging event and to study satellite conjunction patterns.

For UI documentation, see [USAGE_UI.md](USAGE_UI.md).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Find Conjunctions Using a Profile](#find-conjunctions-using-a-profile)
3. [Find Conjunctions Using Custom TLEs](#find-conjunctions-using-custom-tles)
4. [Compare Python vs TypeScript Results](#compare-python-vs-typescript-results)
5. [Analyze Envelope Periods](#analyze-envelope-periods-empirical)
6. [Starlink-35956 Investigation Scripts](#investigate-a-specific-conjunction-event)
7. [Fetch Historical TLEs](#fetch-historical-tles)
8. [Capture Screenshots](#capture-screenshots)

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
uv run python scripts/compare-conjunctions.py --profile WV3-STARLINK35956-Picture --verbose
```

### Compare Custom TLE Results

```bash
# Step 1: Generate Python output (outputs conjunctions-40115-66620-python.csv)
uv run python python/conjunctions.py \
  --tle-a public/data/input/tles/40115.tle \
  --tle-b public/data/input/tles/66620.tle \
  --anchor 2025-12-19T01:30:19Z

# Step 2: Generate TypeScript output (outputs conjunctions-40115-66620-typescript.csv)
npx tsx scripts/conjunctions.ts \
  --tle-a public/data/input/tles/40115.tle \
  --tle-b public/data/input/tles/66620.tle \
  --anchor 2025-12-19T01:30:19Z

# Step 3: Compare using NORAD IDs
uv run python scripts/compare-conjunctions.py --norad-a 40115 --norad-b 66620 --verbose
```

**Script:** `scripts/compare-conjunctions.py`

### Output File Naming

| Run Type | Python Output | TypeScript Output |
|----------|---------------|-------------------|
| Profile | `conjunctions-{profile}-python.csv` | `conjunctions-{profile}-typescript.csv` |
| Custom TLEs | `conjunctions-{noradA}-{noradB}-python.csv` | `conjunctions-{noradA}-{noradB}-typescript.csv` |

### What Gets Verified

- Same number of conjunctions detected
- Time differences < 1 second
- Distance differences < 30 meters
- Geographic coordinate agreement

---

## Analyze Envelope Periods

<a id="analyze-envelope-periods-empirical"></a>

The "envelope period" is the time between successive closest approaches. This script analyzes envelope patterns both empirically (via SGP4 propagation) and theoretically (via synodic period formula).

```bash
# Use cached TLEs (fetches if cache is stale or missing)
uv run python python/envelope_analysis.py

# Force refresh TLEs from Celestrak
uv run python python/envelope_analysis.py --force-fetch
```

**Script:** `python/envelope_analysis.py`

### Satellite Pairs

Pairs are configured in `python/satellite_pairs.json`:

| Pair ID | Satellites | Notes |
|---------|------------|-------|
| `starlink_same_launch` | Two Starlinks from same launch | Same orbital plane - never get close |
| `starlink_diff_shells` | Starlink ~540km vs ~340km | ~89 hour envelope period |
| `iss_starlink` | ISS vs Starlink | ~120 hour envelope period |
| `iss_noaa20` | ISS vs NOAA-20 | ~18 hour envelope period |
| `noaa20_landsat9` | NOAA-20 vs Landsat-9 | Both sun-sync, ~64 hour envelope |
| `hubble_iss` | Hubble vs ISS | ~119 hour envelope period |
| `gps_iss` | GPS IIR-14 vs ISS | MEO vs LEO comparison |

For WV3-specific pairs, see [python/investigation/wv3_pairs.json](python/investigation/wv3_pairs.json).

### Output

- **Console:** Summary table with empirical envelope period, theoretical (synodic) period, min/max distances
- **JSON:** Files in `public/data/output/envelope_analysis/` with orbital elements, approach times, and envelope periods

### Theory

The theoretical envelope period follows the synodic period formula:

```
T_envelope = (T_a × T_b) / |T_a - T_b|
```

Where T_a and T_b are the orbital periods. This approximation works well for satellites in similar orbital planes.

See the [blog post](https://blog.sankara.net/posts/starlink-photo-investigation/) for detailed explanation.

---

## Starlink-35956 Investigation Scripts

<a id="investigate-a-specific-conjunction-event"></a>

Scripts in `python/investigation/` were created to investigate the Starlink-35956 imaging event of December 2025. These are one-off analysis scripts with documented results.

See **[python/investigation/README.md](python/investigation/README.md)** for:
- Each script's intent and methodology
- Verbatim output from each analysis
- Findings and conclusions

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

## Capture Screenshots

<a id="capture-screenshots"></a>

Playwright scripts for capturing documentation screenshots.

```bash
# Start dev server first
npm run dev &

npx tsx scripts/capture-usage-screenshots.ts
```

**Script:** `scripts/capture-usage-screenshots.ts`

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
