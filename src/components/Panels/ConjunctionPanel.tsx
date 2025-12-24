import { useMemo } from 'react';
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
  const sortedConjunctions = useMemo(() => {
    const sorted = [...conjunctions];
    if (sortMode === 'date') {
      sorted.sort((a, b) => a.time.getTime() - b.time.getTime());
    } else {
      sorted.sort((a, b) => a.distance - b.distance);
    }
    return sorted;
  }, [conjunctions, sortMode]);

  return (
    <div>
      <div className="flex items-center justify-end mb-1.5">
        <div className="flex bg-gray-800 rounded text-[10px] overflow-hidden border border-gray-700">
          <button
            onClick={() => onSortModeChange('date')}
            className={`px-1.5 py-0.5 transition-colors ${
              sortMode === 'date'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Date
          </button>
          <button
            onClick={() => onSortModeChange('distance')}
            className={`px-1.5 py-0.5 transition-colors ${
              sortMode === 'distance'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Dist
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-[11px] py-2">
          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Searching...
        </div>
      ) : sortedConjunctions.length === 0 ? (
        <div className="text-gray-500 text-[11px] py-2">
          Calculating...
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {sortedConjunctions.map((conj, index) => (
            <ConjunctionItem
              key={index}
              conjunction={conj}
              onJump={() => onJumpToTime(conj.time)}
              isCurrent={conj.time.getTime() === currentTime.getTime()}
            />
          ))}
        </div>
      )}
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
    return date.toISOString().replace('T', ' ').slice(5, 16);
  };

  return (
    <button
      onClick={onJump}
      className={`w-full px-2 py-1.5 rounded text-left transition-colors ${
        isCurrent
          ? 'bg-yellow-900/50 border border-yellow-600'
          : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
      }`}
    >
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-white font-mono text-[12px]">
            {conjunction.distance.toFixed(1)} km
          </span>
          <span className="text-gray-500 text-[10px]">
            {conjunction.relativeVelocity.toFixed(1)} km/s
          </span>
        </div>
        <span className="text-gray-400 text-[10px] font-mono">
          {formatTime(conjunction.time)}
        </span>
      </div>
      <div className="text-gray-500 text-[10px] mt-0.5">
        Phase {conjunction.phaseAngleDeg?.toFixed(0) ?? '–'}° · {conjunction.earthRelation === 'obstructed' ? 'Earth obstructs' : conjunction.earthRelation === 'background' ? 'Earth behind' : 'Clear'}
      </div>
    </button>
  );
}
