import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import type { SatelliteTLE, Conjunction } from '../../types/satellite';
import { sampleDistanceCurve, findConjunctions, type DistanceSample } from '../../lib/conjunctions';

interface FullscreenDistanceGraphProps {
  isOpen: boolean;
  onClose: () => void;
  tlesA: SatelliteTLE[];
  tlesB: SatelliteTLE[];
  anchorTime: Date;
  rangeDays: number;
  currentTime: Date;
  onTimeChange: (time: Date) => void;
}

export function FullscreenDistanceGraph({
  isOpen,
  onClose,
  tlesA,
  tlesB,
  anchorTime,
  rangeDays,
  currentTime,
  onTimeChange,
}: FullscreenDistanceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoverInfo, setHoverInfo] = useState<{ time: Date; distance: number } | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Compute time window
  const startTime = useMemo(
    () => new Date(anchorTime.getTime() - rangeDays * 24 * 60 * 60 * 1000),
    [anchorTime, rangeDays]
  );
  const endTime = useMemo(
    () => new Date(anchorTime.getTime() + rangeDays * 24 * 60 * 60 * 1000),
    [anchorTime, rangeDays]
  );

  // High-density sampling at 30-second intervals for smooth curve (~17k points for 6 days)
  const samples = useMemo(() => {
    if (!isOpen || !tlesA.length || !tlesB.length) return [];
    const totalSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
    const sampleCount30s = Math.ceil(totalSeconds / 30) + 1;
    return sampleDistanceCurve(tlesA, tlesB, startTime, endTime, sampleCount30s);
  }, [isOpen, tlesA, tlesB, startTime, endTime]);

  // Conjunction points computed separately for red dot markers
  const localConjunctions = useMemo(() => {
    if (!isOpen || !tlesA.length || !tlesB.length) return [];
    return findConjunctions({
      tlesA,
      tlesB,
      startTime,
      endTime,
      options: { coarseStepSeconds: 30 },
    });
  }, [isOpen, tlesA, tlesB, startTime, endTime]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Resize observer
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // Reset zoom handler
  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity);
    setZoomLevel(1);
  }, []);

  // D3 chart rendering
  useEffect(() => {
    if (!isOpen || !svgRef.current || !samples.length || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    const margin = { top: 30, right: 50, bottom: 60, left: 80 };
    const width = dimensions.width;
    const height = dimensions.height;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous render
    svg.selectAll('*').remove();

    // Create chart group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Clip path for zooming
    svg.append('defs').append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    // Scales
    const xScale = d3.scaleTime()
      .domain([startTime, endTime])
      .range([0, innerWidth]);

    const yMax = d3.max(samples, d => d.distance) || 1000;
    const yMin = d3.min(samples, d => d.distance) || 0;
    const yPadding = (yMax - yMin) * 0.1;
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, yMin - yPadding), yMax + yPadding])
      .range([innerHeight, 0]);

    // Store original scales for zoom reset
    const xScaleOrig = xScale.copy();

    // Axes - ticks every 12 hours
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d => d3.utcFormat('%b %d %H:%M')(d as Date))
      .ticks(d3.utcHour.every(12));
    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d => `${d} km`)
      .ticks(Math.floor(innerHeight / 50));

    const xAxisG = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.selectAll('text')
      .attr('fill', '#9ca3af')
      .attr('font-size', '11px');
    xAxisG.selectAll('line').attr('stroke', '#374151');
    xAxisG.select('.domain').attr('stroke', '#374151');

    const yAxisG = g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);

    yAxisG.selectAll('text')
      .attr('fill', '#9ca3af')
      .attr('font-size', '11px');
    yAxisG.selectAll('line').attr('stroke', '#374151');
    yAxisG.select('.domain').attr('stroke', '#374151');

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yScale.ticks(Math.floor(innerHeight / 50)))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 0.5);

    // Chart area with clipping
    const chartArea = g.append('g')
      .attr('clip-path', 'url(#chart-clip)');

    // Line generator
    const line = d3.line<DistanceSample>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.distance))
      .curve(d3.curveMonotoneX);

    // Distance path
    chartArea.append('path')
      .datum(samples)
      .attr('class', 'distance-line')
      .attr('fill', 'none')
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Anchor time marker
    chartArea.append('line')
      .attr('class', 'anchor-marker')
      .attr('stroke', '#fbbf24')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 4')
      .attr('x1', xScale(anchorTime))
      .attr('x2', xScale(anchorTime))
      .attr('y1', 0)
      .attr('y2', innerHeight);

    // Current time marker
    const currentMarker = chartArea.append('line')
      .attr('class', 'current-marker')
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 2)
      .attr('x1', xScale(currentTime))
      .attr('x2', xScale(currentTime))
      .attr('y1', 0)
      .attr('y2', innerHeight);

    // Conjunction points (smaller circles) - use locally computed conjunctions for consistency
    const visibleConjunctions = localConjunctions;
    chartArea.selectAll('.conjunction-point')
      .data(visibleConjunctions)
      .join('circle')
      .attr('class', 'conjunction-point')
      .attr('cx', d => xScale(d.time))
      .attr('cy', d => yScale(d.distance))
      .attr('r', 4)
      .attr('fill', '#ef4444')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    // Conjunction callout group (initially hidden)
    const conjCallout = chartArea.append('g')
      .attr('class', 'conjunction-callout')
      .style('visibility', 'hidden');

    conjCallout.append('rect')
      .attr('class', 'callout-bg')
      .attr('rx', 4)
      .attr('fill', 'rgba(17, 24, 39, 0.95)')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1);

    conjCallout.append('text')
      .attr('class', 'callout-time')
      .attr('fill', '#9ca3af')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    conjCallout.append('text')
      .attr('class', 'callout-distance')
      .attr('fill', '#ef4444')
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold');

    // Tooltip elements
    const tooltipLine = chartArea.append('line')
      .attr('class', 'tooltip-line')
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('visibility', 'hidden');

    const tooltipCircle = chartArea.append('circle')
      .attr('class', 'tooltip-circle')
      .attr('r', 5)
      .attr('fill', '#22c55e')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('visibility', 'hidden');

    const tooltip = d3.select(containerRef.current)
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(17, 24, 39, 0.95)')
      .style('border', '1px solid #374151')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('color', 'white')
      .style('font-size', '12px')
      .style('font-family', 'monospace')
      .style('pointer-events', 'none')
      .style('z-index', '10000');

    // Bisector for finding closest point
    const bisect = d3.bisector<DistanceSample, Date>(d => d.time).left;

    // Current xScale (mutated by zoom)
    let currentXScale = xScale;

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 50])
      .translateExtent([[0, 0], [width, height]])
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on('zoom', (event) => {
        currentXScale = event.transform.rescaleX(xScaleOrig);
        setZoomLevel(event.transform.k);

        // Update x-axis
        xAxisG.call(xAxis.scale(currentXScale));
        xAxisG.selectAll('text').attr('fill', '#9ca3af');
        xAxisG.selectAll('line').attr('stroke', '#374151');

        // Update line
        const updatedLine = d3.line<DistanceSample>()
          .x(d => currentXScale(d.time))
          .y(d => yScale(d.distance))
          .curve(d3.curveMonotoneX);
        chartArea.select('.distance-line')
          .attr('d', updatedLine(samples));

        // Update markers
        chartArea.select('.anchor-marker')
          .attr('x1', currentXScale(anchorTime))
          .attr('x2', currentXScale(anchorTime));

        currentMarker
          .attr('x1', currentXScale(currentTime))
          .attr('x2', currentXScale(currentTime));

        // Update conjunctions
        chartArea.selectAll('.conjunction-point')
          .attr('cx', (d: unknown) => currentXScale((d as Conjunction).time));
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Hover overlay for interactions
    const overlay = g.append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    overlay.on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const x0 = currentXScale.invert(mx);
      const i = bisect(samples, x0, 1);
      const d0 = samples[i - 1];
      const d1 = samples[i];
      const d = d0 && d1 && (x0.getTime() - d0.time.getTime() > d1.time.getTime() - x0.getTime()) ? d1 : d0;

      if (d) {
        const px = currentXScale(d.time);
        const py = yScale(d.distance);

        // Update hover info for bottom-right display
        setHoverInfo({ time: d.time, distance: d.distance });

        tooltipLine
          .attr('x1', px)
          .attr('x2', px)
          .style('visibility', 'visible');

        tooltipCircle
          .attr('cx', px)
          .attr('cy', py)
          .style('visibility', 'visible');

        // Hide floating tooltip (we show info at bottom-right instead)
        tooltip.style('visibility', 'hidden');

        // Find nearest conjunction within threshold
        const domain = currentXScale.domain();
        const nearThreshold = (domain[1]!.getTime() - domain[0]!.getTime()) * 0.02;
        const nearestConj = visibleConjunctions.reduce<Conjunction | null>((best, c) => {
          const dist = Math.abs(c.time.getTime() - x0.getTime());
          if (dist < nearThreshold) {
            if (!best || dist < Math.abs(best.time.getTime() - x0.getTime())) {
              return c;
            }
          }
          return best;
        }, null);

        if (nearestConj) {
          const cx = currentXScale(nearestConj.time);
          const cy = yScale(nearestConj.distance);
          const timeStr = nearestConj.time.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
          const distStr = nearestConj.distance.toFixed(2) + ' km';

          // Position callout to the right of the point
          const calloutX = cx + 10;
          const calloutY = cy - 20;
          const calloutW = 180;
          const calloutH = 38;

          conjCallout.style('visibility', 'visible');
          conjCallout.select('.callout-bg')
            .attr('x', calloutX)
            .attr('y', calloutY)
            .attr('width', calloutW)
            .attr('height', calloutH);
          conjCallout.select('.callout-time')
            .attr('x', calloutX + 8)
            .attr('y', calloutY + 14)
            .text(timeStr);
          conjCallout.select('.callout-distance')
            .attr('x', calloutX + 8)
            .attr('y', calloutY + 30)
            .text(distStr);
        } else {
          conjCallout.style('visibility', 'hidden');
        }
      }
    });

    overlay.on('mouseleave', () => {
      tooltipLine.style('visibility', 'hidden');
      tooltipCircle.style('visibility', 'hidden');
      tooltip.style('visibility', 'hidden');
      conjCallout.style('visibility', 'hidden');
      setHoverInfo(null);
    });

    overlay.on('click', (event) => {
      const [mx] = d3.pointer(event);
      const clickedTime = currentXScale.invert(mx);
      onTimeChange(clickedTime);
    });

    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [isOpen, samples, dimensions, startTime, endTime, anchorTime, currentTime, localConjunctions, onTimeChange]);

  // Update current time marker on time change
  useEffect(() => {
    if (!svgRef.current || !isOpen) return;
    // The marker updates are handled in the zoom callback via currentXScale
  }, [currentTime, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Distance Graph - Fullscreen View"
      className="fixed inset-0 z-[9999] bg-gray-900 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
        <h2 className="text-white text-lg font-medium">
          Distance Graph
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm font-mono">
            {samples.length.toLocaleString()} samples | Zoom: {zoomLevel.toFixed(1)}x
          </span>
          <button
            onClick={handleResetZoom}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
          >
            Reset Zoom
          </button>
          <button
            onClick={onClose}
            aria-label="Close fullscreen view"
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {samples.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            No data available
          </div>
        ) : (
          <>
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              className="bg-gray-900"
            />
            {/* Bottom-right hover info */}
            {hoverInfo && (
              <div className="absolute bottom-2 right-3 text-[11px] font-mono text-gray-400 bg-gray-900/90 px-2 py-1 rounded border border-gray-700">
                {hoverInfo.time.toISOString().replace('T', ' ').slice(0, 19)} UTC · {hoverInfo.distance.toFixed(2)} km
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-gray-700 bg-gray-800 flex items-center gap-6 text-sm text-gray-400">
        <span>Scroll to zoom | Drag to pan | Click to set time</span>
        <span className="text-gray-600">|</span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-0.5 bg-green-500"></span>
          Distance
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-0.5 bg-blue-400"></span>
          Current time
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-0.5 bg-yellow-500" style={{ borderBottom: '2px dashed #fbbf24', height: 0 }}></span>
          Anchor time
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
          Conjunction
        </span>
      </div>
    </div>,
    document.body
  );
}
