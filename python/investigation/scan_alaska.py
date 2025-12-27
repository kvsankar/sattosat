#!/usr/bin/env python3
"""
Scan specifically for Dec 18, 2025 passes over Alaska.
Looking for any WorldView-3 / Starlink-35956 geometry over Alaska.

Checks BOTH scenarios:
1. When WorldView-3 is over Alaska (can it image Starlink?)
2. When Starlink is over Alaska (can WV3 image it from elsewhere?)
"""

from datetime import datetime, timedelta, timezone
from verify_conjunction import (
    load_tles, pick_closest_tle, propagate, distance_km,
    eci_to_geodetic, WORLDVIEW3_TLES, STARLINK_TLES
)


def is_over_alaska(lon: float, lat: float) -> bool:
    """Check if position is over Alaska including the full Aleutian chain.

    The Aleutians extend past the International Date Line to ~173°E.
    - Mainland Alaska: ~130°W to ~168°W, 55°N to 72°N
    - Aleutian Islands: ~165°W to ~173°E, 51°N to 55°N
    """
    # Mainland Alaska + eastern Aleutians (extended bounds)
    mainland = -180 <= lon <= -125 and 45 <= lat <= 75
    # Western Aleutians (past the date line, positive longitude)
    western_aleutians = 165 <= lon <= 180 and 50 <= lat <= 56
    return mainland or western_aleutians


def group_into_passes(samples: list) -> list:
    """Group samples into distinct passes (gap > 30 min = new pass)."""
    if not samples:
        return []
    passes = []
    current_pass = [samples[0]]
    for i in range(1, len(samples)):
        gap = (samples[i]['time'] - samples[i-1]['time']).total_seconds()
        if gap > 1800:  # 30 min gap = new pass
            passes.append(current_pass)
            current_pass = []
        current_pass.append(samples[i])
    passes.append(current_pass)
    return passes


def print_passes(passes: list, sat_name: str, other_name: str):
    """Print pass summary."""
    for i, pass_data in enumerate(passes, 1):
        min_entry = min(pass_data, key=lambda p: p['distance'])
        start_time = pass_data[0]['time']
        end_time = pass_data[-1]['time']
        duration = (end_time - start_time).total_seconds() / 60

        print(f"Pass {i}: {start_time.strftime('%H:%M:%S')} - {end_time.strftime('%H:%M:%S')} UTC ({duration:.1f} min)")
        print(f"  Min distance: {min_entry['distance']:.1f} km at {min_entry['time'].strftime('%H:%M:%S')} UTC")
        print(f"  {sat_name}: {min_entry['primary_lat']:.1f}°N, {min_entry['primary_lon']:.1f}°E, {min_entry['primary_alt']:.0f} km")
        print(f"  {other_name}: {min_entry['other_lat']:.1f}°N, {min_entry['other_lon']:.1f}°E, {min_entry['other_alt']:.0f} km")
        print()


def main():
    print("=" * 70)
    print("Scanning Dec 18, 2025 for Alaska imaging geometry")
    print("=" * 70)
    print()

    wv3_tles = load_tles(WORLDVIEW3_TLES)
    starlink_tles = load_tles(STARLINK_TLES)

    # Scan entire Dec 18
    start = datetime(2025, 12, 18, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2025, 12, 18, 23, 59, 59, tzinfo=timezone.utc)

    print(f"Scanning {start.strftime('%Y-%m-%d')} at 10-second intervals...")
    print()

    current = start
    wv3_over_alaska = []
    starlink_over_alaska = []

    while current <= end:
        wv3_tle = pick_closest_tle(wv3_tles, current)
        starlink_tle = pick_closest_tle(starlink_tles, current)

        try:
            pos_wv3, _ = propagate(wv3_tle.satrec, current)
            pos_starlink, _ = propagate(starlink_tle.satrec, current)

            lat_wv3, lon_wv3, alt_wv3 = eci_to_geodetic(pos_wv3, current)
            lat_starlink, lon_starlink, alt_starlink = eci_to_geodetic(pos_starlink, current)
            dist = distance_km(pos_wv3, pos_starlink)

            sample = {
                'time': current,
                'distance': dist,
                'wv3_lat': lat_wv3, 'wv3_lon': lon_wv3, 'wv3_alt': alt_wv3,
                'starlink_lat': lat_starlink, 'starlink_lon': lon_starlink, 'starlink_alt': alt_starlink,
            }

            # Check if WorldView-3 is over Alaska
            if is_over_alaska(lon_wv3, lat_wv3):
                wv3_over_alaska.append({
                    **sample,
                    'primary_lat': lat_wv3, 'primary_lon': lon_wv3, 'primary_alt': alt_wv3,
                    'other_lat': lat_starlink, 'other_lon': lon_starlink, 'other_alt': alt_starlink,
                })

            # Check if Starlink is over Alaska
            if is_over_alaska(lon_starlink, lat_starlink):
                starlink_over_alaska.append({
                    **sample,
                    'primary_lat': lat_starlink, 'primary_lon': lon_starlink, 'primary_alt': alt_starlink,
                    'other_lat': lat_wv3, 'other_lon': lon_wv3, 'other_alt': alt_wv3,
                })

        except ValueError:
            pass

        current += timedelta(seconds=10)

    # ==================== SECTION 1: WV3 over Alaska ====================
    print("=" * 70)
    print("SCENARIO 1: WorldView-3 over Alaska (imaging outward)")
    print("=" * 70)
    print()

    if wv3_over_alaska:
        passes = group_into_passes(wv3_over_alaska)
        print(f"Found {len(wv3_over_alaska)} samples, {len(passes)} distinct passes\n")
        print_passes(passes, "WV3", "Starlink")

        overall_min = min(wv3_over_alaska, key=lambda p: p['distance'])
        print(f"CLOSEST while WV3 over Alaska: {overall_min['distance']:.1f} km at {overall_min['time'].strftime('%H:%M:%S')} UTC")
    else:
        print("No WorldView-3 passes over Alaska found")
    print()

    # ==================== SECTION 2: Starlink over Alaska ====================
    print("=" * 70)
    print("SCENARIO 2: Starlink over Alaska (WV3 imaging toward Alaska)")
    print("=" * 70)
    print()

    if starlink_over_alaska:
        passes = group_into_passes(starlink_over_alaska)
        print(f"Found {len(starlink_over_alaska)} samples, {len(passes)} distinct passes\n")
        print_passes(passes, "Starlink", "WV3")

        overall_min = min(starlink_over_alaska, key=lambda p: p['distance'])
        print(f"CLOSEST while Starlink over Alaska: {overall_min['distance']:.1f} km at {overall_min['time'].strftime('%H:%M:%S')} UTC")
        print(f"  Starlink: {overall_min['starlink_lat']:.1f}°N, {overall_min['starlink_lon']:.1f}°E, {overall_min['starlink_alt']:.0f} km")
        print(f"  WV3:      {overall_min['wv3_lat']:.1f}°N, {overall_min['wv3_lon']:.1f}°E, {overall_min['wv3_alt']:.0f} km")
    else:
        print("No Starlink passes over Alaska found")
    print()

    # ==================== SUMMARY ====================
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    wv3_min = min(wv3_over_alaska, key=lambda p: p['distance'])['distance'] if wv3_over_alaska else float('inf')
    sl_min = min(starlink_over_alaska, key=lambda p: p['distance'])['distance'] if starlink_over_alaska else float('inf')
    print(f"Closest approach with WV3 over Alaska:      {wv3_min:.1f} km")
    print(f"Closest approach with Starlink over Alaska: {sl_min:.1f} km")
    print(f"Reported imaging distance:                  241 km")
    print()
    if min(wv3_min, sl_min) > 500:
        print("CONCLUSION: Neither scenario produces a distance close to 241 km on Dec 18.")
    print("=" * 70)


if __name__ == "__main__":
    main()
