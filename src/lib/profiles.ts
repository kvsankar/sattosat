import profilesData from './profiles.json';
import { addManualTLEs } from './celestrak';

export interface ProfileSatellite {
  noradId: number;
  role: string;
  tles: string[];
}

export interface Profile {
  name: string;
  description?: string;
  anchor: string; // ISO
  satellites: ProfileSatellite[];
}

export const profiles: Profile[] = profilesData as Profile[];

export function applyProfileTles(profile: Profile): void {
  for (const sat of profile.satellites) {
    for (const tleText of sat.tles) {
      addManualTLEs(sat.noradId, tleText, { forceNorad: true });
    }
  }
}
