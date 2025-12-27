#!/usr/bin/env python3
"""
Quick analysis of WV3 orbital maneuver on Dec 17, 2024 and its effect on
the beat period with Starlink satellites.
"""

import math

# Constants
EARTH_RADIUS_KM = 6378.137
MU = 398600.4418  # km^3/s^2

def mean_motion_to_period_min(mean_motion_rev_day: float) -> float:
    """Convert mean motion (rev/day) to period (minutes)."""
    return 1440.0 / mean_motion_rev_day

def period_to_altitude_km(period_min: float) -> float:
    """Approximate altitude from period (circular orbit assumption)."""
    period_s = period_min * 60
    semi_major_axis = (MU * (period_s / (2 * math.pi)) ** 2) ** (1/3)
    return semi_major_axis - EARTH_RADIUS_KM

def synodic_period_hours(period_a_min: float, period_b_min: float) -> float:
    """Synodic period - time for one satellite to lap the other."""
    if abs(period_a_min - period_b_min) < 0.0001:
        return float('inf')
    synodic_min = abs(period_a_min * period_b_min / (period_a_min - period_b_min))
    return synodic_min / 60  # hours

print("=" * 70)
print("WV3 ORBITAL MANEUVER ANALYSIS - Dec 17, 2024 ~17:32 UTC")
print("=" * 70)

# TLE data from embedded/40115.tle
# Before maneuver (day 351.62, Dec 17 ~14:59 UTC):
before_mm = 14.85523650  # rev/day
before_ecc = 0.0005162

# After maneuver (day 352.23, Dec 18 ~05:32 UTC):
after_mm = 14.84660813  # rev/day
after_ecc = 0.0001686

# Starlink-32153 (healthy, from recent TLE)
starlink_mm = 15.06  # approximate, ~475 km altitude

print("\n--- WV3 ORBITAL PARAMETERS ---")
print(f"{'Parameter':<25} {'Before':>15} {'After':>15} {'Change':>15}")
print("-" * 70)

before_period = mean_motion_to_period_min(before_mm)
after_period = mean_motion_to_period_min(after_mm)
print(f"{'Mean Motion (rev/day)':<25} {before_mm:>15.6f} {after_mm:>15.6f} {after_mm - before_mm:>+15.6f}")
print(f"{'Period (min)':<25} {before_period:>15.4f} {after_period:>15.4f} {after_period - before_period:>+15.4f}")

before_alt = period_to_altitude_km(before_period)
after_alt = period_to_altitude_km(after_period)
print(f"{'Altitude (km)':<25} {before_alt:>15.1f} {after_alt:>15.1f} {after_alt - before_alt:>+15.1f}")

print(f"{'Eccentricity':<25} {before_ecc:>15.7f} {after_ecc:>15.7f} {after_ecc - before_ecc:>+15.7f}")

# Calculate beat period with a Starlink satellite
starlink_period = mean_motion_to_period_min(starlink_mm)
starlink_alt = period_to_altitude_km(starlink_period)

print(f"\n--- STARLINK REFERENCE (healthy, ~475 km) ---")
print(f"Mean Motion: {starlink_mm} rev/day")
print(f"Period: {starlink_period:.4f} min")
print(f"Altitude: {starlink_alt:.1f} km")

print(f"\n--- BEAT PERIOD WITH STARLINK ---")
print(f"{'Metric':<35} {'Before':>15} {'After':>15} {'Change':>15}")
print("-" * 80)

before_synodic = synodic_period_hours(before_period, starlink_period)
after_synodic = synodic_period_hours(after_period, starlink_period)
change_synodic = after_synodic - before_synodic
pct_change = (change_synodic / before_synodic) * 100

print(f"{'Synodic Period (hours)':<35} {before_synodic:>15.2f} {after_synodic:>15.2f} {change_synodic:>+15.2f}")
print(f"{'Synodic Period (days)':<35} {before_synodic/24:>15.3f} {after_synodic/24:>15.3f} {change_synodic/24:>+15.3f}")
print(f"{'% Change':<35} {'':>15} {'':>15} {pct_change:>+14.1f}%")

# Period difference drives synodic period
before_delta_T = abs(before_period - starlink_period)
after_delta_T = abs(after_period - starlink_period)
print(f"\n{'|T_wv3 - T_starlink| (min)':<35} {before_delta_T:>15.4f} {after_delta_T:>15.4f} {after_delta_T - before_delta_T:>+15.4f}")


# Let's also check with the anomalous STARLINK-35956
print("\n" + "=" * 70)
print("COMPARISON: STARLINK-35956 (anomalous, ~447 km, decaying)")
print("=" * 70)

# STARLINK-35956 was at lower altitude due to decay
starlink35956_alt = 447  # approximate from earlier analysis
starlink35956_period_s = 2 * math.pi * math.sqrt((EARTH_RADIUS_KM + starlink35956_alt)**3 / MU)
starlink35956_period = starlink35956_period_s / 60

before_synodic_35956 = synodic_period_hours(before_period, starlink35956_period)
after_synodic_35956 = synodic_period_hours(after_period, starlink35956_period)
change_35956 = after_synodic_35956 - before_synodic_35956

print(f"STARLINK-35956 period: {starlink35956_period:.4f} min (altitude ~{starlink35956_alt} km)")
print(f"\n{'Metric':<35} {'Before':>15} {'After':>15} {'Change':>15}")
print("-" * 80)
print(f"{'Synodic Period (hours)':<35} {before_synodic_35956:>15.2f} {after_synodic_35956:>15.2f} {change_35956:>+15.2f}")
print(f"{'Synodic Period (days)':<35} {before_synodic_35956/24:>15.3f} {after_synodic_35956/24:>15.3f} {change_35956/24:>+15.3f}")

