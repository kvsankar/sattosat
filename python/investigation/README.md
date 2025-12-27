# Starlink-35956 Imaging Event Investigation

On December 18, 2025, Maxar's WorldView-3 satellite reportedly captured an image of Starlink-35956 at 241 km distance over Alaska. This investigation attempts to reproduce that geometry using public TLE data.

## Goals

1. **Find all close approaches on Dec 17-19** - Search for conjunctions between WV3 and Starlink-35956
2. **Find approaches over Alaska** - Filter for times when either satellite is over Alaska
3. **Test with post-anomaly TLE** - Use Starlink's Dec 19 TLE (showing orbital decay) back-propagated

---

## Goal 1: Find all close approaches on Dec 17-19

Find all close approaches < 1000 km between WorldView-3 (NORAD 40115) and Starlink-35956 (NORAD 66620).

**Command:**
```bash
cd python
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle \
    --start 2025-12-17T00:00:00Z --end 2025-12-20T00:00:00Z --threshold 1000
```

**Output:**
```
Loaded 24 TLEs for Sat A
Loaded 12 TLEs for Sat B
Search window: 2025-12-17T00:00:00+00:00 to 2025-12-20T00:00:00+00:00
Finding conjunctions < 1000.0 km...
Found 7 conjunctions
CSV written to: .../conjunctions-40115-66620-python.csv

#   Time (UTC)               Dist (km)  Vel (km/s) Sat A Location         Sat B Location
-----------------------------------------------------------------------------------------------
1   2025-12-17 12:18:59      204.19     11.93      52.9°N, 16.9°W         53.3°N, 17.5°W
2   2025-12-19 01:30:19      350.37     11.32      54.8°N, 146.0°E        52.7°N, 148.2°E
3   2025-12-19 00:42:53      383.07     11.31      51.0°S, 23.6°W         53.2°S, 26.2°W
4   2025-12-17 13:06:27      549.22     11.90      56.7°S, 152.8°E        53.2°S, 157.0°E
5   2025-12-17 11:31:33      660.32     11.94      49.1°S, 173.6°E        53.1°S, 168.2°E
6   2025-12-19 02:17:48      944.76     11.33      58.6°S, 44.1°W         51.9°S, 37.5°W
7   2025-12-18 23:55:24      980.81     11.39      47.1°N, 167.0°E        53.3°N, 159.2°E

Closest approach:
  Time: 2025-12-17 12:18:59.748 UTC
  Distance: 204.19 km
  Relative velocity: 11.93 km/s
```

**Assessment:**
- Closest approach: **204 km on Dec 17** over the Atlantic (16.9°W)
- **Dec 19 01:30 UTC (Dec 18 evening in US):** 350 km over the Sea of Okhotsk (146°E) - closest to Alaska
- **Dec 18 23:55 UTC:** 981 km - only conjunction on calendar Dec 18, too far from 241 km
- The reported 241 km over Alaska cannot be reproduced

---

## Goal 2: Find approaches over Alaska

Find the closest approach while either satellite is over Alaska (including the Aleutian Islands).

**Command:**
```bash
cd python
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle \
    --start 2025-12-17T00:00:00Z --end 2025-12-20T00:00:00Z --threshold 2000 --region alaska
```

**Output:**
```
Loaded 24 TLEs for Sat A
Loaded 12 TLEs for Sat B
Search window: 2025-12-17T00:00:00+00:00 to 2025-12-20T00:00:00+00:00
Region filter: Alaska
Finding conjunctions < 2000.0 km...
Found 2 conjunctions
CSV written to: .../conjunctions-40115-66620-python.csv

#   Time (UTC)               Dist (km)  Vel (km/s) Sat A Location         Sat B Location
-----------------------------------------------------------------------------------------------
1   2025-12-18 23:54:30      1156.75    -          50.3°N, 168.3°E        53.1°N, 153.7°E
2   2025-12-18 23:56:30      1233.13    -          43.0°N, 165.6°E        53.2°N, 166.1°E

Closest approach:
  Time: 2025-12-18 23:54:30.000 UTC [Sat A over Alaska]
  Distance: 1156.75 km
```

**Assessment:**
- Closest approach over Alaska on Dec 17-19: **1157 km on Dec 18 23:54 UTC** (western Aleutians)
- This is far from the reported 241 km distance

---

## Goal 3: Test with post-anomaly TLE

Use Starlink's Dec 19 TLE (epoch 2025-12-19 22:47:58 UTC, n=15.452) which shows orbital decay, back-propagated to earlier dates.

**Command:**
```bash
cd python
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle \
    --tle-b investigation/starlink_dec19_postanomaly.tle \
    --start 2025-12-17T00:00:00Z --end 2025-12-20T00:00:00Z --threshold 1000
```

**Output:**
```
Loaded 24 TLEs for Sat A
Loaded 1 TLEs for Sat B
Search window: 2025-12-17T00:00:00+00:00 to 2025-12-20T00:00:00+00:00
Finding conjunctions < 1000.0 km...
Found 7 conjunctions
CSV written to: .../conjunctions-40115-66620-python.csv

#   Time (UTC)               Dist (km)  Vel (km/s) Sat A Location         Sat B Location
-----------------------------------------------------------------------------------------------
1   2025-12-19 00:42:21      189.88     11.30      52.9°S, 22.8°W         53.0°S, 22.9°W
2   2025-12-17 10:41:31      268.01     11.95      54.6°N, 8.1°E          53.3°N, 9.7°E
3   2025-12-17 09:54:03      406.14     11.94      50.9°S, 161.4°W        53.2°S, 164.5°W
4   2025-12-19 01:29:51      597.14     11.33      56.5°N, 146.9°E        52.4°N, 151.0°E
5   2025-12-18 23:54:49      650.18     11.36      49.2°N, 167.8°E        53.3°N, 162.8°E
6   2025-12-17 11:29:01      772.01     11.94      58.2°S, 177.9°E        53.0°S, 176.1°W
7   2025-12-17 09:06:34      932.25     12.02      47.2°N, 29.2°E         52.8°N, 21.3°E

Closest approach:
  Time: 2025-12-19 00:42:21.532 UTC
  Distance: 189.88 km
  Relative velocity: 11.30 km/s
```

**Assessment:**
- Closest approach with decayed TLE: **190 km on Dec 19 00:42 UTC** (Dec 18 evening in US)
- **Dec 19 01:30 UTC:** 597 km over the Sea of Okhotsk - closer to Alaska region
- **Dec 18 23:55 UTC:** 650 km over western Aleutians (better than normal TLE's 981 km)
- The post-anomaly TLE **does not reproduce 241 km on Dec 18**

---

## Conclusion

The reported 241 km imaging distance over Alaska on Dec 18 **cannot be reproduced** using publicly available TLE data.

| Finding | Value |
|---------|-------|
| Closest approach (Dec 17-19) | 204 km on Dec 17 12:19 UTC (Atlantic) |
| Closest to Alaska timing | 350 km on Dec 19 01:30 UTC (Dec 18 5:30 PM PST) |
| Dec 18 closest approach (UTC) | 981 km at 23:55 UTC |
| Dec 18 closest over Alaska | 1157 km at 23:54 UTC (western Aleutians) |

**Notable:** The Dec 19 01:30 UTC conjunction (350 km) occurs at 5:30 PM PST on Dec 18 in the US, over the Sea of Okhotsk near Kamchatka. This is the closest approach to Alaska timing but still not 241 km.

**Possible explanations for the discrepancy:**
- Proprietary ephemeris data (not public TLEs)
- Different distance calculation method (slant range vs center-to-center)
- Date/timezone confusion in the original report

---

## Files

- `starlink_dec19_postanomaly.tle` - Post-anomaly TLE for Starlink-35956 (epoch 2025-12-19 22:47:58 UTC, n=15.452)
