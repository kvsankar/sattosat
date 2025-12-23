import { useMemo, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SatellitePosition, ECIPosition } from '../../types/satellite';
import { EARTH_RADIUS_KM } from '../../lib/orbit';
import { classifyEarthRelation, computePhaseAngle, computeSunForTime } from '../../lib/relativeView';
import { magnitude, normalize, subtract } from '../../lib/vectorMath';

interface RelativeViewPanelProps {
  positionA: SatellitePosition | null;
  positionB: SatellitePosition | null;
  currentTime: Date;
  orbitPathB?: ECIPosition[];
}

// Include very narrow FoVs so a 10 m target at a few hundred km spans multiple pixels
const FOV_PRESETS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 20, 45];
const TARGET_WIDTH_M = 30;
const TARGET_HEIGHT_M = 4.1;
const TARGET_FILL_FRACTION = 0.5; // target spans ~50% of panel width/height in autofit
const MIN_FOV_DEG = 0.001;

export function RelativeViewPanel({ positionA, positionB, currentTime, orbitPathB = [] }: RelativeViewPanelProps) {
  const [fov, setFov] = useState<number>(45);
  const [autoFit, setAutoFit] = useState<boolean>(true);

  const derived = useMemo(() => {
    if (!positionA || !positionB) return null;
    const rel = subtract(positionB.eci, positionA.eci);
    const rangeKm = magnitude(rel);
    const sunEci = computeSunForTime(currentTime);
    const phaseAngleDeg = computePhaseAngle(positionA.eci, positionB.eci, sunEci);
    const earthInfo = classifyEarthRelation(positionA.eci, positionB.eci);

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
      velB: positionB.velocity,
    };
  }, [currentTime, positionA, positionB]);

  const relativeTrack = useMemo(() => {
    if (!derived || !positionA || orbitPathB.length === 0) return [];
    return orbitPathB.map(p => eciToThree(subtract(p, positionA.eci), derived.scale));
  }, [derived, orbitPathB, positionA]);

  const displayFov = derived ? pickFov(derived.rangeKm, autoFit, fov) : fov;
  const displaySpanM = derived
    ? 2 * derived.rangeKm * 1000 * Math.tan((displayFov * Math.PI / 180) / 2)
    : null;

  const formatSpan = (meters: number | null) => {
    if (meters === null) return '';
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${meters.toFixed(0)} m`;
  };

  const fovButtons = (
    <div className="flex gap-1 flex-wrap justify-end">
      {FOV_PRESETS.map(val => (
        <button
          key={val}
          onClick={() => {
            setAutoFit(false);
            setFov(val);
          }}
          className={`px-2 py-1 rounded text-[11px] ${
            !autoFit && fov === val ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
          title={`${val}° (${(val * 60).toFixed(1)} arcmin)`}
        >
          {val < 1 ? `${val}°` : `${val}°`}
        </button>
      ))}
    </div>
  );

  return (
    <div className="bg-gray-800/95 border border-gray-700 rounded-lg p-3 shadow-xl text-sm text-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-white font-semibold">View from Satellite A</div>
          <div className="text-gray-400 text-xs">
            Satellite B rendered as 30×4.1 m panel facing Sun; cyan line = line of sight
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-[11px] text-gray-400">
            FoV: {autoFit && derived ? `${displayFov.toFixed(4)}° (auto)` : `${displayFov}°`} / {(displayFov * 60).toFixed(1)}′
          </div>
          <label className="flex items-center gap-1 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={autoFit}
              onChange={e => setAutoFit(e.target.checked)}
            />
            Auto-fit FoV
          </label>
          {fovButtons}
        </div>
      </div>

      {!derived ? (
        <div className="text-gray-400 text-sm">Select both satellites to view.</div>
      ) : (
        <>
          {(() => {
            const computedFov = displayFov;
            return (
              <div className="h-56 bg-black rounded overflow-hidden mb-3 relative">
                <RelativeViewCanvas
                  rel={derived.rel}
                  scale={derived.scale}
                  sunEci={derived.sunEci}
                  fov={computedFov}
                  sunFromB={derived.sunFromB}
                  velB={derived.velB}
                  track={relativeTrack}
                  earthPosition={{
                    x: -positionA!.eci.x,
                    y: -positionA!.eci.y,
                    z: -positionA!.eci.z,
                  }}
                />
                <div className="absolute bottom-1 right-2 text-[11px] text-gray-200 bg-black/60 px-2 py-0.5 rounded">
                  FoV {(computedFov * 60).toFixed(2)}′ / {formatSpan(displaySpanM)}
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-900/70 p-2 rounded">
              <div className="text-gray-400">Range</div>
              <div className="text-white font-mono">{derived.rangeKm.toFixed(1)} km</div>
            </div>
            <div className="bg-gray-900/70 p-2 rounded">
              <div className="text-gray-400">Phase angle</div>
              <div className="text-white font-mono">{derived.phaseAngleDeg.toFixed(1)}°</div>
            </div>
            <div className="bg-gray-900/70 p-2 rounded col-span-2">
              <div className="text-gray-400">FoV</div>
              <div className="text-white font-mono">
                {autoFit ? `${(displayFov * 60).toFixed(2)}′ (auto)` : `${(displayFov * 60).toFixed(2)}′`}
                {` (span ${formatSpan(displaySpanM)})`}
              </div>
            </div>
            <div className="bg-gray-900/70 p-2 rounded col-span-2">
              <div className="text-gray-400">Earth alignment</div>
              <div className="text-white font-mono">
                {derived.earthInfo.relation === 'obstructed'
                  ? 'Obstructing line of sight'
                  : derived.earthInfo.relation === 'background'
                    ? 'In background of line of sight'
                    : 'Clear of Earth disc'}
                {` (closest ${derived.earthInfo.missDistance.toFixed(1)} km)`}
              </div>
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
  const sizeWidthM = TARGET_WIDTH_M;
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
  scale: number;
  sunEci: { x: number; y: number; z: number };
  sunFromB: { x: number; y: number; z: number };
  velB?: { x: number; y: number; z: number };
  track: [number, number, number][];
  fov: number;
}

function RelativeViewCanvas({ rel, earthPosition, scale, sunEci, sunFromB, velB, track, fov }: RelativeViewCanvasProps) {
  const relThree = useMemo(() => eciToThree(rel, scale), [rel, scale]);
  const earthThree = useMemo(() => eciToThree(earthPosition, scale), [earthPosition, scale]);
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
    const width = (TARGET_WIDTH_M / 1000) * scale;
    const height = (TARGET_HEIGHT_M / 1000) * scale;
    return { width, height };
  }, [scale]);

  const earthRadiusScaled = EARTH_RADIUS_KM * scale;

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
        panelRotation={panelRotation}
        panelSize={panelSize}
        sunDirThree={sunDirThree}
        trackThree={track}
      />
    </Canvas>
  );
}

interface RelativeSceneProps {
  fov: number;
  relThree: [number, number, number];
  earthThree: [number, number, number];
  earthRadiusScaled: number;
  panelRotation: THREE.Quaternion;
  panelSize: { width: number; height: number };
  sunDirThree: THREE.Vector3;
  trackThree: [number, number, number][];
}

function RelativeScene({
  fov,
  relThree,
  earthThree,
  earthRadiusScaled,
  panelRotation,
  panelSize,
  sunDirThree,
  trackThree,
}: RelativeSceneProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  useFrame(() => {
    if (cameraRef.current) {
      const cam = cameraRef.current;
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
        <mesh position={relThree} rotation={new THREE.Euler().setFromQuaternion(panelRotation)}>
          <planeGeometry args={[panelSize.width, panelSize.height]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ff7f7f"
            emissiveIntensity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
        {trackThree.length > 1 && (
          <Line
            points={trackThree}
            color="#22c55e"
            lineWidth={2}
          />
        )}
        <Html
          position={[
            relThree[0] + panelSize.width * 0.8,
            relThree[1] + panelSize.height * 1.2,
            relThree[2],
          ]}
          center
          style={{
            pointerEvents: 'none',
            color: '#e5e7eb',
            fontSize: '11px',
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          30m × 4.1m
        </Html>

        {/* Earth sphere if within view volume */}
        <mesh position={earthThree}>
          <sphereGeometry args={[earthRadiusScaled, 32, 32]} />
          <meshStandardMaterial color="#1e3a8a" transparent opacity={0.35} />
        </mesh>

        {/* Sightline */}
        <Line
          points={[
            [0, 0, 0],
            [relThree[0], relThree[1], relThree[2]],
          ]}
          color="#38bdf8"
          lineWidth={2}
        />
      </group>
    </>
  );
}

function eciToThree(vec: { x: number; y: number; z: number }, scale: number): [number, number, number] {
  return [vec.x * scale, vec.z * scale, -vec.y * scale];
}
