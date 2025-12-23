import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Line } from '@react-three/drei';
import { Earth } from './Earth';
import { Orbit } from './Orbit';
import { Satellite } from './Satellite';
import type { SatellitePosition, ECIPosition } from '../../types/satellite';
import { calculateSunPosition } from '../../lib/sun';
import * as THREE from 'three';

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
}

export function Scene({ satelliteA, satelliteB, currentTime, showGrid, showTerminator, showAntiSolar }: SceneProps) {
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
          <group key="sat-a">
            <Orbit
              path={satelliteA.orbitPath}
              color="#3b82f6"
              opacity={0.7}
            />
            <Satellite
              position={satelliteA.position}
              color="#3b82f6"
              name={satelliteA.name}
            />
          </group>
        )}

        {/* Satellite B (Red) */}
        {satelliteB && (
          <group key="sat-b">
            <Orbit
              path={satelliteB.orbitPath}
              color="#ef4444"
              opacity={0.7}
            />
            <Satellite
              position={satelliteB.position}
              color="#ef4444"
              name={satelliteB.name}
            />
          </group>
        )}
      </Canvas>
    </div>
  );
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
      <mesh>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1} />
      </mesh>
      <mesh rotation={new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir))}>
        <circleGeometry args={[0.05, 32]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
