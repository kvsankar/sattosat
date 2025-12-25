#!/usr/bin/env python3
"""
Satellite conjunction finder.

Finds close approaches between two satellites using SGP4 propagation.
Outputs results to CSV for verification against web app.

Usage:
    # Using a profile:
    python conjunctions.py --profile WV3-STARLINK35956-Picture

    # Using TLE files:
    python conjunctions.py --tle-a path/to/sat_a.tle --tle-b path/to/sat_b.tle --anchor 2025-12-19T01:30:19Z

Output CSV columns:
    time_utc, distance_km, relative_velocity_km_s, sat_a_lat, sat_a_lon, sat_b_lat, sat_b_lon
"""

import argparse
import csv
import json
import math
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
from sgp4.api import Satrec, jday


# Constants
SEARCH_RANGE_DAYS = 3
STEP_SECONDS = 30.0
THRESHOLD_KM = 1000.0
REFINE_PRECISION_MS = 100

# Data paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_INPUT = PROJECT_ROOT / "public" / "data" / "input"
DATA_OUTPUT = PROJECT_ROOT / "public" / "data" / "output"


@dataclass
class TLERecord:
    """Parsed TLE with epoch and satellite record."""
    line1: str
    line2: str
    epoch: datetime
    satrec: Satrec
    mean_motion: float

    @classmethod
    def from_lines(cls, line1: str, line2: str) -> "TLERecord":
        satrec = Satrec.twoline2rv(line1, line2)
        # Parse epoch from line1
        epoch_str = line1[18:32].strip()
        year = int(epoch_str[:2])
        year = 2000 + year if year < 57 else 1900 + year
        day_of_year = float(epoch_str[2:])
        epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_of_year - 1)
        mean_motion = float(line2[52:63])
        return cls(line1, line2, epoch, satrec, mean_motion)


def load_tle_file(path: Path) -> List[TLERecord]:
    """Load TLEs from a file (2 lines per TLE)."""
    content = path.read_text()
    lines = [l.strip() for l in content.split('\n') if l.strip()]
    records = []

    for i in range(0, len(lines) - 1, 2):
        line1 = lines[i]
        line2 = lines[i + 1]
        if line1.startswith('1 ') and line2.startswith('2 '):
            try:
                records.append(TLERecord.from_lines(line1, line2))
            except Exception as e:
                print(f"Warning: Could not parse TLE: {e}", file=sys.stderr)

    return sorted(records, key=lambda r: r.epoch)


def pick_closest_tle(tles: List[TLERecord], target_time: datetime) -> TLERecord:
    """Pick TLE with epoch closest to target time."""
    return min(tles, key=lambda t: abs((t.epoch - target_time).total_seconds()))


def propagate(satrec: Satrec, dt: datetime) -> Tuple[np.ndarray, np.ndarray]:
    """Propagate satellite to given time, return (position, velocity) in km and km/s."""
    jd, fr = jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond/1e6)
    e, r, v = satrec.sgp4(jd, fr)
    if e != 0:
        raise ValueError(f"SGP4 error code: {e}")
    return np.array(r), np.array(v)


def distance_km(pos1: np.ndarray, pos2: np.ndarray) -> float:
    """Calculate distance between two positions in km."""
    return float(np.linalg.norm(pos1 - pos2))


def eci_to_geodetic(pos: np.ndarray, dt: datetime) -> Tuple[float, float, float]:
    """Convert ECI position to geodetic coordinates (lat, lon, alt)."""
    EARTH_RADIUS_KM = 6378.137
    EARTH_FLATTENING = 1/298.257223563

    x, y, z = pos

    # Calculate GMST
    jd = (dt - datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)).total_seconds() / 86400.0 + 2451545.0
    t = (jd - 2451545.0) / 36525.0
    gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t**2
    gmst = gmst % 360
    gmst_rad = math.radians(gmst)

    # Rotate to ECEF
    x_ecef = x * math.cos(gmst_rad) + y * math.sin(gmst_rad)
    y_ecef = -x * math.sin(gmst_rad) + y * math.cos(gmst_rad)
    z_ecef = z

    # Longitude
    lon = math.degrees(math.atan2(y_ecef, x_ecef))

    # Latitude (iterative)
    p = math.sqrt(x_ecef**2 + y_ecef**2)
    e2 = 2 * EARTH_FLATTENING - EARTH_FLATTENING**2
    lat = math.atan2(z_ecef, p * (1 - e2))

    for _ in range(5):
        sin_lat = math.sin(lat)
        n = EARTH_RADIUS_KM / math.sqrt(1 - e2 * sin_lat**2)
        lat = math.atan2(z_ecef + e2 * n * sin_lat, p)

    # Altitude
    sin_lat = math.sin(lat)
    cos_lat = math.cos(lat)
    n = EARTH_RADIUS_KM / math.sqrt(1 - e2 * sin_lat**2)
    alt = p / cos_lat - n if abs(cos_lat) > 1e-10 else abs(z_ecef) - n * (1 - e2)

    return math.degrees(lat), lon, alt


def refine_minimum(
    tles_a: List[TLERecord],
    tles_b: List[TLERecord],
    start: datetime,
    end: datetime,
    precision_ms: int = 100
) -> Optional[dict]:
    """Refine a local minimum using ternary search."""
    precision = timedelta(milliseconds=precision_ms)

    while (end - start) > precision:
        third = (end - start) / 3
        t1 = start + third
        t2 = end - third

        try:
            tle_a = pick_closest_tle(tles_a, t1)
            tle_b = pick_closest_tle(tles_b, t1)
            pos_a_1, _ = propagate(tle_a.satrec, t1)
            pos_b_1, _ = propagate(tle_b.satrec, t1)
            d1 = distance_km(pos_a_1, pos_b_1)

            tle_a = pick_closest_tle(tles_a, t2)
            tle_b = pick_closest_tle(tles_b, t2)
            pos_a_2, _ = propagate(tle_a.satrec, t2)
            pos_b_2, _ = propagate(tle_b.satrec, t2)
            d2 = distance_km(pos_a_2, pos_b_2)
        except ValueError:
            return None

        if d1 < d2:
            end = t2
        else:
            start = t1

    # Get final values at midpoint
    mid = start + (end - start) / 2
    tle_a = pick_closest_tle(tles_a, mid)
    tle_b = pick_closest_tle(tles_b, mid)

    try:
        pos_a, vel_a = propagate(tle_a.satrec, mid)
        pos_b, vel_b = propagate(tle_b.satrec, mid)
        dist = distance_km(pos_a, pos_b)
        rel_vel = float(np.linalg.norm(vel_b - vel_a))
        lat_a, lon_a, _ = eci_to_geodetic(pos_a, mid)
        lat_b, lon_b, _ = eci_to_geodetic(pos_b, mid)

        return {
            'time': mid,
            'distance': dist,
            'relative_velocity': rel_vel,
            'sat_a_lat': lat_a,
            'sat_a_lon': lon_a,
            'sat_b_lat': lat_b,
            'sat_b_lon': lon_b,
        }
    except ValueError:
        return None


def find_conjunctions(
    tles_a: List[TLERecord],
    tles_b: List[TLERecord],
    start_time: datetime,
    end_time: datetime,
    step_seconds: float = STEP_SECONDS,
    threshold_km: float = THRESHOLD_KM
) -> List[dict]:
    """Find all close approaches between two satellites."""
    conjunctions = []
    current = start_time
    prev_distance = None
    prev_time = None
    decreasing = False

    while current <= end_time:
        tle_a = pick_closest_tle(tles_a, current)
        tle_b = pick_closest_tle(tles_b, current)

        try:
            pos_a, _ = propagate(tle_a.satrec, current)
            pos_b, _ = propagate(tle_b.satrec, current)
            dist = distance_km(pos_a, pos_b)

            if prev_distance is not None:
                if dist < prev_distance:
                    decreasing = True
                elif decreasing and dist > prev_distance:
                    # Found a local minimum - refine it
                    refined = refine_minimum(
                        tles_a, tles_b,
                        prev_time - timedelta(seconds=step_seconds),
                        current,
                        precision_ms=REFINE_PRECISION_MS
                    )
                    if refined and refined['distance'] < threshold_km:
                        conjunctions.append(refined)
                    decreasing = False

            prev_distance = dist
            prev_time = current

        except ValueError:
            pass

        current += timedelta(seconds=step_seconds)

    return sorted(conjunctions, key=lambda c: c['distance'])


def load_profile(name: str) -> dict:
    """Load profile from profiles.json."""
    profiles_path = DATA_INPUT / "profiles.json"
    if not profiles_path.exists():
        raise FileNotFoundError(f"Profiles file not found: {profiles_path}")

    with open(profiles_path) as f:
        profiles = json.load(f)

    for profile in profiles:
        if profile['name'] == name:
            return profile

    available = [p['name'] for p in profiles]
    raise ValueError(f"Profile '{name}' not found. Available: {available}")


def write_csv(conjunctions: List[dict], output_path: Path):
    """Write conjunctions to CSV file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'time_utc', 'distance_km', 'relative_velocity_km_s',
            'sat_a_lat', 'sat_a_lon', 'sat_b_lat', 'sat_b_lon'
        ])

        for c in conjunctions:
            writer.writerow([
                c['time'].strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
                f"{c['distance']:.6f}",
                f"{c['relative_velocity']:.6f}",
                f"{c['sat_a_lat']:.6f}",
                f"{c['sat_a_lon']:.6f}",
                f"{c['sat_b_lat']:.6f}",
                f"{c['sat_b_lon']:.6f}",
            ])


def main():
    parser = argparse.ArgumentParser(
        description='Find satellite conjunctions and output to CSV',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--profile', '-p', help='Profile name from profiles.json')
    parser.add_argument('--tle-a', type=Path, help='TLE file for satellite A')
    parser.add_argument('--tle-b', type=Path, help='TLE file for satellite B')
    parser.add_argument('--anchor', help='Anchor time (ISO format, e.g., 2025-12-19T01:30:19Z)')
    parser.add_argument('--output', '-o', type=Path, help='Output CSV path (default: auto-generated)')
    parser.add_argument('--threshold', type=float, default=THRESHOLD_KM,
                        help=f'Maximum distance threshold in km (default: {THRESHOLD_KM})')
    parser.add_argument('--quiet', '-q', action='store_true', help='Suppress progress output')

    args = parser.parse_args()

    # Validate arguments
    if args.profile and (args.tle_a or args.tle_b):
        parser.error("Cannot use --profile with --tle-a/--tle-b")

    if not args.profile and not (args.tle_a and args.tle_b):
        parser.error("Must specify either --profile or both --tle-a and --tle-b")

    if args.tle_a and args.tle_b and not args.anchor:
        parser.error("--anchor is required when using --tle-a/--tle-b")

    # Load TLEs
    if args.profile:
        profile = load_profile(args.profile)
        anchor = datetime.fromisoformat(profile['anchor'].replace('Z', '+00:00'))

        # Load TLEs for each satellite
        sat_a = profile['satellites'][0]
        sat_b = profile['satellites'][1]

        if sat_a.get('tleFile'):
            tles_a = load_tle_file(DATA_INPUT / sat_a['tleFile'])
        else:
            # Embedded TLEs not supported in CLI - require file reference
            raise ValueError("Profile must use tleFile references for CLI usage")

        if sat_b.get('tleFile'):
            tles_b = load_tle_file(DATA_INPUT / sat_b['tleFile'])
        else:
            raise ValueError("Profile must use tleFile references for CLI usage")

        output_name = f"conjunctions-{args.profile}-python.csv"
    else:
        tles_a = load_tle_file(args.tle_a)
        tles_b = load_tle_file(args.tle_b)
        anchor = datetime.fromisoformat(args.anchor.replace('Z', '+00:00'))
        output_name = f"conjunctions-custom-python.csv"

    # Calculate search window
    start_time = anchor - timedelta(days=SEARCH_RANGE_DAYS)
    end_time = anchor + timedelta(days=SEARCH_RANGE_DAYS)

    if not args.quiet:
        print(f"Loaded {len(tles_a)} TLEs for Sat A")
        print(f"Loaded {len(tles_b)} TLEs for Sat B")
        print(f"Search window: {start_time.isoformat()} to {end_time.isoformat()}")
        print(f"Finding conjunctions < {args.threshold} km...")

    # Find conjunctions
    conjunctions = find_conjunctions(
        tles_a, tles_b,
        start_time, end_time,
        threshold_km=args.threshold
    )

    if not args.quiet:
        print(f"Found {len(conjunctions)} conjunctions")

    # Determine output path
    if args.output:
        output_path = args.output
    else:
        output_path = DATA_OUTPUT / output_name

    # Write CSV
    write_csv(conjunctions, output_path)

    if not args.quiet:
        print(f"Output written to: {output_path}")

        if conjunctions:
            print(f"\nClosest approach:")
            c = conjunctions[0]
            print(f"  Time: {c['time'].strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} UTC")
            print(f"  Distance: {c['distance']:.2f} km")
            print(f"  Relative velocity: {c['relative_velocity']:.2f} km/s")


if __name__ == "__main__":
    main()
