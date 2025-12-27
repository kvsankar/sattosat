#!/usr/bin/env python3
"""
Compare conjunction outputs from Python and TypeScript implementations.

Usage:
    python scripts/compare-conjunctions.py
    python scripts/compare-conjunctions.py --profile WV3-STARLINK35956-Picture
"""

import argparse
import csv
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional


@dataclass
class Conjunction:
    time_utc: datetime
    distance_km: float
    relative_velocity_km_s: float
    sat_a_lat: float
    sat_a_lon: float
    sat_b_lat: float
    sat_b_lon: float


def load_csv(path: Path) -> List[Conjunction]:
    """Load conjunctions from CSV file."""
    conjunctions = []
    with open(path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            time_str = row['time_utc'].replace('Z', '+00:00')
            conjunctions.append(Conjunction(
                time_utc=datetime.fromisoformat(time_str),
                distance_km=float(row['distance_km']),
                relative_velocity_km_s=float(row['relative_velocity_km_s']),
                sat_a_lat=float(row['sat_a_lat']),
                sat_a_lon=float(row['sat_a_lon']),
                sat_b_lat=float(row['sat_b_lat']),
                sat_b_lon=float(row['sat_b_lon']),
            ))
    return conjunctions


def compare_conjunctions(
    python_conj: List[Conjunction],
    ts_conj: List[Conjunction],
    max_compare: int = 20,
    time_tolerance_ms: float = 500,
    distance_tolerance_km: float = 0.01,
    coord_tolerance_deg: float = 0.01
) -> dict:
    """Compare conjunctions and return comparison results."""
    results = {
        'matched': 0,
        'mismatched': 0,
        'differences': [],
        'python_only': [],
        'ts_only': [],
    }

    # Compare top N conjunctions
    for i, py in enumerate(python_conj[:max_compare]):
        # Find matching TS conjunction (by time proximity)
        best_match = None
        best_time_diff = float('inf')

        for ts in ts_conj:
            time_diff = abs((py.time_utc - ts.time_utc).total_seconds() * 1000)
            if time_diff < best_time_diff:
                best_time_diff = time_diff
                best_match = ts

        if best_match and best_time_diff <= time_tolerance_ms:
            # Check if values match within tolerances
            dist_diff = abs(py.distance_km - best_match.distance_km)
            vel_diff = abs(py.relative_velocity_km_s - best_match.relative_velocity_km_s)
            lat_a_diff = abs(py.sat_a_lat - best_match.sat_a_lat)
            lon_a_diff = abs(py.sat_a_lon - best_match.sat_a_lon)
            lat_b_diff = abs(py.sat_b_lat - best_match.sat_b_lat)
            lon_b_diff = abs(py.sat_b_lon - best_match.sat_b_lon)

            if (dist_diff <= distance_tolerance_km and
                lat_a_diff <= coord_tolerance_deg and
                lon_a_diff <= coord_tolerance_deg and
                lat_b_diff <= coord_tolerance_deg and
                lon_b_diff <= coord_tolerance_deg):
                results['matched'] += 1
            else:
                results['mismatched'] += 1
                results['differences'].append({
                    'index': i,
                    'python_time': py.time_utc.isoformat(),
                    'ts_time': best_match.time_utc.isoformat(),
                    'time_diff_ms': best_time_diff,
                    'dist_diff_km': dist_diff,
                    'vel_diff_km_s': vel_diff,
                    'lat_a_diff_deg': lat_a_diff,
                    'lon_a_diff_deg': lon_a_diff,
                    'lat_b_diff_deg': lat_b_diff,
                    'lon_b_diff_deg': lon_b_diff,
                })
        else:
            results['python_only'].append(py)

    return results


def main():
    parser = argparse.ArgumentParser(description='Compare Python and TypeScript conjunction outputs')
    parser.add_argument('--profile', '-p',
                        help='Profile name (e.g., WV3-STARLINK35956-Picture)')
    parser.add_argument('--norad-a', type=int,
                        help='NORAD ID of satellite A (for custom TLE runs)')
    parser.add_argument('--norad-b', type=int,
                        help='NORAD ID of satellite B (for custom TLE runs)')
    parser.add_argument('--max-compare', '-n', type=int, default=20,
                        help='Maximum number of conjunctions to compare (default: 20)')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Show detailed comparison')
    args = parser.parse_args()

    # Determine file identifier
    if args.profile:
        file_id = args.profile
    elif args.norad_a and args.norad_b:
        file_id = f"{args.norad_a}-{args.norad_b}"
    else:
        parser.error("Either --profile or both --norad-a and --norad-b are required")

    # Find output files
    project_root = Path(__file__).parent.parent
    output_dir = project_root / 'public' / 'data' / 'output'

    python_csv = output_dir / f'conjunctions-{file_id}-python.csv'
    ts_csv = output_dir / f'conjunctions-{file_id}-typescript.csv'

    if not python_csv.exists():
        print(f"Error: Python output not found: {python_csv}")
        if args.profile:
            print(f"Run: uv run python python/conjunctions.py --profile {args.profile}")
        else:
            print("Run the Python conjunction script with matching TLE files first")
        sys.exit(1)

    if not ts_csv.exists():
        print(f"Error: TypeScript output not found: {ts_csv}")
        if args.profile:
            print(f"Run: npx tsx scripts/conjunctions.ts --profile {args.profile}")
        else:
            print("Run the TypeScript conjunction script with matching TLE files first")
        sys.exit(1)

    # Load CSVs
    python_conj = load_csv(python_csv)
    ts_conj = load_csv(ts_csv)

    print("=" * 70)
    print("Conjunction Output Comparison")
    print("=" * 70)
    print()
    if args.profile:
        print(f"Profile: {args.profile}")
    else:
        print(f"NORAD IDs: {args.norad_a} vs {args.norad_b}")
    print(f"Python conjunctions: {len(python_conj)}")
    print(f"TypeScript conjunctions: {len(ts_conj)}")
    print()

    # Compare
    results = compare_conjunctions(python_conj, ts_conj, max_compare=args.max_compare)

    print(f"Compared top {args.max_compare} conjunctions:")
    print(f"  Matched: {results['matched']}")
    print(f"  Mismatched: {results['mismatched']}")
    print()

    if results['differences']:
        print("Differences found:")
        print("-" * 70)
        for diff in results['differences']:
            print(f"  Conjunction #{diff['index'] + 1}:")
            print(f"    Time diff: {diff['time_diff_ms']:.1f} ms")
            print(f"    Distance diff: {diff['dist_diff_km']:.6f} km")
            print(f"    Velocity diff: {diff['vel_diff_km_s']:.6f} km/s")
            print(f"    Lat A diff: {diff['lat_a_diff_deg']:.6f}°")
            print(f"    Lon A diff: {diff['lon_a_diff_deg']:.6f}°")
            print(f"    Lat B diff: {diff['lat_b_diff_deg']:.6f}°")
            print(f"    Lon B diff: {diff['lon_b_diff_deg']:.6f}°")
            print()

    if args.verbose:
        print("Top 10 conjunctions comparison:")
        print("-" * 70)
        print(f"{'#':<3} {'Time (UTC)':<25} {'Dist (km)':<12} {'Δ Dist':<10}")
        print("-" * 70)

        for i in range(min(10, len(python_conj))):
            py = python_conj[i]
            # Find matching TS
            for ts in ts_conj:
                time_diff = abs((py.time_utc - ts.time_utc).total_seconds() * 1000)
                if time_diff < 500:
                    dist_diff = py.distance_km - ts.distance_km
                    print(f"{i+1:<3} {py.time_utc.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]:<25} "
                          f"{py.distance_km:<12.3f} {dist_diff:+.6f}")
                    break

    # Summary
    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)

    compared_count = min(args.max_compare, len(python_conj))
    if results['matched'] == compared_count and not results['differences']:
        print()
        print(f"✓ All {compared_count} compared conjunctions match within tolerances!")
        print()
        print("Tolerances used:")
        print("  Time: ±500 ms")
        print("  Distance: ±0.01 km")
        print("  Coordinates: ±0.01°")
    elif results['matched'] > 0:
        print()
        print(f"✓ {results['matched']} of {compared_count} conjunctions match within tolerances.")
        if results['mismatched'] > 0:
            print(f"  {results['mismatched']} conjunctions have small differences (see above).")
    else:
        print()
        print("✗ No conjunctions matched within tolerances.")
        print("  This may indicate algorithm differences.")

    # Show closest approach comparison
    if python_conj and ts_conj:
        print()
        print("Closest approach:")
        print(f"  Python:     {python_conj[0].distance_km:.6f} km at {python_conj[0].time_utc.isoformat()}")
        print(f"  TypeScript: {ts_conj[0].distance_km:.6f} km at {ts_conj[0].time_utc.isoformat()}")
        print(f"  Difference: {abs(python_conj[0].distance_km - ts_conj[0].distance_km):.6f} km")


if __name__ == "__main__":
    main()
