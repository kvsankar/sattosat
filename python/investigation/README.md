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
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle --anchor 2025-12-18T12:00:00Z --threshold 500
```

**Output:**
```
Loaded 24 TLEs for Sat A
Loaded 12 TLEs for Sat B
Search window: 2025-12-15T12:00:00+00:00 to 2025-12-21T12:00:00+00:00
Finding conjunctions < 500.0 km...
Found 5 conjunctions
CSV written to: .../conjunctions-40115-66620-python.csv

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
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle --anchor 2025-12-18T12:00:00Z --threshold 2000 --region alaska
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
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b investigation/starlink_dec19_postanomaly.tle --anchor 2025-12-18T12:00:00Z --threshold 1000
```

**Output:**
```
Loaded 24 TLEs for Sat A
Loaded 1 TLEs for Sat B
Search window: 2025-12-15T12:00:00+00:00 to 2025-12-21T12:00:00+00:00
Finding conjunctions < 1000.0 km...
Found 14 conjunctions
CSV written to: .../conjunctions-40115-66620-python.csv

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
