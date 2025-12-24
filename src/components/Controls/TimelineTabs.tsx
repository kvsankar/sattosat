import React, { useMemo, useState, useCallback } from 'react';
import type { DistanceSample } from '../../lib/conjunctions';
import type { SatelliteTLE } from '../../types/satellite';
import { DistanceTimeline } from './DistanceTimeline';

type MetricId = 'semiMajorAxis' | 'period' | 'raan' | 'argOfPerigee' | 'apogee' | 'perigee' | 'eccentricity' | 'inclination';

interface TimelineTabsProps {
  distanceSamples: DistanceSample[];
  currentDistanceKm?: number;
  currentTime: Date;
  anchorTime: Date;
  rangeDays: number;
  onTimeChange: (time: Date) => void;
  height: number;
  onCollapse?: () => void;
  tleSeriesA: SatelliteTLE[];
  tleSeriesB: SatelliteTLE[];
}

interface ParameterGraphProps {
  seriesA: SatelliteTLE[];
  seriesB: SatelliteTLE[];
  metric: MetricId;
  currentTime: Date;
  anchorTime: Date;
  rangeDays: number;
  onTimeChange: (time: Date) => void;
  height: number;
}

const METRICS: Array<{ id: MetricId; label: string; shortLabel: string; unit: string }> = [
  { id: 'semiMajorAxis', label: 'Semi-major axis', shortLabel: 'SMA', unit: 'km' },
  { id: 'period', label: 'Period', shortLabel: 'Period', unit: 'min' },
  { id: 'raan', label: 'RAAN', shortLabel: 'RAAN', unit: '°' },
  { id: 'argOfPerigee', label: 'Arg of Perigee', shortLabel: 'AoP', unit: '°' },
  { id: 'apogee', label: 'Apogee', shortLabel: 'Apo', unit: 'km' },
  { id: 'perigee', label: 'Perigee', shortLabel: 'Peri', unit: 'km' },
  { id: 'eccentricity', label: 'Eccentricity', shortLabel: 'Ecc', unit: '' },
  { id: 'inclination', label: 'Inclination', shortLabel: 'Inc', unit: '°' },
];

export function TimelineTabs({
  distanceSamples,
  currentDistanceKm,
  currentTime,
  anchorTime,
  rangeDays,
  onTimeChange,
  height,
  onCollapse,
  tleSeriesA,
  tleSeriesB,
}: TimelineTabsProps) {
  const [activeTab, setActiveTab] = useState<MetricId | 'distance'>('distance');
  const activeMetric = METRICS.find(m => m.id === activeTab);

  return (
    <div
      className="bg-gray-900 border border-gray-700 rounded-lg h-full w-full flex flex-col"
      style={{ minWidth: 320 }}
    >
      {/* Header bar with tabs and collapse */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-800">
        <div className="flex items-center gap-0.5">
          <TabButton
            id="distance"
            active={activeTab}
            onSelect={setActiveTab}
            label="Distance"
          />
          <span className="text-gray-600 mx-1">|</span>
          {METRICS.map(m => (
            <TabButton
              key={m.id}
              id={m.id}
              active={activeTab}
              onSelect={setActiveTab}
              label={m.shortLabel}
              title={m.label}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'distance' && typeof currentDistanceKm === 'number' && (
            <span className="text-[11px] text-gray-400 font-mono">
              {currentDistanceKm.toFixed(1)} km
            </span>
          )}
          {activeMetric && (
            <span className="text-[11px] text-gray-400">
              {activeMetric.label} ({activeMetric.unit || '–'})
            </span>
          )}
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="text-gray-500 hover:text-white p-1"
              title="Collapse panel"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Graph area */}
      <div className="flex-1 min-h-0 p-2">
        {activeTab === 'distance' ? (
          <DistanceTimeline
            samples={distanceSamples}
            currentTime={currentTime}
            anchorTime={anchorTime}
            onTimeChange={onTimeChange}
            height={height - 40}
            currentDistanceKm={currentDistanceKm}
          />
        ) : (
          <ParameterGraph
            seriesA={tleSeriesA}
            seriesB={tleSeriesB}
            metric={activeTab}
            currentTime={currentTime}
            anchorTime={anchorTime}
            rangeDays={rangeDays}
            onTimeChange={onTimeChange}
            height={height - 40}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  id,
  active,
  onSelect,
  label,
  title,
}: {
  id: MetricId | 'distance';
  active: MetricId | 'distance';
  onSelect: (id: MetricId | 'distance') => void;
  label: string;
  title?: string;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onSelect(id)}
      title={title}
      className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );
}

function ParameterGraph({
  seriesA,
  seriesB,
  metric,
  currentTime,
  anchorTime,
  rangeDays,
  onTimeChange,
  height,
}: ParameterGraphProps) {
  const [hover, setHover] = useState<{
    time: Date;
    valueA?: number;
    valueB?: number;
    nearPointA?: { idx: number; x: number; y: number; delta?: number };
    nearPointB?: { idx: number; x: number; y: number; delta?: number };
  } | null>(null);
  const metricInfo = METRICS.find(m => m.id === metric)!;
  const viewBoxWidth = 1400;
  const viewBoxHeight = Math.max(140, height - 20);
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 12;
  const paddingBottom = 32;
  const innerW = viewBoxWidth - paddingLeft - paddingRight;
  const innerH = viewBoxHeight - paddingTop - paddingBottom;
  const anchorMs = anchorTime.getTime();
  const windowStart = anchorMs - rangeDays * 24 * 60 * 60 * 1000;
  const windowEnd = anchorMs + rangeDays * 24 * 60 * 60 * 1000;

  const getValue = useCallback(
    (t: SatelliteTLE) => {
      switch (metric) {
        case 'semiMajorAxis':
          return t.semiMajorAxis;
        case 'period':
          return t.period;
        case 'raan':
          return t.raan;
        case 'argOfPerigee':
          return t.argOfPerigee;
        case 'apogee':
          return t.apogee;
        case 'perigee':
          return t.perigee;
        case 'eccentricity':
          return t.eccentricity;
        case 'inclination':
          return t.inclination;
        default:
          return 0;
      }
    },
    [metric]
  );

  const pointsA = useMemo(
    () =>
      seriesA
        .filter(t => {
          const ms = t.epoch.getTime();
          return ms >= windowStart && ms <= windowEnd;
        })
        .map(t => ({ x: t.epoch.getTime(), y: getValue(t) }))
        .sort((a, b) => a.x - b.x),
    [getValue, seriesA, windowEnd, windowStart]
  );

  const pointsB = useMemo(
    () =>
      seriesB
        .filter(t => {
          const ms = t.epoch.getTime();
          return ms >= windowStart && ms <= windowEnd;
        })
        .map(t => ({ x: t.epoch.getTime(), y: getValue(t) }))
        .sort((a, b) => a.x - b.x),
    [getValue, seriesB, windowEnd, windowStart]
  );

  const hasData = pointsA.length > 0 || pointsB.length > 0;
  const xMin = hasData ? Math.min(...[...pointsA, ...pointsB].map(p => p.x)) : windowStart;
  const xMax = hasData ? Math.max(...[...pointsA, ...pointsB].map(p => p.x)) : windowEnd;
  const yValues = [...pointsA, ...pointsB].map(p => p.y);
  const yMin = yValues.length ? Math.min(...yValues) : 0;
  const yMax = yValues.length ? Math.max(...yValues) : 1;
  const ySpan = Math.max(yMax - yMin, 1e-6);

  const formatTick = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 100) return Math.round(n).toString();
    if (abs >= 10) return n.toFixed(1);
    if (abs >= 1) return n.toFixed(2);
    return n.toPrecision(2);
  };

  const buildTicks = (min: number, max: number, count = 4) => {
    if (min === max) return [min];
    const span = max - min;
    const rough = span / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rough || 1))));
    const candidates = [1, 2, 5].map(f => f * magnitude);
    const step = candidates.reduce((best, val) =>
      Math.abs(val - rough) < Math.abs(best - rough) ? val : best, candidates[0]!);
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= end + 1e-9; v += step) ticks.push(v);
    return ticks;
  };

  const xTicks = buildTicks(xMin, xMax, 4);
  const yTicks = buildTicks(yMin, yMax, 4);

  const scaleX = useCallback(
    (x: number) => paddingLeft + ((x - xMin) / (xMax - xMin || 1)) * innerW,
    [paddingLeft, xMin, xMax, innerW]
  );
  const scaleY = useCallback(
    (y: number) => paddingTop + innerH - ((y - yMin) / ySpan) * innerH,
    [paddingTop, innerH, yMin, ySpan]
  );

  const path = (pts: typeof pointsA) =>
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(2)} ${scaleY(p.y).toFixed(2)}`)
      .join(' ');

  const formatAxisLabel = (ms: number) => {
    const d = new Date(ms);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };

  const formatHoverTime = (d: Date) => {
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  const formatValue = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toFixed(1);
    if (abs >= 100) return n.toFixed(2);
    if (abs >= 1) return n.toFixed(3);
    return n.toPrecision(3);
  };

  const formatDelta = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return sign + formatValue(n);
  };

  const onClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left - paddingLeft) / (rect.width - paddingLeft - paddingRight))
    );
    const target = xMin + ratio * (xMax - xMin || 1);
    onTimeChange(new Date(target));
  };

  const onMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left - paddingLeft) / (rect.width - paddingLeft - paddingRight))
    );
    const targetMs = xMin + ratio * (xMax - xMin || 1);

    // Find closest points with index using reduce
    const closestAResult = pointsA.length
      ? pointsA.reduce(
          (acc, p, i) => {
            const dist = Math.abs(p.x - targetMs);
            return dist < acc.dist ? { point: p, idx: i, dist } : acc;
          },
          { point: pointsA[0]!, idx: 0, dist: Math.abs(pointsA[0]!.x - targetMs) }
        )
      : null;

    const closestBResult = pointsB.length
      ? pointsB.reduce(
          (acc, p, i) => {
            const dist = Math.abs(p.x - targetMs);
            return dist < acc.dist ? { point: p, idx: i, dist } : acc;
          },
          { point: pointsB[0]!, idx: 0, dist: Math.abs(pointsB[0]!.x - targetMs) }
        )
      : null;

    // Check if we're "near" a point (within 5% of the x-range)
    const nearThreshold = (xMax - xMin) * 0.05;

    type NearPoint = { idx: number; x: number; y: number; delta?: number };
    let nearPointA: NearPoint | undefined = undefined;
    if (closestAResult && closestAResult.dist < nearThreshold) {
      const prevA = closestAResult.idx > 0 ? pointsA[closestAResult.idx - 1] : null;
      nearPointA = {
        idx: closestAResult.idx,
        x: scaleX(closestAResult.point.x),
        y: scaleY(closestAResult.point.y),
        delta: prevA ? closestAResult.point.y - prevA.y : undefined,
      };
    }

    let nearPointB: NearPoint | undefined = undefined;
    if (closestBResult && closestBResult.dist < nearThreshold) {
      const prevB = closestBResult.idx > 0 ? pointsB[closestBResult.idx - 1] : null;
      nearPointB = {
        idx: closestBResult.idx,
        x: scaleX(closestBResult.point.x),
        y: scaleY(closestBResult.point.y),
        delta: prevB ? closestBResult.point.y - prevB.y : undefined,
      };
    }

    setHover({
      time: new Date(targetMs),
      valueA: closestAResult?.point.y,
      valueB: closestBResult?.point.y,
      nearPointA,
      nearPointB,
    });
  }, [paddingLeft, paddingRight, xMin, xMax, pointsA, pointsB, scaleX, scaleY]);

  const onMouseLeave = useCallback(() => {
    setHover(null);
  }, []);

  return (
    <div className="h-full relative">
      {!hasData ? (
        <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
          No TLE epochs in range ±{rangeDays}d
        </div>
      ) : (
        <>
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full cursor-crosshair"
          onClick={onClick}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
            {/* Axes */}
            <line
              x1={paddingLeft}
              x2={viewBoxWidth - paddingRight}
              y1={viewBoxHeight - paddingBottom}
              y2={viewBoxHeight - paddingBottom}
              stroke="#374151"
              strokeWidth="1"
            />
            <line
              x1={paddingLeft}
              x2={paddingLeft}
              y1={paddingTop}
              y2={viewBoxHeight - paddingBottom}
              stroke="#374151"
              strokeWidth="1"
            />

            {/* Grid + ticks */}
            {xTicks.map((t, idx) => {
              const x = scaleX(t);
              return (
                <g key={`x-${idx}`}>
                  <line x1={x} x2={x} y1={paddingTop} y2={viewBoxHeight - paddingBottom} stroke="#1f2937" strokeWidth="0.5" />
                  <text x={x} y={viewBoxHeight - paddingBottom + 12} fontSize="10" fill="#9ca3af" textAnchor="middle">
                    {formatAxisLabel(t)}
                  </text>
                </g>
              );
            })}
            {yTicks.map((t, idx) => {
              const y = scaleY(t);
              return (
                <g key={`y-${idx}`}>
                  <line x1={paddingLeft} x2={viewBoxWidth - paddingRight} y1={y} y2={y} stroke="#1f2937" strokeWidth="0.5" />
                  <text x={paddingLeft - 6} y={y + 3} fontSize="10" fill="#9ca3af" textAnchor="end">
                    {formatTick(t)} {metricInfo.unit}
                  </text>
                </g>
              );
            })}

            {/* Paths */}
            {pointsA.length > 0 && (
              <path d={path(pointsA)} fill="none" stroke="#3b82f6" strokeWidth="2" />
            )}
            {pointsB.length > 0 && (
              <path d={path(pointsB)} fill="none" stroke="#ef4444" strokeWidth="2" />
            )}

            {/* Points */}
            {pointsA.map((p, idx) => (
              <g key={`a-${idx}`}>
                <circle cx={scaleX(p.x)} cy={scaleY(p.y)} r={3} fill="#3b82f6" />
              </g>
            ))}
            {pointsB.map((p, idx) => (
              <g key={`b-${idx}`}>
                <circle cx={scaleX(p.x)} cy={scaleY(p.y)} r={3} fill="#ef4444" />
              </g>
            ))}

            {/* Current marker */}
            <line
              x1={scaleX(currentTime.getTime())}
              x2={scaleX(currentTime.getTime())}
              y1={paddingTop}
              y2={viewBoxHeight - paddingBottom}
              stroke="#60a5fa"
              strokeDasharray="4 4"
            />
            <line
              x1={scaleX(anchorMs)}
              x2={scaleX(anchorMs)}
              y1={paddingTop}
              y2={viewBoxHeight - paddingBottom}
              stroke="#fbbf24"
              strokeDasharray="4 4"
            />

            {/* Hover indicator */}
            {hover && (() => {
              const hoverX = scaleX(hover.time.getTime());
              return (
                <>
                  <line
                    x1={hoverX}
                    x2={hoverX}
                    y1={paddingTop}
                    y2={viewBoxHeight - paddingBottom}
                    stroke="#9ca3af"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  {hover.valueA !== undefined && (
                    <circle cx={hoverX} cy={scaleY(hover.valueA)} r={5} fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
                  )}
                  {hover.valueB !== undefined && (
                    <circle cx={hoverX} cy={scaleY(hover.valueB)} r={5} fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                  )}

                  {/* Floating callout for series A */}
                  {hover.nearPointA && (
                    <g>
                      <rect
                        x={hover.nearPointA.x + 8}
                        y={hover.nearPointA.y + 8}
                        width={hover.nearPointA.delta !== undefined ? 120 : 70}
                        height={20}
                        rx={3}
                        fill="#1e3a5f"
                        stroke="#3b82f6"
                        strokeWidth="1"
                      />
                      <text
                        x={hover.nearPointA.x + 14}
                        y={hover.nearPointA.y + 22}
                        fontSize="11"
                        fill="#3b82f6"
                        fontFamily="monospace"
                      >
                        {formatValue(pointsA[hover.nearPointA.idx]!.y)}
                        {hover.nearPointA.delta !== undefined && (
                          <tspan fill="#60a5fa"> ({formatDelta(hover.nearPointA.delta)})</tspan>
                        )}
                      </text>
                    </g>
                  )}

                  {/* Floating callout for series B */}
                  {hover.nearPointB && (
                    <g>
                      <rect
                        x={hover.nearPointB.x + 8}
                        y={hover.nearPointB.y + 8}
                        width={hover.nearPointB.delta !== undefined ? 120 : 70}
                        height={20}
                        rx={3}
                        fill="#3f1f1f"
                        stroke="#ef4444"
                        strokeWidth="1"
                      />
                      <text
                        x={hover.nearPointB.x + 14}
                        y={hover.nearPointB.y + 22}
                        fontSize="11"
                        fill="#ef4444"
                        fontFamily="monospace"
                      >
                        {formatValue(pointsB[hover.nearPointB.idx]!.y)}
                        {hover.nearPointB.delta !== undefined && (
                          <tspan fill="#f87171"> ({formatDelta(hover.nearPointB.delta)})</tspan>
                        )}
                      </text>
                    </g>
                  )}
                </>
              );
            })()}
          </svg>
        {hover && (
          <div className="absolute bottom-1 right-2 text-[10px] font-mono bg-gray-900/80 px-1.5 py-0.5 rounded flex items-center gap-1.5">
            <span className="text-gray-400">{formatHoverTime(hover.time)}</span>
            <span className="text-gray-600">·</span>
            <span style={{ color: '#3b82f6' }}>A: {hover.valueA !== undefined ? formatValue(hover.valueA) : '–'}</span>
            <span className="text-gray-600">·</span>
            <span style={{ color: '#ef4444' }}>B: {hover.valueB !== undefined ? formatValue(hover.valueB) : '–'}</span>
            {metricInfo.unit && <span className="text-gray-500">{metricInfo.unit}</span>}
          </div>
        )}
        </>
      )}
    </div>
  );
}
