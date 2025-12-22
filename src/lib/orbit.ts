import * as satellite from 'satellite.js';
import type { CelestrakGP, SatellitePosition, ECIPosition } from '../types/satellite';

// Earth radius in km (WGS84)
export const EARTH_RADIUS_KM = 6378.137;

// Convert GP JSON or raw TLE lines to satellite.js satrec
export function createSatrec(source: CelestrakGP | { line1: string; line2: string }): satellite.SatRec {
  if ('line1' in source && 'line2' in source) {
    return satellite.twoline2satrec(source.line1, source.line2);
  }

  // Fallback: construct lines from GP fields
  const tleLine1 = gpToTleLine1(source);
  const tleLine2 = gpToTleLine2(source);

  return satellite.twoline2satrec(tleLine1, tleLine2);
}

// Generate TLE Line 1 from GP data
function gpToTleLine1(gp: CelestrakGP): string {
  const norad = gp.NORAD_CAT_ID.toString().padStart(5, '0');
  const classification = gp.CLASSIFICATION_TYPE || 'U';
  const intlDesig = formatIntlDesig(gp.OBJECT_ID);
  const epochYear = getEpochYear(gp.EPOCH);
  const epochDay = getEpochDay(gp.EPOCH);
  const meanMotionDot = formatMeanMotionDot(gp.MEAN_MOTION_DOT);
  const meanMotionDdot = formatScientific(gp.MEAN_MOTION_DDOT);
  const bstar = formatScientific(gp.BSTAR);
  const ephType = gp.EPHEMERIS_TYPE || 0;
  const elemSetNo = gp.ELEMENT_SET_NO.toString().padStart(4, ' ');

  const line = `1 ${norad}${classification} ${intlDesig} ${epochYear}${epochDay} ${meanMotionDot} ${meanMotionDdot} ${bstar} ${ephType} ${elemSetNo}`;
  const checksum = computeChecksum(line);

  return line + checksum;
}

// Generate TLE Line 2 from GP data
function gpToTleLine2(gp: CelestrakGP): string {
  const norad = gp.NORAD_CAT_ID.toString().padStart(5, '0');
  const inclination = gp.INCLINATION.toFixed(4).padStart(8, ' ');
  const raan = gp.RA_OF_ASC_NODE.toFixed(4).padStart(8, ' ');
  const eccentricity = gp.ECCENTRICITY.toFixed(7).slice(2); // Remove "0."
  const argPerigee = gp.ARG_OF_PERICENTER.toFixed(4).padStart(8, ' ');
  const meanAnomaly = gp.MEAN_ANOMALY.toFixed(4).padStart(8, ' ');
  const meanMotion = gp.MEAN_MOTION.toFixed(8).padStart(11, ' ');
  const revNum = gp.REV_AT_EPOCH.toString().padStart(5, ' ');

  const line = `2 ${norad} ${inclination} ${raan} ${eccentricity} ${argPerigee} ${meanAnomaly} ${meanMotion}${revNum}`;
  const checksum = computeChecksum(line);

  return line + checksum;
}

// Helper functions for TLE formatting
function formatIntlDesig(objectId: string): string {
  // Format like "1998-067A" to "98067A  "
  const match = objectId.match(/(\d{4})-(\d{3})([A-Z]+)/);
  if (match) {
    const year = match[1]!.slice(2);
    const launch = match[2];
    const piece = match[3]!.padEnd(3, ' ');
    return `${year}${launch}${piece}`;
  }
  return objectId.padEnd(8, ' ').slice(0, 8);
}

function parseEpochAsUTC(epoch: string): Date {
  // Celestrak EPOCH is in UTC but without 'Z' suffix
  // Append 'Z' to ensure UTC interpretation
  const utcEpoch = epoch.endsWith('Z') ? epoch : epoch + 'Z';
  return new Date(utcEpoch);
}

function getEpochYear(epoch: string): string {
  const year = parseEpochAsUTC(epoch).getUTCFullYear();
  return (year % 100).toString().padStart(2, '0');
}

function getEpochDay(epoch: string): string {
  const date = parseEpochAsUTC(epoch);
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = diff / (1000 * 60 * 60 * 24) + 1;
  return dayOfYear.toFixed(8).padStart(12, ' ');
}

function formatMeanMotionDot(value: number): string {
  if (value >= 0) {
    return ' .' + Math.abs(value).toFixed(8).slice(2).padEnd(8, '0');
  } else {
    return '-.' + Math.abs(value).toFixed(8).slice(2).padEnd(8, '0');
  }
}

function formatScientific(value: number): string {
  if (value === 0) return ' 00000-0';

  const sign = value >= 0 ? ' ' : '-';
  const absVal = Math.abs(value);

  // TLE uses "assumed decimal" format: 0.AAAAA × 10^E
  // So mantissa should be in range [0.1, 1.0)
  const exp = Math.floor(Math.log10(absVal)) + 1;
  const mantissa = absVal / Math.pow(10, exp);
  const mantissaStr = Math.round(mantissa * 100000).toString().padStart(5, '0');
  const expSign = exp >= 0 ? '+' : '-';

  return `${sign}${mantissaStr}${expSign}${Math.abs(exp)}`;
}

function computeChecksum(line: string): string {
  let sum = 0;
  for (const char of line) {
    if (char >= '0' && char <= '9') {
      sum += parseInt(char, 10);
    } else if (char === '-') {
      sum += 1;
    }
  }
  return (sum % 10).toString();
}

// Calculate satellite position at a given time
export function calculatePosition(satrec: satellite.SatRec, time: Date): SatellitePosition | null {
  const positionAndVelocity = satellite.propagate(satrec, time);

  if (typeof positionAndVelocity.position === 'boolean' || !positionAndVelocity.position) {
    return null;
  }

  const positionEci = positionAndVelocity.position as satellite.EciVec3<number>;
  const velocityEci = positionAndVelocity.velocity as satellite.EciVec3<number>;

  // Convert to geodetic
  const gmst = satellite.gstime(time);
  const geodeticCoords = satellite.eciToGeodetic(positionEci, gmst);

  return {
    time,
    eci: {
      x: positionEci.x,
      y: positionEci.y,
      z: positionEci.z,
    },
    geodetic: {
      latitude: satellite.degreesLat(geodeticCoords.latitude),
      longitude: satellite.degreesLong(geodeticCoords.longitude),
      altitude: geodeticCoords.height,
    },
    velocity: {
      x: velocityEci.x,
      y: velocityEci.y,
      z: velocityEci.z,
    },
  };
}

// Generate orbit path points for visualization
export function generateOrbitPath(
  satrec: satellite.SatRec,
  time: Date,
  points: number = 360
): ECIPosition[] {
  const path: ECIPosition[] = [];

  // Get the orbital period from mean motion
  // This is approximate but good enough for visualization
  const meanMotion = satrec.no; // radians per minute
  const periodMinutes = (2 * Math.PI) / meanMotion;

  for (let i = 0; i <= points; i++) {
    const fraction = i / points;
    const offsetMinutes = fraction * periodMinutes;
    const pointTime = new Date(time.getTime() + offsetMinutes * 60 * 1000);

    const position = calculatePosition(satrec, pointTime);
    if (position) {
      path.push(position.eci);
    }
  }

  return path;
}

// Calculate distance between two ECI positions in km
export function calculateDistance(pos1: ECIPosition, pos2: ECIPosition): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Calculate relative velocity between two satellites
export function calculateRelativeVelocity(
  vel1: ECIPosition,
  vel2: ECIPosition
): number {
  const dvx = vel1.x - vel2.x;
  const dvy = vel1.y - vel2.y;
  const dvz = vel1.z - vel2.z;
  return Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
}

// Convert ECI to Three.js coordinates (Y-up, scaled)
export function eciToThreeJs(eci: ECIPosition, scale: number = 1 / EARTH_RADIUS_KM): [number, number, number] {
  // ECI: X toward vernal equinox, Z toward north pole, Y completes right-hand
  // Three.js: Y up
  // So we swap Y and Z
  return [
    eci.x * scale,
    eci.z * scale,  // Z becomes Y (up)
    -eci.y * scale, // Y becomes -Z
  ];
}
