import { useState, useEffect, useCallback } from 'react';
import type { SatelliteCatalogEntry } from '../types/satellite';
import { fetchSatelliteCatalog, getCatalogCacheInfo } from '../lib/celestrak';

interface UseSatelliteCatalogResult {
  catalog: SatelliteCatalogEntry[];
  loading: boolean;
  error: string | null;
  cacheInfo: { timestamp: number; count: number } | null;
  refresh: () => void;
}

export function useSatelliteCatalog(): UseSatelliteCatalogResult {
  const [catalog, setCatalog] = useState<SatelliteCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ timestamp: number; count: number } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(false);

  const refresh = useCallback(() => {
    setForceRefresh(true);
    setRefreshTrigger(t => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchSatelliteCatalog(forceRefresh);

        if (!cancelled) {
          // Sort by name for easier browsing
          data.sort((a, b) => a.name.localeCompare(b.name));
          setCatalog(data);
          setCacheInfo(getCatalogCacheInfo());
          setForceRefresh(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load satellite catalog');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, forceRefresh]);

  // Get initial cache info
  useEffect(() => {
    setCacheInfo(getCatalogCacheInfo());
  }, []);

  return { catalog, loading, error, cacheInfo, refresh };
}
