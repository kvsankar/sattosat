export interface Profile {
  name: string;
  description?: string;
  now: string; // ISO timestamp
  satA: number;
  satB: number;
}

export const profiles: Profile[] = [
  {
    name: 'WV3-STARLINK35956-Picture',
    description: 'WorldView-3 vs Starlink close-imaging setup',
    now: '2025-12-19T01:30:00Z',
    satA: 40115, // WorldView-3
    satB: 66620, // Placeholder for Starlink-35956 (embedded TLE set)
  },
];
