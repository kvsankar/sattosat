import { useState, useCallback, useEffect, useMemo } from 'react';
import { Scene } from './components/Globe/Scene';
import { SatelliteSelector } from './components/Controls/SatelliteSelector';
import { TimelineSlider } from './components/Controls/TimelineSlider';
import { OrbitalParams } from './components/Panels/OrbitalParams';
import { ConjunctionPanel } from './components/Panels/ConjunctionPanel';
import { RelativeViewPanel } from './components/Panels/RelativeViewPanel';
import { useSatelliteCatalog } from './hooks/useSatelliteCatalog';
import { useTLE } from './hooks/useTLE';
import { addManualTLEs } from './lib/celestrak';
import { useSatellitePosition } from './hooks/useSatellitePosition';
import { useConjunctions } from './hooks/useConjunctions';
import type { SatelliteCatalogEntry, SatelliteTLE } from './types/satellite';
import { sampleDistanceCurve } from './lib/conjunctions';
import { profiles, applyProfileTles } from './lib/profiles';
import { DistanceTimeline } from './components/Controls/DistanceTimeline';

type SortMode = 'date' | 'distance';
const SEARCH_RANGE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const RELATIVE_PANEL_WIDTH = 384; // px (w-96)
const CONTROL_PANEL_WIDTH = 224;  // px (w-56)
const TIMELINE_HEIGHT = 200;      // px for bottom timeline and control panel alignment

function formatCacheAge(timestamp: number): string {
  const ageMs = Date.now() - timestamp;
  const ageMinutes = Math.floor(ageMs / (1000 * 60));
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

  if (ageMinutes < 1) return 'just now';
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  if (ageHours < 24) return `${ageHours}h ago`;
  return `${Math.floor(ageHours / 24)}d ago`;
}

export default function App() {
  // Current simulation time
  const [currentTime, setCurrentTime] = useState(new Date());
  const [autoNow, setAutoNow] = useState(false);

  // Selected satellite IDs
  const [selectedIdA, setSelectedIdA] = useState<number | null>(null);
  const [selectedIdB, setSelectedIdB] = useState<number | null>(null);

  // UI state
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [conjunctionSortMode, setConjunctionSortMode] = useState<SortMode>('distance');
  const [showGrid, setShowGrid] = useState(true);
  const [anchorTime, setAnchorTime] = useState<Date>(new Date());
  const [selectedProfileName, setSelectedProfileName] = useState<string | null>(null);
  const [showTerminator, setShowTerminator] = useState(true);
  const [showAntiSolar, setShowAntiSolar] = useState(true);
  const [showMainLos, setShowMainLos] = useState(true);
  const [showMainSunLine, setShowMainSunLine] = useState(true);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [relativeCollapsed, setRelativeCollapsed] = useState(false);
  const [viewToggleCollapsed, setViewToggleCollapsed] = useState(false);

  // Load satellite catalog
  const {
    catalog,
    loading: catalogLoading,
    error: catalogError,
    cacheInfo: catalogCacheInfo,
    refresh: refreshCatalog
  } = useSatelliteCatalog();

  // Load TLEs for selected satellites
  const {
    tle: tleA,
    loading: loadingA,
    cacheInfo: cacheInfoA,
    refresh: refreshTleA,
    availableTles: availableTlesA,
    preferredEpoch: preferredEpochA,
    setPreferredEpoch: setPreferredEpochA,
    historicalLoading: historicalLoadingA,
    allTles: allTlesA,
  } = useTLE(selectedIdA, currentTime);

  const {
    tle: tleB,
    loading: loadingB,
    cacheInfo: cacheInfoB,
    refresh: refreshTleB,
    availableTles: availableTlesB,
    preferredEpoch: preferredEpochB,
    setPreferredEpoch: setPreferredEpochB,
    historicalLoading: historicalLoadingB,
    allTles: allTlesB,
  } = useTLE(selectedIdB, currentTime);

  const pickActiveTle = useCallback(
    (
      allTles: SatelliteTLE[],
      preferredEpoch: string | null,
      fallback: SatelliteTLE | null,
      referenceTime: Date
    ) => {
      if (allTles.length === 0) return fallback;
      if (preferredEpoch) {
        const exact = allTles.find(t => t.epoch.toISOString() === preferredEpoch);
        if (exact) return exact;
      }
      const targetMs = referenceTime.getTime();
      return allTles.reduce((closest, current) => {
        const currentDiff = Math.abs(current.epoch.getTime() - targetMs);
        const closestDiff = Math.abs(closest.epoch.getTime() - targetMs);
        return currentDiff < closestDiff ? current : closest;
      }, allTles[0]!);
    },
    []
  );

  const activeTleA = useMemo(
    () => pickActiveTle(allTlesA, preferredEpochA, tleA, anchorTime),
    [allTlesA, preferredEpochA, pickActiveTle, tleA, anchorTime]
  );

  const activeTleB = useMemo(
    () => pickActiveTle(allTlesB, preferredEpochB, tleB, anchorTime),
    [allTlesB, preferredEpochB, pickActiveTle, tleB, anchorTime]
  );

  // Calculate positions and orbit paths
  const { position: positionA, orbitPath: orbitPathA } = useSatellitePosition(activeTleA, currentTime);
  const { position: positionB, orbitPath: orbitPathB } = useSatellitePosition(activeTleB, currentTime);

  // Find conjunctions
  const {
    conjunctions,
    currentDistance,
    currentRelativeVelocity,
    loading: conjunctionsLoading,
  } = useConjunctions(tleA, tleB, allTlesA, allTlesB, currentTime, SEARCH_RANGE_DAYS, anchorTime);

  const distanceSamples = useMemo(() => {
    const tlesAForCurve = allTlesA.length ? allTlesA : (tleA ? [tleA] : []);
    const tlesBForCurve = allTlesB.length ? allTlesB : (tleB ? [tleB] : []);
    if (tlesAForCurve.length === 0 || tlesBForCurve.length === 0) return [];
    const start = new Date(anchorTime.getTime() - SEARCH_RANGE_DAYS * DAY_MS);
    const end = new Date(anchorTime.getTime() + SEARCH_RANGE_DAYS * DAY_MS);
    const base = sampleDistanceCurve(tlesAForCurve, tlesBForCurve, start, end, 220);

    // Ensure we render known close-approach points even if coarse sampling misses them
    const extraPoints: { time: Date; distance: number }[] = [];
    if (typeof currentDistance === 'number' && currentTime >= start && currentTime <= end) {
      extraPoints.push({ time: currentTime, distance: currentDistance });
    }
    if (conjunctions.length) {
      for (const conj of conjunctions) {
        if (conj.time >= start && conj.time <= end) {
          extraPoints.push({ time: conj.time, distance: conj.distance });
        }
      }
    }

    if (extraPoints.length === 0) return base;

    const merged = new Map<number, { time: Date; distance: number }>();
    for (const s of base) merged.set(s.time.getTime(), s);
    for (const extra of extraPoints) merged.set(extra.time.getTime(), extra);

    return Array.from(merged.values()).sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [allTlesA, allTlesB, tleA, tleB, anchorTime, currentDistance, currentTime, conjunctions]);

  // Handlers
  const handleSelectA = useCallback((entry: SatelliteCatalogEntry | null) => {
    setSelectedIdA(entry?.noradId ?? null);
  }, []);

  const handleSelectB = useCallback((entry: SatelliteCatalogEntry | null) => {
    setSelectedIdB(entry?.noradId ?? null);
  }, []);

  const handleJumpToTime = useCallback((time: Date) => {
    setAutoNow(false);
    setCurrentTime(time);
  }, []);

  const handleTimeChange = useCallback((time: Date) => {
    setAutoNow(false);
    setCurrentTime(time);
  }, []);

  const handleAnchorTime = useCallback(() => {
    setAutoNow(false);
    const diffMs = Math.abs(currentTime.getTime() - anchorTime.getTime());
    if (diffMs < 1) return; // Already at anchor, avoid state churn
    setCurrentTime(new Date(anchorTime));
  }, [anchorTime, currentTime]);

  const handleNow = useCallback(() => {
    if (selectedProfileName) return;
    const now = new Date();
    setAnchorTime(now);
    setCurrentTime(now);
    setAutoNow(false);
  }, [selectedProfileName]);

  const handlePasteTlesA = useCallback(async (text: string, opts?: { forceNorad?: boolean }): Promise<number> => {
    if (selectedIdA === null) return 0;
    const added = addManualTLEs(selectedIdA, text, opts);
    refreshTleA({ clearCache: false });
    return added;
  }, [refreshTleA, selectedIdA]);

  const handlePasteTlesB = useCallback(async (text: string, opts?: { forceNorad?: boolean }): Promise<number> => {
    if (selectedIdB === null) return 0;
    const added = addManualTLEs(selectedIdB, text, opts);
    refreshTleB({ clearCache: false });
    return added;
  }, [refreshTleB, selectedIdB]);

  const handleSelectProfile = useCallback((name: string) => {
    const profile = profiles.find(p => p.name === name);
    setSelectedProfileName(name);
    if (!profile) {
      const now = new Date();
      setAnchorTime(now);
      setCurrentTime(now);
      setAutoNow(false);
      setSelectedIdA(null);
      setSelectedIdB(null);
      return;
    }
    // Seed embedded/pasted TLEs from profile
    applyProfileTles(profile);
    const refTime = new Date(profile.anchor);
    setAnchorTime(refTime);
    setCurrentTime(refTime);
    setAutoNow(false);
    const satA = profile.satellites[0]?.noradId ?? null;
    const satB = profile.satellites[1]?.noradId ?? null;
    setSelectedIdA(satA);
    setSelectedIdB(satB);
    setPreferredEpochA(null);
    setPreferredEpochB(null);
  }, [setSelectedIdA, setSelectedIdB]);

  // Auto-load the first profile on startup if available
  useEffect(() => {
    if (!selectedProfileName && profiles.length > 0) {
      handleSelectProfile(profiles[0]!.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.length]);

  // Keep time synced to real clock when in auto-now mode
  useEffect(() => {
    if (!autoNow) return;
    const id = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, [autoNow]);

  return (
    <div className="h-screen w-screen bg-gray-900 flex">
      {/* Collapse toggle button */}
      <button
        onClick={() => setPanelCollapsed(!panelCollapsed)}
        className="absolute top-4 left-4 z-50 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-md shadow-lg transition-all"
        style={{ left: panelCollapsed ? '16px' : '400px' }}
        title={panelCollapsed ? 'Show panel' : 'Hide panel'}
      >
        {panelCollapsed ? '→' : '←'}
      </button>

      {/* Left sidebar */}
      <div
        className={`w-[27rem] flex-shrink-0 p-4 overflow-y-auto border-r border-gray-700 transition-all duration-300 ${
          panelCollapsed ? '-ml-[27rem]' : 'ml-0'
        }`}
      >
        <h1 className="text-xl font-bold text-white mb-1">SatOrbitViz</h1>
        <p className="text-gray-400 text-sm mb-2">
          Satellite Orbit Visualization & Conjunction Finder
        </p>

        {/* Profiles */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-300">
            <span>Profiles</span>
            <span className="text-gray-500 text-xs">sets satellites + now</span>
          </div>
          <select
            value={selectedProfileName ?? ''}
            onChange={(e) => handleSelectProfile(e.target.value)}
            className="w-full bg-gray-900 text-white rounded px-2 py-1 border border-gray-700"
          >
            <option value="">-- None --</option>
            {profiles.map(p => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          {selectedProfileName && (
            <div className="text-xs text-gray-500">
              Anchor: {anchorTime.toISOString().replace('T', ' ').slice(0, 19)} UTC
            </div>
          )}
        </div>

        {/* Catalog cache info */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <span>
            {catalogCacheInfo
              ? `${catalogCacheInfo.count.toLocaleString()} satellites (cached ${formatCacheAge(catalogCacheInfo.timestamp)})`
              : catalogLoading ? 'Loading catalog...' : 'No catalog loaded'
            }
          </span>
          <button
            onClick={refreshCatalog}
            disabled={catalogLoading}
            className="text-blue-400 hover:text-blue-300 disabled:text-gray-600"
            title="Refresh satellite catalog"
          >
            ↻
          </button>
        </div>

        {catalogError && (
          <div className="bg-red-900/50 border border-red-600 text-red-200 p-3 rounded-lg mb-4 text-sm">
            {catalogError}
          </div>
        )}

        {/* Satellite Selectors */}
        <div className="space-y-4 mb-6">
          <SatelliteSelector
            label="Satellite A"
            color="#3b82f6"
            catalog={catalog}
            selectedId={selectedIdA}
            onSelect={handleSelectA}
            loading={catalogLoading || loadingA}
            disabled={catalogLoading}
            cacheInfo={cacheInfoA}
            onRefresh={refreshTleA}
            availableTles={availableTlesA}
            selectedTleEpoch={preferredEpochA}
            onSelectTleEpoch={setPreferredEpochA}
            onPasteTles={handlePasteTlesA}
            historicalLoading={historicalLoadingA}
          />

          <SatelliteSelector
            label="Satellite B"
            color="#ef4444"
            catalog={catalog}
            selectedId={selectedIdB}
            onSelect={handleSelectB}
            loading={catalogLoading || loadingB}
            disabled={catalogLoading}
            cacheInfo={cacheInfoB}
            onRefresh={refreshTleB}
            availableTles={availableTlesB}
            selectedTleEpoch={preferredEpochB}
            onSelectTleEpoch={setPreferredEpochB}
            onPasteTles={handlePasteTlesB}
            historicalLoading={historicalLoadingB}
          />
        </div>

        {/* Timeline Controls */}
        <div className="mb-6">
          <TimelineSlider
            currentTime={currentTime}
            onTimeChange={handleTimeChange}
            onNow={handleNow}
            onAnchor={handleAnchorTime}
            rangeDays={SEARCH_RANGE_DAYS}
            anchorTime={anchorTime}
            showNow={true}
          />
        </div>

        {/* Orbital Parameters */}
        <div className="mb-6">
          <OrbitalParams
            tleA={activeTleA}
            tleB={activeTleB}
            positionA={positionA}
            positionB={positionB}
            currentDistance={currentDistance}
            relativeVelocity={currentRelativeVelocity}
          />
        </div>

        {/* Conjunctions */}
        {tleA && tleB && (
          <ConjunctionPanel
            conjunctions={conjunctions}
            loading={conjunctionsLoading}
            onJumpToTime={handleJumpToTime}
            currentTime={currentTime}
            sortMode={conjunctionSortMode}
            onSortModeChange={setConjunctionSortMode}
          />
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700 text-gray-500 text-xs">
          <p>TLE data from Celestrak</p>
          <p>Propagation via SGP4/SDP4</p>
        </div>
      </div>

      {/* Main 3D view */}
      <div className="flex-1 relative" style={{
        paddingRight: relativeCollapsed ? 16 : RELATIVE_PANEL_WIDTH + 32,
        paddingBottom: timelineCollapsed ? 16 : TIMELINE_HEIGHT + 24
      }}>
        <div className="absolute inset-0">
          <Scene
            satelliteA={
              activeTleA
                ? {
                    name: activeTleA.name,
                    position: positionA,
                    orbitPath: orbitPathA,
                  }
                : null
            }
            satelliteB={
              activeTleB
                ? {
                    name: activeTleB.name,
                    position: positionB,
                    orbitPath: orbitPathB,
                  }
                : null
            }
            currentTime={currentTime}
            showGrid={showGrid}
            showTerminator={showTerminator}
            showAntiSolar={showAntiSolar}
            showMainLos={showMainLos}
            showMainSunLine={showMainSunLine}
          />
        </div>

        {/* Relative view panel (collapsible) */}
        <div className="absolute top-4 right-4 z-40">
          {relativeCollapsed ? (
            <button
              onClick={() => setRelativeCollapsed(false)}
              className="bg-gray-900/90 border border-gray-700 text-white px-3 py-2 rounded shadow-lg text-xs"
            >
              Show A→B view
            </button>
          ) : (
            <div className="w-96 max-w-[420px] relative">
              <button
                onClick={() => setRelativeCollapsed(true)}
                className="absolute -top-3 -right-3 bg-gray-900 border border-gray-700 text-white rounded-full w-8 h-8 shadow-lg text-sm"
                title="Collapse view panel"
              >
                ×
              </button>
              <RelativeViewPanel
                positionA={positionA}
                positionB={positionB}
                tleA={activeTleA}
                tleB={activeTleB}
                currentTime={currentTime}
              />
            </div>
          )}
        </div>

        {/* Bottom distance timeline (collapsible) */}
        <div
          className="absolute left-4 z-30"
          style={{
            right: CONTROL_PANEL_WIDTH + 64,
            bottom: 16,
            height: timelineCollapsed ? undefined : TIMELINE_HEIGHT
          }}
        >
          {timelineCollapsed ? (
            <button
              onClick={() => setTimelineCollapsed(false)}
              className="bg-gray-900/90 border border-gray-700 text-white px-3 py-2 rounded shadow-lg text-xs"
            >
              Show timeline
            </button>
          ) : (
            <DistanceTimeline
              samples={distanceSamples}
              currentTime={currentTime}
              anchorTime={anchorTime}
              rangeDays={SEARCH_RANGE_DAYS}
              onTimeChange={handleTimeChange}
              height={TIMELINE_HEIGHT}
              currentDistanceKm={currentDistance ?? undefined}
              onCollapse={() => setTimelineCollapsed(true)}
            />
          )}
        </div>

        {/* Bottom-right view controls (main view) */}
        <div
          className="absolute bottom-4 right-4 z-50"
          style={{ width: CONTROL_PANEL_WIDTH, height: TIMELINE_HEIGHT }}
        >
          {viewToggleCollapsed ? (
            <button
              onClick={() => setViewToggleCollapsed(false)}
              className="bg-gray-900/90 border border-gray-700 text-white px-3 py-2 rounded shadow-lg text-xs"
            >
              Show view toggles
            </button>
          ) : (
            <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 shadow-lg w-56 h-full space-y-2 flex flex-col relative">
              <button
                onClick={() => setViewToggleCollapsed(true)}
                className="absolute top-2 right-2 text-gray-300 hover:text-white text-xs bg-gray-800/80 border border-gray-700 rounded px-2 py-0.5"
                title="Collapse view toggles"
              >
                ×
              </button>
              <div className="text-gray-200 font-semibold pr-6">View toggles</div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
                Show grid
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={showTerminator} onChange={e => setShowTerminator(e.target.checked)} />
                Show terminator
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={showAntiSolar} onChange={e => setShowAntiSolar(e.target.checked)} />
                Show anti-solar point
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={showMainLos} onChange={e => setShowMainLos(e.target.checked)} />
                Show LoS A→B
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={showMainSunLine} onChange={e => setShowMainSunLine(e.target.checked)} />
                Show Sun line at B
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
