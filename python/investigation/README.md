# Starlink-35956 Imaging Event Investigation

On December 18, 2025, Maxar's WorldView-3 satellite reportedly captured an image of Starlink-35956 at 241 km distance over Alaska. This investigation attempts to reproduce that geometry using public TLE data.

## Investigation Goals

| Goal | Command | Finding |
|------|---------|---------|
| Reproduce the 241 km distance | `python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle --anchor 2025-12-18T12:00:00Z --threshold 500` | • **Dec 17 12:18:59 UTC: 204.2 km** at 52.9°N, 16.9°W (Atlantic Ocean)<br>• Dec 18: No approach <500 km; closest was 983 km at 23:55 UTC<br>• Dec 19 01:30:19 UTC: 350.4 km at 54.8°N, 146.0°E (Sea of Okhotsk) |
| Confirm Alaska as location | `python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle --anchor 2025-12-18T12:00:00Z --threshold 2000 --region alaska` | • Dec 15 23:08 UTC: 247.7 km (Sat A over Alaska, near date line)<br>• Dec 18 closest over Alaska: ~1157 km at 23:54 UTC (western Aleutians) |
| Check if post-anomaly TLE explains it | `python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b investigation/starlink_dec19_postanomaly.tle --anchor 2025-12-18T12:00:00Z --threshold 1000` | Using Starlink TLE epoch 2025-12-19 22:47:58 UTC (n=15.452, decayed):<br>• Dec 18 23:54 UTC: ~650 km (western Aleutians)<br>• No times found with distance ~241 km |

## Remaining Gaps

1. **Line-of-sight vs center-to-center**: Our 204 km is center-to-center distance. The reported 241 km could use a different measure.

2. **Date discrepancy unexplained**: We found 204 km on Dec 17, but the report says Dec 18. No scenario produces 241 km on Dec 18 using public TLE data.

## Conclusion

The reported 241 km imaging distance over Alaska on Dec 18 **cannot be reproduced** using publicly available TLE data.

**What we found:**
- Closest approach: 204 km on Dec 17 12:19 UTC over the Atlantic Ocean
- Dec 18 had no close approach <500 km (closest was 983 km)
- Best Alaska geometry on Dec 18: ~1157 km over western Aleutians at 23:54 UTC

**Possible explanations for the discrepancy:**
- Proprietary ephemeris data (not public TLEs)
- Different distance calculation method (slant range vs center-to-center)
- The 204 km approach on Dec 17 over the Atlantic is the closest match to 241 km

---

## Tool Usage

All investigations use `conjunctions.py` in the parent `python/` directory:

```bash
cd python

# Find all close approaches (default threshold: 1000 km, search window: ±3 days from anchor)
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle --anchor 2025-12-18T12:00:00Z

# With custom threshold
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle --anchor 2025-12-18T12:00:00Z --threshold 500

# Filter by region (finds closest while satellite is over region)
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b ../src/lib/embedded/66620.tle --anchor 2025-12-18T12:00:00Z --threshold 2000 --region alaska

# Use custom TLE file for satellite B
python conjunctions.py --tle-a ../src/lib/embedded/40115.tle --tle-b investigation/starlink_dec19_postanomaly.tle --anchor 2025-12-18T12:00:00Z
```

## Files

- `starlink_dec19_postanomaly.tle` - Post-anomaly TLE for Starlink-35956 (epoch 2025-12-19 22:47:58 UTC, n=15.452)
