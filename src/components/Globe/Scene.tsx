import { useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Line } from '@react-three/drei';
import { Earth } from './Earth';
import { Orbit } from './Orbit';
import { Satellite } from './Satellite';
import type { SatellitePosition, ECIPosition } from '../../types/satellite';
import { calculateSunPosition } from '../../lib/sun';
import { eciToThreeJs } from '../../lib/orbit';
import * as THREE from 'three';
import { useState } from 'react';

// Check if a point is occluded by Earth from camera's perspective
function isOccludedByEarth(
  cameraPos: THREE.Vector3,
  satellitePos: [number, number, number],
  earthRadius: number = 1
): boolean {
  const camToSat = new THREE.Vector3(
    satellitePos[0] - cameraPos.x,
    satellitePos[1] - cameraPos.y,
    satellitePos[2] - cameraPos.z
  );
  const distToSat = camToSat.length();
  const dir = camToSat.normalize();

  // Ray-sphere intersection from camera toward satellite
  const origin = cameraPos;
  const a = 1; // dir is normalized
  const b = 2 * origin.dot(dir);
  const c = origin.dot(origin) - earthRadius * earthRadius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) return false; // No intersection with Earth

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / 2;
  const t2 = (-b + sqrtDisc) / 2;

  // Check if Earth intersection is between camera and satellite
  const tMin = Math.min(t1, t2);

  // Satellite is occluded if Earth intersection happens before reaching satellite
  return tMin > 0 && tMin < distToSat;
}

// Wrapper component that detects occlusion using camera position
function SatelliteGroup({
  satellite,
  color,
  showOccluded,
}: {
  satellite: { name: string; position: SatellitePosition | null; orbitPath: ECIPosition[] };
  color: string;
  showOccluded: boolean;
}) {
  const { camera } = useThree();
  const [isOccluded, setIsOccluded] = useState(false);

  useFrame(() => {
    if (satellite.position) {
      const satPos = eciToThreeJs(satellite.position.eci);
      const occluded = isOccludedByEarth(camera.position, satPos);
      if (occluded !== isOccluded) {
        setIsOccluded(occluded);
      }
    }
  });

  // Determine if satellite marker should be shown
  const showSatellite = !isOccluded || showOccluded;

  return (
    <group>
      {/* Orbit is always visible */}
      <Orbit
        path={satellite.orbitPath}
        color={color}
        opacity={0.7}
      />
      {/* Satellite marker only shown when not occluded, or when showOccluded is enabled */}
      {showSatellite && (
        <Satellite
          position={satellite.position}
          color={color}
          name={satellite.name}
          dimmed={isOccluded}
        />
      )}
    </group>
  );
}

interface SceneProps {
  satelliteA: {
    name: string;
    position: SatellitePosition | null;
    orbitPath: ECIPosition[];
  } | null;
  satelliteB: {
    name: string;
    position: SatellitePosition | null;
    orbitPath: ECIPosition[];
  } | null;
  currentTime: Date;
  showGrid: boolean;
  showTerminator: boolean;
  showAntiSolar: boolean;
  showMainLos: boolean;
  showMainSunLine: boolean;
  showOccluded?: boolean;
}

export function Scene({
  satelliteA,
  satelliteB,
  currentTime,
  showGrid,
  showTerminator,
  showAntiSolar,
  showMainLos,
  showMainSunLine,
  showOccluded = false,
}: SceneProps) {
  // Calculate sun position in ECI coordinates, then convert to Three.js
  const sunPosition = useMemo(() => {
    const sunEci = calculateSunPosition(currentTime);
    // Convert ECI to Three.js (swap Y and Z, negate new Z)
    // Normalize and scale for directional light
    const distance = 50;
    const mag = Math.sqrt(sunEci.x ** 2 + sunEci.y ** 2 + sunEci.z ** 2);
    return [
      (sunEci.x / mag) * distance,
      (sunEci.z / mag) * distance,  // Z becomes Y (up)
      (-sunEci.y / mag) * distance, // Y becomes -Z
    ] as [number, number, number];
  }, [currentTime]);

  return (
    <div className="w-full h-full bg-black">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={45} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1.5}
          maxDistance={20}
          rotateSpeed={0.5}
        />

        {/* Lighting - Sun position based on actual time */}
        {/* Ambient boost for night-side visibility */}
        <ambientLight intensity={0.08} />
        {/* Strong directional sun light for day/night contrast */}
        <directionalLight
          position={sunPosition}
          intensity={3.2}
          color="#fffaf0"
        />
        {/* Hemisphere light for subtle Earth glow on night side */}
        <hemisphereLight args={['#87ceeb', '#000022', 0.2]} />

        {/* Starfield background */}
        <Stars
          radius={100}
          depth={50}
          count={5000}
          factor={4}
          saturation={0}
          fade
        />

        {/* Earth */}
        <Earth currentTime={currentTime} showGrid={showGrid} />

        {showAntiSolar && (
          <AntiSolarMarker sunDirection={sunPosition} />
        )}

        {showTerminator && (
          <TerminatorLine sunDirection={sunPosition} />
        )}

        {/* Satellite A (Blue) */}
        {satelliteA && (
          <SatelliteGroup
            key="sat-a"
            satellite={satelliteA}
            color="#3b82f6"
            showOccluded={showOccluded}
          />
        )}

        {/* Satellite B (Red) */}
        {satelliteB && (
          <SatelliteGroup
            key="sat-b"
            satellite={satelliteB}
            color="#ef4444"
            showOccluded={showOccluded}
          />
        )}

        {/* Main view overlays */}
        {showMainSunLine && satelliteB?.position && (
          <Line
            points={[
              eciToThreeJs(satelliteB.position.eci),
              [
                eciToThreeJs(satelliteB.position.eci)[0] + sunPosition[0] * 0.05,
                eciToThreeJs(satelliteB.position.eci)[1] + sunPosition[1] * 0.05,
                eciToThreeJs(satelliteB.position.eci)[2] + sunPosition[2] * 0.05,
              ],
            ]}
            color="#facc15"
            lineWidth={1}
            dashed
            dashSize={0.1}
            gapSize={0.05}
          />
        )}

        {showMainLos && satelliteA?.position && satelliteB?.position && (
          <Line
            points={computeLosPoints(satelliteA.position.eci, satelliteB.position.eci)}
            color="#38bdf8"
            lineWidth={1}
          />
        )}
      </Canvas>
    </div>
  );
}

function computeLosPoints(eciA: ECIPosition, eciB: ECIPosition): [number, number, number][] {
  const a = eciToThreeJs(eciA);
  const b = eciToThreeJs(eciB);
  const dir: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const mag = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2) || 1;
  const ndir: [number, number, number] = [dir[0] / mag, dir[1] / mag, dir[2] / mag];

  const t = intersectRaySphere(a, ndir, 1); // Earth radius = 1
  const end: [number, number, number] = t
    ? [a[0] + ndir[0] * t, a[1] + ndir[1] * t, a[2] + ndir[2] * t]
    : [a[0] + ndir[0] * 3, a[1] + ndir[1] * 3, a[2] + ndir[2] * 3];

  return [a, end];
}

function intersectRaySphere(origin: [number, number, number], dir: [number, number, number], radius: number): number | null {
  const ox = origin[0], oy = origin[1], oz = origin[2];
  const dx = dir[0], dy = dir[1], dz = dir[2];
  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (ox * dx + oy * dy + oz * dz);
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  const t1 = (-b - sqrt) / (2 * a);
  const t2 = (-b + sqrt) / (2 * a);
  const t = [t1, t2].filter(v => v > 0).sort((x, y) => x - y)[0];
  return t ?? null;
}

function TerminatorLine({ sunDirection }: { sunDirection: [number, number, number] }) {
  const points = useMemo(() => {
    const normal = new THREE.Vector3(-sunDirection[0], -sunDirection[1], -sunDirection[2]).normalize();
    const ref = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(normal, ref).normalize();
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    const radius = 1.001;
    const segments = 256;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const p = new THREE.Vector3().addVectors(
        u.clone().multiplyScalar(Math.cos(t) * radius),
        v.clone().multiplyScalar(Math.sin(t) * radius)
      );
      pts.push([p.x, p.y, p.z]);
    }
    return pts;
  }, [sunDirection]);

  return (
    <Line
      points={points}
      color="#facc15"
      lineWidth={1}
      dashed
      dashSize={0.05}
      gapSize={0.02}
    />
  );
}

function AntiSolarMarker({ sunDirection }: { sunDirection: [number, number, number] }) {
  const dir = useMemo(() => {
    const v = new THREE.Vector3(sunDirection[0], sunDirection[1], sunDirection[2]);
    if (v.length() === 0) return new THREE.Vector3(1, 0, 0);
    return v.normalize();
  }, [sunDirection]);
  const pos = dir.clone().multiplyScalar(1.02);
  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh rotation={new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir))}>
        <circleGeometry args={[0.05, 32]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
