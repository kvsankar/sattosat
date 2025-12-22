// Celestrak GP (General Perturbations) JSON format
export interface CelestrakGP {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

// Simplified satellite info for catalog list
export interface SatelliteCatalogEntry {
  noradId: number;
  name: string;
  objectId: string;
}

// Parsed TLE with computed orbital parameters
export interface SatelliteTLE {
  noradId: number;
  name: string;
  objectId: string;
  epoch: Date;
  line1: string;
  line2: string;
  // Orbital elements
  inclination: number;      // degrees
  eccentricity: number;
  raan: number;             // Right Ascension of Ascending Node (degrees)
  argOfPerigee: number;     // degrees
  meanAnomaly: number;      // degrees
  meanMotion: number;       // revs per day
  bstar: number;            // drag term
  // Derived parameters
  period: number;           // minutes
  apogee: number;           // km above Earth surface
  perigee: number;          // km above Earth surface
  semiMajorAxis: number;    // km
  // Raw GP data for satellite.js
  rawGP: CelestrakGP;
}

// 3D position in Earth-Centered Inertial (ECI) coordinates
export interface ECIPosition {
  x: number;  // km
  y: number;  // km
  z: number;  // km
}

// Geodetic position
export interface GeodeticPosition {
  latitude: number;   // degrees
  longitude: number;  // degrees
  altitude: number;   // km
}

// Satellite position at a specific time
export interface SatellitePosition {
  time: Date;
  eci: ECIPosition;
  geodetic: GeodeticPosition;
  velocity: ECIPosition;  // km/s
}

// Conjunction event between two satellites
export interface Conjunction {
  time: Date;
  distance: number;         // km
  relativeVelocity: number; // km/s
  phaseAngleDeg?: number;   // Sun-B-A phase angle
  earthRelation?: 'obstructed' | 'background' | 'clear';
  earthMissDistanceKm?: number;
  satelliteA: {
    position: SatellitePosition;
    name: string;
  };
  satelliteB: {
    position: SatellitePosition;
    name: string;
  };
}

// App state for selected satellites
export interface SelectedSatellite {
  catalogEntry: SatelliteCatalogEntry;
  tle: SatelliteTLE | null;
  loading: boolean;
  error: string | null;
}
