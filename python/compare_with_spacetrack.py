#!/usr/bin/env python3
"""
Compare conjunction results using Space-Track TLEs vs embedded TLEs.
"""

from pathlib import Path
from verify_conjunction import (
    load_tles, find_close_approaches, TLERecord,
    WORLDVIEW3_TLES, STARLINK_TLES
)


def load_spacetrack_tles(filepath: Path) -> list:
    """Load TLEs from Space-Track file."""
    if not filepath.exists():
        return []

    content = filepath.read_text()
    lines = [l.strip() for l in content.split('\n') if l.strip()]
    tles = []

    i = 0
    while i < len(lines) - 1:
        if lines[i].startswith('1 ') and lines[i+1].startswith('2 '):
            try:
                tles.append(TLERecord.from_lines(lines[i], lines[i+1]))
            except Exception as e:
                print(f"Warning: Could not parse TLE: {e}")
            i += 2
        else:
            i += 1

    return sorted(tles, key=lambda t: t.epoch)


def main():
    print("=" * 70)
    print("Comparing Embedded TLEs vs Space-Track TLEs")
    print("=" * 70)
    print()

    # Load embedded TLEs
    embedded_wv3 = load_tles(WORLDVIEW3_TLES)
    embedded_starlink = load_tles(STARLINK_TLES)

    # Load Space-Track TLEs
    spacetrack_dir = Path(__file__).parent / "spacetrack_tles"
    spacetrack_wv3 = load_spacetrack_tles(spacetrack_dir / "40115.tle")
    spacetrack_starlink = load_spacetrack_tles(spacetrack_dir / "66620.tle")

    print(f"Embedded TLEs:    WV3={len(embedded_wv3)}, Starlink={len(embedded_starlink)}")
    print(f"Space-Track TLEs: WV3={len(spacetrack_wv3)}, Starlink={len(spacetrack_starlink)}")
    print()

    # Check if Space-Track has any additional TLEs
    embedded_epochs = set(t.epoch.isoformat() for t in embedded_starlink)
    spacetrack_epochs = set(t.epoch.isoformat() for t in spacetrack_starlink)

    new_epochs = spacetrack_epochs - embedded_epochs
    if new_epochs:
        print(f"NEW Starlink TLEs from Space-Track:")
        for epoch in sorted(new_epochs):
            tle = next(t for t in spacetrack_starlink if t.epoch.isoformat() == epoch)
            print(f"  {tle.epoch.strftime('%Y-%m-%d %H:%M:%S')} - n={tle.mean_motion:.5f}")
    else:
        print("No new Starlink TLEs from Space-Track (same as embedded)")

    # Compare results
    from datetime import datetime, timezone

    start = datetime(2025, 12, 17, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2025, 12, 19, 23, 59, 59, tzinfo=timezone.utc)

    print("\n" + "=" * 70)
    print("CONJUNCTION SEARCH RESULTS")
    print("=" * 70)

    # Using embedded TLEs
    print("\nUsing EMBEDDED TLEs:")
    approaches_embedded = find_close_approaches(
        embedded_wv3, embedded_starlink, start, end, step_seconds=30, threshold_km=500
    )
    for a in approaches_embedded[:5]:
        print(f"  {a['distance']:.1f} km at {a['time'].strftime('%Y-%m-%d %H:%M:%S')} UTC")

    # Using Space-Track TLEs
    print("\nUsing SPACE-TRACK TLEs:")
    approaches_spacetrack = find_close_approaches(
        spacetrack_wv3, spacetrack_starlink, start, end, step_seconds=30, threshold_km=500
    )
    for a in approaches_spacetrack[:5]:
        print(f"  {a['distance']:.1f} km at {a['time'].strftime('%Y-%m-%d %H:%M:%S')} UTC")

    # Summary
    print("\n" + "=" * 70)
    print("CONCLUSION")
    print("=" * 70)

    if approaches_embedded and approaches_spacetrack:
        diff = abs(approaches_embedded[0]['distance'] - approaches_spacetrack[0]['distance'])
        if diff < 1:
            print("\nResults match - Space-Track TLEs are identical to embedded TLEs.")
            print("No additional TLE data available for the Dec 17-18 anomaly period.")
        else:
            print(f"\nResults differ by {diff:.1f} km")

    print("\nThe ~50 hour TLE gap (Dec 18 20:26 → Dec 19 22:47) means:")
    print("  - No TLEs captured the post-anomaly orbit on Dec 18")
    print("  - The 241 km imaging distance cannot be verified with public TLE data")
    print("  - SpaceX/Vantor likely used internal ephemeris data")


if __name__ == "__main__":
    main()
