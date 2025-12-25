import { addManualTLEs } from './celestrak';

export interface ProfileSatellite {
  noradId: number;
  role: string;
  name?: string;
  tles?: string[];      // Embedded TLEs (legacy)
  tleFile?: string;     // Path to TLE file (new format)
}

export interface Profile {
  name: string;
  description?: string;
  anchor: string; // ISO
  satellites: ProfileSatellite[];
}

// Base path for data files (works for both dev server and production)
const DATA_BASE_PATH = '/data/input';

/**
 * Parse a TLE file content into individual TLE strings.
 * Each TLE is two lines: line 1 starts with "1 ", line 2 starts with "2 ".
 */
function parseTleFile(content: string): string[] {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const tles: string[] = [];

  for (let i = 0; i < lines.length - 1; i += 2) {
    const line1 = lines[i];
    const line2 = lines[i + 1];
    if (line1?.startsWith('1 ') && line2?.startsWith('2 ')) {
      tles.push(`${line1}\n${line2}`);
    }
  }

  return tles;
}

/**
 * Load TLEs for a satellite, either from embedded data or file.
 */
async function loadSatelliteTles(sat: ProfileSatellite): Promise<string[]> {
  // If embedded TLEs exist, use them
  if (sat.tles && sat.tles.length > 0) {
    return sat.tles;
  }

  // Otherwise, fetch from TLE file
  if (sat.tleFile) {
    const url = `${DATA_BASE_PATH}/${sat.tleFile}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch TLE file: ${url}`);
      return [];
    }
    const content = await response.text();
    return parseTleFile(content);
  }

  return [];
}

/**
 * Fetch profiles from the data directory.
 */
export async function fetchProfiles(): Promise<Profile[]> {
  try {
    const response = await fetch(`${DATA_BASE_PATH}/profiles.json`);
    if (!response.ok) {
      console.error('Failed to fetch profiles.json');
      return [];
    }
    const profiles: Profile[] = await response.json();

    // Pre-load TLEs for all satellites
    for (const profile of profiles) {
      for (const sat of profile.satellites) {
        if (!sat.tles && sat.tleFile) {
          sat.tles = await loadSatelliteTles(sat);
        }
      }
    }

    return profiles;
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
}

/**
 * Apply TLEs from a profile to the TLE cache.
 */
export function applyProfileTles(profile: Profile): void {
  for (const sat of profile.satellites) {
    if (sat.tles) {
      for (const tleText of sat.tles) {
        addManualTLEs(sat.noradId, tleText, { forceNorad: true, nameOverride: sat.name });
      }
    }
  }
}
