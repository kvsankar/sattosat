import type { SatelliteTLE, SatellitePosition } from '../../types/satellite';

interface OrbitalParamsProps {
  tleA: SatelliteTLE | null;
  tleB: SatelliteTLE | null;
  positionA: SatellitePosition | null;
  positionB: SatellitePosition | null;
  currentDistance: number | null;
  relativeVelocity: number | null;
}

export function OrbitalParams({
  tleA,
  tleB,
  positionA,
  positionB,
  currentDistance,
  relativeVelocity,
}: OrbitalParamsProps) {
  if (!tleA && !tleB) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg text-gray-400 text-sm">
        Select satellites to view orbital parameters
      </div>
    );
  }

  const hasBoth = tleA && tleB;

  return (
    <div className="bg-gray-800 p-3 rounded-lg">
      {/* Current Distance - only show when both satellites are selected */}
      {hasBoth && currentDistance !== null && (
        <div className="mb-3 p-2.5 bg-gray-900 rounded-lg">
          <div className="text-gray-400 text-[11px] uppercase mb-1">
            Current Distance
          </div>
          <div className="text-xl font-mono text-white">
            {currentDistance.toFixed(1)} km
          </div>
          {relativeVelocity !== null && (
            <div className="text-xs text-gray-400">
              Relative velocity: {relativeVelocity.toFixed(2)} km/s
            </div>
          )}
        </div>
      )}

      {/* Side by side comparison when both selected, single column otherwise */}
      <div className={hasBoth ? 'grid grid-cols-2 gap-4' : ''}>
        {tleA && <ParamColumn tle={tleA} position={positionA} label="Satellite A" color="#3b82f6" />}
        {tleB && <ParamColumn tle={tleB} position={positionB} label="Satellite B" color="#ef4444" />}
      </div>
    </div>
  );
}

interface ParamColumnProps {
  tle: SatelliteTLE | null;
  position: SatellitePosition | null;
  label: string;
  color: string;
}

function formatLatLon(lat: number, lon: number): { lat: string; lon: string } {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return {
    lat: `${Math.abs(lat).toFixed(2)}° ${latDir}`,
    lon: `${Math.abs(lon).toFixed(2)}° ${lonDir}`,
  };
}

function ParamColumn({ tle, position, label, color }: ParamColumnProps) {
  if (!tle) {
    return (
      <div className="text-gray-500 text-sm">
        <div className="font-medium mb-2" style={{ color }}>
          {label}
        </div>
        <div>Not selected</div>
      </div>
    );
  }

  const latLon = position ? formatLatLon(position.geodetic.latitude, position.geodetic.longitude) : null;

  return (
    <div>
      <div className="font-medium mb-2 truncate" style={{ color }} title={tle.name}>
        {tle.name}
      </div>

      <div className="space-y-1 text-xs">
        <ParamRow label="NORAD ID" value={tle.noradId.toString()} />

        {/* Current position */}
        {latLon && (
          <>
            <div className="border-t border-gray-700 my-2 pt-2">
              <span className="text-gray-500 text-[10px] uppercase">Current Position</span>
            </div>
            <ParamRow label="Latitude" value={latLon.lat} />
            <ParamRow label="Longitude" value={latLon.lon} />
            <ParamRow label="Altitude" value={`${position!.geodetic.altitude.toFixed(1)} km`} />
          </>
        )}

        {/* Orbital elements */}
        <div className="border-t border-gray-700 my-2 pt-2">
          <span className="text-gray-500 text-[10px] uppercase">Orbital Elements</span>
        </div>
        <ParamRow label="Inclination" value={`${tle.inclination.toFixed(2)}°`} />
        <ParamRow label="Eccentricity" value={tle.eccentricity.toFixed(6)} />
        <ParamRow label="RAAN" value={`${tle.raan.toFixed(2)}°`} />
        <ParamRow label="Arg Perigee" value={`${tle.argOfPerigee.toFixed(2)}°`} />
        <ParamRow label="Mean Anomaly" value={`${tle.meanAnomaly.toFixed(2)}°`} />
        <ParamRow label="Apogee" value={`${tle.apogee.toFixed(1)} km`} />
        <ParamRow label="Perigee" value={`${tle.perigee.toFixed(1)} km`} />
        <ParamRow label="Period" value={`${tle.period.toFixed(1)} min`} />
        <ParamRow
          label="TLE Epoch"
          value={formatEpochNode(tle.epoch)}
        />
      </div>
    </div>
  );
}

function formatEpochNode(date: Date): JSX.Element {
  const iso = date.toISOString();
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 19) + ' UTC';
  return (
    <span className="flex flex-col items-end leading-tight">
      <span>{datePart}</span>
      <span>{timePart}</span>
    </span>
  );
}

function ParamRow({ label, value }: { label: string; value: string | JSX.Element }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-mono text-right">{value}</span>
    </div>
  );
}
