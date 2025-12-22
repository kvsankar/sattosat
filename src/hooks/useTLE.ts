import { useState, useEffect, useCallback } from 'react';
import type { SatelliteTLE } from '../types/satellite';
import {
  fetchTLE,
  getTLECacheInfo,
  clearTLECache,
  getCacheSettings,
  getCachedTLEs,
  applyEmbeddedTLEs,
} from '../lib/celestrak';

interface UseTLEResult {
  tle: SatelliteTLE | null;
  loading: boolean;
  error: string | null;
  cacheInfo: { timestamp: number; epoch: string } | null;
  refresh: (opts?: { clearCache?: boolean }) => void;
  availableTles: Array<{ epoch: Date; cacheTimestamp: number }>;
  preferredEpoch: string | null;
  setPreferredEpoch: (epoch: string | null) => void;
  historicalLoading: boolean;
  allTles: Array<SatelliteTLE & { cacheTimestamp?: number }>;
}

export function useTLE(noradId: number | null, targetTime: Date): UseTLEResult {
  const [tle, setTle] = useState<SatelliteTLE | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ timestamp: number; epoch: string } | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [availableTles, setAvailableTles] = useState<Array<{ epoch: Date; cacheTimestamp: number }>>([]);
  const [preferredEpoch, setPreferredEpoch] = useState<string | null>(null);
  const historicalLoading = false;
  const [allTles, setAllTles] = useState<Array<SatelliteTLE & { cacheTimestamp?: number }>>([]);

  const refresh = useCallback((opts?: { clearCache?: boolean }) => {
    if (noradId !== null) {
      if (opts?.clearCache !== false) {
        clearTLECache(noradId);
      }
      setForceRefresh(true);
      setRefreshTrigger(t => t + 1);
    }
  }, [noradId]);

  useEffect(() => {
    if (noradId === null) {
      setTle(null);
      setLoading(false);
      setError(null);
      setCacheInfo(null);
      return;
    }

    const currentNoradId = noradId;
    let cancelled = false;

    async function loadTLE() {
      try {
        setLoading(true);
        setError(null);

        const settings = getCacheSettings();

        // Seed the cache with any embedded TLEs for this satellite
        applyEmbeddedTLEs(currentNoradId);

        // Use cached TLEs if available
        let cached = getCachedTLEs(currentNoradId, settings.tleCacheMs);

        if (cached.length === 0 || forceRefresh) {
          // Fetch latest and update cache list
          const latest = await fetchTLE(currentNoradId, forceRefresh);
          cached = getCachedTLEs(currentNoradId, settings.tleCacheMs);
          if (cached.length === 0) {
            cached = [{ ...latest, cacheTimestamp: Date.now() }];
          }
        }

        setAvailableTles(
          cached
            .map(c => ({ epoch: c.epoch, cacheTimestamp: c.cacheTimestamp ?? Date.now() }))
            .sort((a, b) => b.epoch.getTime() - a.epoch.getTime())
        );
        setAllTles(cached);

        const best = selectPreferredOrNearestTle(cached, targetTime, preferredEpoch);

        if (!cancelled) {
          setTle(best);
          setCacheInfo(getTLECacheInfo(currentNoradId));
          setForceRefresh(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load TLE');
          setTle(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTLE();

    return () => {
      cancelled = true;
    };
  }, [noradId, refreshTrigger, forceRefresh, targetTime, preferredEpoch]);

  // Update cache info when noradId changes
  useEffect(() => {
    if (noradId !== null) {
      setCacheInfo(getTLECacheInfo(noradId));
    }
  }, [noradId]);

  return {
    tle,
    loading,
    error,
    cacheInfo,
    refresh,
    availableTles,
    preferredEpoch,
    setPreferredEpoch,
    historicalLoading,
    allTles,
  };
}

function selectPreferredOrNearestTle(
  tles: Array<SatelliteTLE & { cacheTimestamp?: number }>,
  targetTime: Date,
  preferredEpoch: string | null
): SatelliteTLE {
  if (tles.length === 0) {
    throw new Error('No TLEs available');
  }

  if (preferredEpoch) {
    const exact = tles.find(t => t.epoch.toISOString() === preferredEpoch);
    if (exact) return exact;
  }

  const targetMs = targetTime.getTime();
  return tles.reduce((closest, current) => {
    const currentDiff = Math.abs(current.epoch.getTime() - targetMs);
    const closestDiff = Math.abs(closest.epoch.getTime() - targetMs);
    return currentDiff < closestDiff ? current : closest;
  });
}
