import { useState, useMemo, useEffect } from 'react';
import type { SatelliteCatalogEntry } from '../../types/satellite';
import { getRecentSatellites, addRecentSatellite } from '../../lib/recentSatellites';

interface SatelliteSelectorProps {
  label: string;
  color: string;
  catalog: SatelliteCatalogEntry[];
  selectedId: number | null;
  onSelect: (entry: SatelliteCatalogEntry | null) => void;
  loading?: boolean;
  disabled?: boolean;
  cacheInfo?: { timestamp: number; epoch: string } | null;
  onRefresh?: () => void;
  availableTles?: Array<{ epoch: Date; cacheTimestamp: number }>;
  selectedTleEpoch?: string | null;
  onSelectTleEpoch?: (epoch: string | null) => void;
  historicalLoading?: boolean;
  onPasteTles?: (tleText: string, opts?: { forceNorad?: boolean }) => Promise<number> | number;
}

function formatCacheAge(timestamp: number): string {
  const ageMs = Date.now() - timestamp;
  const ageMinutes = Math.floor(ageMs / (1000 * 60));
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

  if (ageMinutes < 1) return 'just now';
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  if (ageHours < 24) return `${ageHours}h ago`;
  return `${Math.floor(ageHours / 24)}d ago`;
}

export function SatelliteSelector({
  label,
  color,
  catalog,
  selectedId,
  onSelect,
  loading = false,
  disabled = false,
  cacheInfo,
  onRefresh,
  availableTles = [],
  selectedTleEpoch = null,
  onSelectTleEpoch,
  historicalLoading = false,
  onPasteTles,
}: SatelliteSelectorProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [recentSatellites, setRecentSatellites] = useState<SatelliteCatalogEntry[]>([]);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteStatus, setPasteStatus] = useState<string | null>(null);
  const [forceNorad, setForceNorad] = useState(false);

  // Load recent satellites on mount
  useEffect(() => {
    setRecentSatellites(getRecentSatellites());
  }, []);

  const filteredCatalog = useMemo(() => {
    const searchTrimmed = search.trim();
    const searchLower = searchTrimmed.toLowerCase();

    // Get matching satellites
    let matches: SatelliteCatalogEntry[];
    if (!searchTrimmed) {
      matches = catalog.slice(0, 100);
    } else {
      matches = catalog
        .filter(
          (sat) =>
            sat.name.toLowerCase().includes(searchLower) ||
            sat.noradId.toString().includes(searchTrimmed)
        )
        .slice(0, 100);
    }

    // Filter recent satellites that match the search
    const matchingRecent = recentSatellites.filter(
      (sat) =>
        !searchTrimmed ||
        sat.name.toLowerCase().includes(searchLower) ||
        sat.noradId.toString().includes(searchTrimmed)
    );

    // Remove recent satellites from matches to avoid duplicates
    const recentIds = new Set(matchingRecent.map(s => s.noradId));
    const nonRecentMatches = matches.filter(s => !recentIds.has(s.noradId));

    // Return recent first, then other matches
    return { recent: matchingRecent, others: nonRecentMatches };
  }, [catalog, search, recentSatellites]);

  const selectedSatellite = useMemo(
    () => catalog.find((s) => s.noradId === selectedId) ?? null,
    [catalog, selectedId]
  );

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-0.5">
        <label
          className="block text-[12px] font-medium leading-tight"
          style={{ color }}
        >
          {label}
        </label>
        {selectedId !== null && cacheInfo && onRefresh && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <span title={`TLE Epoch: ${cacheInfo.epoch}`}>
              {formatCacheAge(cacheInfo.timestamp)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="text-blue-400 hover:text-blue-300"
              title="Refresh TLE"
            >
              ↻
            </button>
          </div>
        )}
      {availableTles.length > 0 && onSelectTleEpoch && (
        <div className="mt-1.5 space-y-1">
          <div className="text-[11px] text-gray-500">TLE epoch</div>
          <select
            value={selectedTleEpoch ?? 'auto'}
            onChange={(e) => {
              const val = e.target.value === 'auto' ? null : e.target.value;
              onSelectTleEpoch(val);
            }}
            className="w-32 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-[10px] leading-tight h-7"
          >
            <option value="auto">Auto</option>
            {availableTles
              .slice()
              .sort((a, b) => b.epoch.getTime() - a.epoch.getTime())
              .map((t, idx) => {
                const iso = t.epoch.toISOString();
                const date = iso.slice(0, 10);
                const time = iso.slice(11, 19) + ' UTC';
                return (
                  <option key={idx} value={t.epoch.toISOString()}>
                    {`${date} ${time}`}
                  </option>
                );
              })}
          </select>
        </div>
      )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={isOpen ? search : selectedSatellite?.name ?? ''}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch('');
          }}
          onBlur={() => {
            // Delay to allow click on dropdown item
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder="Search satellites..."
          disabled={disabled || loading}
          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-[10px] leading-tight h-7"
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {selectedSatellite && !isOpen && !loading && (
          <button
            onClick={() => onSelect(null)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            title="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {historicalLoading && (
        <div className="text-xs text-gray-500 mt-1">Fetching archive TLEs…</div>
      )}

      {onPasteTles && (
        <div className="mt-2">
          <button
            className="text-xs text-blue-400 hover:text-blue-300"
            onClick={() => {
              setShowPaste(p => !p);
              setPasteStatus(null);
            }}
          >
            {showPaste ? 'Hide TLE paste' : 'Paste TLEs'}
          </button>
          {showPaste && (
            <div className="mt-2 space-y-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste one or more 2-line TLE sets..."
                className="w-full h-24 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      setPasteStatus('Saving...');
                      const added = await onPasteTles(pasteText, { forceNorad });
                      setPasteStatus(
                        added > 0
                          ? `Saved ${added} TLE${added === 1 ? '' : 's'}.`
                          : 'No TLEs saved (check NORAD ID or format).'
                      );
                      setPasteText('');
                    } catch (err) {
                      setPasteStatus(err instanceof Error ? err.message : 'Failed to save TLEs');
                    }
                  }}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
                  disabled={!pasteText.trim()}
                >
                  Save
                </button>
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  <input
                    type="checkbox"
                    checked={forceNorad}
                    onChange={(e) => setForceNorad(e.target.checked)}
                  />
                  Force save (ignore NORAD mismatch)
                </label>
                {pasteStatus && (
                  <span className="text-xs text-gray-400">{pasteStatus}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-gray-800 border border-gray-600 rounded-md shadow-lg">
          {filteredCatalog.recent.length === 0 && filteredCatalog.others.length === 0 ? (
            <div className="px-3 py-2 text-gray-400 text-sm">
              No satellites found
            </div>
          ) : (
            <>
              {/* Recent satellites */}
              {filteredCatalog.recent.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs text-gray-500 bg-gray-900">
                    Recent
                  </div>
                  {filteredCatalog.recent.map((sat) => (
                    <button
                      key={`recent-${sat.noradId}`}
                      onClick={() => {
                        addRecentSatellite(sat);
                        setRecentSatellites(getRecentSatellites());
                        onSelect(sat);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex justify-between items-center ${
                        sat.noradId === selectedId ? 'bg-gray-700' : ''
                      }`}
                    >
                      <span className="text-white truncate">{sat.name}</span>
                      <span className="text-gray-500 text-xs ml-2">
                        {sat.noradId}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* Other satellites */}
              {filteredCatalog.others.length > 0 && (
                <>
                  {filteredCatalog.recent.length > 0 && (
                    <div className="px-3 py-1 text-xs text-gray-500 bg-gray-900">
                      All Satellites
                    </div>
                  )}
                  {filteredCatalog.others.map((sat) => (
                    <button
                      key={sat.noradId}
                      onClick={() => {
                        addRecentSatellite(sat);
                        setRecentSatellites(getRecentSatellites());
                        onSelect(sat);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex justify-between items-center ${
                        sat.noradId === selectedId ? 'bg-gray-700' : ''
                      }`}
                    >
                      <span className="text-white truncate">{sat.name}</span>
                      <span className="text-gray-500 text-xs ml-2">
                        {sat.noradId}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
