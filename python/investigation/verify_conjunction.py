#!/usr/bin/env python3
"""
Verify WorldView-3 / Starlink-35956 conjunction calculations.

This script investigates the discrepancy between:
- Reported imaging distance: 241 km (from Vantor/SpaceX)
- SatToSat calculated closest approach: 350.4 km at 2025-12-18 01:30:19 UTC

Usage:
    python verify_conjunction.py
"""

import math
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import List, Tuple, Optional

from sgp4.api import Satrec, jday
from sgp4 import exporter
import numpy as np


# =============================================================================
# TLE Data
# =============================================================================

# WorldView-3 (NORAD 40115) TLEs
WORLDVIEW3_TLES = [
    ("1 40115U 14048A   25350.34446038  .00001065  00000-0  12954-3 0  9991",
     "2 40115  97.8614  62.5794 0005054 173.0688 187.0598 14.85520725614770"),
    ("1 40115U 14048A   25350.95067920  .00000991  00000-0  12090-3 0  9995",
     "2 40115  97.8613  63.1780 0005108 171.1729 188.9577 14.85522182614862"),
    ("1 40115U 14048A   25351.28746733  .00000969  00000-0  11844-3 0  9999",
     "2 40115  97.8612  63.5105 0005130 170.1438 189.9878 14.85523011614910"),
    ("1 40115U 14048A   25351.62425533  .00000921  00000-0  11282-3 0  9993",
     "2 40115  97.8612  63.8431 0005162 169.1037 191.0291 14.85523650614960"),
    ("1 40115U 14048A   25351.82632810  .00000923  00000-0  11309-3 0  9995",
     "2 40115  97.8612  64.0426 0005176 168.4648 191.6687 14.85524143614998"),
    ("1 40115U 14048A   25352.23066906  .00000882  00000-0  11059-3 0  9994",
     "2 40115  97.8774  64.4419 0001686 140.5848 219.5489 14.84660813615050"),
    ("1 40115U 14048A   25352.63504949  .00000825  00000-0  10389-3 0  9994",
     "2 40115  97.8775  64.8416 0001682 139.1546 220.9795 14.84660894615119"),
    ("1 40115U 14048A   25352.90463620  .00000841  00000-0  10574-3 0  9998",
     "2 40115  97.8774  65.1080 0001711 138.8396 221.2947 14.84661456615153"),
    ("1 40115U 14048A   25353.24161950  .00000793  00000-0  10008-3 0  9995",
     "2 40115  97.8773  65.4410 0001733 138.3296 221.8051 14.84661803615204"),
    ("1 40115U 14048A   25353.64599932  .00000777  00000-0  98130-4 0  9999",
     "2 40115  97.8773  65.8405 0001761 137.8017 222.3333 14.84662431615261"),
]

# Starlink-35956 (NORAD 66620) TLEs
STARLINK_TLES = [
    ("1 66620U 25271D   25349.33335648  .00069454  00000-0  12476-2 0  9995",
     "2 66620  53.1595 174.8277 0000850  72.9145  91.6448 15.49265927  4665"),
    ("1 66620U 25271D   25349.91668981  .00078363  00000-0  14055-2 0  9992",
     "2 66620  53.1591 172.0407 0001030  67.3574 112.6206 15.49257406  4750"),
    ("1 66620U 25271D   25350.25003472  .00035242  00000-0  63952-3 0  9999",
     "2 66620  53.1588 170.4449 0000971  85.0403 155.2232 15.49279151  4804"),
    ("1 66620U 25271D   25350.91659374  .00072155  00000-0  12924-2 0  9996",
     "2 66620  53.1594 167.2583 0001011  73.6747 286.4374 15.49331814  4858"),
    ("1 66620U 25271D   25351.11012073  .00067036  00000-0  12027-2 0  9994",
     "2 66620  53.1595 166.3336 0001328  61.4490 298.6653 15.49318301  4880"),
    ("1 66620U 25271D   25351.62618341  .00066138  00000-0  11865-2 0  9991",
     "2 66620  53.1599 163.8656 0001254  90.3166 269.7987 15.49324687  4962"),
    ("1 66620U 25271D   25351.88421566  .00067856  00000-0  12164-2 0  9991",
     "2 66620  53.1598 162.6324 0000934  77.1817 282.9297 15.49335274  5001"),
    ("1 66620U 25271D   25352.27126318  .00039571  00000-0  71543-3 0  9992",
     "2 66620  53.1601 160.7823 0000850  76.6318 283.4786 15.49329114  5067"),
    ("1 66620U 25271D   25352.59380185  .00072798  00000-0  13029-2 0  9993",
     "2 66620  53.1598 159.2400 0001065  75.4151 284.6977 15.49350533  5117"),
    ("1 66620U 25271D   25352.85183634  .00034317  00000-0  62165-3 0  9993",
     "2 66620  53.1598 158.0059 0001202  74.9181 285.1961 15.49341209  5157"),
    # Post-anomaly TLEs showing decay
    ("1 66620U 25271D   25353.94998243 -.00389636  00000-0 -84825-2 0  9999",
     "2 66620  53.1593 152.7719 0001217  60.4895 299.6234 15.45204148  5322"),
    ("1 66620U 25271D   25355.96038664  .00072102  00000-0  17924-2 0  9996",
     "2 66620  53.1599 143.2712 0001851 170.8964 189.2075 15.39672113  5638"),
]


@dataclass
class TLERecord:
    """Parsed TLE with epoch and satellite record."""
    line1: str
    line2: str
    epoch: datetime
    satrec: Satrec
    mean_motion: float  # rev/day

    @classmethod
    def from_lines(cls, line1: str, line2: str) -> "TLERecord":
        satrec = Satrec.twoline2rv(line1, line2)
        # Parse epoch from line1
        epoch_str = line1[18:32].strip()
        year = int(epoch_str[:2])
        year = 2000 + year if year < 57 else 1900 + year
        day_of_year = float(epoch_str[2:])
        epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_of_year - 1)
        # Mean motion from line2
        mean_motion = float(line2[52:63])
        return cls(line1, line2, epoch, satrec, mean_motion)


def load_tles(tle_list: List[Tuple[str, str]]) -> List[TLERecord]:
    """Load and parse TLE records."""
    records = []
    for line1, line2 in tle_list:
        records.append(TLERecord.from_lines(line1, line2))
    return sorted(records, key=lambda r: r.epoch)


def pick_closest_tle(tles: List[TLERecord], target_time: datetime) -> TLERecord:
    """Pick TLE with epoch closest to target time."""
    return min(tles, key=lambda t: abs((t.epoch - target_time).total_seconds()))


def propagate(satrec: Satrec, dt: datetime) -> Tuple[np.ndarray, np.ndarray]:
    """Propagate satellite to given time, return position and velocity in km and km/s."""
    jd, fr = jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond/1e6)
    e, r, v = satrec.sgp4(jd, fr)
    if e != 0:
        raise ValueError(f"SGP4 error code: {e}")
    return np.array(r), np.array(v)


def distance_km(pos1: np.ndarray, pos2: np.ndarray) -> float:
    """Calculate distance between two positions in km."""
    return float(np.linalg.norm(pos1 - pos2))


def eci_to_geodetic(pos: np.ndarray, dt: datetime) -> Tuple[float, float, float]:
    """
    Convert ECI position to geodetic coordinates (lat, lon, alt).
    Simplified calculation using GMST for Earth rotation.
    """
    # Constants
    EARTH_RADIUS_KM = 6378.137
    EARTH_FLATTENING = 1/298.257223563

    x, y, z = pos

    # Calculate GMST (Greenwich Mean Sidereal Time)
    jd = (dt - datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)).total_seconds() / 86400.0 + 2451545.0
    t = (jd - 2451545.0) / 36525.0
    gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t**2
    gmst = gmst % 360
    gmst_rad = math.radians(gmst)

    # Rotate to ECEF
    x_ecef = x * math.cos(gmst_rad) + y * math.sin(gmst_rad)
    y_ecef = -x * math.sin(gmst_rad) + y * math.cos(gmst_rad)
    z_ecef = z

    # Calculate longitude
    lon = math.degrees(math.atan2(y_ecef, x_ecef))

    # Iterative calculation of latitude (accounting for Earth oblateness)
    p = math.sqrt(x_ecef**2 + y_ecef**2)
    e2 = 2 * EARTH_FLATTENING - EARTH_FLATTENING**2
    lat = math.atan2(z_ecef, p * (1 - e2))

    for _ in range(5):  # Iterate for convergence
        sin_lat = math.sin(lat)
        n = EARTH_RADIUS_KM / math.sqrt(1 - e2 * sin_lat**2)
        lat = math.atan2(z_ecef + e2 * n * sin_lat, p)

    # Altitude
    sin_lat = math.sin(lat)
    cos_lat = math.cos(lat)
    n = EARTH_RADIUS_KM / math.sqrt(1 - e2 * sin_lat**2)
    alt = p / cos_lat - n if abs(cos_lat) > 1e-10 else abs(z_ecef) - n * (1 - e2)

    return math.degrees(lat), lon, alt


def find_close_approaches(
    wv3_tles: List[TLERecord],
    starlink_tles: List[TLERecord],
    start_time: datetime,
    end_time: datetime,
    step_seconds: float = 30.0,
    threshold_km: float = 1000.0
) -> List[dict]:
    """
    Find all close approaches between satellites.
    Returns list of approach records with time, distance, positions.
    """
    approaches = []
    current = start_time
    prev_distance = None
    prev_time = None
    decreasing = False

    while current <= end_time:
        # Pick best TLEs for current time
        wv3_tle = pick_closest_tle(wv3_tles, current)
        starlink_tle = pick_closest_tle(starlink_tles, current)

        try:
            pos_wv3, vel_wv3 = propagate(wv3_tle.satrec, current)
            pos_starlink, vel_starlink = propagate(starlink_tle.satrec, current)
            dist = distance_km(pos_wv3, pos_starlink)

            # Detect local minimum
            if prev_distance is not None:
                if dist < prev_distance:
                    decreasing = True
                elif decreasing and dist > prev_distance:
                    # Found a local minimum at prev_time
                    # Refine with ternary search
                    refined = refine_minimum(
                        wv3_tles, starlink_tles,
                        prev_time - timedelta(seconds=step_seconds),
                        current,
                        precision_ms=100
                    )
                    if refined and refined['distance'] < threshold_km:
                        approaches.append(refined)
                    decreasing = False

            prev_distance = dist
            prev_time = current

        except ValueError:
            pass  # Skip propagation errors

        current += timedelta(seconds=step_seconds)

    return sorted(approaches, key=lambda a: a['distance'])


def refine_minimum(
    wv3_tles: List[TLERecord],
    starlink_tles: List[TLERecord],
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

        wv3_tle = pick_closest_tle(wv3_tles, t1)
        starlink_tle = pick_closest_tle(starlink_tles, t1)

        try:
            pos_wv3_1, _ = propagate(wv3_tle.satrec, t1)
            pos_starlink_1, _ = propagate(starlink_tle.satrec, t1)
            d1 = distance_km(pos_wv3_1, pos_starlink_1)
        except ValueError:
            return None

        wv3_tle = pick_closest_tle(wv3_tles, t2)
        starlink_tle = pick_closest_tle(starlink_tles, t2)

        try:
            pos_wv3_2, _ = propagate(wv3_tle.satrec, t2)
            pos_starlink_2, _ = propagate(starlink_tle.satrec, t2)
            d2 = distance_km(pos_wv3_2, pos_starlink_2)
        except ValueError:
            return None

        if d1 < d2:
            end = t2
        else:
            start = t1

    # Get final values at midpoint
    mid = start + (end - start) / 2
    wv3_tle = pick_closest_tle(wv3_tles, mid)
    starlink_tle = pick_closest_tle(starlink_tles, mid)

    try:
        pos_wv3, vel_wv3 = propagate(wv3_tle.satrec, mid)
        pos_starlink, vel_starlink = propagate(starlink_tle.satrec, mid)
        dist = distance_km(pos_wv3, pos_starlink)

        # Calculate relative velocity
        rel_vel = np.linalg.norm(vel_starlink - vel_wv3)

        # Get geodetic coordinates
        lat_wv3, lon_wv3, alt_wv3 = eci_to_geodetic(pos_wv3, mid)
        lat_starlink, lon_starlink, alt_starlink = eci_to_geodetic(pos_starlink, mid)

        return {
            'time': mid,
            'distance': dist,
            'relative_velocity': rel_vel,
            'wv3_tle_epoch': wv3_tle.epoch,
            'starlink_tle_epoch': starlink_tle.epoch,
            'starlink_mean_motion': starlink_tle.mean_motion,
            'wv3_position': {'lat': lat_wv3, 'lon': lon_wv3, 'alt': alt_wv3},
            'starlink_position': {'lat': lat_starlink, 'lon': lon_starlink, 'alt': alt_starlink},
        }
    except ValueError:
        return None


def scan_for_target_distance(
    wv3_tles: List[TLERecord],
    starlink_tles: List[TLERecord],
    start_time: datetime,
    end_time: datetime,
    target_distance: float,
    tolerance: float = 5.0,
    step_seconds: float = 10.0
) -> List[dict]:
    """
    Scan for times when distance is approximately equal to target.
    Returns all times where distance is within tolerance of target.
    """
    matches = []
    current = start_time

    while current <= end_time:
        wv3_tle = pick_closest_tle(wv3_tles, current)
        starlink_tle = pick_closest_tle(starlink_tles, current)

        try:
            pos_wv3, _ = propagate(wv3_tle.satrec, current)
            pos_starlink, _ = propagate(starlink_tle.satrec, current)
            dist = distance_km(pos_wv3, pos_starlink)

            if abs(dist - target_distance) <= tolerance:
                lat_wv3, lon_wv3, alt_wv3 = eci_to_geodetic(pos_wv3, current)
                lat_starlink, lon_starlink, alt_starlink = eci_to_geodetic(pos_starlink, current)

                matches.append({
                    'time': current,
                    'distance': dist,
                    'wv3_tle_epoch': wv3_tle.epoch,
                    'starlink_tle_epoch': starlink_tle.epoch,
                    'wv3_position': {'lat': lat_wv3, 'lon': lon_wv3, 'alt': alt_wv3},
                    'starlink_position': {'lat': lat_starlink, 'lon': lon_starlink, 'alt': alt_starlink},
                })
        except ValueError:
            pass

        current += timedelta(seconds=step_seconds)

    return matches


def format_position(pos: dict) -> str:
    """Format position dict as string."""
    lat = pos['lat']
    lon = pos['lon']
    lat_dir = 'N' if lat >= 0 else 'S'
    lon_dir = 'E' if lon >= 0 else 'W'
    return f"{abs(lat):.1f}°{lat_dir}, {abs(lon):.1f}°{lon_dir}, {pos['alt']:.0f} km"


def is_over_alaska(lon: float, lat: float) -> bool:
    """Check if position is over Alaska including the full Aleutian chain."""
    # Mainland Alaska + eastern Aleutians
    mainland = -180 <= lon <= -125 and 45 <= lat <= 75
    # Western Aleutians (past the date line)
    western_aleutians = 165 <= lon <= 180 and 50 <= lat <= 56
    return mainland or western_aleutians


def main():
    print("=" * 70)
    print("WorldView-3 / Starlink-35956 Conjunction Verification")
    print("=" * 70)
    print()

    # Load TLEs
    wv3_tles = load_tles(WORLDVIEW3_TLES)
    starlink_tles = load_tles(STARLINK_TLES)

    print(f"Loaded {len(wv3_tles)} WorldView-3 TLEs")
    print(f"Loaded {len(starlink_tles)} Starlink-35956 TLEs")
    print()

    # Print Starlink TLE epochs with mean motion
    print("Starlink-35956 TLE epochs and mean motion:")
    print("-" * 50)
    for tle in starlink_tles:
        print(f"  {tle.epoch.strftime('%Y-%m-%d %H:%M UTC')} - {tle.mean_motion:.5f} rev/day")
    print()

    # Define search window - Dec 17-19, 2025
    start_time = datetime(2025, 12, 17, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2025, 12, 19, 23, 59, 59, tzinfo=timezone.utc)

    print(f"Search window: {start_time.strftime('%Y-%m-%d %H:%M')} to {end_time.strftime('%Y-%m-%d %H:%M')} UTC")
    print()

    # ==========================================================================
    # Test 1: Find all close approaches
    # ==========================================================================
    print("=" * 70)
    print("TEST 1: Finding all close approaches (< 500 km)")
    print("=" * 70)

    approaches = find_close_approaches(
        wv3_tles, starlink_tles,
        start_time, end_time,
        step_seconds=30,
        threshold_km=500
    )

    print(f"\nFound {len(approaches)} close approaches:\n")
    for i, a in enumerate(approaches[:20], 1):  # Show top 20
        over_alaska = is_over_alaska(a['wv3_position']['lon'], a['wv3_position']['lat'])
        alaska_marker = " [ALASKA]" if over_alaska else ""
        print(f"{i:2d}. {a['distance']:.1f} km at {a['time'].strftime('%Y-%m-%d %H:%M:%S')} UTC{alaska_marker}")
        print(f"    Relative velocity: {a['relative_velocity']:.2f} km/s")
        print(f"    WorldView-3: {format_position(a['wv3_position'])}")
        print(f"    Starlink:    {format_position(a['starlink_position'])}")
        print(f"    TLE epochs - WV3: {a['wv3_tle_epoch'].strftime('%m-%d %H:%M')}, "
              f"Starlink: {a['starlink_tle_epoch'].strftime('%m-%d %H:%M')} (n={a['starlink_mean_motion']:.4f})")
        print()

    # ==========================================================================
    # Test 2: Search for 241 km distance
    # ==========================================================================
    print("=" * 70)
    print("TEST 2: Searching for times when distance ≈ 241 km")
    print("=" * 70)

    matches_241 = scan_for_target_distance(
        wv3_tles, starlink_tles,
        start_time, end_time,
        target_distance=241,
        tolerance=10,
        step_seconds=10
    )

    if matches_241:
        print(f"\nFound {len(matches_241)} times when distance was 231-251 km:\n")
        for m in matches_241[:10]:
            over_alaska = is_over_alaska(m['wv3_position']['lon'], m['wv3_position']['lat'])
            alaska_marker = " [ALASKA]" if over_alaska else ""
            print(f"  {m['distance']:.1f} km at {m['time'].strftime('%Y-%m-%d %H:%M:%S')} UTC{alaska_marker}")
            print(f"    WorldView-3: {format_position(m['wv3_position'])}")
            print(f"    Starlink:    {format_position(m['starlink_position'])}")
    else:
        print("\nNo times found where distance ≈ 241 km within tolerance.")
        print("This suggests the TLEs don't predict the reported imaging distance.")
    print()

    # ==========================================================================
    # Test 3: Test with post-anomaly TLE only
    # ==========================================================================
    print("=" * 70)
    print("TEST 3: Using post-anomaly Starlink TLE (Dec 19, n=15.452)")
    print("=" * 70)

    # Use only the post-anomaly TLE
    post_anomaly_tle = [t for t in starlink_tles if t.mean_motion < 15.47]
    if post_anomaly_tle:
        print(f"\nUsing Starlink TLE from {post_anomaly_tle[0].epoch.strftime('%Y-%m-%d %H:%M')} UTC")
        print(f"Mean motion: {post_anomaly_tle[0].mean_motion:.5f} rev/day (decayed)\n")

        approaches_post = find_close_approaches(
            wv3_tles, post_anomaly_tle,
            datetime(2025, 12, 18, 0, 0, 0, tzinfo=timezone.utc),
            datetime(2025, 12, 18, 23, 59, 59, tzinfo=timezone.utc),
            step_seconds=30,
            threshold_km=500
        )

        if approaches_post:
            print(f"Close approaches on Dec 18 using post-anomaly TLE:\n")
            for i, a in enumerate(approaches_post[:10], 1):
                over_alaska = is_over_alaska(a['wv3_position']['lon'], a['wv3_position']['lat'])
                alaska_marker = " [ALASKA]" if over_alaska else ""
                print(f"{i:2d}. {a['distance']:.1f} km at {a['time'].strftime('%H:%M:%S')} UTC{alaska_marker}")
                print(f"    WorldView-3: {format_position(a['wv3_position'])}")
        else:
            print("No close approaches found using post-anomaly TLE.")
    print()

    # ==========================================================================
    # Summary
    # ==========================================================================
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print()
    print("Reported: 241 km over Alaska on Dec 18, 2025")
    print()

    if approaches:
        closest = approaches[0]
        print(f"Calculated closest approach:")
        print(f"  Distance: {closest['distance']:.1f} km")
        print(f"  Time: {closest['time'].strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"  WorldView-3: {format_position(closest['wv3_position'])}")
        print(f"  Starlink: {format_position(closest['starlink_position'])}")
        print()
        print(f"Discrepancy: {closest['distance'] - 241:.1f} km")


if __name__ == "__main__":
    main()
