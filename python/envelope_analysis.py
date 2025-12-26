#!/usr/bin/env python3
"""
Distance envelope analysis for satellite pairs.

Analyzes how orbital parameters affect the distance envelope pattern:
- Envelope period (time between successive minima)
- Minimum distance distribution
- Correlation with inclination, altitude, RAAN difference, etc.

Usage:
    uv run python python/envelope_analysis.py
"""

import json
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Tuple, Optional
import sys

import numpy as np
from sgp4.api import Satrec, jday

# Constants
EARTH_RADIUS_KM = 6378.137
MU = 398600.4418  # km^3/s^2

PROJECT_ROOT = Path(__file__).parent.parent


@dataclass
class OrbitalElements:
    """Orbital elements extracted from TLE."""
    norad_id: int
    name: str
    inclination: float  # degrees
    raan: float  # degrees (Right Ascension of Ascending Node)
    eccentricity: float
    arg_perigee: float  # degrees
    mean_anomaly: float  # degrees
    mean_motion: float  # revs/day
    altitude_km: float  # approximate (circular orbit assumption)
    period_min: float  # orbital period in minutes
    epoch: datetime
    satrec: Satrec
    line1: str
    line2: str


@dataclass
class EnvelopeResult:
    """Results of envelope analysis for a satellite pair."""
    sat_a: OrbitalElements
    sat_b: OrbitalElements

    # Distance samples
    times: List[datetime]
    distances: List[float]

    # Local minima (every close approach)
    minima_times: List[datetime]
    minima_distances: List[float]

    # Envelope minima (deepest dips - the "scallop bottoms")
    envelope_minima_times: List[datetime]
    envelope_minima_distances: List[float]

    # Derived metrics
    approach_periods: List[float]  # hours between successive close approaches
    mean_approach_period: float  # hours
    envelope_periods: List[float]  # hours between successive envelope bottoms
    mean_envelope_period: float  # hours
    min_distance: float
    max_min_distance: float  # max of the local minima

    # Orbital parameter differences
    delta_inclination: float
    delta_altitude: float
    delta_raan: float
    relative_velocity_range: Tuple[float, float]  # min, max km/s


def parse_tle(line1: str, line2: str, name: str = "") -> OrbitalElements:
    """Parse TLE lines into orbital elements."""
    satrec = Satrec.twoline2rv(line1, line2)

    # Parse epoch
    epoch_str = line1[18:32].strip()
    year = int(epoch_str[:2])
    year = 2000 + year if year < 57 else 1900 + year
    day_of_year = float(epoch_str[2:])
    epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_of_year - 1)

    # Extract elements
    inclination = float(line2[8:16])
    raan = float(line2[17:25])
    eccentricity = float('0.' + line2[26:33])
    arg_perigee = float(line2[34:42])
    mean_anomaly = float(line2[43:51])
    mean_motion = float(line2[52:63])
    norad_id = int(line1[2:7])

    # Calculate derived parameters
    period_min = 1440.0 / mean_motion  # minutes
    period_sec = period_min * 60
    semi_major_axis = (MU * (period_sec / (2 * math.pi)) ** 2) ** (1/3)
    altitude_km = semi_major_axis - EARTH_RADIUS_KM  # Approximate for circular

    return OrbitalElements(
        norad_id=norad_id,
        name=name or f"NORAD-{norad_id}",
        inclination=inclination,
        raan=raan,
        eccentricity=eccentricity,
        arg_perigee=arg_perigee,
        mean_anomaly=mean_anomaly,
        mean_motion=mean_motion,
        altitude_km=altitude_km,
        period_min=period_min,
        epoch=epoch,
        satrec=satrec,
        line1=line1,
        line2=line2,
    )


def propagate(satrec: Satrec, dt: datetime) -> Tuple[np.ndarray, np.ndarray]:
    """Propagate satellite to given time, return (position, velocity) in km and km/s."""
    jd, fr = jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond/1e6)
    e, r, v = satrec.sgp4(jd, fr)
    if e != 0:
        raise ValueError(f"SGP4 error code: {e}")
    return np.array(r), np.array(v)


def sample_distances(
    sat_a: OrbitalElements,
    sat_b: OrbitalElements,
    start_time: datetime,
    duration_days: float,
    step_minutes: float = 1.0
) -> Tuple[List[datetime], List[float], List[float]]:
    """
    Sample distances between two satellites over time.
    Returns (times, distances, relative_velocities).
    """
    times = []
    distances = []
    rel_velocities = []

    current = start_time
    end_time = start_time + timedelta(days=duration_days)
    step = timedelta(minutes=step_minutes)

    while current <= end_time:
        try:
            pos_a, vel_a = propagate(sat_a.satrec, current)
            pos_b, vel_b = propagate(sat_b.satrec, current)

            dist = float(np.linalg.norm(pos_b - pos_a))
            rel_vel = float(np.linalg.norm(vel_b - vel_a))

            times.append(current)
            distances.append(dist)
            rel_velocities.append(rel_vel)
        except ValueError:
            pass

        current += step

    return times, distances, rel_velocities


def find_local_minima(
    times: List[datetime],
    distances: List[float]
) -> Tuple[List[datetime], List[float]]:
    """Find local minima in distance curve."""
    minima_times = []
    minima_distances = []

    for i in range(1, len(distances) - 1):
        if distances[i] < distances[i-1] and distances[i] < distances[i+1]:
            minima_times.append(times[i])
            minima_distances.append(distances[i])

    return minima_times, minima_distances


def find_envelope_minima(
    minima_times: List[datetime],
    minima_distances: List[float],
    window_size: int = 5
) -> Tuple[List[datetime], List[float], List[float]]:
    """
    Find the lowest minima (envelope bottoms) among local minima.

    Uses a sliding window to find local minima within the minima sequence.
    Returns (times, distances, envelope_periods_in_hours).
    """
    if len(minima_times) < 3:
        return [], [], []

    envelope_times = []
    envelope_distances = []

    # Find local minima within the minima sequence
    # Use a larger window to find the "deepest dips"
    half_window = max(2, window_size // 2)

    for i in range(half_window, len(minima_distances) - half_window):
        # Check if this is the minimum in its neighborhood
        window_start = i - half_window
        window_end = i + half_window + 1
        window = minima_distances[window_start:window_end]

        if minima_distances[i] == min(window):
            # Also verify it's a true local minimum (lower than immediate neighbors)
            is_local_min = True
            for j in range(max(0, i-half_window), min(len(minima_distances), i+half_window+1)):
                if j != i and minima_distances[j] < minima_distances[i]:
                    is_local_min = False
                    break

            if is_local_min:
                # Avoid duplicates - only add if not too close to last added
                if not envelope_times or (minima_times[i] - envelope_times[-1]).total_seconds() > 3600:
                    envelope_times.append(minima_times[i])
                    envelope_distances.append(minima_distances[i])

    # Calculate periods between envelope minima
    envelope_periods = []
    for i in range(1, len(envelope_times)):
        delta_hours = (envelope_times[i] - envelope_times[i-1]).total_seconds() / 3600
        envelope_periods.append(delta_hours)

    return envelope_times, envelope_distances, envelope_periods


def analyze_envelope(
    sat_a: OrbitalElements,
    sat_b: OrbitalElements,
    duration_days: float = 6.0,
    step_minutes: float = 1.0
) -> EnvelopeResult:
    """Perform full envelope analysis for a satellite pair."""
    # Use the later of the two epochs as start time
    start_time = max(sat_a.epoch, sat_b.epoch)

    # Sample distances
    times, distances, rel_velocities = sample_distances(
        sat_a, sat_b, start_time, duration_days, step_minutes
    )

    # Find local minima (every close approach)
    minima_times, minima_distances = find_local_minima(times, distances)

    # Calculate approach periods (time between successive close approaches)
    approach_periods = []
    for i in range(1, len(minima_times)):
        delta_hours = (minima_times[i] - minima_times[i-1]).total_seconds() / 3600
        approach_periods.append(delta_hours)

    mean_approach_period = np.mean(approach_periods) if approach_periods else 0.0

    # Find envelope minima (the deepest dips - scallop bottoms)
    envelope_minima_times, envelope_minima_distances, envelope_periods = find_envelope_minima(
        minima_times, minima_distances, window_size=10
    )

    mean_envelope_period = np.mean(envelope_periods) if envelope_periods else 0.0

    # Calculate orbital parameter differences
    delta_inc = abs(sat_a.inclination - sat_b.inclination)
    delta_alt = abs(sat_a.altitude_km - sat_b.altitude_km)
    delta_raan = abs(sat_a.raan - sat_b.raan)
    if delta_raan > 180:
        delta_raan = 360 - delta_raan

    return EnvelopeResult(
        sat_a=sat_a,
        sat_b=sat_b,
        times=times,
        distances=distances,
        minima_times=minima_times,
        minima_distances=minima_distances,
        envelope_minima_times=envelope_minima_times,
        envelope_minima_distances=envelope_minima_distances,
        approach_periods=approach_periods,
        mean_approach_period=mean_approach_period,
        envelope_periods=envelope_periods,
        mean_envelope_period=mean_envelope_period,
        min_distance=min(minima_distances) if minima_distances else min(distances),
        max_min_distance=max(minima_distances) if minima_distances else max(distances),
        delta_inclination=delta_inc,
        delta_altitude=delta_alt,
        delta_raan=delta_raan,
        relative_velocity_range=(min(rel_velocities), max(rel_velocities)),
    )


def fetch_tle_from_celestrak(norad_id: int) -> Optional[OrbitalElements]:
    """Fetch current TLE from Celestrak."""
    import urllib.request

    url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={norad_id}&FORMAT=tle"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            content = response.read().decode('utf-8')
            lines = [l.strip() for l in content.split('\n') if l.strip()]

            # Find line1 and line2
            line1 = None
            line2 = None
            name = ""

            for i, line in enumerate(lines):
                if line.startswith('1 '):
                    line1 = line
                    if i > 0 and not lines[i-1].startswith('1 ') and not lines[i-1].startswith('2 '):
                        name = lines[i-1]
                elif line.startswith('2 '):
                    line2 = line

            if line1 and line2:
                return parse_tle(line1, line2, name)
    except Exception as e:
        print(f"Error fetching TLE for {norad_id}: {e}", file=sys.stderr)

    return None


def print_result_summary(result: EnvelopeResult):
    """Print summary of envelope analysis."""
    print(f"\n{'='*70}")
    print(f"Satellite Pair: {result.sat_a.name} ↔ {result.sat_b.name}")
    print(f"{'='*70}")

    print(f"\nOrbital Parameters:")
    print(f"  {'Parameter':<20} {'Sat A':>15} {'Sat B':>15} {'Delta':>12}")
    print(f"  {'-'*62}")
    print(f"  {'Altitude (km)':<20} {result.sat_a.altitude_km:>15.1f} {result.sat_b.altitude_km:>15.1f} {result.delta_altitude:>12.1f}")
    print(f"  {'Inclination (°)':<20} {result.sat_a.inclination:>15.2f} {result.sat_b.inclination:>15.2f} {result.delta_inclination:>12.2f}")
    print(f"  {'RAAN (°)':<20} {result.sat_a.raan:>15.2f} {result.sat_b.raan:>15.2f} {result.delta_raan:>12.2f}")
    print(f"  {'Period (min)':<20} {result.sat_a.period_min:>15.2f} {result.sat_b.period_min:>15.2f} {abs(result.sat_a.period_min - result.sat_b.period_min):>12.2f}")

    print(f"\nClose Approaches:")
    print(f"  Total approaches (6 days): {len(result.minima_times)}")
    print(f"  Mean approach period: {result.mean_approach_period:.2f} hours ({result.mean_approach_period*60:.1f} min)")
    print(f"  Minimum distance: {result.min_distance:.1f} km")
    print(f"  Maximum of minima: {result.max_min_distance:.1f} km")

    print(f"\nEnvelope (deepest dips):")
    print(f"  Number of envelope minima: {len(result.envelope_minima_times)}")
    if result.envelope_periods:
        print(f"  Mean envelope period: {result.mean_envelope_period:.2f} hours")
        print(f"  Envelope period range: {min(result.envelope_periods):.2f} - {max(result.envelope_periods):.2f} hours")
    else:
        print(f"  Mean envelope period: N/A (need more data)")

    print(f"\nRelative velocity: {result.relative_velocity_range[0]:.2f} - {result.relative_velocity_range[1]:.2f} km/s")


def save_envelope_data(result: EnvelopeResult, output_path: Path):
    """Save envelope data to JSON for visualization."""
    data = {
        'sat_a': {
            'norad_id': result.sat_a.norad_id,
            'name': result.sat_a.name,
            'altitude_km': result.sat_a.altitude_km,
            'inclination': result.sat_a.inclination,
            'raan': result.sat_a.raan,
            'period_min': result.sat_a.period_min,
        },
        'sat_b': {
            'norad_id': result.sat_b.norad_id,
            'name': result.sat_b.name,
            'altitude_km': result.sat_b.altitude_km,
            'inclination': result.sat_b.inclination,
            'raan': result.sat_b.raan,
            'period_min': result.sat_b.period_min,
        },
        'analysis': {
            'delta_altitude': result.delta_altitude,
            'delta_inclination': result.delta_inclination,
            'delta_raan': result.delta_raan,
            'min_distance_km': result.min_distance,
            'max_min_distance_km': result.max_min_distance,
            'num_approaches': len(result.minima_times),
            'mean_approach_period_hours': result.mean_approach_period,
            'num_envelope_minima': len(result.envelope_minima_times),
            'mean_envelope_period_hours': result.mean_envelope_period,
            'relative_velocity_min': result.relative_velocity_range[0],
            'relative_velocity_max': result.relative_velocity_range[1],
        },
        'minima': [
            {
                'time': t.isoformat(),
                'distance_km': d,
            }
            for t, d in zip(result.minima_times, result.minima_distances)
        ],
        'envelope_minima': [
            {
                'time': t.isoformat(),
                'distance_km': d,
            }
            for t, d in zip(result.envelope_minima_times, result.envelope_minima_distances)
        ],
        'approach_periods_hours': result.approach_periods,
        'envelope_periods_hours': result.envelope_periods,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)


def load_satellite_pairs() -> List[Tuple[int, int, str]]:
    """Load satellite pairs from config file."""
    config_path = Path(__file__).parent / "satellite_pairs.json"
    with open(config_path, 'r') as f:
        config = json.load(f)

    pairs = []
    for p in config["pairs"]:
        pairs.append((p["norad_a"], p["norad_b"], p["description"]))
    return pairs


def main():
    print("Distance Envelope Analysis")
    print("=" * 70)

    # Load pairs from config
    satellite_pairs = load_satellite_pairs()
    print(f"\nLoaded {len(satellite_pairs)} satellite pairs from config")
    print("Fetching TLEs from Celestrak...")

    # Collect all unique NORAD IDs
    all_ids = set()
    for id_a, id_b, _ in satellite_pairs:
        all_ids.add(id_a)
        all_ids.add(id_b)

    # Fetch TLEs
    satellites = {}
    for norad_id in sorted(all_ids):
        print(f"  Fetching {norad_id}...", end=" ", flush=True)
        sat = fetch_tle_from_celestrak(norad_id)
        if sat:
            satellites[norad_id] = sat
            print(f"OK ({sat.name})")
        else:
            print("FAILED")

    print(f"\nSuccessfully fetched {len(satellites)}/{len(all_ids)} satellites")

    # Analyze each pair
    results = []
    output_dir = PROJECT_ROOT / "public" / "data" / "output" / "envelope_analysis"

    for id_a, id_b, description in satellite_pairs:
        if id_a not in satellites or id_b not in satellites:
            print(f"\nSkipping: {description} (missing TLE)")
            continue

        sat_a = satellites[id_a]
        sat_b = satellites[id_b]

        print(f"\nAnalyzing: {description}")
        result = analyze_envelope(sat_a, sat_b, duration_days=14.0, step_minutes=1.0)
        results.append((description, result))

        print_result_summary(result)

        # Save to JSON
        filename = f"envelope_{id_a}_{id_b}.json"
        save_envelope_data(result, output_dir / filename)

    # Summary table
    print("\n" + "=" * 120)
    print("SUMMARY TABLE")
    print("=" * 120)
    print(f"{'Pair':<45} {'Δ Alt':>8} {'Δ Inc':>7} {'Δ RAAN':>8} {'Approach':>10} {'Envelope':>10} {'Min Dist':>10}")
    print(f"{'':45} {'(km)':>8} {'(°)':>7} {'(°)':>8} {'(hrs)':>10} {'(hrs)':>10} {'(km)':>10}")
    print("-" * 120)

    for desc, result in results:
        env_period = f"{result.mean_envelope_period:.2f}" if result.envelope_periods else "N/A"
        print(f"{desc:<45} {result.delta_altitude:>8.0f} {result.delta_inclination:>7.1f} "
              f"{result.delta_raan:>8.1f} {result.mean_approach_period:>10.2f} {env_period:>10} {result.min_distance:>10.1f}")

    print("\n" + "=" * 120)
    print("OBSERVATIONS")
    print("=" * 120)

    # Sort by envelope period to find patterns
    sorted_results = sorted(results, key=lambda x: x[1].mean_envelope_period if x[1].envelope_periods else 999)

    print("\nOrdered by envelope period (shortest to longest):")
    for desc, result in sorted_results:
        if result.envelope_periods:
            print(f"  {result.mean_envelope_period:>6.2f} hrs ({result.mean_envelope_period*60:.0f} min) - {desc}")
        else:
            print(f"     N/A - {desc}")

    print(f"\nData saved to: {output_dir}")


if __name__ == "__main__":
    main()
