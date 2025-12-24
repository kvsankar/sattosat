import React, { useMemo, useCallback, useState } from 'react';
import type { DistanceSample } from '../../lib/conjunctions';

interface DistanceTimelineProps {
  samples: DistanceSample[];
  currentTime: Date;
  anchorTime: Date;
  onTimeChange: (time: Date) => void;
  height?: number;
  currentDistanceKm?: number;
}

interface HoverInfo {
  time: Date;
  distance: number;
}

export function DistanceTimeline({
  samples,
  currentTime,
  anchorTime,
  onTimeChange,
  height = 190,
  currentDistanceKm,
}: DistanceTimelineProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const stats = useMemo(() => {
    if (!samples.length) return null;
    const distances = samples.map(s => s.distance);
    if (typeof currentDistanceKm === 'number') distances.push(currentDistanceKm);
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    const start = samples[0]!.time.getTime();
    const end = samples[samples.length - 1]!.time.getTime();
    return { min, max, start, end };
  }, [samples, currentDistanceKm]);

  const viewBoxWidth = 1400;
  const viewBoxHeight = Math.max(140, height - 20);
  const paddingLeft = 60;
  const paddingRight = 16;
  const paddingTop = 12;
  const paddingBottom = 32;
  const padding = { left: paddingLeft, right: paddingRight, top: paddingTop, bottom: paddingBottom };
  const innerW = viewBoxWidth - paddingLeft - paddingRight;
  const innerH = viewBoxHeight - paddingTop - paddingBottom;

  const formatTick = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 100) return Math.round(n).toString();
    if (abs >= 10) return n.toFixed(1);
    if (abs >= 1) return n.toFixed(1);
    return n.toFixed(2);
  };

  const path = useMemo(() => {
    if (!samples.length || !stats) return '';
    const { min, max, start, end } = stats;
    const span = Math.max(max - min, 1);
    const scaleX = (t: number) => paddingLeft + ((t - start) / (end - start)) * innerW;
    const scaleY = (d: number) => paddingTop + innerH - ((d - min) / span) * innerH;

    return samples
      .map((s, i) => {
        const x = scaleX(s.time.getTime());
        const y = scaleY(s.distance);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [samples, stats, innerW, innerH, paddingLeft, paddingTop]);

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!stats) return;
      const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left - paddingLeft) / (rect.width - paddingLeft - paddingRight))
      );
      const target = stats.start + ratio * (stats.end - stats.start);
      onTimeChange(new Date(target));
    },
    [onTimeChange, paddingLeft, paddingRight, stats]
  );

  const min = stats?.min ?? 0;
  const max = stats?.max ?? 1;
  const start = stats?.start ?? 0;
  const end = stats?.end ?? 1;
  const scaleX = (t: number) => paddingLeft + ((t - start) / (end - start || 1)) * innerW;
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

  const formatAxisLabel = (t: number) => {
    const d = new Date(t);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };

  const formatHoverTime = (d: Date) => {
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!stats || !samples.length) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left - paddingLeft) / (rect.width - paddingLeft - paddingRight))
      );
      const targetMs = stats.start + ratio * (stats.end - stats.start);
      // Find closest sample
      const closest = samples.reduce((best, s) => {
        const diff = Math.abs(s.time.getTime() - targetMs);
        const bestDiff = Math.abs(best.time.getTime() - targetMs);
        return diff < bestDiff ? s : best;
      });
      setHover({ time: new Date(targetMs), distance: closest.distance });
    },
    [stats, samples, paddingLeft, paddingRight]
  );

  const handleMouseLeave = useCallback(() => {
    setHover(null);
  }, []);

  // Generate ticks at midnight UTC for each day in the range
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const startDate = new Date(start);
    // Round up to next midnight UTC
    const firstMidnight = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    for (let t = firstMidnight.getTime(); t <= end; t += 24 * 60 * 60 * 1000) {
      ticks.push(t);
    }
    return ticks;
  }, [start, end]);

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
    <div className="h-full relative">
      {!stats ? (
        <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
          Select satellites to view distance
        </div>
      ) : (
        <>
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full cursor-crosshair"
          onClick={handleClick}
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
                    {formatAxisLabel(t)}
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
                  <text x={padding.left - 6} y={y + 3} fontSize="10" fill="#9ca3af" textAnchor="end">
                    {formatTick(d)} km
                  </text>
                </g>
              );
            })}

            {/* Anchor line */}
            <line x1={anchorX} x2={anchorX} y1={padding.top} y2={viewBoxHeight - padding.bottom} stroke="#fbbf24" strokeDasharray="4 4" strokeWidth="1" />
            {/* Current time marker */}
            <line x1={currentX} x2={currentX} y1={padding.top} y2={viewBoxHeight - padding.bottom} stroke="#60a5fa" strokeWidth="2" />
            {currentY !== null && (
              <circle cx={currentX} cy={currentY} r={3} fill="#60a5fa" />
            )}

            {/* Hover indicator */}
            {hover && (() => {
              const hoverX = scaleX(hover.time.getTime());
              const span = Math.max(max - min, 1);
              const hoverY = padding.top + innerH - ((hover.distance - min) / span) * innerH;
              return (
                <>
                  <line
                    x1={hoverX}
                    x2={hoverX}
                    y1={padding.top}
                    y2={viewBoxHeight - padding.bottom}
                    stroke="#9ca3af"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle cx={hoverX} cy={hoverY} r={5} fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
                </>
              );
            })()}
          </svg>
        {/* Hover info */}
        {hover && (
          <div className="absolute bottom-1 right-2 text-[10px] font-mono text-gray-400 bg-gray-900/80 px-1.5 py-0.5 rounded">
            {formatHoverTime(hover.time)} · {hover.distance.toFixed(1)} km
          </div>
        )}
        </>
      )}
    </div>
  );
}
