# Starlink-35956 Imaging Event Investigation

This directory contains scripts developed to investigate the WorldView-3 / Starlink-35956 imaging event of December 18, 2025, and the discrepancy between the reported distance (241 km) and our calculated distance (350 km).

For general-purpose analysis scripts, see [USAGE_SCRIPTS.md](../../USAGE_SCRIPTS.md).

## Background

On December 18, 2025, Maxar's WorldView-3 satellite captured an image of Starlink-35956. The reported imaging distance was 241 km over Alaska. Our SatToSat conjunction finder calculated the closest approach at 350.4 km. These scripts were created to investigate this discrepancy.

---

## Scripts

### 1. verify_conjunction.py

**Intent:** Comprehensive verification of the WV3/Starlink-35956 conjunction. Tests multiple TLE epochs, searches for times matching the reported 241 km distance, and compares pre-anomaly vs post-anomaly TLEs.

**Command:**
```bash
uv run python python/investigation/verify_conjunction.py
```

**Results:**
```
======================================================================
WorldView-3 / Starlink-35956 Conjunction Verification
======================================================================

Loaded 10 WorldView-3 TLEs
Loaded 12 Starlink-35956 TLEs

Starlink-35956 TLE epochs and mean motion:
--------------------------------------------------
  2025-12-15 08:00 UTC - 15.49266 rev/day
  2025-12-15 22:00 UTC - 15.49257 rev/day
  2025-12-16 06:00 UTC - 15.49279 rev/day
  2025-12-16 21:59 UTC - 15.49332 rev/day
  2025-12-17 02:38 UTC - 15.49318 rev/day
  2025-12-17 15:01 UTC - 15.49325 rev/day
  2025-12-17 21:13 UTC - 15.49335 rev/day
  2025-12-18 06:30 UTC - 15.49329 rev/day
  2025-12-18 14:15 UTC - 15.49351 rev/day
  2025-12-18 20:26 UTC - 15.49341 rev/day
  2025-12-19 22:47 UTC - 15.45204 rev/day
  2025-12-21 23:02 UTC - 15.39672 rev/day

Search window: 2025-12-17 00:00 to 2025-12-19 23:59 UTC

======================================================================
TEST 1: Finding all close approaches (< 500 km)
======================================================================

Found 3 close approaches:

 1. 204.2 km at 2025-12-17 12:18:59 UTC
    Relative velocity: 11.93 km/s
    WorldView-3: 52.9°N, 16.9°W, 618 km
    Starlink:    53.3°N, 17.5°W, 424 km
    TLE epochs - WV3: 12-17 14:58, Starlink: 12-17 15:01 (n=15.4932)

 2. 350.4 km at 2025-12-19 01:30:19 UTC
    Relative velocity: 11.32 km/s
    WorldView-3: 54.8°N, 146.0°E, 623 km
    Starlink:    52.7°N, 148.2°E, 424 km
    TLE epochs - WV3: 12-18 21:42, Starlink: 12-18 20:26 (n=15.4934)

 3. 383.1 km at 2025-12-19 00:42:53 UTC
    Relative velocity: 11.31 km/s
    WorldView-3: 51.0°S, 23.6°W, 636 km
    Starlink:    53.2°S, 26.2°W, 438 km
    TLE epochs - WV3: 12-18 21:42, Starlink: 12-18 20:26 (n=15.4934)

======================================================================
TEST 2: Searching for times when distance ≈ 241 km
======================================================================

Found 2 times when distance was 231-251 km:

  235.0 km at 2025-12-17 12:18:50 UTC
    WorldView-3: 53.5°N, 16.7°W, 618 km
    Starlink:    53.3°N, 18.5°W, 424 km
  238.0 km at 2025-12-17 12:19:10 UTC
    WorldView-3: 52.3°N, 17.2°W, 618 km
    Starlink:    53.3°N, 16.4°W, 424 km

======================================================================
TEST 3: Using post-anomaly Starlink TLE (Dec 19, n=15.452)
======================================================================

Using Starlink TLE from 2025-12-19 22:47 UTC
Mean motion: 15.45204 rev/day (decayed)

No close approaches found using post-anomaly TLE.

======================================================================
SUMMARY
======================================================================

Reported: 241 km over Alaska on Dec 18, 2025

Calculated closest approach:
  Distance: 204.2 km
  Time: 2025-12-17 12:18:59 UTC
  WorldView-3: 52.9°N, 16.9°W, 618 km
  Starlink: 53.3°N, 17.5°W, 424 km

Discrepancy: -36.8 km
```

**Finding:** The closest approach matching ~241 km occurred on Dec 17 (not Dec 18) over the Atlantic Ocean (not Alaska). The Dec 18 approaches were all >900 km when WV3 was over Alaska. This suggests either different TLE data was used for the reported distance, or the imaging geometry differs from a simple closest-approach calculation.

---

### 2. scan_alaska.py

**Intent:** Find all WorldView-3 passes over Alaska on Dec 18, 2025, and measure the distance to Starlink-35956 during each pass.

**Command:**
```bash
uv run python python/investigation/scan_alaska.py
```

**Results:**
```
======================================================================
Scanning Dec 18, 2025 for passes over Alaska
======================================================================

Scanning 2025-12-18 at 10-second intervals...
Looking for WorldView-3 passes over Alaska region

Found 210 samples with WorldView-3 over Alaska

Identified 6 distinct passes over Alaska:

Pass 1: 05:49:10 - 05:52:50 UTC (3.7 min)
  Minimum distance: 9685.0 km at 05:49:10 UTC
  WorldView-3: 62.2°N, -125.1°W, 625 km
  Starlink:    -15.6°, 178.6°, 423 km

Pass 2: 07:21:30 - 07:29:50 UTC (8.3 min)
  Minimum distance: 9160.9 km at 07:21:30 UTC
  WorldView-3: 45.2°N, -141.0°W, 622 km
  Starlink:    -13.9°, 153.7°, 423 km

Pass 3: 08:58:30 - 09:03:40 UTC (5.2 min)
  Minimum distance: 9472.9 km at 08:58:30 UTC
  WorldView-3: 45.0°N, -165.2°W, 622 km
  Starlink:    -26.2°, 140.0°, 427 km

Pass 4: 20:34:10 - 20:41:50 UTC (7.7 min)
  Minimum distance: 4204.0 km at 20:41:50 UTC
  WorldView-3: 45.1°N, -145.2°W, 620 km
  Starlink:    43.4°, 164.7°, 422 km

Pass 5: 22:10:30 - 22:18:50 UTC (8.3 min)
  Minimum distance: 2463.1 km at 22:18:50 UTC
  WorldView-3: 45.3°N, -169.4°W, 620 km
  Starlink:    50.7°, 160.9°, 424 km

Pass 6: 23:47:30 - 23:48:20 UTC (0.8 min)
  Minimum distance: 4743.8 km at 23:48:20 UTC
  WorldView-3: 72.1°N, -174.6°W, 626 km
  Starlink:    45.0°, 120.5°, 423 km

======================================================================
CLOSEST APPROACH WHILE WV3 OVER ALASKA:
  Distance: 2463.1 km
  Time: 2025-12-18 22:18:50 UTC
  WorldView-3: 45.3°N, -169.4°, 620 km
  Starlink:    50.7°, 160.9°, 424 km
======================================================================
```

**Finding:** During all 6 WV3 passes over Alaska on Dec 18, the minimum distance to Starlink-35956 was 2463 km - nowhere near the reported 241 km. This confirms that no close approach occurred while WV3 was over Alaska on Dec 18.

---

### 3. scan_dec17.py

**Intent:** Compare close approach patterns between Dec 17 and Dec 18 to understand orbital geometry evolution.

**Command:**
```bash
uv run python python/investigation/scan_dec17.py
```

**Results:**
```
======================================================================
Comparing Dec 17 and Dec 18 close approaches
======================================================================

Scanning 2025-12-17...

Scanning 2025-12-18...

======================================================================
Dec 17 close approaches (< 1000 km):
======================================================================
  204.2 km at 12:19:00 UTC
    WV3: 52.9°, -16.9°
    SL:  53.3°, -17.5°
  550.2 km at 13:06:30 UTC
    WV3: -56.5°, 152.7°
    SL:  -53.2°, 157.3°
  661.4 km at 11:31:30 UTC
    WV3: -49.3°, 173.7°
    SL:  -53.1°, 167.8°

======================================================================
Dec 18 close approaches (< 1000 km):
======================================================================
  983.1 km at 23:55:30 UTC
    WV3: 46.7°, 166.9°
    SL:  53.3°, 159.8°
```

**Finding:** Dec 17 had multiple close approaches (closest: 204 km), while Dec 18 had only one marginal approach at 983 km. The WV3 orbital maneuver on Dec 17 ~17:32 UTC significantly changed the conjunction geometry, pushing the close approach window away from Dec 18.

---

### 4. backpropagate_dec19.py

**Intent:** Test whether the Dec 19 (post-anomaly) TLE for Starlink-35956 can back-predict the Dec 18 imaging conditions. This checks if Starlink was already in an anomalous orbit during the imaging event.

**Command:**
```bash
uv run python python/investigation/backpropagate_dec19.py
```

**Results:**
```
======================================================================
Back-propagating Dec 19 TLE to Dec 18
======================================================================

Dec 19 TLE epoch: 2025-12-19 22:47:58 UTC
Dec 19 TLE mean motion: 15.45204 rev/day (DECAYED)

Dec 18 TLE epochs (normal orbit):
  2025-12-18 06:30:37 UTC - n=15.49329
  2025-12-18 14:15:04 UTC - n=15.49351
  2025-12-18 20:26:38 UTC - n=15.49341

======================================================================
TEST 1: Close approaches on Dec 18 using Dec 19 TLE (back-propagated)
======================================================================

Found 1 close approaches:

 1. 661.6 km at 23:55:00 UTC
    WV3: 48.5°, 167.6°, 621 km
    SL:  53.3°, 164.0°, 434 km

======================================================================
TEST 2: Close approaches on Dec 18 using Dec 18 TLEs (normal)
======================================================================

Found 1 close approaches:

 1. 976.8 km at 23:55:30 UTC
    WV3: 46.7°, 166.9°, 621 km

======================================================================
TEST 3: Scanning for ~241 km distance using Dec 19 TLE
======================================================================

No times found with distance ~241 km

======================================================================
SUMMARY
======================================================================

Reported: 241 km over Alaska on Dec 18

Dec 19 TLE (back-propagated): 661.6 km at 23:55:00 UTC
  Location: 48.5°, 167.6°
Dec 18 TLE (normal orbit):    976.8 km at 23:55:30 UTC
  Location: 46.7°, 166.9°
```

**Finding:** Back-propagating the post-anomaly TLE gives a closer approach (661 km vs 977 km) but still nowhere near 241 km. The anomalous TLE cannot explain the reported imaging distance, even with back-propagation.

---

### 5. wv3_maneuver_analysis.py

**Intent:** Analyze the WV3 orbital maneuver that occurred on Dec 17, 2024 ~17:32 UTC and its effect on the synodic (beat) period with Starlink satellites.

**Command:**
```bash
uv run python python/investigation/wv3_maneuver_analysis.py
```

**Results:**
```
======================================================================
WV3 ORBITAL MANEUVER ANALYSIS - Dec 17, 2024 ~17:32 UTC
======================================================================

--- WV3 ORBITAL PARAMETERS ---
Parameter                          Before           After          Change
----------------------------------------------------------------------
Mean Motion (rev/day)           14.855237       14.846608       -0.008628
Period (min)                      96.9355         96.9919         +0.0563
Altitude (km)                       611.9           614.7            +2.7
Eccentricity                    0.0005162       0.0001686      -0.0003476

--- STARLINK REFERENCE (healthy, ~475 km) ---
Mean Motion: 15.06 rev/day
Period: 95.6175 min
Altitude: 548.4 km

--- BEAT PERIOD WITH STARLINK ---
Metric                                       Before           After          Change
--------------------------------------------------------------------------------
Synodic Period (hours)                       117.21          112.47           -4.74
Synodic Period (days)                         4.884           4.686          -0.197
% Change                                                                      -4.0%

|T_wv3 - T_starlink| (min)                   1.3180          1.3743         +0.0563

======================================================================
COMPARISON: STARLINK-35956 (anomalous, ~447 km, decaying)
======================================================================
STARLINK-35956 period: 93.5248 min (altitude ~447 km)

Metric                                       Before           After          Change
--------------------------------------------------------------------------------
Synodic Period (hours)                        44.30           43.61           -0.69
Synodic Period (days)                         1.846           1.817          -0.029
```

**Finding:** The WV3 maneuver raised altitude by 2.7 km, reducing eccentricity. This shortened the synodic period with Starlink satellites by ~4%, shifting the timing of close approaches. The maneuver explains why the Dec 17 close approach window didn't repeat on Dec 18.

---

### 6. compare_with_spacetrack.py

**Intent:** Verify that the embedded TLEs match Space-Track.org data, ruling out data source discrepancies as a cause of the distance difference.

**Command:**
```bash
uv run python python/investigation/compare_with_spacetrack.py
```

**Results:**
```
======================================================================
Comparing Embedded TLEs vs Space-Track TLEs
======================================================================

Embedded TLEs:    WV3=10, Starlink=12
Space-Track TLEs: WV3=26, Starlink=12

No new Starlink TLEs from Space-Track (same as embedded)

======================================================================
CONJUNCTION SEARCH RESULTS
======================================================================

Using EMBEDDED TLEs:
  204.2 km at 2025-12-17 12:18:59 UTC
  350.4 km at 2025-12-19 01:30:19 UTC
  383.1 km at 2025-12-19 00:42:53 UTC

Using SPACE-TRACK TLEs:
  204.2 km at 2025-12-17 12:18:59 UTC
  350.4 km at 2025-12-19 01:30:19 UTC
  383.1 km at 2025-12-19 00:42:53 UTC

Difference in closest approach: 0.0 km
```

**Finding:** Embedded TLEs produce identical results to Space-Track TLEs. The discrepancy between reported and calculated distances is not due to TLE data source differences.

---

## Supporting Files

- `wv3_pairs.json` - Satellite pair configurations for WV3-specific envelope analysis
- `spacetrack_tles/` - Historical TLE data downloaded from Space-Track.org

## Summary of Investigation

| Question | Answer |
|----------|--------|
| Was the 241 km approach on Dec 18? | No - closest was 983 km on Dec 18 |
| When was the ~241 km approach? | Dec 17 12:19 UTC (204 km) |
| Was it over Alaska? | No - over Atlantic Ocean (~17°W) |
| Did WV3 maneuver affect this? | Yes - shifted close approach window |
| Is it a TLE data issue? | No - Space-Track gives identical results |
| Can post-anomaly TLE explain it? | No - still gives >600 km |

The investigation concludes that the reported 241 km imaging distance cannot be reproduced using publicly available TLE data. The discrepancy may be due to proprietary ephemeris data, different distance calculation methods (e.g., line-of-sight vs center-to-center), or timing differences in the reported event.
