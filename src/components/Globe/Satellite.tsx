import { Sphere, Html } from '@react-three/drei';
import type { SatellitePosition } from '../../types/satellite';
import { eciToThreeJs } from '../../lib/orbit';

interface SatelliteProps {
  position: SatellitePosition | null;
  color: string;
  name: string;
  showLabel?: boolean;
}

export function Satellite({
  position,
  color,
  name,
  showLabel = true,
}: SatelliteProps) {
  if (!position) return null;

  const [x, y, z] = eciToThreeJs(position.eci);

  return (
    <group position={[x, y, z]}>
      {/* Satellite marker */}
      <Sphere args={[0.005, 12, 12]}>
        <meshBasicMaterial color={color} />
      </Sphere>

      {/* Glow effect */}
      <Sphere args={[0.009, 12, 12]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
        />
      </Sphere>

      {/* Label */}
      {showLabel && (
        <Html
          position={[0.05, 0.05, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              color: color,
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              border: `1px solid ${color}`,
            }}
          >
            {name}
          </div>
        </Html>
      )}
    </group>
  );
}
