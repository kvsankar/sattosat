import { useMemo } from 'react';
import type { SatelliteTLE, SatellitePosition, ECIPosition } from '../types/satellite';
import { createSatrec, calculatePosition, generateOrbitPath } from '../lib/orbit';

interface UseSatellitePositionResult {
  position: SatellitePosition | null;
  orbitPath: ECIPosition[];
}

export function useSatellitePosition(
  tle: SatelliteTLE | null,
  time: Date
): UseSatellitePositionResult {
  return useMemo(() => {
    if (!tle) {
      return { position: null, orbitPath: [] };
    }

    try {
      const satrec = createSatrec({ line1: tle.line1, line2: tle.line2 });
      const position = calculatePosition(satrec, time);
      const orbitPath = generateOrbitPath(satrec, time);

      return { position, orbitPath };
    } catch (err) {
      console.error(`Error calculating position for ${tle.name}:`, err);
      return { position: null, orbitPath: [] };
    }
  }, [tle?.line1, tle?.line2, tle?.name, time]);
}
