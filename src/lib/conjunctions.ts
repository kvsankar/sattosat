import * as satellite from 'satellite.js';
import type { Conjunction, SatelliteTLE } from '../types/satellite';
import { createSatrec, calculatePosition, calculateDistance, calculateRelativeVelocity } from './orbit';
import { classifyEarthRelation, computePhaseAngle, computeSunForTime } from './relativeView';

interface ConjunctionSearchResult {
  time: Date;
  distance: number;
}

export interface DistanceSample {
  time: Date;
  distance: number;
}

interface SatrecEntry {
  tle: SatelliteTLE;
  satrec: satellite.SatRec;
}

function buildSatrecCache(tles: SatelliteTLE[]): SatrecEntry[] {
  return tles
    .slice()
    .sort((a, b) => a.epoch.getTime() - b.epoch.getTime())
    .map(tle => ({
      tle,
      satrec: createSatrec({ line1: tle.line1, line2: tle.line2 }),
    }));
}

function selectSatrecForTime(entries: SatrecEntry[], time: Date): SatrecEntry | null {
  if (entries.length === 0) return null;
  let selected = entries[0]!;
  for (const entry of entries) {
    if (entry.tle.epoch.getTime() <= time.getTime()) {
      selected = entry;
    } else {
      break;
    }
  }
  return selected;
}

// Find all closest approaches between two satellites in a time range
// This finds local minima in the distance function, switching TLEs when epochs change
export function findConjunctions(params: {
  tlesA: SatelliteTLE[];
  tlesB: SatelliteTLE[];
  startTime: Date;
  endTime: Date;
  options?: {
    coarseStepSeconds?: number;
    maxResults?: number;
  };
}): Conjunction[] {
  const { tlesA, tlesB, startTime, endTime, options = {} } = params;
  const {
    coarseStepSeconds = 30,  // finer coarse search to avoid missing tight passes
    maxResults,
  } = options;

  const cachedA = buildSatrecCache(tlesA);
  const cachedB = buildSatrecCache(tlesB);

  // Find all local minima (closest approach points)
  const localMinima = findAllLocalMinima(
    cachedA,
    cachedB,
    startTime,
    endTime,
    coarseStepSeconds
  );

  // Convert to Conjunction objects
  const conjunctions: Conjunction[] = [];

  for (const minimum of localMinima) {
    const activeA = selectSatrecForTime(cachedA, minimum.time);
    const activeB = selectSatrecForTime(cachedB, minimum.time);
    if (!activeA || !activeB) continue;

    const posA = calculatePosition(activeA.satrec, minimum.time);
    const posB = calculatePosition(activeB.satrec, minimum.time);

    if (posA && posB) {
      const relVel = calculateRelativeVelocity(posA.velocity, posB.velocity);
      const sunEci = computeSunForTime(minimum.time);
      const phaseAngleDeg = computePhaseAngle(posA.eci, posB.eci, sunEci);
      const { relation, missDistance } = classifyEarthRelation(posA.eci, posB.eci);

      conjunctions.push({
        time: minimum.time,
        distance: minimum.distance,
        relativeVelocity: relVel,
        phaseAngleDeg,
        earthRelation: relation,
        earthMissDistanceKm: missDistance,
        satelliteA: {
          position: posA,
          name: activeA.tle.name,
        },
        satelliteB: {
          position: posB,
          name: activeB.tle.name,
        },
      });
    }
  }

  // Sort chronologically; panel handles distance/date sorting for display
  conjunctions.sort((a, b) => a.distance - b.distance);
  if (typeof maxResults === 'number') {
    return conjunctions.slice(0, maxResults);
  }
  return conjunctions;
}

// Find all local minima in the distance function
function findAllLocalMinima(
  cachedA: SatrecEntry[],
  cachedB: SatrecEntry[],
  startTime: Date,
  endTime: Date,
  stepSeconds: number
): ConjunctionSearchResult[] {
  const minima: ConjunctionSearchResult[] = [];
  const stepMs = stepSeconds * 1000;

  let prevDist: number | null = null;
  let currDist: number | null = null;
  let prevTime: Date | null = null;
  let currTime: Date | null = null;
  let wasDecreasing = false;

  let time = new Date(startTime.getTime());

  while (time <= endTime) {
    const activeA = selectSatrecForTime(cachedA, time);
    const activeB = selectSatrecForTime(cachedB, time);
    const posA = activeA ? calculatePosition(activeA.satrec, time) : null;
    const posB = activeB ? calculatePosition(activeB.satrec, time) : null;

    if (posA && posB) {
      const dist = calculateDistance(posA.eci, posB.eci);

      if (prevDist !== null && currDist !== null && prevTime !== null && currTime !== null) {
        // Check if we just passed a local minimum
        // (distance was decreasing, now increasing)
        const isDecreasing = currDist < prevDist;
        const isIncreasing = dist > currDist;

        if (wasDecreasing && isIncreasing) {
          // Found a local minimum around currTime
          // Refine it with ternary search
          const refined = refineMinimum(cachedA, cachedB, currTime, stepSeconds);
          minima.push(refined);
        }

        wasDecreasing = isDecreasing;
      }

      prevDist = currDist;
      currDist = dist;
      prevTime = currTime;
      currTime = new Date(time.getTime());
    }

    time = new Date(time.getTime() + stepMs);
  }

  return mergeNearbyMinima(minima, stepSeconds);
}

// Refine minimum using ternary search
function refineMinimum(
  cachedA: SatrecEntry[],
  cachedB: SatrecEntry[],
  approximateTime: Date,
  windowSeconds: number
): ConjunctionSearchResult {
  let left = approximateTime.getTime() - windowSeconds * 1000;
  let right = approximateTime.getTime() + windowSeconds * 1000;

  // Ternary search for minimum
  const tolerance = 100; // 100ms precision

  while (right - left > tolerance) {
    const mid1 = left + (right - left) / 3;
    const mid2 = right - (right - left) / 3;

    const dist1 = getDistanceAtTime(cachedA, cachedB, new Date(mid1));
    const dist2 = getDistanceAtTime(cachedA, cachedB, new Date(mid2));

    if (dist1 < dist2) {
      right = mid2;
    } else {
      left = mid1;
    }
  }

  const finalTime = new Date((left + right) / 2);
  const finalDistance = getDistanceAtTime(cachedA, cachedB, finalTime);

  return {
    time: finalTime,
    distance: finalDistance,
  };
}

function mergeNearbyMinima(minima: ConjunctionSearchResult[], thresholdSeconds: number): ConjunctionSearchResult[] {
  if (minima.length === 0) return minima;
  const sorted = minima.slice().sort((a, b) => a.time.getTime() - b.time.getTime());
  const merged: ConjunctionSearchResult[] = [];

  let current = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    const dt = (next.time.getTime() - current.time.getTime()) / 1000;
    if (dt <= thresholdSeconds) {
      // Keep the tighter pass within this window
      if (next.distance < current.distance) {
        current = next;
      }
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
}

function getDistanceAtTime(
  cachedA: SatrecEntry[],
  cachedB: SatrecEntry[],
  time: Date
): number {
  const activeA = selectSatrecForTime(cachedA, time);
  const activeB = selectSatrecForTime(cachedB, time);
  const posA = activeA ? calculatePosition(activeA.satrec, time) : null;
  const posB = activeB ? calculatePosition(activeB.satrec, time) : null;

  if (!posA || !posB) return Infinity;

  return calculateDistance(posA.eci, posB.eci);
}

// Sample distance curve over a time range for plotting
export function sampleDistanceCurve(
  tlesA: SatelliteTLE[],
  tlesB: SatelliteTLE[],
  startTime: Date,
  endTime: Date,
  samples: number = 180
): DistanceSample[] {
  if (!tlesA.length || !tlesB.length || samples <= 1) return [];
  const cacheA = buildSatrecCache(tlesA);
  const cacheB = buildSatrecCache(tlesB);
  const totalMs = endTime.getTime() - startTime.getTime();
  const stepMs = totalMs / (samples - 1);

  const result: DistanceSample[] = [];
  for (let i = 0; i < samples; i++) {
    const t = new Date(startTime.getTime() + i * stepMs);
    const distance = getDistanceAtTime(cacheA, cacheB, t);
    result.push({ time: t, distance });
  }
  return result;
}

// Calculate current distance between two satellites
export function getCurrentDistance(
  tlesA: SatelliteTLE[],
  tlesB: SatelliteTLE[],
  time: Date
): { distance: number; relativeVelocity: number } | null {
  const cacheA = buildSatrecCache(tlesA);
  const cacheB = buildSatrecCache(tlesB);
  const activeA = selectSatrecForTime(cacheA, time);
  const activeB = selectSatrecForTime(cacheB, time);
  if (!activeA || !activeB) return null;

  const posA = calculatePosition(activeA.satrec, time);
  const posB = calculatePosition(activeB.satrec, time);

  if (!posA || !posB) return null;

  return {
    distance: calculateDistance(posA.eci, posB.eci),
    relativeVelocity: calculateRelativeVelocity(posA.velocity, posB.velocity),
  };
}
