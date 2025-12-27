#!/usr/bin/env python3
"""
Scan Dec 17 and compare with Dec 18 to understand the geometry better.
"""

from datetime import datetime, timedelta, timezone
from verify_conjunction import (
    load_tles, pick_closest_tle, propagate, distance_km,
    eci_to_geodetic, WORLDVIEW3_TLES, STARLINK_TLES
)
import numpy as np


def scan_all_approaches(wv3_tles, starlink_tles, date_str, day_offset=0):
    """Scan a full day and find all local minima in distance."""
    base_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    start = base_date + timedelta(days=day_offset)
    end = start + timedelta(days=1) - timedelta(seconds=1)

    print(f"\nScanning {start.strftime('%Y-%m-%d')}...")

    current = start
    approaches = []
    prev_dist = None
    prev_time = None
    decreasing = False

    while current <= end:
        wv3_tle = pick_closest_tle(wv3_tles, current)
        starlink_tle = pick_closest_tle(starlink_tles, current)

        try:
            pos_wv3, _ = propagate(wv3_tle.satrec, current)
            pos_starlink, _ = propagate(starlink_tle.satrec, current)
            dist = distance_km(pos_wv3, pos_starlink)

            if prev_dist is not None:
                if dist < prev_dist:
                    decreasing = True
                elif decreasing and dist > prev_dist and prev_dist < 1000:
                    # Found a local minimum
                    lat_wv3, lon_wv3, alt_wv3 = eci_to_geodetic(
                        propagate(wv3_tle.satrec, prev_time)[0], prev_time
                    )
                    lat_sl, lon_sl, alt_sl = eci_to_geodetic(
                        propagate(starlink_tle.satrec, prev_time)[0], prev_time
                    )
                    approaches.append({
                        'time': prev_time,
                        'distance': prev_dist,
                        'wv3_lat': lat_wv3, 'wv3_lon': lon_wv3,
                        'sl_lat': lat_sl, 'sl_lon': lon_sl,
                    })
                    decreasing = False

            prev_dist = dist
            prev_time = current

        except ValueError:
            pass

        current += timedelta(seconds=30)

    return approaches


def main():
    print("=" * 70)
    print("Comparing Dec 17 and Dec 18 close approaches")
    print("=" * 70)

    wv3_tles = load_tles(WORLDVIEW3_TLES)
    starlink_tles = load_tles(STARLINK_TLES)

    # Scan both days
    dec17_approaches = scan_all_approaches(wv3_tles, starlink_tles, "2025-12-17")
    dec18_approaches = scan_all_approaches(wv3_tles, starlink_tles, "2025-12-18")

    print(f"\n{'='*70}")
    print(f"Dec 17 close approaches (< 1000 km):")
    print(f"{'='*70}")
    for a in sorted(dec17_approaches, key=lambda x: x['distance']):
        print(f"  {a['distance']:.1f} km at {a['time'].strftime('%H:%M:%S')} UTC")
        print(f"    WV3: {a['wv3_lat']:.1f}°, {a['wv3_lon']:.1f}°")
        print(f"    SL:  {a['sl_lat']:.1f}°, {a['sl_lon']:.1f}°")

    print(f"\n{'='*70}")
    print(f"Dec 18 close approaches (< 1000 km):")
    print(f"{'='*70}")
    if dec18_approaches:
        for a in sorted(dec18_approaches, key=lambda x: x['distance']):
            print(f"  {a['distance']:.1f} km at {a['time'].strftime('%H:%M:%S')} UTC")
            print(f"    WV3: {a['wv3_lat']:.1f}°, {a['wv3_lon']:.1f}°")
            print(f"    SL:  {a['sl_lat']:.1f}°, {a['sl_lon']:.1f}°")
    else:
        print("  None found!")



if __name__ == "__main__":
    main()
