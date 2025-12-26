import * as satellite from 'satellite.js';
import type { CelestrakGP, SatelliteCatalogEntry, SatelliteTLE } from '../types/satellite';
import { getEmbeddedTleTexts } from './embeddedTles';

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

// Cache keys
const CACHE_KEY_CATALOG = 'satorbitviz_catalog';
const CACHE_KEY_TLE_PREFIX = 'satorbitviz_tle_';
const CACHE_KEY_SETTINGS = 'satorbitviz_cache_settings';

// Default cache durations (in milliseconds)
const DEFAULT_CATALOG_CACHE_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_TLE_CACHE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Earth constants
const EARTH_RADIUS_KM = 6378.137;
const MU = 398600.4418; // Earth's gravitational parameter (km^3/s^2)
const MAX_TLE_CACHE_ENTRIES = 50;

// Satellite groups to fetch from Celestrak
const SATELLITE_GROUPS = [
  'active',      // General active satellites (~8000)
  'starlink',    // SpaceX Starlink constellation (~6000)
  'stations',    // Space stations (ISS, CSS, etc.)
];

interface CacheSettings {
  catalogCacheMs: number;
  tleCacheMs: number;
}

interface CatalogCacheEntry {
  data: SatelliteCatalogEntry[];
  timestamp: number;
}

interface TLECacheStored {
  gp: CelestrakGP;
  line1: string;
  line2: string;
  timestamp: number; // when this TLE snapshot was stored
  source?: 'manual' | 'fetched';
}

interface TLECacheEntry {
  entries: TLECacheStored[];
}

// Get cache settings
export function getCacheSettings(): CacheSettings {
  try {
    const stored = localStorage.getItem(CACHE_KEY_SETTINGS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return {
    catalogCacheMs: DEFAULT_CATALOG_CACHE_MS,
    tleCacheMs: DEFAULT_TLE_CACHE_MS,
  };
}

// Update cache settings
export function setCacheSettings(settings: Partial<CacheSettings>): void {
  const current = getCacheSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

// Get catalog cache info
export function getCatalogCacheInfo(): { timestamp: number; count: number } | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY_CATALOG);
    if (cached) {
      const entry: CatalogCacheEntry = JSON.parse(cached);
      return { timestamp: entry.timestamp, count: entry.data.length };
    }
  } catch {
    // ignore
  }
  return null;
}

// Clear all cache
export function clearAllCache(): void {
  try {
    // Clear catalog
    localStorage.removeItem(CACHE_KEY_CATALOG);

    // Clear all TLEs
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_TLE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

// Clear specific TLE cache
export function clearTLECache(noradId: number): void {
  try {
    localStorage.removeItem(`${CACHE_KEY_TLE_PREFIX}${noradId}`);
  } catch {
    // ignore
  }
}

// Fetch satellite catalog (with caching)
export async function fetchSatelliteCatalog(forceRefresh = false): Promise<SatelliteCatalogEntry[]> {
  const settings = getCacheSettings();

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedCatalog(settings.catalogCacheMs);
    if (cached) {
      return cached;
    }
  }

  const allSatellites: SatelliteCatalogEntry[] = [];
  const seenIds = new Set<number>();

  // Fetch all groups in parallel with timeout
  const CATALOG_TIMEOUT_MS = 15000; // 15 second timeout per group

  const fetchPromises = SATELLITE_GROUPS.map(async (group) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);

    try {
      const url = `${CELESTRAK_BASE}?GROUP=${group}&FORMAT=json`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Failed to fetch ${group} catalog: ${response.status}`);
        return [];
      }

      const data: CelestrakGP[] = await response.json();
      return data.map(gp => ({
        noradId: gp.NORAD_CAT_ID,
        name: gp.OBJECT_NAME,
        objectId: gp.OBJECT_ID,
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn(`Timeout fetching ${group} catalog after ${CATALOG_TIMEOUT_MS}ms`);
      } else {
        console.warn(`Error fetching ${group} catalog:`, err);
      }
      return [];
    }
  });

  const results = await Promise.all(fetchPromises);

  // Merge results, avoiding duplicates
  for (const satellites of results) {
    for (const sat of satellites) {
      if (!seenIds.has(sat.noradId)) {
        seenIds.add(sat.noradId);
        allSatellites.push(sat);
      }
    }
  }

  if (allSatellites.length === 0) {
    throw new Error('Failed to fetch any satellite catalogs');
  }

  // Cache the result
  cacheCatalog(allSatellites);

  return allSatellites;
}

// Fetch TLE for a specific satellite (with caching)
export async function fetchTLE(noradId: number, forceRefresh = false): Promise<SatelliteTLE> {
  const settings = getCacheSettings();

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedTLEs(noradId, settings.tleCacheMs);
    if (cached.length > 0) {
      // Return most recently stored entry
      const latest = cached.sort((a, b) => b.cacheTimestamp - a.cacheTimestamp)[0]!;
      return latest;
    }
  }

  const TLE_TIMEOUT_MS = 10000; // 10 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TLE_TIMEOUT_MS);

  const jsonUrl = `${CELESTRAK_BASE}?CATNR=${noradId}&FORMAT=json`;
  const tleUrl = `${CELESTRAK_BASE}?CATNR=${noradId}&FORMAT=tle`;

  let jsonResponse: Response;
  let tleResponse: Response;

  try {
    [jsonResponse, tleResponse] = await Promise.all([
      fetch(jsonUrl, { signal: controller.signal }),
      fetch(tleUrl, { signal: controller.signal }),
    ]);
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Timeout fetching TLE for NORAD ${noradId} after ${TLE_TIMEOUT_MS}ms`);
    }
    throw err;
  }

  if (!jsonResponse.ok) {
    throw new Error(`Failed to fetch GP data for NORAD ${noradId}: ${jsonResponse.status}`);
  }

  if (!tleResponse.ok) {
    throw new Error(`Failed to fetch TLE lines for NORAD ${noradId}: ${tleResponse.status}`);
  }

  const data: CelestrakGP[] = await jsonResponse.json();
  const tleText = await tleResponse.text();

  if (data.length === 0) {
    throw new Error(`No TLE found for NORAD ${noradId}`);
  }

  const gp = data[0]!;
  const { line1, line2 } = parseTleLines(tleText);

  // Cache the result (accumulating history)
  cacheTLE(noradId, gp, line1, line2);

  return parseTLE(gp, line1, line2);
}

// Get TLE cache info for a satellite
export function getTLECacheInfo(noradId: number): { timestamp: number; epoch: string } | null {
  try {
    const key = `${CACHE_KEY_TLE_PREFIX}${noradId}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const entry: TLECacheEntry = JSON.parse(cached);
      const entries = normalizeTleEntries(entry);
      if (entries.length === 0) return null;
      const latest = entries.sort((a, b) => b.timestamp - a.timestamp)[0]!;
      return { timestamp: latest.timestamp, epoch: latest.gp.EPOCH };
    }
  } catch {
    // ignore
  }
  return null;
}

// Get all cached TLEs (parsed) for a satellite within maxAgeMs
export function getCachedTLEs(
  noradId: number,
  maxAgeMs: number
): Array<SatelliteTLE & { cacheTimestamp: number }> {
  const entries = getCachedTLEEntries(noradId, maxAgeMs);
  return entries.map(e => ({
    ...parseTLE(e.gp, e.line1, e.line2),
    cacheTimestamp: e.timestamp,
  }));
}

function parseTleLines(tleText: string): { line1: string; line2: string } {
  const lines = tleText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const line1 = lines.find(l => l.startsWith('1 '));
  const line2 = lines.find(l => l.startsWith('2 '));

  if (!line1 || !line2) {
    throw new Error('Malformed TLE response');
  }

  return { line1, line2 };
}

function parseCelestrakEpoch(epoch: string): Date {
  // Celestrak epochs are UTC without a trailing Z
  const utcEpoch = epoch.endsWith('Z') ? epoch : `${epoch}Z`;
  return new Date(utcEpoch);
}

// Parse GP data into our TLE format with derived parameters
function parseTLE(gp: CelestrakGP, line1: string, line2: string): SatelliteTLE {
  const meanMotion = gp.MEAN_MOTION; // revs/day
  const eccentricity = gp.ECCENTRICITY;

  // Calculate orbital period in minutes
  const period = (24 * 60) / meanMotion;

  // Calculate semi-major axis using Kepler's third law
  const periodSeconds = period * 60;
  const semiMajorAxis = Math.pow(
    MU * Math.pow(periodSeconds / (2 * Math.PI), 2),
    1 / 3
  );

  // Calculate apogee and perigee altitudes
  const apogee = semiMajorAxis * (1 + eccentricity) - EARTH_RADIUS_KM;
  const perigee = semiMajorAxis * (1 - eccentricity) - EARTH_RADIUS_KM;

  return {
    noradId: gp.NORAD_CAT_ID,
    name: gp.OBJECT_NAME,
    objectId: gp.OBJECT_ID,
    epoch: parseCelestrakEpoch(gp.EPOCH),
    line1,
    line2,
    inclination: gp.INCLINATION,
    eccentricity: gp.ECCENTRICITY,
    raan: gp.RA_OF_ASC_NODE,
    argOfPerigee: gp.ARG_OF_PERICENTER,
    meanAnomaly: gp.MEAN_ANOMALY,
    meanMotion: gp.MEAN_MOTION,
    bstar: gp.BSTAR,
    period,
    apogee,
    perigee,
    semiMajorAxis,
    rawGP: gp,
  };
}

// Parse manual TLE text (one or more two-line sets) and cache them
export function addManualTLEs(
  noradId: number,
  tleText: string,
  opts?: { forceNorad?: boolean; nameOverride?: string }
): number {
  const sets = parseTleSets(tleText);
  let added = 0;
  for (const { name, line1, line2 } of sets) {
    const gp = tleToGp(name, line1, line2);
    if (!opts?.forceNorad && gp.NORAD_CAT_ID !== noradId) continue;
    // Override NORAD to the selected ID if forced
    if (opts?.forceNorad && gp.NORAD_CAT_ID !== noradId) {
      gp.NORAD_CAT_ID = noradId;
    }
    if (opts?.nameOverride) {
      gp.OBJECT_NAME = opts.nameOverride;
    }
    cacheTLE(noradId, gp, line1, line2, 'manual');
    added += 1;
  }
  return added;
}

export function applyEmbeddedTLEs(noradId: number): number {
  if (embeddedApplied.has(noradId)) return 0;
  const texts = getEmbeddedTleTexts(noradId);
  let added = 0;
  for (const text of texts) {
    added += addManualTLEs(noradId, text, { forceNorad: true });
  }
  if (added > 0) {
    embeddedApplied.add(noradId);
  }
  return added;
}

// Catalog cache management
function getCachedCatalog(maxAgeMs: number): SatelliteCatalogEntry[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY_CATALOG);
    if (!cached) return null;

    const entry: CatalogCacheEntry = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;

    if (age > maxAgeMs) {
      localStorage.removeItem(CACHE_KEY_CATALOG);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

function cacheCatalog(data: SatelliteCatalogEntry[]): void {
  try {
    const entry: CatalogCacheEntry = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY_CATALOG, JSON.stringify(entry));
  } catch {
    // localStorage might be full
    console.warn('Failed to cache satellite catalog');
  }
}

// TLE cache management
function getCachedTLEEntries(noradId: number, maxAgeMs: number): TLECacheStored[] {
  try {
    const key = `${CACHE_KEY_TLE_PREFIX}${noradId}`;
    const cached = localStorage.getItem(key);
    if (!cached) return [];

    const entry: TLECacheEntry = JSON.parse(cached);
    const normalized = normalizeTleEntries(entry);
    const now = Date.now();
    const fresh = normalized.filter(e => {
      if (e.source === 'manual') return true;
      return now - e.timestamp <= maxAgeMs;
    });

    // Persist cleaned entries back
    saveTleEntries(key, fresh);

    return fresh;
  } catch {
    return [];
  }
}

function cacheTLE(noradId: number, gp: CelestrakGP, line1: string, line2: string, source: 'manual' | 'fetched' = 'fetched'): void {
  try {
    const key = `${CACHE_KEY_TLE_PREFIX}${noradId}`;

    const existing = getCachedTLEEntries(noradId, Number.MAX_SAFE_INTEGER);
    const newEntry: TLECacheStored = {
      gp,
      line1,
      line2,
      timestamp: Date.now(),
      source,
    };

    // Replace entries with same epoch to avoid duplicates
    const filtered = existing.filter(e => e.gp.EPOCH !== gp.EPOCH);
    const combined = [...filtered, newEntry]
      .sort((a, b) => new Date(b.gp.EPOCH).getTime() - new Date(a.gp.EPOCH).getTime())
      .slice(0, MAX_TLE_CACHE_ENTRIES);

    saveTleEntries(key, combined);
  } catch {
    // localStorage might be full or disabled
  }
}

function normalizeTleEntries(entry: unknown): TLECacheStored[] {
  if (!entry || typeof entry !== 'object') return [];

  const candidate = entry as Partial<TLECacheEntry> & {
    data?: Partial<TLECacheStored>;
    gp?: CelestrakGP;
    line1?: string;
    line2?: string;
    timestamp?: number;
    source?: 'fetched' | 'manual';
  };

  if (Array.isArray(candidate.entries)) {
    return candidate.entries.map(sanitizeCachedEntry);
  }

  if (candidate.data?.gp && candidate.data.line1 && candidate.data.line2) {
    const ts = candidate.timestamp ?? Date.now();
    return [
      sanitizeCachedEntry({
        gp: candidate.data.gp,
        line1: candidate.data.line1,
        line2: candidate.data.line2,
        timestamp: ts,
        source: candidate.data.source ?? 'manual',
      }),
    ];
  }

  if (candidate.gp && candidate.line1 && candidate.line2) {
    const ts = candidate.timestamp ?? Date.now();
    return [sanitizeCachedEntry({ gp: candidate.gp, line1: candidate.line1, line2: candidate.line2, timestamp: ts, source: candidate.source ?? 'fetched' })];
  }

  return [];
}

function sanitizeCachedEntry(entry: TLECacheStored): TLECacheStored {
  const gp = { ...entry.gp };
  if (gp.OBJECT_NAME && (gp.OBJECT_NAME.startsWith('1 ') || gp.OBJECT_NAME.startsWith('2 '))) {
    gp.OBJECT_NAME = `NORAD ${gp.NORAD_CAT_ID}`;
  }
  return { ...entry, gp, source: entry.source ?? 'fetched' };
}

function saveTleEntries(key: string, entries: TLECacheStored[]): void {
  const payload: TLECacheEntry = { entries };
  localStorage.setItem(key, JSON.stringify(payload));
}

function parseTleSets(tleText: string): Array<{ name: string; line1: string; line2: string }> {
  const lines = tleText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const sets: Array<{ name: string; line1: string; line2: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith('1 ') && lines[i + 1]?.startsWith('2 ')) {
      const possibleName = lines[i - 1] ?? '';
      const name = possibleName && !possibleName.startsWith('1 ') && !possibleName.startsWith('2 ')
        ? possibleName
        : '';
      const line1 = lines[i]!;
      const line2 = lines[i + 1]!;
      sets.push({ name, line1, line2 });
      i += 1; // skip next because it's line2
    }
  }
  return sets;
}

function tleToGp(name: string, line1: string, line2: string): CelestrakGP {
  const satrec = satellite.twoline2satrec(line1, line2);
  const epochDate = satellitePropEpoch(line1);

  return {
    OBJECT_NAME: name || `NORAD ${satrec.satnum}`,
    OBJECT_ID: '',
    EPOCH: epochDate.toISOString().replace('Z', ''),
    MEAN_MOTION: satrec.no * 60 * 24 / (2 * Math.PI),
    ECCENTRICITY: satrec.ecco,
    INCLINATION: satrec.inclo * (180 / Math.PI),
    RA_OF_ASC_NODE: satrec.nodeo * (180 / Math.PI),
    ARG_OF_PERICENTER: satrec.argpo * (180 / Math.PI),
    MEAN_ANOMALY: satrec.mo * (180 / Math.PI),
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: typeof satrec.satnum === 'string' ? parseInt(satrec.satnum, 10) : satrec.satnum,
    ELEMENT_SET_NO: 0,
    REV_AT_EPOCH: 0,
    BSTAR: satrec.bstar,
    MEAN_MOTION_DOT: satrec.ndot,
    MEAN_MOTION_DDOT: satrec.nddot,
  };
}

function satellitePropEpoch(line1: string): Date {
  // Line 1 cols 19-32: epoch year/day of year
  const epochYear = parseInt(line1.slice(18, 20), 10);
  const epochDay = parseFloat(line1.slice(20, 32));
  const year = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;
  const start = new Date(Date.UTC(year, 0, 1));
  const epochMs = start.getTime() + (epochDay - 1) * 24 * 60 * 60 * 1000;
  return new Date(epochMs);
}
const embeddedApplied = new Set<number>();
