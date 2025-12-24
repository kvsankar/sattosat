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

const METRICS: Array<{ id: MetricId; label: string; unit: string }> = [
  { id: 'semiMajorAxis', label: 'Semi-major axis', unit: 'km' },
  { id: 'period', label: 'Period', unit: 'min' },
  { id: 'raan', label: 'RAAN', unit: '°' },
  { id: 'argOfPerigee', label: 'AoP', unit: '°' },
  { id: 'apogee', label: 'Apogee', unit: 'km' },
  { id: 'perigee', label: 'Perigee', unit: 'km' },
  { id: 'eccentricity', label: 'Eccentricity', unit: '' },
  { id: 'inclination', label: 'Inclination', unit: '°' },
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

  return (
    <div
      className="bg-gray-900/95 border border-gray-700 rounded-lg shadow-lg p-2 h-full w-full flex flex-col relative"
      style={{ minWidth: 320 }}
    >
      {onCollapse && (
        <button
          onClick={onCollapse}
          className="absolute top-2 right-2 text-gray-300 hover:text-white text-xs bg-gray-800/80 border border-gray-700 rounded px-2 py-0.5"
          title="Collapse timeline"
        >
          ↓
        </button>
      )}

      <div className="flex flex-wrap gap-1 mb-2 pr-6">
        <TabButton id="distance" active={activeTab} onSelect={setActiveTab} label="Relative distance" />
        {METRICS.map(m => (
          <TabButton key={m.id} id={m.id} active={activeTab} onSelect={setActiveTab} label={m.label} />
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'distance' ? (
          <DistanceTimeline
            samples={distanceSamples}
            currentTime={currentTime}
            anchorTime={anchorTime}
            rangeDays={rangeDays}
            onTimeChange={onTimeChange}
            height={height - 20}
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
            height={height - 20}
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
}: {
  id: MetricId | 'distance';
  active: MetricId | 'distance';
  onSelect: (id: MetricId | 'distance') => void;
  label: string;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`px-2 py-1 rounded text-[11px] border ${
        isActive
          ? 'bg-blue-600 text-white border-blue-500'
          : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
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

  const scaleX = (x: number) =>
    paddingLeft + ((x - xMin) / (xMax - xMin || 1)) * innerW;
  const scaleY = (y: number) =>
    paddingTop + innerH - ((y - yMin) / ySpan) * innerH;

  const path = (pts: typeof pointsA) =>
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(2)} ${scaleY(p.y).toFixed(2)}`)
      .join(' ');

  const formatTimeLabel = (ms: number) => {
    const d = new Date(ms);
    return d.toISOString().slice(5, 16).replace('T', ' ');
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

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-3 h-full">
      {!hasData ? (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
          No TLE epochs in range ±{rangeDays}d around anchor.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-gray-200 mb-1 pr-6">
            <div className="font-semibold">
              {metricInfo.label} ({metricInfo.unit || 'unitless'})
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-300">
              <span className="flex items-center gap-1"><span className="w-3 h-1 bg-blue-500 inline-block" /> A</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1 bg-red-500 inline-block" /> B</span>
            </div>
          </div>
          <svg
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            className="w-full h-full cursor-crosshair"
            onClick={onClick}
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
                    {formatTimeLabel(t)}
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
          </svg>
        </>
      )}
    </div>
  );
}
