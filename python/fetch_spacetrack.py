#!/usr/bin/env python3
"""
Fetch historical TLEs from Space-Track.org GP_History API.

Usage:
    # Edit .env file with your credentials, then run:
    cd python
    uv run python fetch_spacetrack.py
"""

import os
import sys
import requests
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the same directory as this script
load_dotenv(Path(__file__).parent.parent / ".env")

# Space-Track API endpoints
SPACETRACK_AUTH_URL = "https://www.space-track.org/ajaxauth/login"
SPACETRACK_BASE_URL = "https://www.space-track.org/basicspacedata/query"

# Satellites of interest
SATELLITES = {
    66620: "Starlink-35956",
    40115: "WorldView-3",
}

# Date range for historical TLEs (Dec 15-22, 2025)
START_DATE = "2025-12-15"
END_DATE = "2025-12-22"


def login(session: requests.Session, username: str, password: str) -> bool:
    """Authenticate with Space-Track."""
    print(f"Logging in as {username}...")
    resp = session.post(SPACETRACK_AUTH_URL, data={
        "identity": username,
        "password": password,
    })
    if resp.status_code == 200 and "Login Failed" not in resp.text:
        print("Login successful!")
        return True
    else:
        print(f"Login failed: {resp.text[:200]}")
        return False


def fetch_gp_history(session: requests.Session, norad_id: int, start_date: str, end_date: str) -> list:
    """Fetch GP history for a satellite."""
    # Query GP_History class
    query_url = (
        f"{SPACETRACK_BASE_URL}/class/gp_history"
        f"/NORAD_CAT_ID/{norad_id}"
        f"/EPOCH/{start_date}--{end_date}"
        f"/orderby/EPOCH asc"
        f"/format/tle"
    )

    print(f"Fetching TLEs for NORAD {norad_id} from {start_date} to {end_date}...")
    resp = session.get(query_url)

    if resp.status_code != 200:
        print(f"Error: {resp.status_code} - {resp.text[:200]}")
        return []

    return resp.text.strip()


def parse_tle_epochs(tle_data: str) -> list:
    """Parse TLE data and extract epochs."""
    lines = tle_data.strip().split('\n')
    tles = []

    i = 0
    while i < len(lines):
        # Check if this is a 3-line or 2-line TLE
        if lines[i].startswith('0 ') or (not lines[i].startswith('1 ') and not lines[i].startswith('2 ')):
            # 3-line TLE (name + line1 + line2)
            if i + 2 < len(lines):
                name = lines[i].strip()
                line1 = lines[i + 1].strip()
                line2 = lines[i + 2].strip()
                i += 3
            else:
                break
        elif lines[i].startswith('1 '):
            # 2-line TLE
            name = ""
            line1 = lines[i].strip()
            if i + 1 < len(lines) and lines[i + 1].startswith('2 '):
                line2 = lines[i + 1].strip()
                i += 2
            else:
                i += 1
                continue
        else:
            i += 1
            continue

        # Parse epoch from line1
        try:
            epoch_str = line1[18:32].strip()
            year = int(epoch_str[:2])
            year = 2000 + year if year < 57 else 1900 + year
            day_of_year = float(epoch_str[2:])
            epoch = datetime(year, 1, 1) + timedelta(days=day_of_year - 1)

            # Parse mean motion from line2
            mean_motion = float(line2[52:63])

            tles.append({
                'name': name,
                'line1': line1,
                'line2': line2,
                'epoch': epoch,
                'mean_motion': mean_motion,
            })
        except (ValueError, IndexError) as e:
            print(f"Warning: Could not parse TLE: {e}")
            continue

    return tles


def main():
    # Get credentials from .env
    username = os.environ.get("SPACETRACK_USER")
    password = os.environ.get("SPACETRACK_PASS")

    if not username or not password or username == "your_username":
        print("Error: Space-Track credentials required.")
        print("Edit python/.env with your credentials:")
        print("  SPACETRACK_USER=your_username")
        print("  SPACETRACK_PASS=your_password")
        sys.exit(1)

    # Create session
    session = requests.Session()

    # Login
    if not login(session, username, password):
        sys.exit(1)

    # Output directory
    output_dir = Path(__file__).parent / "spacetrack_tles"
    output_dir.mkdir(exist_ok=True)

    print()

    # Fetch TLEs for each satellite
    for norad_id, name in SATELLITES.items():
        print(f"\n{'='*60}")
        print(f"Satellite: {name} (NORAD {norad_id})")
        print('='*60)

        tle_data = fetch_gp_history(session, norad_id, START_DATE, END_DATE)

        if not tle_data:
            print(f"No TLEs found for {name}")
            continue

        # Save raw TLE data
        output_file = output_dir / f"{norad_id}.tle"
        with open(output_file, 'w') as f:
            f.write(tle_data)
        print(f"Saved to: {output_file}")

        # Parse and summarize
        tles = parse_tle_epochs(tle_data)
        print(f"\nFound {len(tles)} TLE epochs:")
        print("-" * 50)

        for tle in tles:
            epoch_str = tle['epoch'].strftime('%Y-%m-%d %H:%M:%S UTC')
            print(f"  {epoch_str} - n={tle['mean_motion']:.5f} rev/day")

        # Highlight anomaly indicators
        if norad_id == 66620:
            print("\n*** Checking for orbital decay indicators ***")
            for i, tle in enumerate(tles):
                if tle['mean_motion'] < 15.48:
                    print(f"  DECAY DETECTED: {tle['epoch'].strftime('%Y-%m-%d %H:%M')} "
                          f"n={tle['mean_motion']:.5f} (below 15.48)")

    print("\n" + "="*60)
    print("Done! TLE files saved to:", output_dir)
    print("="*60)


if __name__ == "__main__":
    main()
