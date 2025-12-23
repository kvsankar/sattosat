import { useState, useCallback, useEffect } from 'react';

interface TimelineSliderProps {
  currentTime: Date;
  onTimeChange: (time: Date) => void;
  onNow?: () => void;
  onAnchor?: () => void;
  rangeDays?: number;
  anchorTime?: Date;
  showNow?: boolean;
}

const SPEEDS = [1, 10, 100, 1000];

export function TimelineSlider({
  currentTime,
  onTimeChange,
  onNow,
  onAnchor,
  rangeDays = 5,
  anchorTime,
  showNow = true,
}: TimelineSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1); // Default 10x

  const anchor = anchorTime ?? new Date();
  const minTime = anchor.getTime() - rangeDays * 24 * 60 * 60 * 1000;
  const maxTime = anchor.getTime() + rangeDays * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const nowDisabled = nowMs < minTime || nowMs > maxTime;
  const totalRange = maxTime - minTime;

  // Calculate slider position (0-100)
  const sliderValue = ((currentTime.getTime() - minTime) / totalRange) * 100;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsPlaying(false);
      const percent = parseFloat(e.target.value);
      const newTime = new Date(minTime + (percent / 100) * totalRange);
      onTimeChange(newTime);
    },
    [minTime, totalRange, onTimeChange]
  );

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    if (onNow) {
      onNow();
    } else {
      onTimeChange(new Date());
    }
  }, [onNow, onTimeChange]);

  const handleStep = useCallback((minutes: number) => {
    setIsPlaying(false);
    const next = new Date(currentTime.getTime() + minutes * 60 * 1000);
    onTimeChange(next);
  }, [currentTime, onTimeChange]);

  const handleStepSeconds = useCallback((seconds: number) => {
    setIsPlaying(false);
    const next = new Date(currentTime.getTime() + seconds * 1000);
    onTimeChange(next);
  }, [currentTime, onTimeChange]);

  const handleAnchorClick = useCallback(() => {
    setIsPlaying(false);
    if (onAnchor) {
      onAnchor();
    }
  }, [onAnchor]);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((i) => (i + 1) % SPEEDS.length);
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const speed = SPEEDS[speedIndex] ?? 10;
    const intervalMs = 100; // Update every 100ms

    const interval = setInterval(() => {
      const newTime = new Date(currentTime.getTime() + speed * intervalMs);
      if (newTime.getTime() > maxTime) {
        setIsPlaying(false);
        return;
      }
      onTimeChange(newTime);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, speedIndex, currentTime, maxTime, onTimeChange]);

  const formatDate = (date: Date) => {
    return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  const formatRelative = (date: Date) => {
    const diffMs = date.getTime() - anchor.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (Math.abs(diffHours) < 1) {
      const diffMins = Math.round(diffMs / (1000 * 60));
      return diffMins >= 0 ? `+${diffMins}m` : `${diffMins}m`;
    } else if (Math.abs(diffDays) < 1) {
      const hours = Math.round(diffHours);
      return hours >= 0 ? `+${hours}h` : `${hours}h`;
    } else {
      const days = diffDays.toFixed(1);
      return parseFloat(days) >= 0 ? `+${days}d` : `${days}d`;
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-400">Timeline</div>
        <div className="flex items-center gap-2">
          {onAnchor && (
            <button
              onClick={handleAnchorClick}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white"
            >
              Anchor
            </button>
          )}
          {showNow && (
            <button
              onClick={handleReset}
              disabled={nowDisabled}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white disabled:opacity-50"
              title={nowDisabled ? 'Now is outside range' : 'Jump to now'}
            >
              Now
            </button>
          )}
          <button
            onClick={togglePlay}
            className={`px-3 py-1 text-xs rounded text-white ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={cycleSpeed}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white min-w-[50px]"
          >
            {SPEEDS[speedIndex]}x
          </button>
        </div>
      </div>

      {/* Time display */}
      <div className="text-center mb-3">
        <div className="text-white font-mono text-sm">
          {formatDate(currentTime)}
        </div>
        <div className="text-gray-400 text-xs">
          {formatRelative(currentTime)} from anchor
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min="0"
          max="100"
          step="0.01"
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />

        {/* Now marker */}
        <div
          className="absolute top-0 h-2 w-0.5 bg-yellow-500 pointer-events-none"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Range labels */}
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>-{rangeDays}d</span>
        <span>Anchor</span>
        <span>+{rangeDays}d</span>
      </div>

      {/* Fine controls */}
      <div className="flex gap-2 mt-3 text-xs">
        <button
          onClick={() => handleStep(-5)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          -5m
        </button>
        <button
          onClick={() => handleStep(-1)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          -1m
        </button>
        <button
          onClick={() => handleStepSeconds(-10)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          -10s
        </button>
        <button
          onClick={() => handleStepSeconds(10)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          +10s
        </button>
        <button
          onClick={() => handleStep(1)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          +1m
        </button>
        <button
          onClick={() => handleStep(5)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          +5m
        </button>
      </div>
    </div>
  );
}
