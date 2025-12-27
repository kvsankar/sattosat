#!/usr/bin/env npx tsx
/**
 * Satellite conjunction finder CLI.
 *
 * Uses the same algorithm as the web app to find close approaches.
 * Outputs results to CSV for verification against Python implementation.
 *
 * Usage:
 *   npx tsx scripts/conjunctions.ts --profile WV3-STARLINK35956-Picture
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { findConjunctions } from '../src/lib/conjunctions';
import type { SatelliteTLE, Conjunction } from '../src/types/satellite';

// Constants
const SEARCH_RANGE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// Data paths (ES module compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_INPUT = path.join(PROJECT_ROOT, 'public', 'data', 'input');
const DATA_OUTPUT = path.join(PROJECT_ROOT, 'public', 'data', 'output');

interface ProfileSatellite {
  noradId: number;
  role: string;
  name?: string;
  tleFile?: string;
}

interface Profile {
  name: string;
  description?: string;
  anchor: string;
  satellites: ProfileSatellite[];
}

/**
 * Parse a TLE file into SatelliteTLE objects.
 */
function parseTleFile(filePath: string): SatelliteTLE[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const tles: SatelliteTLE[] = [];

  for (let i = 0; i < lines.length - 1; i += 2) {
    const line1 = lines[i];
    const line2 = lines[i + 1];

    if (line1?.startsWith('1 ') && line2?.startsWith('2 ')) {
      const epoch = parseTleEpoch(line1);
      const noradId = parseInt(line1.substring(2, 7).trim(), 10);

      tles.push({
        noradId,
        name: `NORAD ${noradId}`,
        epoch,
        line1,
        line2,
      });
    }
  }

  return tles.sort((a, b) => a.epoch.getTime() - b.epoch.getTime());
}

/**
 * Parse epoch from TLE line 1.
 */
function parseTleEpoch(line1: string): Date {
  const epochStr = line1.substring(18, 32).trim();
  const year = parseInt(epochStr.substring(0, 2), 10);
  const fullYear = year < 57 ? 2000 + year : 1900 + year;
  const dayOfYear = parseFloat(epochStr.substring(2));
  const date = new Date(Date.UTC(fullYear, 0, 1));
  date.setTime(date.getTime() + (dayOfYear - 1) * DAY_MS);
  return date;
}

/**
 * Load profile from profiles.json.
 */
function loadProfile(name: string): Profile {
  const profilesPath = path.join(DATA_INPUT, 'profiles.json');
  const profiles: Profile[] = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

  const profile = profiles.find(p => p.name === name);
  if (!profile) {
    const available = profiles.map(p => p.name);
    throw new Error(`Profile '${name}' not found. Available: ${available.join(', ')}`);
  }

  return profile;
}

/**
 * Convert conjunction to CSV row.
 */
function conjunctionToCsvRow(c: Conjunction): string {
  const time = c.time.toISOString().replace('Z', '').substring(0, 23) + 'Z';
  return [
    time,
    c.distance.toFixed(6),
    c.relativeVelocity.toFixed(6),
    c.satelliteA.position.geodetic.latitude.toFixed(6),
    c.satelliteA.position.geodetic.longitude.toFixed(6),
    c.satelliteB.position.geodetic.latitude.toFixed(6),
    c.satelliteB.position.geodetic.longitude.toFixed(6),
  ].join(',');
}

/**
 * Write conjunctions to CSV file.
 */
function writeCsv(conjunctions: Conjunction[], outputPath: string): void {
  const header = 'time_utc,distance_km,relative_velocity_km_s,sat_a_lat,sat_a_lon,sat_b_lat,sat_b_lon';
  const rows = conjunctions.map(conjunctionToCsvRow);
  const content = [header, ...rows].join('\n') + '\n';

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content);
}

/**
 * Parse command line arguments.
 */
function parseArgs(): { profile?: string; tleA?: string; tleB?: string; anchor?: string; output?: string; quiet?: boolean } {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--profile' || arg === '-p') {
      args.profile = argv[++i];
    } else if (arg === '--tle-a') {
      args.tleA = argv[++i];
    } else if (arg === '--tle-b') {
      args.tleB = argv[++i];
    } else if (arg === '--anchor') {
      args.anchor = argv[++i];
    } else if (arg === '--output' || arg === '-o') {
      args.output = argv[++i];
    } else if (arg === '--quiet' || arg === '-q') {
      args.quiet = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: npx tsx scripts/conjunctions.ts [options]

Options:
  --profile, -p <name>  Profile name from profiles.json
  --tle-a <path>        TLE file for satellite A
  --tle-b <path>        TLE file for satellite B
  --anchor <time>       Anchor time (ISO format)
  --output, -o <path>   Output CSV path
  --quiet, -q           Suppress progress output
  --help, -h            Show this help message
`);
      process.exit(0);
    }
  }

  return args as ReturnType<typeof parseArgs>;
}

async function main(): Promise<void> {
  const args = parseArgs();

  // Validate arguments
  if (args.profile && (args.tleA || args.tleB)) {
    console.error('Error: Cannot use --profile with --tle-a/--tle-b');
    process.exit(1);
  }

  if (!args.profile && !(args.tleA && args.tleB)) {
    console.error('Error: Must specify either --profile or both --tle-a and --tle-b');
    process.exit(1);
  }

  if (args.tleA && args.tleB && !args.anchor) {
    console.error('Error: --anchor is required when using --tle-a/--tle-b');
    process.exit(1);
  }

  let tlesA: SatelliteTLE[];
  let tlesB: SatelliteTLE[];
  let anchor: Date;
  let outputName: string;

  if (args.profile) {
    const profile = loadProfile(args.profile);
    anchor = new Date(profile.anchor);

    const satA = profile.satellites[0];
    const satB = profile.satellites[1];

    if (!satA?.tleFile || !satB?.tleFile) {
      throw new Error('Profile must use tleFile references for CLI usage');
    }

    tlesA = parseTleFile(path.join(DATA_INPUT, satA.tleFile));
    tlesB = parseTleFile(path.join(DATA_INPUT, satB.tleFile));

    // Apply names from profile
    if (satA.name) {
      tlesA = tlesA.map(t => ({ ...t, name: satA.name! }));
    }
    if (satB.name) {
      tlesB = tlesB.map(t => ({ ...t, name: satB.name! }));
    }

    outputName = `conjunctions-${args.profile}-typescript.csv`;
  } else {
    tlesA = parseTleFile(args.tleA!);
    tlesB = parseTleFile(args.tleB!);
    anchor = new Date(args.anchor!);
    // Use NORAD IDs for unique output filename
    const noradA = tlesA[0]?.noradId ?? 0;
    const noradB = tlesB[0]?.noradId ?? 0;
    outputName = `conjunctions-${noradA}-${noradB}-typescript.csv`;
  }

  // Calculate search window
  const startTime = new Date(anchor.getTime() - SEARCH_RANGE_DAYS * DAY_MS);
  const endTime = new Date(anchor.getTime() + SEARCH_RANGE_DAYS * DAY_MS);

  if (!args.quiet) {
    console.log(`Loaded ${tlesA.length} TLEs for Sat A`);
    console.log(`Loaded ${tlesB.length} TLEs for Sat B`);
    console.log(`Search window: ${startTime.toISOString()} to ${endTime.toISOString()}`);
    console.log('Finding conjunctions...');
  }

  // Find conjunctions
  const conjunctions = findConjunctions({
    tlesA,
    tlesB,
    startTime,
    endTime,
  });

  if (!args.quiet) {
    console.log(`Found ${conjunctions.length} conjunctions`);
  }

  // Determine output path
  const outputPath = args.output || path.join(DATA_OUTPUT, outputName);

  // Write CSV
  writeCsv(conjunctions, outputPath);

  if (!args.quiet) {
    console.log(`Output written to: ${outputPath}`);

    if (conjunctions.length > 0) {
      const c = conjunctions[0];
      console.log('\nClosest approach:');
      console.log(`  Time: ${c.time.toISOString().replace('Z', ' UTC')}`);
      console.log(`  Distance: ${c.distance.toFixed(2)} km`);
      console.log(`  Relative velocity: ${c.relativeVelocity.toFixed(2)} km/s`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
