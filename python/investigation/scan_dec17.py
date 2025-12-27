#!/usr/bin/env python3
"""
Scan Dec 15-19 to understand the synodic (envelope) period pattern.
Shows all close approaches and time intervals between them.
"""

from datetime import datetime, timedelta, timezone
from verify_conjunction import (
    load_tles, pick_closest_tle, propagate, distance_km,
    eci_to_geodetic, WORLDVIEW3_TLES, STARLINK_TLES
)


def scan_approaches(wv3_tles, starlink_tles, start: datetime, end: datetime, threshold_km=1000):
    """Scan time range and find all local minima in distance below threshold."""
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
                elif decreasing and dist > prev_dist and prev_dist < threshold_km:
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

    return sorted(approaches, key=lambda x: x['time'])


def main():
    print("=" * 70)
    print("Synodic Period Analysis: Dec 15-19, 2025")
    print("=" * 70)
    print()
    print("Scanning for all close approaches (< 1000 km) over 5 days")
    print("to verify the ~44 hour envelope period pattern.")
    print()

    wv3_tles = load_tles(WORLDVIEW3_TLES)
    starlink_tles = load_tles(STARLINK_TLES)

    # Scan Dec 15-19
    start = datetime(2025, 12, 15, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2025, 12, 19, 23, 59, 59, tzinfo=timezone.utc)

    print(f"Scanning {start.strftime('%Y-%m-%d')} to {end.strftime('%Y-%m-%d')}...")
    approaches = scan_approaches(wv3_tles, starlink_tles, start, end)

    print(f"\nFound {len(approaches)} close approaches (< 1000 km):\n")

    # Print approaches grouped by day
    current_day = None
    for a in approaches:
        day = a['time'].strftime('%Y-%m-%d')
        if day != current_day:
            print(f"\n{'='*70}")
            print(f"{day}")
            print(f"{'='*70}")
            current_day = day
        print(f"  {a['distance']:6.1f} km at {a['time'].strftime('%H:%M:%S')} UTC  |  WV3: {a['wv3_lat']:5.1f}°, {a['wv3_lon']:6.1f}°  |  SL: {a['sl_lat']:5.1f}°, {a['sl_lon']:6.1f}°")

    # Compute intervals between closest approaches per envelope
    print(f"\n{'='*70}")
    print("ENVELOPE PERIOD ANALYSIS")
    print(f"{'='*70}")
    print()

    # Find the minimum distance approach for each ~12-hour window (envelope)
    envelopes = []
    if approaches:
        current_envelope = [approaches[0]]
        for i in range(1, len(approaches)):
            gap_hours = (approaches[i]['time'] - approaches[i-1]['time']).total_seconds() / 3600
            if gap_hours > 6:  # New envelope if gap > 6 hours
                # Save the minimum from current envelope
                min_approach = min(current_envelope, key=lambda x: x['distance'])
                envelopes.append(min_approach)
                current_envelope = []
            current_envelope.append(approaches[i])
        # Don't forget the last envelope
        if current_envelope:
            min_approach = min(current_envelope, key=lambda x: x['distance'])
            envelopes.append(min_approach)

    print("Envelope minima (closest approach per conjunction window):")
    print()
    print(f"{'#':<3} {'Date/Time':>20} {'Distance':>10} {'Interval':>12} {'Location'}")
    print("-" * 70)

    for i, env in enumerate(envelopes):
        interval_str = ""
        if i > 0:
            interval_hours = (env['time'] - envelopes[i-1]['time']).total_seconds() / 3600
            interval_str = f"{interval_hours:5.1f} hours"

        print(f"{i+1:<3} {env['time'].strftime('%Y-%m-%d %H:%M'):<20} {env['distance']:8.1f} km  {interval_str:>12}   {env['wv3_lat']:5.1f}°N, {env['wv3_lon']:6.1f}°E")

    # Calculate average interval
    if len(envelopes) > 1:
        intervals = []
        for i in range(1, len(envelopes)):
            interval_hours = (envelopes[i]['time'] - envelopes[i-1]['time']).total_seconds() / 3600
            intervals.append(interval_hours)
        avg_interval = sum(intervals) / len(intervals)
        print()
        print(f"Average envelope period: {avg_interval:.1f} hours ({avg_interval/24:.2f} days)")
        print(f"Expected (synodic):      ~44 hours (~1.8 days)")

    # Check for Dec 18 specifically
    print(f"\n{'='*70}")
    print("DEC 18 ANALYSIS")
    print(f"{'='*70}")
    dec18_approaches = [a for a in approaches if a['time'].day == 18]
    if dec18_approaches:
        min_dec18 = min(dec18_approaches, key=lambda x: x['distance'])
        print(f"Closest approach on Dec 18: {min_dec18['distance']:.1f} km at {min_dec18['time'].strftime('%H:%M:%S')} UTC")
    else:
        print("No approaches < 1000 km on Dec 18!")

    # Note about the WV3 maneuver
    print()
    print("NOTE: WV3 performed an orbital maneuver on Dec 17 ~17:32 UTC.")
    print("This may affect the approach pattern after that time.")
    print("=" * 70)


if __name__ == "__main__":
    main()
