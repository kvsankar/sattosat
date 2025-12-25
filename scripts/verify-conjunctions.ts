#!/usr/bin/env npx tsx
/**
 * CLI tool to verify conjunction calculations using the same TS code as the web app.
 * This ensures algorithm consistency between TS and Python implementations.
 *
 * Usage:
 *   npx tsx scripts/verify-conjunctions.ts
 */

import { findConjunctions } from '../src/lib/conjunctions';
import type { SatelliteTLE } from '../src/types/satellite';

const MU = 398600.4418; // Earth gravitational parameter km³/s²
const EARTH_RADIUS_KM = 6378.137;

// WorldView-3 (NORAD 40115) TLEs
const WORLDVIEW3_TLE_DATA = `
1 40115U 14048A   25350.34446038  .00001065  00000-0  12954-3 0  9991
2 40115  97.8614  62.5794 0005054 173.0688 187.0598 14.85520725614770
1 40115U 14048A   25350.95067920  .00000991  00000-0  12090-3 0  9995
2 40115  97.8613  63.1780 0005108 171.1729 188.9577 14.85522182614862
1 40115U 14048A   25351.28746733  .00000969  00000-0  11844-3 0  9999
2 40115  97.8612  63.5105 0005130 170.1438 189.9878 14.85523011614910
1 40115U 14048A   25351.62425533  .00000921  00000-0  11282-3 0  9993
2 40115  97.8612  63.8431 0005162 169.1037 191.0291 14.85523650614960
1 40115U 14048A   25351.82632810  .00000923  00000-0  11309-3 0  9995
2 40115  97.8612  64.0426 0005176 168.4648 191.6687 14.85524143614998
1 40115U 14048A   25352.23066906  .00000882  00000-0  11059-3 0  9994
2 40115  97.8774  64.4419 0001686 140.5848 219.5489 14.84660813615050
1 40115U 14048A   25352.63504949  .00000825  00000-0  10389-3 0  9994
2 40115  97.8775  64.8416 0001682 139.1546 220.9795 14.84660894615119
1 40115U 14048A   25352.90463620  .00000841  00000-0  10574-3 0  9998
2 40115  97.8774  65.1080 0001711 138.8396 221.2947 14.84661456615153
1 40115U 14048A   25353.24161950  .00000793  00000-0  10008-3 0  9995
2 40115  97.8773  65.4410 0001733 138.3296 221.8051 14.84661803615204
1 40115U 14048A   25353.64599932  .00000777  00000-0  98130-4 0  9999
2 40115  97.8773  65.8405 0001761 137.8017 222.3333 14.84662431615261
`.trim();

// Starlink-35956 (NORAD 66620) TLEs
const STARLINK_TLE_DATA = `
1 66620U 25271D   25349.33335648  .00069454  00000-0  12476-2 0  9995
2 66620  53.1595 174.8277 0000850  72.9145  91.6448 15.49265927  4665
1 66620U 25271D   25349.91668981  .00078363  00000-0  14055-2 0  9992
2 66620  53.1591 172.0407 0001030  67.3574 112.6206 15.49257406  4750
1 66620U 25271D   25350.25003472  .00035242  00000-0  63952-3 0  9999
2 66620  53.1588 170.4449 0000971  85.0403 155.2232 15.49279151  4804
1 66620U 25271D   25350.91659374  .00072155  00000-0  12924-2 0  9996
2 66620  53.1594 167.2583 0001011  73.6747 286.4374 15.49331814  4858
1 66620U 25271D   25351.11012073  .00067036  00000-0  12027-2 0  9994
2 66620  53.1595 166.3336 0001328  61.4490 298.6653 15.49318301  4880
1 66620U 25271D   25351.62618341  .00066138  00000-0  11865-2 0  9991
2 66620  53.1599 163.8656 0001254  90.3166 269.7987 15.49324687  4962
1 66620U 25271D   25351.88421566  .00067856  00000-0  12164-2 0  9991
2 66620  53.1598 162.6324 0000934  77.1817 282.9297 15.49335274  5001
1 66620U 25271D   25352.27126318  .00039571  00000-0  71543-3 0  9992
2 66620  53.1601 160.7823 0000850  76.6318 283.4786 15.49329114  5067
1 66620U 25271D   25352.59380185  .00072798  00000-0  13029-2 0  9993
2 66620  53.1598 159.2400 0001065  75.4151 284.6977 15.49350533  5117
1 66620U 25271D   25352.85183634  .00034317  00000-0  62165-3 0  9993
2 66620  53.1598 158.0059 0001202  74.9181 285.1961 15.49341209  5157
1 66620U 25271D   25353.94998243 -.00389636  00000-0 -84825-2 0  9999
2 66620  53.1593 152.7719 0001217  60.4895 299.6234 15.45204148  5322
1 66620U 25271D   25355.96038664  .00072102  00000-0  17924-2 0  9996
2 66620  53.1599 143.2712 0001851 170.8964 189.2075 15.39672113  5638
`.trim();

function parseEpochFromTLE(line1: string): Date {
  const epochStr = line1.substring(18, 32).trim();
  const year = parseInt(epochStr.substring(0, 2));
  const fullYear = year < 57 ? 2000 + year : 1900 + year;
  const dayOfYear = parseFloat(epochStr.substring(2));
  const date = new Date(Date.UTC(fullYear, 0, 1));
  date.setTime(date.getTime() + (dayOfYear - 1) * 24 * 60 * 60 * 1000);
  return date;
}

function parseTLELines(data: string, noradId: number, name: string): SatelliteTLE[] {
  const lines = data.split('\n').filter(line => line.trim());
  const tles: SatelliteTLE[] = [];

  for (let i = 0; i < lines.length; i += 2) {
    const line1 = lines[i];
    const line2 = lines[i + 1];
    if (!line1 || !line2) continue;

    const epoch = parseEpochFromTLE(line1);
    const meanMotion = parseFloat(line2.substring(52, 63));
    const eccentricity = parseFloat('0.' + line2.substring(26, 33).trim());
    const inclination = parseFloat(line2.substring(8, 16));

    const period = (24 * 60) / meanMotion;
    const periodSeconds = period * 60;
    const semiMajorAxis = Math.pow(MU * Math.pow(periodSeconds / (2 * Math.PI), 2), 1 / 3);
    const apogee = semiMajorAxis * (1 + eccentricity) - EARTH_RADIUS_KM;
    const perigee = semiMajorAxis * (1 - eccentricity) - EARTH_RADIUS_KM;

    tles.push({
      noradId,
      name,
      line1,
      line2,
      epoch,
      inclination,
      eccentricity,
      raan: parseFloat(line2.substring(17, 25)),
      argOfPerigee: parseFloat(line2.substring(34, 42)),
      meanAnomaly: parseFloat(line2.substring(43, 51)),
      meanMotion,
      period,
      semiMajorAxis,
      apogee,
      perigee,
    });
  }
  return tles;
}

function formatDate(d: Date): string {
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

async function main() {
  console.log('='.repeat(70));
  console.log('TypeScript Conjunction Verification');
  console.log('Using same code as SatToSat web app');
  console.log('='.repeat(70));
  console.log();

  const wv3Tles = parseTLELines(WORLDVIEW3_TLE_DATA, 40115, 'WorldView-3');
  const starlinkTles = parseTLELines(STARLINK_TLE_DATA, 66620, 'Starlink-35956');

  console.log(`Loaded ${wv3Tles.length} WorldView-3 TLEs`);
  console.log(`Loaded ${starlinkTles.length} Starlink-35956 TLEs`);
  console.log();

  console.log('Starlink-35956 TLE epochs:');
  console.log('-'.repeat(50));
  for (const tle of starlinkTles.sort((a, b) => a.epoch.getTime() - b.epoch.getTime())) {
    console.log(`  ${formatDate(tle.epoch)} - n=${tle.meanMotion.toFixed(5)} rev/day`);
  }
  console.log();

  const startTime = new Date('2025-12-17T00:00:00Z');
  const endTime = new Date('2025-12-19T23:59:59Z');

  console.log(`Search window: ${formatDate(startTime)} to ${formatDate(endTime)}`);
  console.log();

  console.log('='.repeat(70));
  console.log('Finding all close approaches...');
  console.log('='.repeat(70));
  console.log();

  const conjunctions = findConjunctions({
    tlesA: wv3Tles,
    tlesB: starlinkTles,
    startTime,
    endTime,
    options: { coarseStepSeconds: 30 },
  });

  console.log(`Found ${conjunctions.length} conjunctions:\n`);

  for (let i = 0; i < Math.min(conjunctions.length, 20); i++) {
    const c = conjunctions[i]!;
    console.log(`${(i + 1).toString().padStart(2)}. ${c.distance.toFixed(1)} km at ${formatDate(c.time)}`);
    console.log(`    Relative velocity: ${c.relativeVelocity.toFixed(2)} km/s`);
    console.log(`    Phase angle: ${c.phaseAngleDeg.toFixed(1)}°`);
    console.log(`    Earth relation: ${c.earthRelation}`);
    console.log();
  }

  console.log('='.repeat(70));
  console.log('COMPARISON WITH PYTHON RESULTS');
  console.log('='.repeat(70));
  console.log();

  if (conjunctions.length > 0) {
    const closest = conjunctions[0]!;
    console.log('TypeScript (this script):');
    console.log(`  Closest: ${closest.distance.toFixed(1)} km at ${formatDate(closest.time)}`);
    console.log();
    console.log('Python script found:');
    console.log('  Closest: 204.2 km at 2025-12-17 12:18:59 UTC');
    console.log();

    const diff = Math.abs(closest.distance - 204.2);
    if (diff < 1) {
      console.log('✓ Results match within 1 km - algorithms are consistent!');
    } else {
      console.log(`✗ Results differ by ${diff.toFixed(1)} km - investigate discrepancy`);
    }
  }

  console.log();
  console.log('Reported imaging distance: 241 km');
  console.log('Location: Alaska');
  console.log('Date: December 18, 2025');
}

main().catch(console.error);
