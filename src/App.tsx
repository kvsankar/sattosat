import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Scene } from './components/Globe/Scene';
import { SatelliteSelector } from './components/Controls/SatelliteSelector';
import { TimelineSlider } from './components/Controls/TimelineSlider';
import { CollapsibleSection } from './components/Controls/CollapsibleSection';
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
import { TimelineTabs } from './components/Controls/TimelineTabs';

type SortMode = 'date' | 'distance';
const SEARCH_RANGE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const TIMELINE_HEIGHT = 200;      // px for bottom timeline and control panel alignment

function filterAvailableTlesByAnchor(
  entries: Array<{ epoch: Date; cacheTimestamp: number }>,
  anchor: Date
): Array<{ epoch: Date; cacheTimestamp: number }> {
  const start = anchor.getTime() - SEARCH_RANGE_DAYS * DAY_MS;
  const end = anchor.getTime() + SEARCH_RANGE_DAYS * DAY_MS;
  const filtered = entries.filter(e => {
    const t = e.epoch.getTime();
    return t >= start && t <= end;
  });
  return filtered.length > 0 ? filtered : entries;
}

function filterTlesByAnchor(entries: SatelliteTLE[], anchor: Date): SatelliteTLE[] {
  const start = anchor.getTime() - SEARCH_RANGE_DAYS * DAY_MS;
  const end = anchor.getTime() + SEARCH_RANGE_DAYS * DAY_MS;
  const filtered = entries.filter(e => {
    const t = e.epoch.getTime();
    return t >= start && t <= end;
  });
  return filtered.length > 0 ? filtered : entries;
}

function displayNameFor(noradId: number | null, tle: SatelliteTLE | null, profileNames: Record<number, string>): string {
  if (noradId !== null && profileNames[noradId]) return profileNames[noradId];
  if (tle?.name && !tle.name.toUpperCase().startsWith('NORAD')) return tle.name;
  if (noradId !== null) return `NORAD ${noradId}`;
  return 'Unknown';
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
  const [profileNames, setProfileNames] = useState<Record<number, string>>({});
  const [showTerminator, setShowTerminator] = useState(true);
  const [showAntiSolar, setShowAntiSolar] = useState(true);
  const [showMainLos, setShowMainLos] = useState(true);
  const [showMainSunLine, setShowMainSunLine] = useState(true);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [relativeCollapsed, setRelativeCollapsed] = useState(false);
  const hasAutoLoadedProfile = useRef(false);

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

  const filteredAvailableTlesA = useMemo(
    () => filterAvailableTlesByAnchor(availableTlesA, anchorTime),
    [anchorTime, availableTlesA]
  );

  const filteredAvailableTlesB = useMemo(
    () => filterAvailableTlesByAnchor(availableTlesB, anchorTime),
    [anchorTime, availableTlesB]
  );

  const filteredAllTlesA = useMemo(
    () => filterTlesByAnchor(allTlesA, anchorTime),
    [allTlesA, anchorTime]
  );

  const filteredAllTlesB = useMemo(
    () => filterTlesByAnchor(allTlesB, anchorTime),
    [allTlesB, anchorTime]
  );

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

  const displayNameA = useMemo(
    () => displayNameFor(selectedIdA, activeTleA, profileNames),
    [activeTleA, profileNames, selectedIdA]
  );

  const displayNameB = useMemo(
    () => displayNameFor(selectedIdB, activeTleB, profileNames),
    [activeTleB, profileNames, selectedIdB]
  );

  const displayTleA = activeTleA ? { ...activeTleA, name: displayNameA } : null;
  const displayTleB = activeTleB ? { ...activeTleB, name: displayNameB } : null;

  // Calculate positions and orbit paths
  const { position: positionA, orbitPath: orbitPathA } = useSatellitePosition(activeTleA, currentTime);
  const { position: positionB, orbitPath: orbitPathB } = useSatellitePosition(activeTleB, currentTime);
  const profileActive = !!selectedProfileName;
  const hasSatA = !!activeTleA && !!positionA;
  const hasSatB = !!activeTleB && !!positionB;
  const hasPair = hasSatA && hasSatB;
  const pairEnabled = profileActive && hasPair;
  useEffect(() => {
    if (!hasPair) {
      setShowMainLos(false);
      setShowMainSunLine(false);
    }
  }, [hasPair]);

  // Find conjunctions
  const {
    conjunctions,
    currentDistance,
    currentRelativeVelocity,
    loading: conjunctionsLoading,
  } = useConjunctions(tleA, tleB, allTlesA, allTlesB, currentTime, SEARCH_RANGE_DAYS, anchorTime);

  const distanceSamples = useMemo(() => {
    if (!pairEnabled) return [];
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
  }, [allTlesA, allTlesB, tleA, tleB, anchorTime, currentDistance, currentTime, conjunctions, pairEnabled]);

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
    const newName = profile ? profile.name : null;
    setSelectedProfileName(newName);
    if (!profile) {
      setProfileNames({});
      const now = new Date();
      setAnchorTime(now);
      setCurrentTime(now);
      setAutoNow(false);
      setSelectedIdA(null);
      setSelectedIdB(null);
      setPreferredEpochA(null);
      setPreferredEpochB(null);
      return;
    }
    const nameMap: Record<number, string> = {};
    for (const sat of profile.satellites) {
      if (sat.name) nameMap[sat.noradId] = sat.name;
    }
    setProfileNames(nameMap);
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
  }, [setAnchorTime, setAutoNow, setCurrentTime, setPreferredEpochA, setPreferredEpochB, setSelectedIdA, setSelectedIdB]);

  // Auto-load the first profile on startup if available
  useEffect(() => {
    if (hasAutoLoadedProfile.current) return;
    if (profiles.length > 0) {
      handleSelectProfile(profiles[0]!.name);
      hasAutoLoadedProfile.current = true;
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
    <div className="h-screen w-screen bg-gray-900 flex text-[12px]">
      {/* Collapsed sidebar expand button */}
      {panelCollapsed && (
        <button
          onClick={() => setPanelCollapsed(false)}
          className="absolute top-2 left-2 z-50 w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white rounded shadow-lg text-sm flex items-center justify-center border border-gray-700"
          title="Show panel"
        >
          ▸
        </button>
      )}

      {/* Left sidebar */}
      <div
        className={`w-[20rem] flex-shrink-0 overflow-y-auto border-r border-gray-700 transition-all duration-300 sidebar-scroll ${
          panelCollapsed ? '-ml-[20rem]' : 'ml-0'
        }`}
      >
        {/* Sidebar header with collapse button */}
        <div className="flex items-center justify-between px-2.5 py-2 border-b border-gray-700">
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">SatOrbitViz</h1>
            <p className="text-gray-400 text-xs leading-snug">
              Orbit Visualization & Conjunction Finder
            </p>
          </div>
          <button
            onClick={() => setPanelCollapsed(true)}
            className="w-7 h-7 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-sm flex items-center justify-center border border-gray-700 flex-shrink-0"
            title="Hide panel"
          >
            ◂
          </button>
        </div>

        <div className="px-2.5 py-2 space-y-1">

        {/* Satellite Selection (includes Profile) */}
        <CollapsibleSection
          title="Satellites"
          badge={catalogCacheInfo ? catalogCacheInfo.count.toLocaleString() : undefined}
        >
          {/* Profile Selection */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">Profile</span>
              {selectedProfileName && (
                <span className="text-[10px] text-gray-500">
                  {anchorTime.toISOString().slice(0, 10)}
                </span>
              )}
            </div>
            <select
              value={selectedProfileName ?? ''}
              onChange={(e) => handleSelectProfile(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-2 py-1.5 border border-gray-700 text-[12px] leading-tight"
            >
              <option value="">-- None --</option>
              {profiles.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 mb-1.5">
            <button
              onClick={refreshCatalog}
              disabled={catalogLoading}
              className="text-blue-400 hover:text-blue-300 disabled:text-gray-600"
              title="Refresh satellite catalog"
            >
              ↻ Refresh catalog
            </button>
          </div>

          {catalogError && (
            <div className="bg-red-900/50 border border-red-600 text-red-200 p-2 rounded text-[11px] mb-2">
              {catalogError}
            </div>
          )}

          <div className="space-y-1.5">
            <SatelliteSelector
              label="Sat A"
              color="#3b82f6"
              catalog={catalog}
              selectedId={selectedIdA}
              onSelect={handleSelectA}
              loading={catalogLoading || loadingA}
              disabled={catalogLoading}
              cacheInfo={cacheInfoA}
              onRefresh={refreshTleA}
              availableTles={filteredAvailableTlesA}
              selectedTleEpoch={preferredEpochA}
              onSelectTleEpoch={setPreferredEpochA}
              onPasteTles={handlePasteTlesA}
              historicalLoading={historicalLoadingA}
            />

            <SatelliteSelector
              label="Sat B"
              color="#ef4444"
              catalog={catalog}
              selectedId={selectedIdB}
              onSelect={handleSelectB}
              loading={catalogLoading || loadingB}
              disabled={catalogLoading}
              cacheInfo={cacheInfoB}
              onRefresh={refreshTleB}
              availableTles={filteredAvailableTlesB}
              selectedTleEpoch={preferredEpochB}
              onSelectTleEpoch={setPreferredEpochB}
              onPasteTles={handlePasteTlesB}
              historicalLoading={historicalLoadingB}
            />
          </div>
        </CollapsibleSection>

        {/* Timeline Controls */}
        <CollapsibleSection title="Timeline">
          <TimelineSlider
            key={selectedProfileName ?? 'none'}
            currentTime={currentTime}
            onTimeChange={handleTimeChange}
            onNow={handleNow}
            onAnchor={handleAnchorTime}
            rangeDays={SEARCH_RANGE_DAYS}
            anchorTime={anchorTime}
            showNow={true}
            disabled={false}
            initialPlaying={false}
          />
        </CollapsibleSection>

        {/* Orbital Parameters */}
        {pairEnabled && (
          <CollapsibleSection title="Orbital Parameters">
            <OrbitalParams
              tleA={displayTleA}
              tleB={displayTleB}
              positionA={positionA}
              positionB={positionB}
              currentDistance={currentDistance}
              relativeVelocity={currentRelativeVelocity}
            />
          </CollapsibleSection>
        )}

        {/* Conjunctions */}
        {pairEnabled && tleA && tleB && (
          <CollapsibleSection title="Close Approaches" badge={conjunctions.length || undefined}>
            <ConjunctionPanel
              conjunctions={conjunctions}
              loading={conjunctionsLoading}
              onJumpToTime={handleJumpToTime}
              currentTime={currentTime}
              sortMode={conjunctionSortMode}
              onSortModeChange={setConjunctionSortMode}
            />
          </CollapsibleSection>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700 text-gray-500 text-xs">
          <p>TLE data from Celestrak</p>
          <p>Propagation via SGP4/SDP4</p>
        </div>
        </div>
      </div>

      {/* Main 3D view and timelines */}
      <div className="flex-1 relative p-4">
        <div className="grid h-full w-full grid-cols-[minmax(0,1fr)_384px] grid-rows-[minmax(0,1fr)_auto] gap-3">
          <div className="relative rounded-lg overflow-hidden bg-black/40">
            <Scene
              satelliteA={
                hasSatA && activeTleA
                  ? {
                      name: displayNameA,
                      position: positionA,
                      orbitPath: orbitPathA,
                    }
                  : null
              }
              satelliteB={
                hasSatB && activeTleB
                  ? {
                      name: displayNameB,
                      position: positionB,
                      orbitPath: orbitPathB,
                    }
                  : null
              }
              currentTime={currentTime}
              showGrid={showGrid}
              showTerminator={showTerminator}
              showAntiSolar={showAntiSolar}
              showMainLos={pairEnabled && showMainLos}
              showMainSunLine={pairEnabled && showMainSunLine}
            />
            <div className="absolute left-3 right-3 bottom-3 flex flex-wrap gap-3 items-center text-xs text-gray-200 bg-black/60 rounded-md px-3 py-2 border border-gray-700">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
                Grid
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={showTerminator} onChange={e => setShowTerminator(e.target.checked)} />
                Terminator
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={showAntiSolar} onChange={e => setShowAntiSolar(e.target.checked)} />
                Anti-solar
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={pairEnabled && showMainLos}
                  disabled={!pairEnabled}
                  onChange={e => setShowMainLos(e.target.checked)}
                />
                LoS A→B
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={pairEnabled && showMainSunLine}
                  disabled={!pairEnabled}
                  onChange={e => setShowMainSunLine(e.target.checked)}
                />
                Sun line at B
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={!relativeCollapsed} onChange={e => setRelativeCollapsed(!e.target.checked)} />
                Relative view panel
              </label>
            </div>
          </div>

          <div className="relative">
            {relativeCollapsed ? (
              <button
                onClick={() => setRelativeCollapsed(false)}
                className="bg-gray-900/90 border border-gray-700 text-white px-3 py-2 rounded shadow-lg text-xs"
              >
                ↑ Show A→B view
              </button>
            ) : (
              <div className="w-full h-full max-w-[420px] relative">
                <button
                  onClick={() => setRelativeCollapsed(true)}
                  className="absolute -top-3 -right-3 bg-gray-900 border border-gray-700 text-white rounded-full w-8 h-8 shadow-lg text-sm"
                  title="Collapse view panel"
                >
                  ←
                </button>
                {pairEnabled ? (
                  <RelativeViewPanel
                    positionA={positionA}
                    positionB={positionB}
                    tleA={activeTleA}
                    tleB={activeTleB}
                    currentTime={currentTime}
                  />
                ) : (
                  <div className="bg-gray-800/95 border border-gray-700 rounded-lg p-3 shadow-xl text-sm text-gray-300 w-full">
                    Select two satellites to view the A→B relative panel.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="col-span-2">
            {timelineCollapsed ? (
              <button
                onClick={() => setTimelineCollapsed(false)}
                className="bg-gray-900/90 border border-gray-700 text-white px-3 py-2 rounded shadow-lg text-xs"
              >
                ↑ Show graphs
              </button>
            ) : (
              <TimelineTabs
                distanceSamples={distanceSamples}
                currentDistanceKm={currentDistance ?? undefined}
                currentTime={currentTime}
                anchorTime={anchorTime}
                rangeDays={SEARCH_RANGE_DAYS}
                onTimeChange={handleTimeChange}
                height={TIMELINE_HEIGHT}
                onCollapse={() => setTimelineCollapsed(true)}
                tleSeriesA={filteredAllTlesA}
                tleSeriesB={filteredAllTlesB}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
