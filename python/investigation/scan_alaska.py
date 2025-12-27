#!/usr/bin/env python3
"""
Scan specifically for Dec 18, 2025 passes over Alaska.
Looking for any WorldView-3 / Starlink-35956 geometry over Alaska.
"""

from datetime import datetime, timedelta, timezone
from verify_conjunction import (
    load_tles, pick_closest_tle, propagate, distance_km,
    eci_to_geodetic, WORLDVIEW3_TLES, STARLINK_TLES
)


def is_over_alaska(lon: float, lat: float) -> bool:
    """Check if position is roughly over Alaska (extended region)."""
    # Alaska roughly spans 130°W to 170°W, 50°N to 72°N
    # Extended to catch nearby passes
    return -175 <= lon <= -125 and 45 <= lat <= 75


def main():
    print("=" * 70)
    print("Scanning Dec 18, 2025 for passes over Alaska")
    print("=" * 70)
    print()

    wv3_tles = load_tles(WORLDVIEW3_TLES)
    starlink_tles = load_tles(STARLINK_TLES)

    # Scan entire Dec 18
    start = datetime(2025, 12, 18, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2025, 12, 18, 23, 59, 59, tzinfo=timezone.utc)

    print(f"Scanning {start.strftime('%Y-%m-%d')} at 10-second intervals...")
    print(f"Looking for WorldView-3 passes over Alaska region")
    print()

    current = start
    alaska_passes = []

    while current <= end:
        wv3_tle = pick_closest_tle(wv3_tles, current)
        starlink_tle = pick_closest_tle(starlink_tles, current)

        try:
            pos_wv3, _ = propagate(wv3_tle.satrec, current)
            pos_starlink, _ = propagate(starlink_tle.satrec, current)

            lat_wv3, lon_wv3, alt_wv3 = eci_to_geodetic(pos_wv3, current)
            lat_starlink, lon_starlink, alt_starlink = eci_to_geodetic(pos_starlink, current)

            # Check if WorldView-3 is over Alaska
            if is_over_alaska(lon_wv3, lat_wv3):
                dist = distance_km(pos_wv3, pos_starlink)
                alaska_passes.append({
                    'time': current,
                    'distance': dist,
                    'wv3_lat': lat_wv3,
                    'wv3_lon': lon_wv3,
                    'wv3_alt': alt_wv3,
                    'starlink_lat': lat_starlink,
                    'starlink_lon': lon_starlink,
                    'starlink_alt': alt_starlink,
                })

        except ValueError:
            pass

        current += timedelta(seconds=10)

    # Find continuous passes (group by time gaps)
    if alaska_passes:
        print(f"Found {len(alaska_passes)} samples with WorldView-3 over Alaska")
        print()

        # Group into passes (gap > 30 min = new pass)
        passes = []
        current_pass = [alaska_passes[0]]

        for i in range(1, len(alaska_passes)):
            gap = (alaska_passes[i]['time'] - alaska_passes[i-1]['time']).total_seconds()
            if gap > 1800:  # 30 min gap = new pass
                passes.append(current_pass)
                current_pass = []
            current_pass.append(alaska_passes[i])
        passes.append(current_pass)

        print(f"Identified {len(passes)} distinct passes over Alaska:\n")

        for i, pass_data in enumerate(passes, 1):
            min_dist = min(p['distance'] for p in pass_data)
            min_entry = min(pass_data, key=lambda p: p['distance'])
            start_time = pass_data[0]['time']
            end_time = pass_data[-1]['time']
            duration = (end_time - start_time).total_seconds() / 60

            print(f"Pass {i}: {start_time.strftime('%H:%M:%S')} - {end_time.strftime('%H:%M:%S')} UTC ({duration:.1f} min)")
            print(f"  Minimum distance: {min_dist:.1f} km at {min_entry['time'].strftime('%H:%M:%S')} UTC")
            print(f"  WorldView-3: {min_entry['wv3_lat']:.1f}°N, {min_entry['wv3_lon']:.1f}°W, {min_entry['wv3_alt']:.0f} km")
            print(f"  Starlink:    {min_entry['starlink_lat']:.1f}°, {min_entry['starlink_lon']:.1f}°, {min_entry['starlink_alt']:.0f} km")

            # Check if Starlink is also near Alaska
            starlink_over_alaska = is_over_alaska(min_entry['starlink_lon'], min_entry['starlink_lat'])
            if starlink_over_alaska:
                print(f"  *** BOTH satellites over Alaska! ***")
            print()

        # Find overall minimum during Alaska passes
        overall_min = min(alaska_passes, key=lambda p: p['distance'])
        print("=" * 70)
        print(f"CLOSEST APPROACH WHILE WV3 OVER ALASKA:")
        print(f"  Distance: {overall_min['distance']:.1f} km")
        print(f"  Time: {overall_min['time'].strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"  WorldView-3: {overall_min['wv3_lat']:.1f}°N, {overall_min['wv3_lon']:.1f}°, {overall_min['wv3_alt']:.0f} km")
        print(f"  Starlink:    {overall_min['starlink_lat']:.1f}°, {overall_min['starlink_lon']:.1f}°, {overall_min['starlink_alt']:.0f} km")
        print("=" * 70)
    else:
        print("No WorldView-3 passes over Alaska found on Dec 18, 2025")


if __name__ == "__main__":
    main()
