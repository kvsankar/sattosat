import type { ECIPosition } from '../types/satellite';

export function subtract(a: ECIPosition, b: ECIPosition): ECIPosition {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add(a: ECIPosition, b: ECIPosition): ECIPosition {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(v: ECIPosition, k: number): ECIPosition {
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

export function dot(a: ECIPosition, b: ECIPosition): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function magnitude(v: ECIPosition): number {
  return Math.sqrt(dot(v, v));
}

export function normalize(v: ECIPosition): ECIPosition {
  const mag = magnitude(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return scale(v, 1 / mag);
}

export function angleBetweenDeg(a: ECIPosition, b: ECIPosition): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  const cosTheta = Math.min(1, Math.max(-1, dot(a, b) / (magA * magB)));
  return Math.acos(cosTheta) * (180 / Math.PI);
}

export function closestApproachToOriginAlongSegment(
  start: ECIPosition,
  end: ECIPosition
): { distance: number; tAlong: number; rawT: number } {
  const ab = subtract(end, start);
  const abLenSq = dot(ab, ab);
  if (abLenSq === 0) {
    return { distance: magnitude(start), tAlong: 0, rawT: 0 };
  }
  // Parameter t where 0=start, 1=end
  const t = -dot(start, ab) / abLenSq;
  const clampedT = Math.max(0, Math.min(1, t));
  const closest = add(start, scale(ab, clampedT));
  return { distance: magnitude(closest), tAlong: clampedT, rawT: t };
}
