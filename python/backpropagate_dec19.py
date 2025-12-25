#!/usr/bin/env python3
"""
Back-propagate Dec 19 TLE to Dec 18 to see if it gives closer results.
"""

from datetime import datetime, timedelta, timezone
from verify_conjunction import (
    load_tles, pick_closest_tle, propagate, distance_km,
    eci_to_geodetic, WORLDVIEW3_TLES, TLERecord
)
import numpy as np

# Dec 19 post-anomaly TLE for Starlink-35956 (shows decay)
DEC19_STARLINK_TLE = (
    "1 66620U 25271D   25353.94998243 -.00389636  00000-0 -84825-2 0  9999",
    "2 66620  53.1593 152.7719 0001217  60.4895 299.6234 15.45204148  5322"
)

# Dec 18 normal TLEs for comparison
DEC18_STARLINK_TLES = [
    ("1 66620U 25271D   25352.27126318  .00039571  00000-0  71543-3 0  9992",
     "2 66620  53.1601 160.7823 0000850  76.6318 283.4786 15.49329114  5067"),
    ("1 66620U 25271D   25352.59380185  .00072798  00000-0  13029-2 0  9993",
     "2 66620  53.1598 159.2400 0001065  75.4151 284.6977 15.49350533  5117"),
    ("1 66620U 25271D   25352.85183634  .00034317  00000-0  62165-3 0  9993",
     "2 66620  53.1598 158.0059 0001202  74.9181 285.1961 15.49341209  5157"),
]


def is_over_alaska(lon: float, lat: float) -> bool:
    """Check if position is roughly over Alaska."""
    return -175 <= lon <= -130 and 50 <= lat <= 72


def find_approaches_with_tle(starlink_tle: TLERecord, wv3_tles: list,
                              start: datetime, end: datetime, step_seconds: float = 10):
    """Find all close approaches using a specific Starlink TLE."""
    approaches = []
    current = start
    prev_dist = None
    prev_time = None
    decreasing = False

    while current <= end:
        wv3_tle = pick_closest_tle(wv3_tles, current)

        try:
            pos_wv3, _ = propagate(wv3_tle.satrec, current)
            pos_starlink, _ = propagate(starlink_tle.satrec, current)
            dist = distance_km(pos_wv3, pos_starlink)

            # Detect local minimum
            if prev_dist is not None:
                if dist < prev_dist:
                    decreasing = True
                elif decreasing and dist > prev_dist and prev_dist < 1000:
                    # Found minimum at prev_time
                    lat_wv3, lon_wv3, alt_wv3 = eci_to_geodetic(
                        propagate(wv3_tle.satrec, prev_time)[0], prev_time
                    )
                    lat_sl, lon_sl, alt_sl = eci_to_geodetic(
                        propagate(starlink_tle.satrec, prev_time)[0], prev_time
                    )
                    approaches.append({
                        'time': prev_time,
                        'distance': prev_dist,
                        'wv3_lat': lat_wv3, 'wv3_lon': lon_wv3, 'wv3_alt': alt_wv3,
                        'sl_lat': lat_sl, 'sl_lon': lon_sl, 'sl_alt': alt_sl,
                    })
                    decreasing = False

            prev_dist = dist
            prev_time = current

        except Exception as e:
            pass

        current += timedelta(seconds=step_seconds)

    return sorted(approaches, key=lambda x: x['distance'])


def scan_for_241km(starlink_tle: TLERecord, wv3_tles: list,
                   start: datetime, end: datetime, step_seconds: float = 5):
    """Scan for times when distance is approximately 241 km."""
    matches = []
    current = start

    while current <= end:
        wv3_tle = pick_closest_tle(wv3_tles, current)

        try:
            pos_wv3, _ = propagate(wv3_tle.satrec, current)
            pos_starlink, _ = propagate(starlink_tle.satrec, current)
            dist = distance_km(pos_wv3, pos_starlink)

            if 235 <= dist <= 247:  # Within ~6 km of 241
                lat_wv3, lon_wv3, alt_wv3 = eci_to_geodetic(pos_wv3, current)
                lat_sl, lon_sl, alt_sl = eci_to_geodetic(pos_starlink, current)

                matches.append({
                    'time': current,
                    'distance': dist,
                    'wv3_lat': lat_wv3, 'wv3_lon': lon_wv3, 'wv3_alt': alt_wv3,
                    'sl_lat': lat_sl, 'sl_lon': lon_sl, 'sl_alt': alt_sl,
                    'wv3_over_alaska': is_over_alaska(lon_wv3, lat_wv3),
                })
        except:
            pass

        current += timedelta(seconds=step_seconds)

    return matches


def main():
    print("=" * 70)
    print("Back-propagating Dec 19 TLE to Dec 18")
    print("=" * 70)
    print()

    # Load WorldView-3 TLEs
    wv3_tles = load_tles(WORLDVIEW3_TLES)

    # Create TLE records
    dec19_tle = TLERecord.from_lines(DEC19_STARLINK_TLE[0], DEC19_STARLINK_TLE[1])
    dec18_tles = [TLERecord.from_lines(t[0], t[1]) for t in DEC18_STARLINK_TLES]

    print(f"Dec 19 TLE epoch: {dec19_tle.epoch.strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"Dec 19 TLE mean motion: {dec19_tle.mean_motion:.5f} rev/day (DECAYED)")
    print()
    print("Dec 18 TLE epochs (normal orbit):")
    for tle in dec18_tles:
        print(f"  {tle.epoch.strftime('%Y-%m-%d %H:%M:%S')} UTC - n={tle.mean_motion:.5f}")
    print()

    # Search window: Dec 18
    start = datetime(2025, 12, 18, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2025, 12, 18, 23, 59, 59, tzinfo=timezone.utc)

    # Test 1: Find close approaches using Dec 19 TLE
    print("=" * 70)
    print("TEST 1: Close approaches on Dec 18 using Dec 19 TLE (back-propagated)")
    print("=" * 70)

    approaches_dec19 = find_approaches_with_tle(dec19_tle, wv3_tles, start, end, step_seconds=30)

    if approaches_dec19:
        print(f"\nFound {len(approaches_dec19)} close approaches:\n")
        for i, a in enumerate(approaches_dec19[:10], 1):
            alaska = " [ALASKA]" if is_over_alaska(a['wv3_lon'], a['wv3_lat']) else ""
            print(f"{i:2d}. {a['distance']:.1f} km at {a['time'].strftime('%H:%M:%S')} UTC{alaska}")
            print(f"    WV3: {a['wv3_lat']:.1f}°, {a['wv3_lon']:.1f}°, {a['wv3_alt']:.0f} km")
            print(f"    SL:  {a['sl_lat']:.1f}°, {a['sl_lon']:.1f}°, {a['sl_alt']:.0f} km")
    else:
        print("\nNo close approaches < 1000 km found")

    # Test 2: Find close approaches using Dec 18 TLEs (for comparison)
    print("\n" + "=" * 70)
    print("TEST 2: Close approaches on Dec 18 using Dec 18 TLEs (normal)")
    print("=" * 70)

    approaches_dec18 = find_approaches_with_tle(dec18_tles[1], wv3_tles, start, end, step_seconds=30)

    if approaches_dec18:
        print(f"\nFound {len(approaches_dec18)} close approaches:\n")
        for i, a in enumerate(approaches_dec18[:10], 1):
            alaska = " [ALASKA]" if is_over_alaska(a['wv3_lon'], a['wv3_lat']) else ""
            print(f"{i:2d}. {a['distance']:.1f} km at {a['time'].strftime('%H:%M:%S')} UTC{alaska}")
            print(f"    WV3: {a['wv3_lat']:.1f}°, {a['wv3_lon']:.1f}°, {a['wv3_alt']:.0f} km")
    else:
        print("\nNo close approaches < 1000 km found")

    # Test 3: Scan for 241 km using Dec 19 TLE
    print("\n" + "=" * 70)
    print("TEST 3: Scanning for ~241 km distance using Dec 19 TLE")
    print("=" * 70)

    matches_241 = scan_for_241km(dec19_tle, wv3_tles, start, end, step_seconds=5)

    if matches_241:
        print(f"\nFound {len(matches_241)} times with distance 235-247 km:\n")
        for m in matches_241[:20]:
            alaska = " [ALASKA]" if m['wv3_over_alaska'] else ""
            print(f"  {m['distance']:.1f} km at {m['time'].strftime('%H:%M:%S')} UTC{alaska}")
            print(f"      WV3: {m['wv3_lat']:.1f}°, {m['wv3_lon']:.1f}°")

        # Check for Alaska matches
        alaska_matches = [m for m in matches_241 if m['wv3_over_alaska']]
        if alaska_matches:
            print(f"\n*** ALASKA MATCHES: {len(alaska_matches)} ***")
            for m in alaska_matches:
                print(f"  {m['distance']:.1f} km at {m['time'].strftime('%H:%M:%S')} UTC")
                print(f"      WV3: {m['wv3_lat']:.1f}°N, {abs(m['wv3_lon']):.1f}°W")
    else:
        print("\nNo times found with distance ~241 km")

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print()
    print("Reported: 241 km over Alaska on Dec 18")
    print()

    if approaches_dec19:
        closest = approaches_dec19[0]
        print(f"Dec 19 TLE (back-propagated): {closest['distance']:.1f} km at {closest['time'].strftime('%H:%M:%S')} UTC")
        print(f"  Location: {closest['wv3_lat']:.1f}°, {closest['wv3_lon']:.1f}°")

    if approaches_dec18:
        closest = approaches_dec18[0]
        print(f"Dec 18 TLE (normal orbit):    {closest['distance']:.1f} km at {closest['time'].strftime('%H:%M:%S')} UTC")
        print(f"  Location: {closest['wv3_lat']:.1f}°, {closest['wv3_lon']:.1f}°")


if __name__ == "__main__":
    main()
