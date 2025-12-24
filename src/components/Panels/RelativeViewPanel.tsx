import { useMemo, useState, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Line, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { SatellitePosition, SatelliteTLE, ECIPosition } from '../../types/satellite';
import { EARTH_RADIUS_KM } from '../../lib/orbit';
import { computePhaseAngle } from '../../lib/relativeView';
import { magnitude, normalize, subtract } from '../../lib/vectorMath';
import { calculateSunPosition } from '../../lib/sun';
import { Earth } from '../Globe/Earth';

interface RelativeViewPanelProps {
  positionA: SatellitePosition | null;
  positionB: SatellitePosition | null;
  tleA: SatelliteTLE | null;
  tleB: SatelliteTLE | null;
  currentTime: Date;
  orbitPathB: ECIPosition[];
}

// FoV presets in degrees
// Narrow FoVs for target tracking, wide for context
const FOV_PRESETS = [
  { value: 0.5 / 60, label: "0.5′" },    // 0.5 arcmin - very narrow
  { value: 3 / 60, label: "3′" },        // 3 arcmin
  { value: 20 / 60, label: "20′" },      // 20 arcmin
  { value: 2, label: "2°" },             // 2 degrees
  { value: 90, label: "90°" },           // 90 degrees - shows Earth
];
// Target rendered as three rectangular segments with gaps:
// 12.8m + 0.5m gap + 2.7m + 0.5m gap + 12.8m
const TARGET_SEGMENTS_M = [12.8, 2.7, 12.8];
const TARGET_GAP_M = 0.5;
const TARGET_TOTAL_WIDTH_M = TARGET_SEGMENTS_M.reduce((a, b) => a + b, 0) + TARGET_GAP_M * 2; // 12.8 + 0.5 + 2.7 + 0.5 + 12.8
const TARGET_HEIGHT_M = 4.1;
const TARGET_FILL_FRACTION = 0.5; // target spans ~50% of panel width/height in autofit
const MIN_FOV_DEG = 0.001;

export function RelativeViewPanel({ positionA, positionB, tleA, tleB, currentTime, orbitPathB }: RelativeViewPanelProps) {
  const [fov, setFov] = useState<number>(45);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const [showSunLine, setShowSunLine] = useState<boolean>(true);
  const [showTrack, setShowTrack] = useState<boolean>(true);
  const [showVelocity, setShowVelocity] = useState<boolean>(true);
  const [showNadir, setShowNadir] = useState<boolean>(true);

  // Suppress unused variable warnings - these are kept for potential future use
  void tleA;
  void tleB;

  const derived = useMemo(() => {
    if (!positionA || !positionB) return null;
    const rel = subtract(positionB.eci, positionA.eci);
    const rangeKmRaw = magnitude(rel);
    const rangeKm = Number.isFinite(rangeKmRaw) ? rangeKmRaw : EARTH_RADIUS_KM;
    const sunEci = calculateSunPosition(currentTime);
    const phaseAngleDeg = computePhaseAngle(positionA.eci, positionB.eci, sunEci);

    return {
      rangeKm,
      phaseAngleDeg,
    };
  }, [currentTime, positionA, positionB]);

  const autoFov = derived ? pickFov(derived.rangeKm, true, fov) : fov;
  const displayFov = autoFit && derived ? autoFov : fov;

  const fovRad = (displayFov * Math.PI) / 180;
  const displaySpanM = derived
    ? 2 * derived.rangeKm * 1000 * Math.tan(fovRad / 2)
    : null;

  const formatSpan = (meters: number | null) => {
    if (meters === null) return '';
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${meters.toFixed(0)} m`;
  };

  const formatFov = (deg: number) => {
    if (deg >= 1) return `${deg.toFixed(0)}°`;
    return `${(deg * 60).toFixed(1)}′`;
  };

  const fovButtons = (
    <div className="flex gap-1 flex-wrap">
      {FOV_PRESETS.map(preset => (
        <button
          key={preset.value}
          onClick={() => {
            setAutoFit(false);
            setFov(preset.value);
          }}
          className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
            !autoFit && fov === preset.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          title={`${preset.value}° FoV`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-3 text-sm text-gray-200">
      {/* FoV Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={autoFit}
              onChange={e => setAutoFit(e.target.checked)}
              className="accent-blue-500"
            />
            Auto FoV
          </label>
          <span className="text-[11px] text-gray-500">|</span>
          {fovButtons}
        </div>
        <div className="text-[11px] text-gray-400 font-mono">
          {formatFov(displayFov)}{autoFit && derived ? ' (auto)' : ''}
        </div>
      </div>

      {!derived ? (
        <div className="text-gray-500 text-sm text-center py-8">Select both satellites to view.</div>
      ) : (
        <>
          {/* 3D Canvas */}
          <div className="h-56 bg-black rounded overflow-hidden mb-3 relative">
            <RelativeViewCanvas
              positionA={positionA!}
              positionB={positionB!}
              currentTime={currentTime}
              fov={displayFov}
              showSunLine={showSunLine}
              showTrack={showTrack}
              showVelocity={showVelocity}
              showNadir={showNadir}
              orbitPathB={orbitPathB}
            />
            <div className="absolute top-1.5 left-2 text-[10px] text-gray-300 bg-black/70 px-1.5 py-0.5 rounded pointer-events-none font-mono">
              N ↑
            </div>
            <div className="absolute bottom-1.5 right-2 text-[10px] text-gray-300 bg-black/70 px-1.5 py-0.5 rounded pointer-events-none font-mono">
              {formatFov(displayFov)} · {formatSpan(displaySpanM)}
            </div>
          </div>

          {/* Display Options */}
          <div className="flex flex-wrap gap-3 mb-3 text-[11px]">
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer hover:text-white transition-colors">
              <input type="checkbox" checked={showSunLine} onChange={e => setShowSunLine(e.target.checked)} className="accent-blue-500" />
              Sun
            </label>
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer hover:text-white transition-colors">
              <input type="checkbox" checked={showNadir} onChange={e => setShowNadir(e.target.checked)} className="accent-blue-500" />
              Nadir
            </label>
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer hover:text-white transition-colors">
              <input type="checkbox" checked={showTrack} onChange={e => setShowTrack(e.target.checked)} className="accent-blue-500" />
              Track
            </label>
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer hover:text-white transition-colors">
              <input type="checkbox" checked={showVelocity} onChange={e => setShowVelocity(e.target.checked)} className="accent-blue-500" />
              Velocity
            </label>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="bg-gray-800/50 px-2 py-1.5 rounded">
              <div className="text-gray-500 text-[10px]">Range</div>
              <div className="text-white font-mono">{derived.rangeKm.toFixed(1)} km</div>
            </div>
            <div className="bg-gray-800/50 px-2 py-1.5 rounded">
              <div className="text-gray-500 text-[10px]">Phase</div>
              <div className="text-white font-mono">{derived.phaseAngleDeg.toFixed(1)}°</div>
            </div>
            <div className="bg-gray-800/50 px-2 py-1.5 rounded">
              <div className="text-gray-500 text-[10px]">Span</div>
              <div className="text-white font-mono">{formatSpan(displaySpanM)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function pickFov(rangeKm: number, autoFit: boolean, manualFov: number): number {
  if (!autoFit) return manualFov;
  if (rangeKm <= 0) return manualFov;
  const rangeM = rangeKm * 1000;
  const sizeWidthM = TARGET_TOTAL_WIDTH_M;
  const sizeHeightM = TARGET_HEIGHT_M;
  const angularWidth = 2 * Math.atan(sizeWidthM / (2 * rangeM));
  const angularHeight = 2 * Math.atan(sizeHeightM / (2 * rangeM));
  const angularSize = Math.max(angularWidth, angularHeight); // radians
  const fovRad = angularSize / TARGET_FILL_FRACTION;
  const fovDeg = (fovRad * 180) / Math.PI;
  return Math.max(MIN_FOV_DEG, Math.min(120, fovDeg));
}

interface RelativeViewCanvasProps {
  positionA: SatellitePosition;
  positionB: SatellitePosition;
  currentTime: Date;
  fov: number;
  showSunLine: boolean;
  showTrack: boolean;
  showVelocity: boolean;
  showNadir: boolean;
  orbitPathB: ECIPosition[];
}

// Convert ECI to Three.js with scaling (camera-relative coordinate system)
function eciToThreeScaled(vec: { x: number; y: number; z: number }, scale: number): [number, number, number] {
  return [vec.x * scale, vec.z * scale, -vec.y * scale];
}

function RelativeViewCanvas({
  positionA,
  positionB,
  currentTime,
  fov,
  showSunLine,
  showTrack,
  showVelocity,
  showNadir,
  orbitPathB,
}: RelativeViewCanvasProps) {
  // Compute relative position and scaling
  const rel = useMemo(() => subtract(positionB.eci, positionA.eci), [positionA.eci, positionB.eci]);
  const rangeKm = useMemo(() => {
    const r = magnitude(rel);
    return Number.isFinite(r) ? r : EARTH_RADIUS_KM;
  }, [rel]);

  // Scale so the scene fits nicely - relative coords centered at camera
  const scale = useMemo(() => 1 / Math.max(rangeKm, EARTH_RADIUS_KM), [rangeKm]);

  // Satellite B position in scaled Three.js coords (camera at origin)
  const relThree = useMemo(() => eciToThreeScaled(rel, scale), [rel, scale]);

  // Earth position (negative of A's position, scaled)
  const earthPos = useMemo(() => ({
    x: -positionA.eci.x,
    y: -positionA.eci.y,
    z: -positionA.eci.z,
  }), [positionA.eci]);
  const earthThree = useMemo(() => eciToThreeScaled(earthPos, scale), [earthPos, scale]);
  const earthRadiusScaled = EARTH_RADIUS_KM * scale;

  // Sun direction (normalized, for lighting)
  const sunEci = useMemo(() => calculateSunPosition(currentTime), [currentTime]);
  const sunDirThree = useMemo(() => {
    const vec = eciToThreeScaled(normalize(sunEci), 1);
    const v = new THREE.Vector3(...vec);
    return v.length() === 0 ? new THREE.Vector3(0, 0, 1) : v.normalize();
  }, [sunEci]);

  // Sun direction from B (for sun line indicator)
  const sunFromBDir = useMemo(() => {
    const dir = subtract(sunEci, positionB.eci);
    const vec = eciToThreeScaled(normalize(dir), 1);
    const v = new THREE.Vector3(...vec);
    return v.length() === 0 ? new THREE.Vector3(0, 0, 1) : v.normalize();
  }, [sunEci, positionB.eci]);

  // DESIGN DECISION: "Camera-at-A" model
  // We show B's absolute orbit translated so A is at origin, NOT true relative motion.
  // True relative motion (B(t)-A(t) sampled over time) produces complex curves that
  // users found confusing. This approach shows "what B's orbit looks like from A's
  // current position" - like mounting a camera on A. Each frame updates as A moves.
  // Consequence: velocity arrow, orbit tangent, and panel orientation all use
  // absolute velocity for internal consistency.
  const velocityDir = useMemo(() => {
    const vec = eciToThreeScaled(positionB.velocity, 1);
    const v = new THREE.Vector3(...vec);
    return v.length() === 0 ? null : v.normalize();
  }, [positionB.velocity]);

  // Transform B's orbit path to camera-centered coords
  // For narrow FoVs (< 10°), only show segment nearest to satellite
  const trackPoints = useMemo(() => {
    if (orbitPathB.length === 0) return [];

    // Transform all points to camera-relative coords
    const allPoints = orbitPathB.map(p => {
      const relToA = {
        x: p.x - positionA.eci.x,
        y: p.y - positionA.eci.y,
        z: p.z - positionA.eci.z,
      };
      return eciToThreeScaled(relToA, scale);
    });

    // For wide FoV, show full track
    if (fov >= 10) return allPoints;

    // For narrow FoV, find the point closest to B's current position and show segment around it
    const bPos = positionB.eci;
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < orbitPathB.length; i++) {
      const p = orbitPathB[i]!;
      const dx = p.x - bPos.x;
      const dy = p.y - bPos.y;
      const dz = p.z - bPos.z;
      const dist = dx * dx + dy * dy + dz * dz;
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    // Take ~10% of orbit on each side (about 36 points each way for 360-point orbit)
    const segmentSize = Math.max(20, Math.floor(orbitPathB.length * 0.1));
    const startIdx = Math.max(0, closestIdx - segmentSize);
    const endIdx = Math.min(orbitPathB.length - 1, closestIdx + segmentSize);

    return allPoints.slice(startIdx, endIdx + 1);
  }, [orbitPathB, positionA.eci, positionB.eci, scale, fov]);

  // Panel size for satellite body
  const panelSize = useMemo(() => ({
    width: (TARGET_TOTAL_WIDTH_M / 1000) * scale,
    height: (TARGET_HEIGHT_M / 1000) * scale,
  }), [scale]);

  // Panel rotation based on velocity and sun
  const panelRotation = useMemo(() => {
    const q = new THREE.Quaternion();
    const longAxis = velocityDir ?? new THREE.Vector3(1, 0, 0);
    if (longAxis.length() === 0) return q;
    const sunProj = sunFromBDir.clone().sub(longAxis.clone().multiplyScalar(sunFromBDir.dot(longAxis)));
    const normalAxis = sunProj.length() > 0 ? sunProj.normalize() : new THREE.Vector3(0, 0, 1);
    const shortAxis = normalAxis.clone().cross(longAxis).normalize();
    const correctedNormal = longAxis.clone().cross(shortAxis).normalize();
    if (shortAxis.length() === 0 || correctedNormal.length() === 0) return q;
    const m = new THREE.Matrix4();
    m.set(
      longAxis.x, shortAxis.x, correctedNormal.x, 0,
      longAxis.y, shortAxis.y, correctedNormal.y, 0,
      longAxis.z, shortAxis.z, correctedNormal.z, 0,
      0, 0, 0, 1
    );
    q.setFromRotationMatrix(m);
    return q;
  }, [sunFromBDir, velocityDir]);

  // Earth visibility check - only render if Earth is geometrically in FoV
  const earthVisible = useMemo(() => {
    const fovRad = (fov * Math.PI) / 180;
    // View direction (camera at origin looking at satellite B)
    const viewDir = normalize(rel);
    // Earth direction (from camera to Earth center)
    const earthDir = normalize(earthPos);
    // Angle between view and Earth
    const dot = viewDir.x * earthDir.x + viewDir.y * earthDir.y + viewDir.z * earthDir.z;
    const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
    // Earth angular radius from camera
    const earthDistance = magnitude(earthPos);
    if (earthDistance <= EARTH_RADIUS_KM) return true; // Inside Earth (shouldn't happen)
    const earthAngular = Math.asin(Math.min(1, EARTH_RADIUS_KM / earthDistance));
    // Earth is visible if within half-FoV + Earth's angular radius
    return angle <= fovRad / 2 + earthAngular;
  }, [fov, rel, earthPos]);

  // Use full textured Earth only for wide FoVs (>= 10°), otherwise lightweight proxy
  const useFullEarth = fov >= 10;

  return (
    <Canvas>
      <Suspense fallback={null}>
        <RelativeScene
          relThree={relThree}
          earthThree={earthThree}
          earthRadiusScaled={earthRadiusScaled}
          currentTime={currentTime}
          sunDirThree={sunDirThree}
          sunFromBDir={sunFromBDir}
          fov={fov}
          showSunLine={showSunLine}
          showTrack={showTrack}
          showVelocity={showVelocity}
          showNadir={showNadir}
          trackPoints={trackPoints}
          velocityDir={velocityDir}
          panelSize={panelSize}
          panelRotation={panelRotation}
          scale={scale}
          earthVisible={earthVisible}
          useFullEarth={useFullEarth}
        />
      </Suspense>
    </Canvas>
  );
}

interface RelativeSceneProps {
  relThree: [number, number, number];
  earthThree: [number, number, number];
  earthRadiusScaled: number;
  currentTime: Date;
  sunDirThree: THREE.Vector3;
  sunFromBDir: THREE.Vector3;
  fov: number;
  showSunLine: boolean;
  showTrack: boolean;
  showVelocity: boolean;
  showNadir: boolean;
  trackPoints: [number, number, number][];
  velocityDir: THREE.Vector3 | null;
  panelSize: { width: number; height: number };
  panelRotation: THREE.Quaternion;
  scale: number;
  earthVisible: boolean;
  useFullEarth: boolean;
}

function RelativeScene({
  relThree,
  earthThree,
  earthRadiusScaled,
  currentTime,
  sunDirThree,
  sunFromBDir,
  fov,
  showSunLine,
  showTrack,
  showVelocity,
  showNadir,
  trackPoints,
  velocityDir,
  panelSize,
  panelRotation,
  scale,
  earthVisible,
  useFullEarth,
}: RelativeSceneProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  // Camera at origin, looking at satellite B
  useFrame(() => {
    if (cameraRef.current) {
      const cam = cameraRef.current;
      const viewVec = new THREE.Vector3(...relThree).normalize();
      const north = new THREE.Vector3(0, 1, 0);
      let up = north.clone().sub(viewVec.clone().multiplyScalar(north.dot(viewVec)));
      if (up.lengthSq() < 1e-6) {
        const east = new THREE.Vector3(1, 0, 0);
        up = east.clone().sub(viewVec.clone().multiplyScalar(east.dot(viewVec)));
      }
      if (up.lengthSq() < 1e-6) {
        up = new THREE.Vector3(0, 0, 1);
      }
      up.normalize();
      cam.up.copy(up);
      cam.position.set(0, 0, 0.00001);
      cam.lookAt(...relThree);
      cam.updateProjectionMatrix();
    }
  });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault fov={fov} near={1e-7} far={100} />
      <color attach="background" args={['#000008']} />

      {/* Lighting - same as main view */}
      <ambientLight intensity={0.08} />
      <directionalLight
        position={sunDirThree.clone().multiplyScalar(50).toArray() as [number, number, number]}
        intensity={3.2}
        color="#fffaf0"
      />
      <hemisphereLight args={['#87ceeb', '#000022', 0.2]} />

      {/* Starfield */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade />

      {/* Earth - only render if visible, use full component for wide FoV, lightweight for narrow */}
      {earthVisible && (
        useFullEarth ? (
          <group position={earthThree} scale={[earthRadiusScaled, earthRadiusScaled, earthRadiusScaled]}>
            <Earth currentTime={currentTime} showGrid={false} />
          </group>
        ) : (
          <mesh position={earthThree}>
            <sphereGeometry args={[earthRadiusScaled, 32, 32]} />
            <meshStandardMaterial color="#1e3a5f" />
          </mesh>
        )
      )}

      {/* Orbit track */}
      {showTrack && trackPoints.length > 1 && (
        <Line
          points={trackPoints}
          color="#22c55e"
          lineWidth={2}
        />
      )}

      {/* Satellite B body - solar panels */}
      <group position={relThree} quaternion={panelRotation}>
        {TARGET_SEGMENTS_M.map((segment, idx) => {
          const leftOffsetM =
            -TARGET_TOTAL_WIDTH_M / 2 +
            TARGET_SEGMENTS_M.slice(0, idx).reduce((a, b) => a + b, 0) +
            (idx > 0 ? idx * TARGET_GAP_M : 0) +
            segment / 2;
          const offsetX = (leftOffsetM / 1000) * scale;
          return (
            <mesh key={idx} position={[offsetX, 0, 0]} renderOrder={20}>
              <planeGeometry args={[(segment / 1000) * scale, panelSize.height]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#ff7f7f"
                emissiveIntensity={0.3}
                side={THREE.DoubleSide}
                depthTest={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* Nadir line from satellite to Earth center */}
      {showNadir && (
        <Line
          points={[relThree, earthThree]}
          color="#6b7280"
          lineWidth={1}
          dashed
          dashSize={0.25}
          gapSize={0.15}
        />
      )}

      {/* Sun direction from B */}
      {showSunLine && (
        <Line
          points={[
            relThree,
            [
              relThree[0] + sunFromBDir.x * 2,
              relThree[1] + sunFromBDir.y * 2,
              relThree[2] + sunFromBDir.z * 2,
            ],
          ]}
          color="#facc15"
          lineWidth={1}
          dashed
          dashSize={0.2}
          gapSize={0.1}
          renderOrder={6}
        />
      )}

      {/* Velocity direction (absolute - tangent to orbit track) */}
      {showVelocity && velocityDir && (() => {
        // Fixed visual length: half the view height at satellite distance
        const distToB = Math.sqrt(relThree[0] ** 2 + relThree[1] ** 2 + relThree[2] ** 2);
        const fovRad = (fov * Math.PI) / 180;
        const velocityLength = distToB * Math.tan(fovRad / 2); // half the view height
        const arrowHeadSize = velocityLength * 0.15; // arrowhead length
        const tip: [number, number, number] = [
          relThree[0] + velocityDir.x * velocityLength,
          relThree[1] + velocityDir.y * velocityLength,
          relThree[2] + velocityDir.z * velocityLength,
        ];
        // Create arrowhead by finding perpendicular direction
        const up = new THREE.Vector3(0, 1, 0);
        const perp = up.clone().cross(velocityDir).normalize();
        if (perp.length() < 0.01) {
          perp.set(1, 0, 0).cross(velocityDir).normalize();
        }
        const arrowLeft: [number, number, number] = [
          tip[0] - velocityDir.x * arrowHeadSize + perp.x * arrowHeadSize * 0.25,
          tip[1] - velocityDir.y * arrowHeadSize + perp.y * arrowHeadSize * 0.25,
          tip[2] - velocityDir.z * arrowHeadSize + perp.z * arrowHeadSize * 0.25,
        ];
        const arrowRight: [number, number, number] = [
          tip[0] - velocityDir.x * arrowHeadSize - perp.x * arrowHeadSize * 0.25,
          tip[1] - velocityDir.y * arrowHeadSize - perp.y * arrowHeadSize * 0.25,
          tip[2] - velocityDir.z * arrowHeadSize - perp.z * arrowHeadSize * 0.25,
        ];
        return (
          <>
            {/* Arrow shaft */}
            <Line
              points={[relThree, tip]}
              color="#4ade80"
              lineWidth={4}
              renderOrder={11}
            />
            {/* Arrowhead as lines */}
            <Line
              points={[arrowLeft, tip, arrowRight]}
              color="#4ade80"
              lineWidth={4}
              renderOrder={11}
            />
          </>
        );
      })()}
    </>
  );
}

