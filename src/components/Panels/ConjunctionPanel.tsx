import { useMemo, useState } from 'react';
import type { Conjunction } from '../../types/satellite';

type SortMode = 'date' | 'distance';

interface ConjunctionPanelProps {
  conjunctions: Conjunction[];
  loading: boolean;
  onJumpToTime: (time: Date) => void;
  currentTime: Date;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
}

export function ConjunctionPanel({
  conjunctions,
  loading,
  onJumpToTime,
  currentTime,
  sortMode,
  onSortModeChange,
}: ConjunctionPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sortedConjunctions = useMemo(() => {
    const sorted = [...conjunctions];
    if (sortMode === 'date') {
      sorted.sort((a, b) => a.time.getTime() - b.time.getTime());
    } else {
      sorted.sort((a, b) => a.distance - b.distance);
    }
    return sorted;
  }, [conjunctions, sortMode]);

  const header = (
    <button
      type="button"
      onClick={() => setCollapsed(c => !c)}
      className="w-full flex items-center justify-between px-3 py-2 bg-gray-850 text-left"
    >
      <div className="flex items-center gap-2 text-white font-medium">
        <span>Close Approaches</span>
        {conjunctions.length > 0 && (
          <span className="text-gray-400 text-sm font-normal">
            ({conjunctions.length})
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex bg-gray-900 rounded-md text-xs overflow-hidden">
          <button
            onClick={() => onSortModeChange('date')}
            className={`px-2 py-1 transition-colors ${
              sortMode === 'date'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Date
          </button>
          <button
            onClick={() => onSortModeChange('distance')}
            className={`px-2 py-1 transition-colors ${
              sortMode === 'distance'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Distance
          </button>
        </div>
        <span className="text-gray-400">{collapsed ? '▸' : '▾'}</span>
      </div>
    </button>
  );

  const body = loading ? (
    <div className="flex items-center gap-2 text-gray-400 text-sm px-3 py-3">
      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      Searching for conjunctions...
    </div>
  ) : sortedConjunctions.length === 0 ? (
    <div className="text-gray-400 text-sm px-3 py-3">
      Calculating closest approaches...
    </div>
  ) : (
    <div className="space-y-2 max-h-64 overflow-y-auto px-3 py-3">
      {sortedConjunctions.map((conj, index) => (
        <ConjunctionItem
          key={index}
          conjunction={conj}
          onJump={() => onJumpToTime(conj.time)}
          isCurrent={conj.time.getTime() === currentTime.getTime()}
        />
      ))}
    </div>
  );

  return (
    <div className="border border-gray-700 rounded-md overflow-hidden bg-gray-800">
      {header}
      {!collapsed && body}
    </div>
  );
}

interface ConjunctionItemProps {
  conjunction: Conjunction;
  onJump: () => void;
  isCurrent: boolean;
}

function ConjunctionItem({ conjunction, onJump, isCurrent }: ConjunctionItemProps) {
  const formatTime = (date: Date) => {
    return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  const formatRelative = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (Math.abs(diffHours) < 24) {
      return diffHours >= 0
        ? `in ${Math.round(diffHours)}h`
        : `${Math.round(-diffHours)}h ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return diffDays >= 0 ? `in ${diffDays}d` : `${-diffDays}d ago`;
  };

  return (
    <button
      onClick={onJump}
      className={`w-full p-2 rounded text-left transition-colors ${
        isCurrent
          ? 'bg-yellow-900/50 border border-yellow-600'
          : 'bg-gray-900 hover:bg-gray-700'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-white font-mono text-sm">
            {conjunction.distance.toFixed(1)} km
          </div>
          <div className="text-gray-400 text-xs">
            {conjunction.relativeVelocity.toFixed(2)} km/s rel. vel.
          </div>
          <div className="text-gray-400 text-xs">
            Phase {conjunction.phaseAngleDeg?.toFixed(1) ?? '–'}° • Earth{' '}
            {conjunction.earthRelation === 'obstructed'
              ? 'obstructs'
              : conjunction.earthRelation === 'background'
                ? 'background'
                : 'clear'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-gray-300 text-xs">
            {formatRelative(conjunction.time)}
          </div>
          <div className="text-gray-500 text-xs">
            {formatTime(conjunction.time)}
          </div>
        </div>
      </div>
    </button>
  );
}
