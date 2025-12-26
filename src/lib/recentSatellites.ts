import type { SatelliteCatalogEntry } from '../types/satellite';

const STORAGE_KEY = 'sattosat_recent_satellites';
const MAX_RECENT = 5;

export function getRecentSatellites(): SatelliteCatalogEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return [];
}

export function addRecentSatellite(satellite: SatelliteCatalogEntry): void {
  try {
    const recent = getRecentSatellites();

    // Remove if already exists (to move to front)
    const filtered = recent.filter(s => s.noradId !== satellite.noradId);

    // Add to front
    filtered.unshift(satellite);

    // Keep only MAX_RECENT
    const trimmed = filtered.slice(0, MAX_RECENT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}
