import { useEffect, useState } from 'react';
import * as THREE from 'three';
import type { ECIPosition } from '../../types/satellite';
import { eciToThreeJs } from '../../lib/orbit';

interface OrbitProps {
  path: ECIPosition[];
  color: string;
  opacity?: number;
}

export function Orbit({ path, color, opacity = 0.6 }: OrbitProps) {
  const [line, setLine] = useState<THREE.Line | null>(null);

  useEffect(() => {
    if (path.length === 0) {
      setLine(null);
      return;
    }

    // Create points
    const points = path.map(pos => {
      const [x, y, z] = eciToThreeJs(pos);
      return new THREE.Vector3(x, y, z);
    });

    // Create geometry and material
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: color,
      opacity: opacity,
      transparent: true,
    });

    // Create line
    const newLine = new THREE.Line(geometry, material);
    setLine(newLine);

    // Cleanup
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [path, color, opacity]);

  if (!line) return null;

  return <primitive object={line} />;
}
