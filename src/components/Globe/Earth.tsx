import { useMemo } from 'react';
import { Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { getGMST } from '../../lib/sun';

// Earth radius = 1 unit in our scene
const EARTH_RADIUS = 1;

// NASA Blue Marble texture URLs (public domain)
const EARTH_TEXTURE_URL = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg';
const EARTH_NIGHT_URL = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg';
const EARTH_BUMP_URL = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png';

interface EarthProps {
  currentTime: Date;
  showGrid: boolean;
}

export function Earth({ currentTime, showGrid }: EarthProps) {
  // Calculate Earth rotation based on GMST (Greenwich Mean Sidereal Time)
  // GMST is the angle from vernal equinox to prime meridian, measured eastward
  // We rotate the Earth texture by GMST so the prime meridian aligns correctly
  const earthRotation = useMemo(() => {
    // Positive rotation to transform from inertial to Earth-fixed coordinates
    return getGMST(currentTime);
  }, [currentTime]);

  return (
    <group rotation={[0, earthRotation, 0]}>
      {/* Earth sphere with texture */}
      <EarthSphere />

      {/* Atmosphere glow */}
      <Atmosphere />

      {/* Lat/Lon grid (optional) */}
      {showGrid && <LatLonGrid />}
    </group>
  );
}

function EarthSphere() {
  // Load textures
  const [dayMap, nightMap, bumpMap] = useTexture([
    EARTH_TEXTURE_URL,
    EARTH_NIGHT_URL,
    EARTH_BUMP_URL,
  ]);

  return (
    <Sphere args={[EARTH_RADIUS, 64, 64]}>
      <meshStandardMaterial
        map={dayMap}
        bumpMap={bumpMap}
        bumpScale={0.02}
        metalness={0.05}
        roughness={0.55}
        emissiveMap={nightMap}
        emissiveIntensity={0.6}
        emissive="#0b1a2a"
      />
    </Sphere>
  );
}

function Atmosphere() {
  return (
    <Sphere args={[EARTH_RADIUS * 1.02, 64, 64]}>
      <meshPhongMaterial
        color="#4a90d9"
        transparent
        opacity={0.15}
        side={THREE.BackSide}
      />
    </Sphere>
  );
}

function LatLonGrid() {
  const gridLines = useMemo(() => {
    const group = new THREE.Group();
    const r = EARTH_RADIUS * 1.002;
    const segments = 64;

    // Latitude lines every 30 degrees
    const latitudes = [-60, -30, 0, 30, 60];
    latitudes.forEach(lat => {
      const latRad = lat * Math.PI / 180;
      const points: THREE.Vector3[] = [];
      const radius = Math.cos(latRad) * r;
      const y = Math.sin(latRad) * r;

      for (let i = 0; i <= segments; i++) {
        const lon = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          Math.cos(lon) * radius,
          y,
          Math.sin(lon) * radius
        ));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const color = lat === 0 ? '#ffff00' : '#888888'; // Equator in yellow
      const material = new THREE.LineBasicMaterial({
        color,
        opacity: lat === 0 ? 0.6 : 0.3,
        transparent: true
      });
      group.add(new THREE.Line(geometry, material));
    });

    // Longitude lines every 30 degrees
    for (let lon = 0; lon < 360; lon += 30) {
      const lonRad = lon * Math.PI / 180;
      const points: THREE.Vector3[] = [];

      for (let i = 0; i <= segments; i++) {
        const lat = (i / segments) * Math.PI - Math.PI / 2;
        points.push(new THREE.Vector3(
          Math.cos(lat) * Math.cos(lonRad) * r,
          Math.sin(lat) * r,
          Math.cos(lat) * Math.sin(lonRad) * r
        ));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const color = lon === 0 ? '#00ff00' : '#888888'; // Prime meridian in green
      const material = new THREE.LineBasicMaterial({
        color,
        opacity: lon === 0 ? 0.6 : 0.3,
        transparent: true
      });
      group.add(new THREE.Line(geometry, material));
    }

    return group;
  }, []);

  return <primitive object={gridLines} />;
}
