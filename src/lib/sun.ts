import * as satellite from 'satellite.js';
import type { ECIPosition } from '../types/satellite';

/**
 * Calculate Julian Date from a JavaScript Date
 * Algorithm from Vallado's "Fundamentals of Astrodynamics and Applications"
 */
function jday(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): number {
  return (
    367.0 * year -
    Math.floor(7 * (year + Math.floor((month + 9) / 12.0)) * 0.25) +
    Math.floor((275 * month) / 9.0) +
    day +
    1721013.5 +
    ((second / 60.0 + minute) / 60.0 + hour) / 24.0
  );
}

/**
 * Calculate the Sun's position in ECI (Earth-Centered Inertial) coordinates.
 * Uses the algorithm from Vallado's "Fundamentals of Astrodynamics and Applications"
 * which is the same algorithm used by satellite.js internally.
 */
export function calculateSunPosition(date: Date): ECIPosition {
  // Julian Date
  const jd = jday(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );

  // Julian centuries from J2000.0 (1 Jan 2000 12:00 TT)
  const T_UT1 = (jd - 2451545.0) / 36525.0;

  // Mean longitude of the Sun (degrees) - Vallado Eq. 3-47
  const lambdaSun = 280.4606184 + 36000.77005361 * T_UT1;

  // Mean anomaly of the Sun (degrees) - Vallado Eq. 3-48
  const M = 357.5277233 + 35999.05034 * T_UT1;
  const Mrad = degToRad(M);

  // Ecliptic longitude of the Sun (degrees) - Vallado Eq. 3-49
  const lambdaEcliptic = lambdaSun + 1.914666471 * Math.sin(Mrad)
                        + 0.019994643 * Math.sin(2 * Mrad);
  const lambdaEclipticRad = degToRad(lambdaEcliptic);

  // Obliquity of the ecliptic (degrees) - Vallado Eq. 3-50
  const epsilon = 23.439291 - 0.0130042 * T_UT1;
  const epsilonRad = degToRad(epsilon);

  // Distance from Earth to Sun in AU - Vallado Eq. 3-51
  const rSun = 1.000140612 - 0.016708617 * Math.cos(Mrad)
             - 0.000139589 * Math.cos(2 * Mrad);

  // Convert to ECI (Mean of Date) coordinates - Vallado Eq. 3-52
  // Sun position in Astronomical Units
  const xAU = rSun * Math.cos(lambdaEclipticRad);
  const yAU = rSun * Math.cos(epsilonRad) * Math.sin(lambdaEclipticRad);
  const zAU = rSun * Math.sin(epsilonRad) * Math.sin(lambdaEclipticRad);

  // Convert AU to km (1 AU = 149597870.7 km)
  const AU_TO_KM = 149597870.7;
  return {
    x: xAU * AU_TO_KM,
    y: yAU * AU_TO_KM,
    z: zAU * AU_TO_KM,
  };
}

/**
 * Get Greenwich Mean Sidereal Time using satellite.js
 * Returns GMST in radians
 */
export function getGMST(date: Date): number {
  // satellite.js gstime returns GMST in radians
  return satellite.gstime(date);
}

function degToRad(deg: number): number {
  return deg * Math.PI / 180;
}
