import { describe, it, expect, vi } from 'vitest';
import * as satellite from 'satellite.js';

type TleLines = { line1: string; line2: string };

const CELESTRAK_TLE_URL = (catnr: number) =>
  `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=tle`;

const ORACLE_SATS = [
  { catnr: 40115, name: 'WORLDVIEW-3' },
  { catnr: 66629, name: 'STARLINK-35956' },
];

async function fetchTle(catnr: number): Promise<TleLines> {
  const text = await fetch(CELESTRAK_TLE_URL(catnr)).then(res => {
    if (!res.ok) throw new Error(`Failed to fetch TLE: ${res.status}`);
    return res.text();
  });

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const line1 = lines.find(l => l.startsWith('1 '));
  const line2 = lines.find(l => l.startsWith('2 '));
  if (!line1 || !line2) throw new Error('Malformed TLE response');

  return { line1, line2 };
}

function propagateSatJs(line1: string, line2: string, time: Date) {
  const satrec = satellite.twoline2satrec(line1, line2);
  const pv = satellite.propagate(satrec, time);
  if (!pv.position || typeof pv.position === 'boolean') {
    throw new Error('Propagation failed');
  }
  const gmst = satellite.gstime(time);
  const geo = satellite.eciToGeodetic(pv.position, gmst);

  return {
    lat: satellite.degreesLat(geo.latitude),
    lon: satellite.degreesLong(geo.longitude),
    alt: geo.height,
  };
}

async function propagateWithTleJs(line1: string, line2: string, time: Date) {
  // tle.js expects a browser-like global; stub self if missing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).self = globalThis;
  const { getSatelliteInfo } = await import('tle.js/dist/tlejs.esm.js');
  const info = getSatelliteInfo([line1, line2], time, 0, 0, 0);
  return { lat: info.lat, lon: info.lng, height: info.height };
}

describe('Oracle check against independent tle.js library', () => {
  // Networked test; allow a bit more time.
  vi.setConfig({ testTimeout: 15000 });

  it('propagates positions matching tle.js within tolerance', async () => {
    const when = new Date(); // Use current epoch to avoid oracle drift

    for (const sat of ORACLE_SATS) {
      const { line1, line2 } = await fetchTle(sat.catnr);

      const ours = propagateSatJs(line1, line2, when);
      const oracle = await propagateWithTleJs(line1, line2, when);

      const latDiff = Math.abs(ours.lat - oracle.lat);
      const lonDiff = Math.abs(ours.lon - oracle.lon);
      const altDiff = Math.abs(ours.alt - oracle.height);

      // Tolerance: ~0.05° lat/lon (~5–6 km) and 5 km altitude
      expect(latDiff).toBeLessThan(0.05);
      expect(lonDiff).toBeLessThan(0.05);
      expect(altDiff).toBeLessThan(5);
    }
  });
});
