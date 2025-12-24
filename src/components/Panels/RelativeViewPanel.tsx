import { useMemo, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { SatellitePosition, SatelliteTLE } from '../../types/satellite';
import { EARTH_RADIUS_KM, createSatrec } from '../../lib/orbit';
import { classifyEarthRelation, computePhaseAngle, computeSunForTime, generateRelativeOrbitTrack } from '../../lib/relativeView';
import { dot, magnitude, normalize, subtract } from '../../lib/vectorMath';

interface RelativeViewPanelProps {
  positionA: SatellitePosition | null;
  positionB: SatellitePosition | null;
  tleA: SatelliteTLE | null;
  tleB: SatelliteTLE | null;
  currentTime: Date;
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

export function RelativeViewPanel({ positionA, positionB, tleA, tleB, currentTime }: RelativeViewPanelProps) {
  const [fov, setFov] = useState<number>(45);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const [showLos, setShowLos] = useState<boolean>(true);
  const [showSunLine, setShowSunLine] = useState<boolean>(true);
  const [showTrack, setShowTrack] = useState<boolean>(true);
  const [showVelocity, setShowVelocity] = useState<boolean>(true);

  const satrecA = useMemo(() => {
    if (!tleA) return null;
    return createSatrec({ line1: tleA.line1, line2: tleA.line2 });
  }, [tleA]);

  const satrecB = useMemo(() => {
    if (!tleB) return null;
    return createSatrec({ line1: tleB.line1, line2: tleB.line2 });
  }, [tleB]);

  const derived = useMemo(() => {
    if (!positionA || !positionB) return null;
    const rel = subtract(positionB.eci, positionA.eci);
    const rangeKmRaw = magnitude(rel);
    const rangeKm = Number.isFinite(rangeKmRaw) ? rangeKmRaw : EARTH_RADIUS_KM;
    const sunEci = computeSunForTime(currentTime);
    const phaseAngleDeg = computePhaseAngle(positionA.eci, positionB.eci, sunEci);
    const earthInfo = classifyEarthRelation(positionA.eci, positionB.eci);
    const earthFromA = { x: -positionA.eci.x, y: -positionA.eci.y, z: -positionA.eci.z };

    // Scale so the largest object (Earth radius or range) is around unit size
    const scale = 1 / Math.max(rangeKm, EARTH_RADIUS_KM);
    return {
      rel,
      rangeKm,
      sunEci,
      sunFromB: subtract(sunEci, positionB.eci),
      phaseAngleDeg,
      earthInfo,
      scale,
      velB: subtract(positionB.velocity, positionA.velocity),
      earthFromA,
    };
  }, [currentTime, positionA, positionB]);

  const relativeTrackEci = useMemo(() => {
    if (!satrecA || !satrecB) return [];
    return generateRelativeOrbitTrack(satrecA, satrecB, currentTime);
  }, [currentTime, satrecA, satrecB]);

  const relativeTrack = useMemo(() => {
    if (!derived || relativeTrackEci.length === 0) return [];
    return relativeTrackEci.map(p => eciToThree(p, derived.scale));
  }, [derived, relativeTrackEci]);

  // Use the forward-looking half of the sampled orbit to avoid doubled lines
  const trackLinePoints = useMemo(() => {
    if (relativeTrack.length === 0) return [];
    const mid = Math.floor(relativeTrack.length / 2);
    const halfWindow = Math.floor(relativeTrack.length / 4); // show a symmetric segment around the current point
    const start = Math.max(0, mid - halfWindow);
    const end = Math.min(relativeTrack.length, mid + halfWindow + 1);
    return relativeTrack.slice(start, end);
  }, [relativeTrack]);

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

  const earthVisible = useMemo(() => {
    if (!derived) return false;
    const viewDir = normalize(derived.rel);
    const earthDir = normalize(derived.earthFromA);
    const cosTheta = clamp(dot(viewDir, earthDir), -1, 1);
    const angle = Math.acos(cosTheta);
    const earthDistance = magnitude(derived.earthFromA);
    if (earthDistance <= EARTH_RADIUS_KM) return true;
    const earthAngular = Math.asin(Math.min(1, EARTH_RADIUS_KM / earthDistance));
    return angle <= fovRad / 2 + earthAngular;
  }, [derived, fovRad]);

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
              rel={derived.rel}
              scale={derived.scale}
              sunEci={derived.sunEci}
              fov={displayFov}
              sunFromB={derived.sunFromB}
              velB={derived.velB}
              trackPoints={trackLinePoints}
              showLos={showLos}
              showSunLine={showSunLine}
              showTrack={showTrack}
              showVelocity={showVelocity}
              earthVisible={earthVisible}
              earthPosition={{
                x: -positionA!.eci.x,
                y: -positionA!.eci.y,
                z: -positionA!.eci.z,
              }}
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
              <input type="checkbox" checked={showLos} onChange={e => setShowLos(e.target.checked)} className="accent-blue-500" />
              LoS
            </label>
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer hover:text-white transition-colors">
              <input type="checkbox" checked={showSunLine} onChange={e => setShowSunLine(e.target.checked)} className="accent-blue-500" />
              Sun
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
  rel: { x: number; y: number; z: number };
  earthPosition: { x: number; y: number; z: number };
  earthVisible: boolean;
  scale: number;
  sunEci: { x: number; y: number; z: number };
  sunFromB: { x: number; y: number; z: number };
  velB?: { x: number; y: number; z: number };
  trackPoints: [number, number, number][];
  showLos: boolean;
  showSunLine: boolean;
  showTrack: boolean;
  showVelocity: boolean;
  fov: number;
}

function RelativeViewCanvas({
  rel,
  earthPosition,
  earthVisible,
  scale,
  sunEci,
  sunFromB,
  velB,
  trackPoints,
  showLos,
  showSunLine,
  showTrack,
  showVelocity,
  fov
}: RelativeViewCanvasProps) {
  const safeScale = Number.isFinite(scale) ? scale : 0;
  const relThree = useMemo(() => eciToThree(rel, safeScale), [rel, safeScale]);
  const earthThree = useMemo(() => eciToThree(earthPosition, safeScale), [earthPosition, safeScale]);
  const sunDirThree = useMemo(() => {
    const vec = eciToThree(normalize(sunEci), 1);
    const v = new THREE.Vector3(...vec);
    if (v.length() === 0) return new THREE.Vector3(0, 0, 1);
    return v.normalize();
  }, [sunEci]);
  const sunFromBDir = useMemo(() => {
    const vec = eciToThree(normalize(sunFromB), 1);
    const v = new THREE.Vector3(...vec);
    if (v.length() === 0) return new THREE.Vector3(0, 0, 1);
    return v.normalize();
  }, [sunFromB]);

  const panelSize = useMemo(() => {
    const width = (TARGET_TOTAL_WIDTH_M / 1000) * safeScale;
    const height = (TARGET_HEIGHT_M / 1000) * safeScale;
    return { width, height };
  }, [safeScale]);

  const earthRadiusScaled = EARTH_RADIUS_KM * safeScale;

  const velocityDir = useMemo(() => {
    if (!velB) return null;
    const vec = eciToThree(velB, 1);
    const v = new THREE.Vector3(...vec);
    if (v.length() === 0) return null;
    return v.normalize();
  }, [velB]);

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

  return (
    <Canvas>
      <RelativeScene
        fov={fov}
        relThree={relThree}
        earthThree={earthThree}
        earthRadiusScaled={earthRadiusScaled}
        scale={safeScale}
        panelRotation={panelRotation}
        panelSize={panelSize}
        sunDirThree={sunDirThree}
        sunFromBDir={sunFromBDir}
        velocityDir={velocityDir}
        showLos={showLos}
        showSunLine={showSunLine}
        showTrack={showTrack}
        showVelocity={showVelocity}
        trackPoints={trackPoints}
        earthVisible={earthVisible}
      />
    </Canvas>
  );
}

interface RelativeSceneProps {
  fov: number;
  relThree: [number, number, number];
  earthThree: [number, number, number];
  earthRadiusScaled: number;
  scale: number;
  panelRotation: THREE.Quaternion;
  panelSize: { width: number; height: number };
  sunDirThree: THREE.Vector3;
  sunFromBDir: THREE.Vector3;
  trackPoints?: [number, number, number][];
  velocityDir: THREE.Vector3 | null;
  showLos: boolean;
  showSunLine: boolean;
  showTrack: boolean;
  showVelocity: boolean;
  earthVisible: boolean;
}

function RelativeScene({
  fov,
  relThree,
  earthThree,
  earthRadiusScaled,
  scale,
  panelRotation,
  panelSize,
  sunDirThree,
  sunFromBDir,
  trackPoints = [],
  velocityDir,
  showLos,
  showSunLine,
  showTrack,
  showVelocity,
  earthVisible,
}: RelativeSceneProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  useFrame(() => {
    if (cameraRef.current) {
      const cam = cameraRef.current;
      const viewVec = new THREE.Vector3(relThree[0], relThree[1], relThree[2]).normalize();
      const north = new THREE.Vector3(0, 1, 0); // Earth +Z in Three coords
      let up = north.clone().sub(viewVec.clone().multiplyScalar(north.dot(viewVec))); // project north onto view plane
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
      cam.lookAt(relThree[0], relThree[1], relThree[2]);
      cam.updateProjectionMatrix();
    }
  });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault fov={fov} near={1e-6} far={50} />
      <color attach="background" args={['#05070d']} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={sunDirThree.clone().multiplyScalar(-10).toArray() as [number, number, number]}
        intensity={1.2}
        color="#fff9ec"
      />
      <group>
        {showTrack && trackPoints.length > 1 && (
          <Line
            points={trackPoints}
            color="#22c55e"
            lineWidth={2}
            renderOrder={0}
            depthTest={false}
            depthWrite={false}
          />
        )}
        {/* Satellite body container: solar | gap | antenna | gap | solar */}
        <group position={relThree} quaternion={panelRotation}>
          {TARGET_SEGMENTS_M.map((segment, idx) => {
            const leftOffsetM =
              -TARGET_TOTAL_WIDTH_M / 2 +
              TARGET_SEGMENTS_M.slice(0, idx).reduce((a, b) => a + b, 0) +
              (idx > 0 ? idx * TARGET_GAP_M : 0) +
              segment / 2;
            const offsetX = (leftOffsetM / 1000) * scale;
            return (
              <mesh key={idx} position={[offsetX, 0, 0]} renderOrder={5}>
                <planeGeometry args={[ (segment / 1000) * scale, panelSize.height ]} />
                <meshStandardMaterial
                  color="#ef4444"
                  emissive="#ff7f7f"
                  emissiveIntensity={0.3}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
        </group>
        {/* Sun direction indicator (thin dashed yellow) */}
        {showSunLine && (
          <Line
            points={[
              [relThree[0], relThree[1], relThree[2]],
              [relThree[0] + sunFromBDir.x * 2, relThree[1] + sunFromBDir.y * 2, relThree[2] + sunFromBDir.z * 2],
            ]}
            color="#facc15"
            lineWidth={1}
            dashed
            dashSize={0.2}
            gapSize={0.1}
            renderOrder={6}
          />
        )}
        {/* Nadir line from satellite to Earth center */}
        <Line
          points={[
            [relThree[0], relThree[1], relThree[2]],
            [earthThree[0], earthThree[1], earthThree[2]],
          ]}
          color="#6b7280"
          lineWidth={1}
          dashed
          dashSize={0.25}
          gapSize={0.15}
          renderOrder={6}
        />
        {/* Earth sphere if within view volume */}
        {earthVisible && (
          <mesh position={earthThree} renderOrder={3}>
            <sphereGeometry args={[earthRadiusScaled, 32, 32]} />
            <meshStandardMaterial color="#1e3a8a" transparent opacity={0.35} />
          </mesh>
        )}

        {/* Sightline (LoS) */}
        {showLos && (
          <Line
            points={[
              [0, 0, 0],
              [relThree[0], relThree[1], relThree[2]],
            ]}
            color="#38bdf8"
            lineWidth={0.75}
            renderOrder={10}
          />
        )}
        {/* Velocity direction from B */}
        {showVelocity && velocityDir && (
          <>
            <Line
              points={[
                [relThree[0], relThree[1], relThree[2]],
                [relThree[0] + velocityDir.x * 2, relThree[1] + velocityDir.y * 2, relThree[2] + velocityDir.z * 2],
              ]}
              color="#f97316"
              lineWidth={1.2}
              renderOrder={11}
            />
            <mesh
              position={[
                relThree[0] + velocityDir.x * 2,
                relThree[1] + velocityDir.y * 2,
                relThree[2] + velocityDir.z * 2,
              ]}
              renderOrder={11}
            >
              <coneGeometry args={[0.05, 0.12, 8]} />
              <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.4} />
            </mesh>
          </>
        )}
      </group>
    </>
  );
}

function eciToThree(vec: { x: number; y: number; z: number }, scale: number): [number, number, number] {
  return [vec.x * scale, vec.z * scale, -vec.y * scale];
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}
