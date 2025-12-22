import { describe, it, expect } from 'vitest';
import { createSatrec, calculatePosition, generateOrbitPath } from './orbit';
import type { CelestrakGP } from '../types/satellite';

// Sample GP data for WORLDVIEW-3 (high orbit, low BSTAR)
const worldview3GP: CelestrakGP = {
  OBJECT_NAME: "WORLDVIEW-3 (WV-3)",
  OBJECT_ID: "2014-048A",
  EPOCH: "2025-12-21T19:15:52.219872",
  MEAN_MOTION: 14.84666878,
  ECCENTRICITY: 0.0001862,
  INCLINATION: 97.8768,
  RA_OF_ASC_NODE: 67.9714,
  ARG_OF_PERICENTER: 134.3123,
  MEAN_ANOMALY: 225.8245,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: "U",
  NORAD_CAT_ID: 40115,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 57892,
  BSTAR: 0.000036647,
  MEAN_MOTION_DOT: 0.00000265,
  MEAN_MOTION_DDOT: 0
};

// Sample GP data for STARLINK-35956 (high BSTAR, tests formatScientific edge case)
const starlink35956GP: CelestrakGP = {
  OBJECT_NAME: "STARLINK-35956",
  OBJECT_ID: "2025-271N",
  EPOCH: "2025-12-18T16:00:00.999936",
  MEAN_MOTION: 15.49463337,
  ECCENTRICITY: 0.00005424,
  INCLINATION: 53.1591,
  RA_OF_ASC_NODE: 158.846,
  ARG_OF_PERICENTER: 63.7637,
  MEAN_ANOMALY: 4.4961,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: "U",
  NORAD_CAT_ID: 66629,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 519,
  BSTAR: 0.0002238515,
  MEAN_MOTION_DOT: 0.00012088,
  MEAN_MOTION_DDOT: 0
};

describe('createSatrec', () => {
  it('should create satrec without error for WORLDVIEW-3', () => {
    const satrec = createSatrec(worldview3GP);
    expect(satrec.error).toBe(0);
  });

  it('should create satrec without error for STARLINK-35956', () => {
    const satrec = createSatrec(starlink35956GP);
    expect(satrec.error).toBe(0);
  });
});

describe('calculatePosition', () => {
  it('should calculate position at epoch for WORLDVIEW-3', () => {
    const satrec = createSatrec(worldview3GP);
    const epochDate = new Date(worldview3GP.EPOCH + 'Z');
    const position = calculatePosition(satrec, epochDate);

    expect(position).not.toBeNull();
    expect(position!.eci.x).toBeDefined();
    expect(position!.eci.y).toBeDefined();
    expect(position!.eci.z).toBeDefined();
  });

  it('should calculate position at epoch +1h for WORLDVIEW-3', () => {
    const satrec = createSatrec(worldview3GP);
    const epochDate = new Date(worldview3GP.EPOCH + 'Z');
    const testTime = new Date(epochDate.getTime() + 60 * 60 * 1000);
    const position = calculatePosition(satrec, testTime);

    expect(position).not.toBeNull();
  });

  it('should calculate position at epoch for STARLINK-35956', () => {
    const satrec = createSatrec(starlink35956GP);
    const epochDate = new Date(starlink35956GP.EPOCH + 'Z');
    const position = calculatePosition(satrec, epochDate);

    expect(position).not.toBeNull();
    expect(position!.eci.x).toBeDefined();
  });

  it('should calculate position at epoch +1h for STARLINK-35956', () => {
    const satrec = createSatrec(starlink35956GP);
    const epochDate = new Date(starlink35956GP.EPOCH + 'Z');
    const testTime = new Date(epochDate.getTime() + 60 * 60 * 1000);
    const position = calculatePosition(satrec, testTime);

    // This was failing before the formatScientific fix
    expect(position).not.toBeNull();
  });
});

describe('generateOrbitPath', () => {
  it('should generate orbit path for WORLDVIEW-3', () => {
    const satrec = createSatrec(worldview3GP);
    const epochDate = new Date(worldview3GP.EPOCH + 'Z');
    const path = generateOrbitPath(satrec, epochDate);

    expect(path.length).toBeGreaterThan(0);
    expect(path.length).toBe(361); // 360 points + closing point
  });

  it('should generate orbit path for STARLINK-35956', () => {
    const satrec = createSatrec(starlink35956GP);
    const epochDate = new Date(starlink35956GP.EPOCH + 'Z');
    const path = generateOrbitPath(satrec, epochDate);

    // This was returning 0 points before the fix
    expect(path.length).toBeGreaterThan(0);
  });
});
