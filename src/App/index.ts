import * as fs from 'fs';
import * as path from 'path';
import LooperSingleton from './LooperSingleton';
import { formatEndReport } from '../Helpers/Reporters';
import { writeReportHTML } from '../Helpers/ReportWriter';
import Variables from '../Helpers/Variables';
import { parsePersonTypes } from '../Helpers/Classifier';

interface SimConfig {
  simulation?: {
    persons?: number;
    ticks?: number;
    seed?: number;
    personTypes?: unknown;
  };
  variables?: Record<string, unknown>;
}

/**
 * Parses --config and --output from process.argv.
 * @returns paths for the config file and output directory, if provided
 */
function parseArgs(): { configPath?: string; outputDir?: string } {
  const args = process.argv.slice(2);
  let configPath: string | undefined;
  let outputDir: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) configPath = args[++i];
    else if (args[i] === '--output' && i + 1 < args.length) outputDir = args[++i];
  }
  return { configPath, outputDir };
}

const { configPath, outputDir } = parseArgs();

let config: SimConfig = {};
if (configPath) {
  const raw = fs.readFileSync(path.resolve(configPath), 'utf8');
  config = JSON.parse(raw) as SimConfig;
}

if (config.variables) {
  for (const [key, value] of Object.entries(config.variables)) {
    if (!(key in Variables)) {
      // eslint-disable-next-line no-console
      console.warn(`Config: unknown variable "${key}", skipping.`);
      continue;
    }
    if (typeof value !== 'number') {
      // eslint-disable-next-line no-console
      console.warn(`Config: variable "${key}" must be a number, got ${typeof value}, skipping.`);
      continue;
    }
    Object.assign(Variables, { [key]: value });
  }
}

const N = config.simulation?.persons ?? 100;
const TICKS = config.simulation?.ticks ?? 100;
const SEED = config.simulation?.seed ?? 42;
const PERSON_TYPES = parsePersonTypes(config.simulation?.personTypes);

const looper = LooperSingleton.getInstance();
// eslint-disable-next-line no-console
const simulation = looper.start(N, TICKS, SEED, console.log, PERSON_TYPES);

// eslint-disable-next-line no-console
console.log(formatEndReport(
  simulation.decadeHistory,
  TICKS,
  SEED,
  N,
  simulation.naturalResources,
  simulation.naturalResourceCeiling,
  simulation.personTypes,
  simulation.seededTypeCounts,
  simulation.getLiving(),
));

writeReportHTML(simulation, N, TICKS, SEED, outputDir);
