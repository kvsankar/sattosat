#!/usr/bin/env python3
"""
Theoretical analysis of envelope periods based on orbital mechanics.

The envelope period is driven by differential precession and synodic effects.

Usage:
    uv run python python/envelope_theory.py
"""

import json
import math
from pathlib import Path

# Constants
EARTH_RADIUS_KM = 6378.137
MU = 398600.4418  # km^3/s^2
J2 = 1.08263e-3   # Earth's J2 coefficient


def orbital_period_minutes(altitude_km: float) -> float:
    """Calculate orbital period in minutes."""
    a = EARTH_RADIUS_KM + altitude_km
    period_s = 2 * math.pi * math.sqrt(a**3 / MU)
    return period_s / 60


def mean_motion_rad_s(altitude_km: float) -> float:
    """Mean motion in rad/s."""
    a = EARTH_RADIUS_KM + altitude_km
    return math.sqrt(MU / a**3)


def raan_precession_deg_day(altitude_km: float, inclination_deg: float) -> float:
    """
    RAAN precession rate due to J2 in degrees/day.
    Negative = westward drift (prograde orbits with i < 90 deg)
    Positive = eastward drift (retrograde orbits with i > 90 deg)
    """
    a = EARTH_RADIUS_KM + altitude_km
    n = mean_motion_rad_s(altitude_km)
    i = math.radians(inclination_deg)

    # d(RAAN)/dt = -3/2 * J2 * (Re/a)^2 * n * cos(i)
    raan_rate_rad_s = -1.5 * J2 * (EARTH_RADIUS_KM / a)**2 * n * math.cos(i)
    return math.degrees(raan_rate_rad_s) * 86400  # deg/day


def synodic_period_hours(period_a_min: float, period_b_min: float) -> float:
    """
    Synodic period - time for one satellite to lap the other.
    Returns infinity if periods are equal.
    """
    if abs(period_a_min - period_b_min) < 0.001:
        return float('inf')
    # 1/T_synodic = |1/T_a - 1/T_b|
    synodic_min = abs(period_a_min * period_b_min / (period_a_min - period_b_min))
    return synodic_min / 60  # hours


def differential_raan_period_hours(raan_rate_a: float, raan_rate_b: float) -> float:
    """
    Time for orbital planes to complete one full relative rotation.
    Based on differential RAAN precession rates.
    """
    diff_rate = abs(raan_rate_a - raan_rate_b)  # deg/day
    if diff_rate < 0.001:
        return float('inf')
    days_per_cycle = 360.0 / diff_rate
    return days_per_cycle * 24  # hours


def load_pairs_from_config():
    """Load satellite pairs with orbital parameters from config."""
    config_path = Path(__file__).parent / "satellite_pairs.json"
    with open(config_path, 'r') as f:
        config = json.load(f)

    pairs = []
    for p in config["pairs"]:
        # Skip pairs without observed envelope hours or orbital parameters
        if "observed_envelope_hours" not in p:
            continue
        if "approx_altitude_a_km" not in p:
            continue

        pairs.append({
            "name": p["description"].split("(")[0].strip(),  # Short name
            "alt_a": p["approx_altitude_a_km"],
            "inc_a": p["approx_inclination_a_deg"],
            "alt_b": p["approx_altitude_b_km"],
            "inc_b": p["approx_inclination_b_deg"],
            "observed": p["observed_envelope_hours"],
        })

    return pairs


def main():
    pairs = load_pairs_from_config()

    print("=" * 100)
    print("ENVELOPE PERIOD THEORETICAL ANALYSIS")
    print("=" * 100)
    print(f"\nLoaded {len(pairs)} pairs with observed envelope periods from config")
    print()

    print(f"{'Pair':<30} {'D Inc':>7} {'D Alt':>7} {'RAAN A':>10} {'RAAN B':>10} {'Diff RAAN':>11} {'Synodic':>9} {'Observed':>9}")
    print(f"{'':30} {'(deg)':>7} {'(km)':>7} {'(d/day)':>10} {'(d/day)':>10} {'(hrs)':>11} {'(hrs)':>9} {'(hrs)':>9}")
    print("-" * 100)

    for p in pairs:
        period_a = orbital_period_minutes(p["alt_a"])
        period_b = orbital_period_minutes(p["alt_b"])

        raan_a = raan_precession_deg_day(p["alt_a"], p["inc_a"])
        raan_b = raan_precession_deg_day(p["alt_b"], p["inc_b"])

        diff_raan_period = differential_raan_period_hours(raan_a, raan_b)
        synodic = synodic_period_hours(period_a, period_b)

        delta_inc = abs(p["inc_a"] - p["inc_b"])
        delta_alt = abs(p["alt_a"] - p["alt_b"])

        print(f"{p['name']:<30} {delta_inc:>7.1f} {delta_alt:>7.0f} {raan_a:>10.3f} {raan_b:>10.3f} "
              f"{diff_raan_period:>11.1f} {synodic:>9.1f} {p['observed']:>9.1f}")



if __name__ == "__main__":
    main()
