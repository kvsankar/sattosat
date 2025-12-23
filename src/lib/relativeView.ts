import type { ECIPosition } from '../types/satellite';
import type { SatRec } from 'satellite.js';
import { EARTH_RADIUS_KM, calculatePosition, generateOrbitSamples } from './orbit';
import { angleBetweenDeg, closestApproachToOriginAlongSegment, subtract } from './vectorMath';
import { calculateSunPosition } from './sun';

export type EarthRelation = 'obstructed' | 'background' | 'clear';

export function classifyEarthRelation(
  satAEci: ECIPosition,
  satBEci: ECIPosition,
  radius: number = EARTH_RADIUS_KM
): { relation: EarthRelation; missDistance: number; tAlong: number } {
  const { distance, tAlong, rawT } = closestApproachToOriginAlongSegment(satAEci, satBEci);
  if (distance <= radius && tAlong >= 0 && tAlong <= 1) {
    return { relation: 'obstructed', missDistance: distance, tAlong };
  }

  if (distance <= radius && rawT > 1) {
    // Earth lies behind Satellite B along the same line of sight
    return { relation: 'background', missDistance: distance, tAlong };
  }

  return { relation: 'clear', missDistance: distance, tAlong };
}

export function computePhaseAngle(
  satAEci: ECIPosition,
  satBEci: ECIPosition,
  sunEci: ECIPosition
): number {
  // Sun - B - A phase: angle at Satellite B between Sun->B and A->B vectors
  const sunToB = subtract(sunEci, satBEci);
  const aToB = subtract(satAEci, satBEci);
  return angleBetweenDeg(sunToB, aToB);
}

export function computeSunForTime(time: Date): ECIPosition {
  return calculateSunPosition(time);
}

export function generateRelativeOrbitTrack(
  satrecA: SatRec,
  satrecB: SatRec,
  time: Date,
  points: number = 360
): ECIPosition[] {
  const samplesB = generateOrbitSamples(satrecB, time, points);
  const track: ECIPosition[] = [];

  for (const sample of samplesB) {
    const positionA = calculatePosition(satrecA, sample.time);
    if (!positionA) continue;
    track.push(subtract(sample.eci, positionA.eci));
  }

  return track;
}
