# Starlink-35956 Imaging Event Investigation

This directory contains scripts developed to investigate the WorldView-3 / Starlink-35956 imaging event of December 18, 2025.

For general-purpose analysis scripts, see [USAGE_SCRIPTS.md](../../USAGE_SCRIPTS.md).

## Background

On December 18, 2025, Maxar's WorldView-3 satellite reportedly captured an image of Starlink-35956 at 241 km distance over Alaska. Our SatToSat conjunction finder (anchored at Dec 19 01:30 UTC) calculated the closest approach at 350.4 km. These scripts investigate this discrepancy.

## Investigation Goals

| Goal | Script | Finding |
|------|--------|---------|
| Reproduce the 241 km distance | `verify_conjunction.py` | **204 km on Dec 17 12:19 UTC** (Atlantic Ocean); Dec 18 had no approach <500 km (closest: 983 km); Dec 19 had 350 km and 383 km |
| Confirm Dec 18 as imaging date | `scan_dec17.py` | Dec 18 closest was 983 km; synodic period ~37h skips Dec 18 |
| Confirm Alaska as location | `scan_alaska.py` | WV3 over Alaska: 1157 km; Starlink over Alaska: 1168 km |
| Rule out TLE data source issues | `compare_with_spacetrack.py` | Space-Track gives identical results |
| Check if WV3 maneuver caused shift | `wv3_maneuver_analysis.py` | Maneuver NOT the cause; natural ~37h period skips Dec 18 |
| Check if Starlink decay explains it | `backpropagate_dec19.py` | Back-propagated TLE gives 661 km, not 241 km |

## Resolved Analysis Gaps

1. **Starlink position checked** (Gap 1): `scan_alaska.py` now checks BOTH scenarios - when WV3 is over Alaska AND when Starlink is over Alaska. Neither produces a distance close to 241 km on Dec 18.

2. **Dec 15-19 fully analyzed** (Gap 3): `scan_dec17.py` now scans Dec 15-19, revealing a ~37.2 hour synodic period. Close approaches occurred on Dec 15, 17, and 19 - naturally skipping Dec 18.

3. **Causation proven** (Gap 5): `wv3_maneuver_analysis.py` now shows the maneuver changed the synodic period by only 1.3%, which is NOT enough to explain Dec 18 missing a close approach. The natural ~37 hour period inherently skips Dec 18.

## Remaining Gaps

1. **Line-of-sight vs center-to-center**: Our 204 km is center-to-center distance. The reported 241 km could use a different measure (slant range, etc.).

2. **Date discrepancy unexplained**: We found 204 km on Dec 17, but the report says Dec 18. No scenario produces 241 km on Dec 18 using public TLE data.

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

**Intent:** Find all passes over Alaska on Dec 18, 2025, checking BOTH scenarios: when WV3 is over Alaska AND when Starlink is over Alaska. Includes the full Aleutian chain (extending past the International Date Line to ~173°E).

**Command:**
```bash
uv run python python/investigation/scan_alaska.py
```

**Results:**
```
======================================================================
Scanning Dec 18, 2025 for Alaska imaging geometry
======================================================================

Scanning 2025-12-18 at 10-second intervals...

======================================================================
SCENARIO 1: WorldView-3 over Alaska (imaging outward)
======================================================================

Found 246 samples, 7 distinct passes

Pass 7: 23:47:30 - 23:54:30 UTC (7.0 min)
  Min distance: 1156.7 km at 23:54:30 UTC
  WV3: 50.3°N, 168.3°E, 622 km  (western Aleutians)
  Starlink: 53.1°N, 153.7°E, 424 km

CLOSEST while WV3 over Alaska: 1156.7 km at 23:54:30 UTC

======================================================================
SCENARIO 2: Starlink over Alaska (WV3 imaging toward Alaska)
======================================================================

Found 245 samples, 6 distinct passes

Pass 6: 23:56:20 - 23:59:50 UTC (3.5 min)
  Min distance: 1168.0 km at 23:56:20 UTC
  Starlink: 53.2°N, 165.0°E, 424 km  (western Aleutians)
  WV3: 43.7°N, 165.8°E, 620 km

CLOSEST while Starlink over Alaska: 1168.0 km at 23:56:20 UTC

======================================================================
SUMMARY
======================================================================
Closest approach with WV3 over Alaska:      1156.7 km
Closest approach with Starlink over Alaska: 1168.0 km
Reported imaging distance:                  241 km

CONCLUSION: Neither scenario produces a distance close to 241 km on Dec 18.
======================================================================
```

**Finding:** Both satellites passed over the western Aleutians around 23:54-23:56 UTC on Dec 18 with a distance of ~1160 km. This is the closest Dec 18 approach over Alaska, but still ~5x larger than the reported 241 km.

---

### 3. scan_dec17.py

**Intent:** Scan Dec 15-19 to understand the synodic (envelope) period pattern and verify why Dec 18 has no close approach.

**Command:**
```bash
uv run python python/investigation/scan_dec17.py
```

**Results:**
```
======================================================================
Synodic Period Analysis: Dec 15-19, 2025
======================================================================

Scanning for all close approaches (< 1000 km) over 5 days
to verify the ~44 hour envelope period pattern.

Scanning 2025-12-15 to 2025-12-19...

Found 10 close approaches (< 1000 km):

======================================================================
2025-12-15
======================================================================
   247.7 km at 23:08:00 UTC  |  WV3:  53.3°, -179.0°  |  SL:  52.8°,  179.0°

======================================================================
2025-12-17
======================================================================
   204.2 km at 12:19:00 UTC  |  WV3:  52.9°,  -16.9°  |  SL:  53.3°,  -17.5°

======================================================================
2025-12-18
======================================================================
   983.1 km at 23:55:30 UTC  |  WV3:  46.7°,  166.9°  |  SL:  53.3°,  159.8°

======================================================================
2025-12-19
======================================================================
   370.2 km at 01:30:30 UTC  |  WV3:  54.1°,  145.7°  |  SL:  52.6°,  149.2°

======================================================================
ENVELOPE PERIOD ANALYSIS
======================================================================

Envelope minima (closest approach per conjunction window):

#              Date/Time   Distance     Interval Location
----------------------------------------------------------------------
1   2025-12-15 23:08        247.7 km               53.3°N, -179.0°E
2   2025-12-17 12:19        204.2 km   37.2 hours  52.9°N,  -16.9°E
3   2025-12-19 01:30        370.2 km   37.2 hours  54.1°N,  145.7°E

Average envelope period: 37.2 hours (1.55 days)
Expected (synodic):      ~44 hours (~1.8 days)

======================================================================
DEC 18 ANALYSIS
======================================================================
Closest approach on Dec 18: 983.1 km at 23:55:30 UTC

NOTE: WV3 performed an orbital maneuver on Dec 17 ~17:32 UTC.
This may affect the approach pattern after that time.
======================================================================
```

**Finding:** The synodic period is ~37.2 hours, causing close approaches on Dec 15, 17, and 19 - naturally skipping Dec 18. Dec 18's only approach (983 km) is marginal. The maneuver is not the cause; the natural period inherently misses Dec 18.

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

**Intent:** Analyze whether the WV3 orbital maneuver on Dec 17 ~17:32 UTC caused Dec 18 to miss the close approach window.

**Command:**
```bash
uv run python python/investigation/wv3_maneuver_analysis.py
```

**Results:**
```
======================================================================
WV3 ORBITAL MANEUVER ANALYSIS - Dec 17, 2025 ~17:32 UTC
======================================================================

--- WV3 ORBITAL PARAMETERS ---
Parameter                          Before           After          Change
----------------------------------------------------------------------
Mean Motion (rev/day)           14.855237       14.846608       -0.008628
Period (min)                      96.9355         96.9919         +0.0563
Altitude (km)                       611.9           614.7            +2.7
Eccentricity                    0.0005162       0.0001686      -0.0003476

--- SYNODIC PERIOD WITH STARLINK-35956 ---
Metric                                       Before           After          Change
--------------------------------------------------------------------------------
Synodic Period (hours)                        37.61           37.11           -0.50
Synodic Period (days)                         1.567           1.546          -0.021
% Change                                                                      -1.3%

======================================================================
CLOSE APPROACH TIMING ANALYSIS
======================================================================

Observed close approaches (from synodic period analysis):
#              Date/Time   Distance Hours since prev
-------------------------------------------------------
1       2025-12-15 23:08    247.7 km
2       2025-12-17 12:19    204.2 km  37.2 hours
3       2025-12-19 01:30    370.2 km  37.2 hours

======================================================================
KEY FINDINGS
======================================================================

1. SYNODIC PERIOD: The observed envelope period is ~37.2 hours.

2. DEC 18 GAP: With a ~37 hour period:
   - Dec 15 23:08 + 37h = Dec 17 12:08 (actual: 12:19) ✓
   - Dec 17 12:19 + 37h = Dec 19 01:19 (actual: 01:30) ✓
   The period naturally skips Dec 18.

3. THE MANEUVER: WV3 maneuvered AFTER the Dec 17 12:19 close approach.
   The maneuver changed the synodic period by only 1.3%, which is NOT
   enough to explain Dec 18 missing a close approach.

4. REAL EXPLANATION: The ~37 hour synodic period naturally produces
   close approaches every ~1.5 days, skipping Dec 18 entirely.

======================================================================
CONCLUSION: Dec 18 has no close approach because of the natural
synodic period (~37 hours), NOT because of the WV3 maneuver.
======================================================================
```

**Finding:** The WV3 maneuver changed the synodic period by only 1.3% - NOT enough to explain Dec 18 missing a close approach. The natural ~37 hour period inherently produces approaches on Dec 15, 17, and 19, skipping Dec 18. The maneuver is NOT the cause.

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
| When was the ~241 km approach? | Dec 17 12:19 UTC (204 km) - wrong date |
| Was it over Alaska? | No - over Atlantic Ocean (~17°W) - wrong location |
| What if Starlink was over Alaska? | Checked - minimum 1168 km on Dec 18 (western Aleutians) |
| Why no close approach on Dec 18? | Natural ~37h synodic period skips Dec 18 |
| Did WV3 maneuver cause this? | No - maneuver only changed period by 1.3% |
| Is it a TLE data issue? | No - Space-Track gives identical results |
| Can post-anomaly TLE explain it? | No - still gives >600 km |

## Conclusion

The reported 241 km imaging distance over Alaska on Dec 18 **cannot be reproduced** using publicly available TLE data.

**What we found:**
- Closest approach: 204 km on Dec 17 12:19 UTC over the Atlantic Ocean
- Dec 18 had no close approach due to the natural ~37 hour synodic period
- Best Alaska geometry on Dec 18: ~1160 km over western Aleutians at 23:54 UTC
- The WV3 maneuver is NOT responsible for Dec 18 missing the approach window

**Possible explanations for the discrepancy:**
- Proprietary ephemeris data (not public TLEs)
- Different distance calculation method (slant range vs center-to-center)
- The 204 km approach on Dec 17 over the Atlantic is the closest match to 241 km

**Investigation status:** All identified gaps have been addressed. The discrepancy between the reported event (241 km, Dec 18, Alaska) and public TLE data remains unexplained.
