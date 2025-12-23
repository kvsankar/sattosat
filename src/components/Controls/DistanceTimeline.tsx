import React, { useMemo, useCallback, useEffect, useState } from 'react';
import type { DistanceSample } from '../../lib/conjunctions';

interface DistanceTimelineProps {
  samples: DistanceSample[];
  currentTime: Date;
  anchorTime: Date;
  rangeDays: number;
  onTimeChange: (time: Date) => void;
  height?: number;
  onCollapse?: () => void;
  currentDistanceKm?: number;
}

export function DistanceTimeline({
  samples,
  currentTime,
  anchorTime,
  rangeDays,
  onTimeChange,
  height = 190,
  onCollapse,
  currentDistanceKm,
}: DistanceTimelineProps) {
  const rawStats = useMemo(() => {
    if (!samples.length) return null;
    const distances = samples.map(s => s.distance);
    if (typeof currentDistanceKm === 'number') distances.push(currentDistanceKm);
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    const start = samples[0]!.time.getTime();
    const end = samples[samples.length - 1]!.time.getTime();
    return { min, max, start, end };
  }, [samples, currentDistanceKm]);

  // Zoom state (applies to both axes)
  const [zoom, setZoom] = useState({ x: 1, y: 1, xCenter: 0, yCenter: 0 });

  // Reset zoom when data changes
  useEffect(() => {
    if (!rawStats) return;
    const midX = (rawStats.start + rawStats.end) / 2;
    const midY = (rawStats.min + rawStats.max) / 2;
    setZoom({ x: 1, y: 1, xCenter: midX, yCenter: midY });
  }, [rawStats?.start, rawStats?.end, rawStats?.min, rawStats?.max]);

  const stats = useMemo(() => {
    if (!rawStats) return null;
    const baseSpanX = Math.max(rawStats.end - rawStats.start, 1);
    const baseSpanY = Math.max(rawStats.max - rawStats.min, 1);

    const halfSpanX = baseSpanX / (2 * zoom.x);
    const halfSpanY = baseSpanY / (2 * zoom.y);

    const centerX = isFinite(zoom.xCenter) ? zoom.xCenter : (rawStats.start + rawStats.end) / 2;
    const centerY = isFinite(zoom.yCenter) ? zoom.yCenter : (rawStats.min + rawStats.max) / 2;

    const start = Math.max(rawStats.start, centerX - halfSpanX);
    const end = Math.min(rawStats.end, centerX + halfSpanX);
    const min = Math.max(rawStats.min, centerY - halfSpanY);
    const max = Math.min(rawStats.max, centerY + halfSpanY);

    return {
      min,
      max,
      start,
      end,
      raw: rawStats,
    };
  }, [rawStats, zoom.x, zoom.y, zoom.xCenter, zoom.yCenter]);

  const viewBoxWidth = 1300;
  const viewBoxHeight = Math.max(140, height - 20);
  const padding = { left: 60, right: 24, top: 12, bottom: 28 };
  const innerW = viewBoxWidth - padding.left - padding.right;
  const innerH = viewBoxHeight - padding.top - padding.bottom;

  const path = useMemo(() => {
    if (!samples.length || !stats) return '';
    const { min, max, start, end } = stats;
    const span = Math.max(max - min, 1);
    const scaleX = (t: number) => padding.left + ((t - start) / (end - start)) * innerW;
    const scaleY = (d: number) => padding.top + innerH - ((d - min) / span) * innerH;

    const visible = samples.filter(s => s.time.getTime() >= start && s.time.getTime() <= end);
    const points = visible.length ? visible : samples;

    return points
      .map((s, i) => {
        const x = scaleX(s.time.getTime());
        const y = scaleY(s.distance);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [samples, stats, padding.left, padding.right, padding.top, padding.bottom, innerW, innerH]);

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!stats) return;
      const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left - padding.left) / (rect.width - padding.left - padding.right))
      );
      const target = stats.start + ratio * (stats.end - stats.start);
      onTimeChange(new Date(target));
    },
    [onTimeChange, stats, padding.left, padding.right]
  );

  const handleZoom = useCallback((factor: number, focus: { x: number; y: number } | null) => {
    setZoom(prev => {
      const nextX = Math.min(50, Math.max(1, prev.x * factor));
      const nextY = Math.min(50, Math.max(1, prev.y * factor));
      if (!stats || !focus) {
        return { ...prev, x: nextX, y: nextY };
      }
      return {
        x: nextX,
        y: nextY,
        xCenter: focus.x,
        yCenter: focus.y,
      };
    });
  }, [stats]);

  const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    if (!stats) return;
    event.preventDefault();
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const ratioX = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left - padding.left) / (rect.width - padding.left - padding.right))
    );
    const ratioY = Math.min(
      1,
      Math.max(0, (event.clientY - rect.top - padding.top) / (rect.height - padding.top - padding.bottom))
    );
    const focusX = stats.start + ratioX * (stats.end - stats.start);
    const focusY = stats.max - ratioY * (stats.max - stats.min);
    const factor = event.deltaY < 0 ? 1.2 : 0.8;
    handleZoom(factor, { x: focusX, y: focusY });
  }, [handleZoom, stats, padding.left, padding.right, padding.top, padding.bottom]);

  const resetZoom = useCallback(() => {
    if (!rawStats) return;
    const midX = (rawStats.start + rawStats.end) / 2;
    const midY = (rawStats.min + rawStats.max) / 2;
    setZoom({ x: 1, y: 1, xCenter: midX, yCenter: midY });
  }, [rawStats]);

  const [hover, setHover] = useState<{ x: number; y: number; time: number; distance: number } | null>(null);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!stats) return;
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const ratioX = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left - padding.left) / (rect.width - padding.left - padding.right))
    );
    const ratioY = Math.min(
      1,
      Math.max(0, (event.clientY - rect.top - padding.top) / (rect.height - padding.top - padding.bottom))
    );
    const time = stats.start + ratioX * (stats.end - stats.start);
    const distance = stats.max - ratioY * (stats.max - stats.min);
    setHover({ x: event.clientX, y: event.clientY, time, distance });
  }, [stats, padding.left, padding.right, padding.top, padding.bottom]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  if (!stats) {
    return (
      <div className="bg-gray-900/90 border border-gray-700 rounded-lg p-3 text-gray-400 text-sm h-full">
        Load two satellites to see the distance timeline.
      </div>
    );
  }

  const { min, max, start, end, raw } = stats;
  const scaleX = (t: number) => padding.left + ((t - start) / (end - start)) * innerW;
  const spanLabel = `${-rangeDays}d to +${rangeDays}d`;
  const currentX = scaleX(currentTime.getTime());
  const anchorX = scaleX(anchorTime.getTime());
  const currentY = (() => {
    const dist = typeof currentDistanceKm === 'number'
      ? currentDistanceKm
      : samples.length
        ? samples.reduce((closest, s) => {
            const diff = Math.abs(s.time.getTime() - currentTime.getTime());
            const curDiff = Math.abs(closest.time.getTime() - currentTime.getTime());
            return diff < curDiff ? s : closest;
          }).distance
        : null;
    if (dist === null) return null;
    const span = Math.max(max - min, 1);
    return padding.top + innerH - ((dist - min) / span) * innerH;
  })();

  const formatTime = (t: number) => {
    const d = new Date(t);
    return d.toISOString().slice(5, 16).replace('T', ' ');
  };

  const xTicks = (() => {
    const ticks: number[] = [start, anchorTime.getTime(), end];
    const mid1 = start + (end - start) / 4;
    const mid2 = start + (end - start) * 3 / 4;
    ticks.push(mid1, mid2);
    return Array.from(new Set(ticks.map(t => Math.round(t)))).sort((a, b) => a - b);
  })();

  const yTicks = useMemo(() => {
    const span = max - min;
    if (span === 0) return [min];

    // Pick a clean step (1/2/5 × 10^n)
    const roughStep = span / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
    const candidates = [1, 2, 5].map(f => f * magnitude);
    const step = candidates.reduce((best, val) =>
      Math.abs(val - roughStep) < Math.abs(best - roughStep) ? val : best, candidates[0]!);

    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= end + 1e-6; v += step) {
      ticks.push(v);
    }
        return ticks;
  }, [min, max]);

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-3 shadow-lg h-full relative">
      {onCollapse && (
        <button
          onClick={onCollapse}
          className="absolute top-2 right-2 text-gray-300 hover:text-white text-xs bg-gray-800/80 border border-gray-700 rounded px-2 py-0.5"
          title="Collapse timeline"
        >
          ×
        </button>
      )}
      <div className="flex items-center justify-between text-xs text-gray-200 mb-1 pr-8">
        <div className="font-semibold">Distance timeline ({spanLabel})</div>
        <div className="flex items-center gap-2">
          <div className="flex">
            <button
              onClick={() => handleZoom(1.2, { x: (start + end) / 2, y: (min + max) / 2 })}
              className="px-2 py-1 bg-gray-800 text-gray-200 rounded-l border border-gray-700 hover:bg-gray-700"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => handleZoom(0.8, { x: (start + end) / 2, y: (min + max) / 2 })}
              className="px-2 py-1 bg-gray-800 text-gray-200 border-t border-b border-gray-700 hover:bg-gray-700"
              title="Zoom out"
            >
              −
            </button>
            <button
              onClick={resetZoom}
              className="px-2 py-1 bg-gray-800 text-gray-200 rounded-r border border-gray-700 hover:bg-gray-700"
              title="Reset zoom"
            >
              Reset
            </button>
          </div>
          <div className="flex flex-col items-end text-gray-300">
            <span>min {raw.min.toFixed(1)} km · max {raw.max.toFixed(1)} km</span>
            {typeof currentDistanceKm === 'number' && (
              <span className="text-[11px] text-gray-400">
                Current {currentDistanceKm.toFixed(1)} km @ {formatTime(currentTime.getTime())}
              </span>
            )}
          </div>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-full cursor-crosshair"
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="distFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={viewBoxWidth} height={viewBoxHeight} fill="url(#distFill)" opacity="0.15" />
        {path && (
          <>
            <path d={path} fill="none" stroke="#22c55e" strokeWidth="2" />
          </>
        )}
        {/* X axis */}
        <line
          x1={padding.left}
          x2={viewBoxWidth - padding.right}
          y1={viewBoxHeight - padding.bottom}
          y2={viewBoxHeight - padding.bottom}
          stroke="#374151"
          strokeWidth="1"
        />
        {/* Y axis */}
        <line
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={viewBoxHeight - padding.bottom}
          stroke="#374151"
          strokeWidth="1"
        />

        {/* Grid + ticks */}
        {xTicks.map((t, idx) => {
          const x = scaleX(t);
          const label = formatTime(t);
          return (
            <g key={`x-${idx}`}>
              <line
                x1={x}
                x2={x}
                y1={padding.top}
                y2={viewBoxHeight - padding.bottom}
                stroke="#1f2937"
                strokeWidth="0.5"
              />
              <text
                x={x}
                y={viewBoxHeight - padding.bottom + 12}
                fontSize="10"
                fill="#9ca3af"
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })}
        {yTicks.map((d, idx) => {
          const y = padding.top + innerH - ((d - min) / (max - min || 1)) * innerH;
          return (
            <g key={`y-${idx}`}>
              <line
                x1={padding.left}
                x2={viewBoxWidth - padding.right}
                y1={y}
                y2={y}
                stroke="#1f2937"
                strokeWidth="0.5"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                fontSize="10"
                fill="#9ca3af"
                textAnchor="end"
              >
                {d.toFixed(0)} km
              </text>
            </g>
          );
        })}

        {/* Anchor line */}
        <line x1={anchorX} x2={anchorX} y1={padding.top} y2={viewBoxHeight - padding.bottom} stroke="#fbbf24" strokeDasharray="4 4" strokeWidth="1" />
        {/* Current time marker */}
        <line x1={currentX} x2={currentX} y1={padding.top} y2={viewBoxHeight - padding.bottom} stroke="#60a5fa" strokeWidth="2" />
        {currentY !== null && (
          <g>
            <circle cx={currentX} cy={currentY} r={3} fill="#60a5fa" />
            <text x={currentX + 6} y={currentY - 6} fontSize="10" fill="#bfdbfe">
              {typeof currentDistanceKm === 'number' ? currentDistanceKm.toFixed(1) : ''} km
            </text>
          </g>
        )}
        {/* Hover crosshair */}
        {hover && (
          <g>
            <line
              x1={padding.left}
              x2={viewBoxWidth - padding.right}
              y1={hover ? padding.top + innerH - ((hover.distance - min) / (max - min)) * innerH : 0}
              y2={hover ? padding.top + innerH - ((hover.distance - min) / (max - min)) * innerH : 0}
              stroke="#9ca3af"
              strokeDasharray="4 2"
              strokeWidth="0.5"
            />
            <line
              x1={hover ? padding.left + ((hover.time - start) / (end - start)) * innerW : 0}
              x2={hover ? padding.left + ((hover.time - start) / (end - start)) * innerW : 0}
              y1={padding.top}
              y2={viewBoxHeight - padding.bottom}
              stroke="#9ca3af"
              strokeDasharray="4 2"
              strokeWidth="0.5"
            />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="absolute text-[11px] bg-gray-900/90 text-gray-100 border border-gray-700 rounded px-2 py-1 pointer-events-none"
          style={{ left: hover.x + 10, top: hover.y - 10 }}
        >
          <div>{formatTime(hover.time)}</div>
          <div>{hover.distance.toFixed(1)} km</div>
        </div>
      )}
      <div className="flex justify-between text-[11px] text-gray-400 mt-1">
        <span>-{rangeDays}d</span>
        <span>Anchor</span>
        <span>+{rangeDays}d</span>
      </div>
    </div>
  );
}
