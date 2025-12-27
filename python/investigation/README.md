# Starlink-35956 Imaging Event Investigation

On December 18, 2025, Maxar's WorldView-3 satellite reportedly captured an image of Starlink-35956 at 241 km distance over Alaska. This investigation attempts to reproduce that geometry using public TLE data.

## Goals

1. **Try to reproduce the 241 km approach** - Find all close approaches between WV3 and Starlink-35956
2. **Reproduce all approaches over Alaska** - Filter for times when either satellite is over Alaska
3. **Reproduce approaches using post-anomaly TLE** - Use Starlink's Dec 19 TLE (showing orbital decay) back-propagated

---

## Goal 1: Try to reproduce the 241 km approach

Find all close approaches < 500 km between WorldView-3 (NORAD 40115) and Starlink-35956 (NORAD 66620).

**Command:**
```bash
cd python
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle \
    --anchor 2025-12-18T12:00:00Z --threshold 500
```

**Output:**
```
Loaded 24 TLEs for Sat A
Loaded 12 TLEs for Sat B
Search window: 2025-12-15T12:00:00+00:00 to 2025-12-21T12:00:00+00:00
Finding conjunctions < 500.0 km...
Found 5 conjunctions
CSV written to: .../conjunctions-40115-66620-python.csv

#   Time (UTC)               Dist (km)  Vel (km/s) Sat A Location         Sat B Location
-----------------------------------------------------------------------------------------------
1   2025-12-15 23:08:11      200.47     12.50      52.6°N, 179.4°W        52.9°N, 179.8°W
2   2025-12-17 12:18:59      204.19     11.93      52.9°N, 16.9°W         53.3°N, 17.5°W
3   2025-12-20 15:31:59      212.77     10.63      51.4°S, 114.3°E        52.1°S, 113.6°E
4   2025-12-19 01:30:19      350.37     11.32      54.8°N, 146.0°E        52.7°N, 148.2°E
5   2025-12-19 00:42:53      383.07     11.31      51.0°S, 23.6°W         53.2°S, 26.2°W

Closest approach:
  Time: 2025-12-15 23:08:11.643 UTC
  Distance: 200.47 km
  Relative velocity: 12.50 km/s
```

**Assessment:**
- Closest approach found: **200.5 km on Dec 15** (not Dec 18)
- The Dec 17 approach at 204 km over the Atlantic is closest to the reported 241 km
- **Dec 18 has no approach < 500 km** - the reported 241 km over Alaska cannot be reproduced

---

## Goal 2: Reproduce all approaches over Alaska

Find the closest approach while either satellite is over Alaska (including the Aleutian Islands).

**Command:**
```bash
cd python
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle \
    --anchor 2025-12-18T12:00:00Z --threshold 2000 --region alaska
```

**Output:**
```
Loaded 24 TLEs for Sat A
Loaded 12 TLEs for Sat B
Search window: 2025-12-15T12:00:00+00:00 to 2025-12-21T12:00:00+00:00
Region filter: Alaska
Finding conjunctions < 2000.0 km...
Found 2 conjunctions
CSV written to: .../conjunctions-40115-66620-python.csv

#   Time (UTC)               Dist (km)  Vel (km/s) Sat A Location         Sat B Location
-----------------------------------------------------------------------------------------------
1   2025-12-15 23:08:00      247.73     -          53.3°N, 179.0°W        52.8°N, 179.0°E
2   2025-12-15 23:08:00      247.73     -          53.3°N, 179.0°W        52.8°N, 179.0°E

Closest approach:
  Time: 2025-12-15 23:08:00.000 UTC [Sat A over Alaska]
  Distance: 247.73 km
```

**Assessment:**
- Closest Alaska approach: **247.7 km on Dec 15** near the date line (Sat A over Alaska)
- This is remarkably close to the reported 241 km, but on the **wrong date** (Dec 15, not Dec 18)
- Dec 18 closest over Alaska: ~1157 km at 23:54 UTC over western Aleutians

---

## Goal 3: Reproduce approaches using post-anomaly TLE

Use Starlink's Dec 19 TLE (epoch 2025-12-19 22:47:58 UTC, n=15.452) which shows orbital decay, back-propagated to earlier dates.

**Command:**
```bash
cd python
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle \
    --tle-b investigation/starlink_dec19_postanomaly.tle \
    --anchor 2025-12-18T12:00:00Z --threshold 1000
```

**Output:**
```
Loaded 24 TLEs for Sat A
Loaded 1 TLEs for Sat B
Search window: 2025-12-15T12:00:00+00:00 to 2025-12-21T12:00:00+00:00
Finding conjunctions < 1000.0 km...
Found 14 conjunctions
CSV written to: .../conjunctions-40115-66620-python.csv

#   Time (UTC)               Dist (km)  Vel (km/s) Sat A Location         Sat B Location
-----------------------------------------------------------------------------------------------
1   2025-12-19 00:42:21      189.88     11.30      52.9°S, 22.8°W         53.0°S, 22.9°W
2   2025-12-20 15:31:59      212.77     10.63      51.4°S, 114.3°E        52.1°S, 113.6°E
3   2025-12-15 20:42:19      246.72     12.50      54.0°S, 37.7°E         53.1°S, 39.0°E
4   2025-12-17 10:41:31      268.01     11.95      54.6°N, 8.1°E          53.3°N, 9.7°E
5   2025-12-17 09:54:03      406.14     11.94      50.9°S, 161.4°W        53.2°S, 164.5°W
6   2025-12-15 19:54:51      418.07     12.55      50.2°N, 131.9°W        52.5°N, 135.3°W
7   2025-12-20 16:19:30      543.24     10.65      54.9°N, 76.2°W         51.2°N, 72.9°W
8   2025-12-19 01:29:51      597.14     11.33      56.5°N, 146.9°E        52.4°N, 151.0°E
9   2025-12-18 23:54:49      650.18     11.36      49.2°N, 167.8°E        53.3°N, 162.8°E
10  2025-12-15 21:29:46      692.26     12.54      57.7°N, 152.6°W        53.3°N, 146.6°W
11  2025-12-20 14:44:26      758.99     10.69      47.7°N, 55.0°W         52.8°N, 60.3°W
12  2025-12-17 11:29:01      772.01     11.94      58.2°S, 177.9°E        53.0°S, 176.1°W
13  2025-12-15 19:07:24      900.99     12.56      46.5°S, 58.8°E         51.5°S, 50.8°E
14  2025-12-17 09:06:34      932.25     12.02      47.2°N, 29.2°E         52.8°N, 21.3°E

Closest approach:
  Time: 2025-12-19 00:42:21.532 UTC
  Distance: 189.88 km
  Relative velocity: 11.30 km/s
```

**Assessment:**
- Using the decayed TLE gives **189.9 km on Dec 19** as closest approach
- Dec 18 23:54 UTC: 650.2 km over western Aleutians (better than normal TLE's 983 km, but still not 241 km)
- The post-anomaly TLE **does not reproduce 241 km on Dec 18**

---

## Conclusion

The reported 241 km imaging distance over Alaska on Dec 18 **cannot be reproduced** using publicly available TLE data.

| Finding | Value |
|---------|-------|
| Closest approach found | 200.5 km on Dec 15 23:08 UTC |
| Closest approach over Alaska | 247.7 km on Dec 15 23:08 UTC (near date line) |
| Dec 18 closest approach | 983 km at 23:55 UTC (no approach < 500 km) |
| Dec 18 closest over Alaska | ~1157 km at 23:54 UTC (western Aleutians) |

**Possible explanations for the discrepancy:**
- Proprietary ephemeris data (not public TLEs)
- Different distance calculation method (slant range vs center-to-center)
- The 247.7 km approach on Dec 15 over Alaska is the closest match to the reported event

---

## Files

- `starlink_dec19_postanomaly.tle` - Post-anomaly TLE for Starlink-35956 (epoch 2025-12-19 22:47:58 UTC, n=15.452)
