import { useState, useEffect } from 'react';
import type { SatelliteTLE, Conjunction } from '../types/satellite';
import { findConjunctions, getCurrentDistance } from '../lib/conjunctions';

interface UseConjunctionsResult {
  conjunctions: Conjunction[];
  currentDistance: number | null;
  currentRelativeVelocity: number | null;
  loading: boolean;
  error: string | null;
}

export function useConjunctions(
  tleA: SatelliteTLE | null,
  tleB: SatelliteTLE | null,
  allTlesA: SatelliteTLE[],
  allTlesB: SatelliteTLE[],
  currentTime: Date,
  timeRangeDays: number = 10,
  searchCenter?: Date
): UseConjunctionsResult {
  const [conjunctions, setConjunctions] = useState<Conjunction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate current distance (reactive to time changes)
  const currentDistanceResult = (() => {
    const tlesA = allTlesA.length ? allTlesA : (tleA ? [tleA] : []);
    const tlesB = allTlesB.length ? allTlesB : (tleB ? [tleB] : []);
    if (tlesA.length === 0 || tlesB.length === 0) return null;
    try {
      return getCurrentDistance(tlesA, tlesB, currentTime);
    } catch {
      return null;
    }
  })();

  // Find conjunctions when satellites change (not on every time tick)
  useEffect(() => {
    const tlesA = allTlesA.length ? allTlesA : (tleA ? [tleA] : []);
    const tlesB = allTlesB.length ? allTlesB : (tleB ? [tleB] : []);

    if (tlesA.length === 0 || tlesB.length === 0) {
      setConjunctions([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Anchor search to the simulated time at the moment satellites/TLEs change.
    // We intentionally do not rerun this search on every playback tick to avoid flicker.
    const searchCenterTime = searchCenter ?? currentTime;

    // Capture stable references for the async function
    const tleSnapshotA = tlesA.slice();
    const tleSnapshotB = tlesB.slice();

    let cancelled = false;

    async function findAllConjunctions() {
      try {
        setLoading(true);
        setError(null);

        // Use current simulation time as center of search range
        const startTime = new Date(searchCenterTime.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);
        const endTime = new Date(searchCenterTime.getTime() + timeRangeDays * 24 * 60 * 60 * 1000);

        // Run in a microtask to not block the main thread
        const results = await new Promise<Conjunction[]>((resolve) => {
          setTimeout(() => {
            try {
              const conjs = findConjunctions({
                tlesA: tleSnapshotA,
                tlesB: tleSnapshotB,
                startTime,
                endTime,
                options: {
                  coarseStepSeconds: 30,
                },
              });
              resolve(conjs);
            } catch (err) {
              console.error('Conjunction search error:', err);
              resolve([]);
            }
          }, 0);
        });

        if (!cancelled) {
          setConjunctions(results);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to find conjunctions');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    findAllConjunctions();

    return () => {
      cancelled = true;
    };
  }, [
    allTlesA,
    allTlesB,
    currentTime,
    searchCenter,
    timeRangeDays,
    tleA,
    tleB,
  ]);

  return {
    conjunctions,
    currentDistance: currentDistanceResult?.distance ?? null,
    currentRelativeVelocity: currentDistanceResult?.relativeVelocity ?? null,
    loading,
    error,
  };
}
