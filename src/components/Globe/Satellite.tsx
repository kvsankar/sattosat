import { Sphere, Html } from '@react-three/drei';
import type { SatellitePosition } from '../../types/satellite';
import { eciToThreeJs } from '../../lib/orbit';

interface SatelliteProps {
  position: SatellitePosition | null;
  color: string;
  name: string;
  showLabel?: boolean;
  dimmed?: boolean;
}

export function Satellite({
  position,
  color,
  name,
  showLabel = true,
  dimmed = false,
}: SatelliteProps) {
  if (!position) return null;

  const [x, y, z] = eciToThreeJs(position.eci);

  // Reduced opacity when dimmed (satellite behind Earth)
  const markerOpacity = dimmed ? 0.4 : 1;
  const glowOpacity = dimmed ? 0.15 : 0.3;
  const labelOpacity = dimmed ? 0.5 : 1;

  return (
    <group position={[x, y, z]}>
      {/* Satellite marker */}
      <Sphere args={[0.005, 12, 12]}>
        <meshBasicMaterial color={color} transparent opacity={markerOpacity} />
      </Sphere>

      {/* Glow effect */}
      <Sphere args={[0.009, 12, 12]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={glowOpacity}
        />
      </Sphere>

      {/* Label */}
      {showLabel && (
        <Html
          position={[0.05, 0.05, 0]}
          zIndexRange={[100, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: labelOpacity,
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
