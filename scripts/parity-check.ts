/**
 * Engine parity harness — proves a change to the simulation engine is behaviour-preserving.
 *
 * Runs the tick loop across a set of seeds and captures the full per-tick snapshot history.
 * In `--emit` mode it writes that history to a JSON file; in `--verify` mode it re-runs the
 * same configuration and compares field by field against a previously emitted file, reporting
 * the first divergence (seed, tick, field, expected, actual).
 *
 * The intended workflow is to emit a baseline on the unmodified revision, apply an
 * optimisation, then verify: any refactor that claims to preserve behaviour must produce a
 * byte-identical history. Calibration changes (new `Variables` values) are expected to
 * diverge — this tool is for refactors, not for tuning.
 *
 * Usage:
 *   npx ts-node scripts/parity-check.ts --emit baseline.json [--seeds 8] [--ticks 200] [--persons 100]
 *   npx ts-node scripts/parity-check.ts --verify baseline.json
 *
 * Options:
 *   --emit FILE      run and write the baseline history to FILE
 *   --verify FILE    run and compare against the baseline in FILE (exit 1 on divergence)
 *   --seeds N|a,b,c  seed list, or a single N meaning seeds 1..N (default 1..8)
 *   --ticks N        ticks per run (default 200)
 *   --persons N      initial population (default 100)
 *
 * `--seeds`, `--ticks` and `--persons` are recorded in the emitted file and reused on verify,
 * so the two runs cannot silently disagree about their configuration.
 */

import * as fs from 'fs';
import LooperSingleton from '../src/App/LooperSingleton';
import { TickSnapshot } from '../src/App/Simulation';

/** Run configuration captured alongside a baseline so verify reuses it exactly. */
interface ParityConfig {
  /** Seeds executed, in order. */
  seeds: number[];
  /** Ticks per run. */
  ticks: number;
  /** Initial population per run. */
  persons: number;
}

/** A baseline file: the configuration plus one snapshot history per seed. */
interface ParityBaseline {
  /** Configuration the histories were produced with. */
  config: ParityConfig;
  /** Snapshot history per seed, keyed by seed value as a string. */
  histories: Record<string, TickSnapshot[]>;
}

/**
 * Reads a flag's value from an argv array.
 *
 * @param argv - process arguments
 * @param name - flag name including leading dashes
 * @returns the flag's value, or null when absent
 */
function flag(argv: string[], name: string): string | null {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

/**
 * Parses a `--seeds` value: a comma list of seeds, or a single N meaning seeds 1..N.
 *
 * @param raw - the raw flag value, or null for the default
 * @returns the seed list
 */
function parseSeeds(raw: string | null): number[] {
  if (raw === null) return [1, 2, 3, 4, 5, 6, 7, 8];
  if (raw.includes(',')) return raw.split(',').map(s => Number(s.trim()));
  const n = Number(raw);
  return Array.from({ length: n }, (_, i) => i + 1);
}

/**
 * Runs every seed in the configuration and collects its snapshot history.
 *
 * @param config - run configuration
 * @returns snapshot history per seed
 */
async function run(config: ParityConfig): Promise<Record<string, TickSnapshot[]>> {
  const histories: Record<string, TickSnapshot[]> = {};
  for (const seed of config.seeds) {
    const simulation = await LooperSingleton.getInstance()
      .start(config.persons, config.ticks, seed, () => {});
    histories[String(seed)] = simulation.history;
  }
  return histories;
}

/**
 * Compares two histories field by field and returns the first divergence found.
 *
 * @param expected - baseline histories
 * @param actual - freshly produced histories
 * @param seeds - seeds to compare, in order
 * @returns a human-readable divergence description, or null when identical
 */
function firstDivergence(
  expected: Record<string, TickSnapshot[]>,
  actual: Record<string, TickSnapshot[]>,
  seeds: number[],
): string | null {
  for (const seed of seeds) {
    const a = expected[String(seed)];
    const b = actual[String(seed)];
    if (a === undefined) return `seed ${seed}: missing from baseline`;
    if (a.length !== b.length) {
      return `seed ${seed}: history length ${b.length}, baseline ${a.length}`;
    }
    for (let t = 0; t < a.length; t++) {
      const rowA = a[t] as unknown as Record<string, unknown>;
      const rowB = b[t] as unknown as Record<string, unknown>;
      for (const key of Object.keys(rowA)) {
        const va = JSON.stringify(rowA[key]);
        const vb = JSON.stringify(rowB[key]);
        if (va !== vb) {
          return `seed ${seed}, tick ${t}, field "${key}": baseline ${va}, got ${vb}`;
        }
      }
    }
  }
  return null;
}

/** Entry point. */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const emit = flag(argv, '--emit');
  const verify = flag(argv, '--verify');

  if ((emit === null) === (verify === null)) {
    throw new Error('Pass exactly one of --emit FILE or --verify FILE');
  }

  /* eslint-disable no-console */
  if (emit !== null) {
    const config: ParityConfig = {
      seeds: parseSeeds(flag(argv, '--seeds')),
      ticks: Number(flag(argv, '--ticks') ?? 200),
      persons: Number(flag(argv, '--persons') ?? 100),
    };
    const histories = await run(config);
    const baseline: ParityBaseline = { config, histories };
    fs.writeFileSync(emit, JSON.stringify(baseline));
    console.log(
      `Emitted baseline: ${config.seeds.length} seeds x ${config.ticks} ticks x ` +
      `${config.persons} persons -> ${emit}`,
    );
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(verify as string, 'utf8')) as ParityBaseline;
  const actual = await run(baseline.config);
  const divergence = firstDivergence(baseline.histories, actual, baseline.config.seeds);

  if (divergence === null) {
    console.log(
      `PARITY OK: ${baseline.config.seeds.length} seeds x ${baseline.config.ticks} ticks ` +
      'identical to baseline',
    );
    return;
  }

  console.error(`PARITY FAILED: ${divergence}`);
  process.exitCode = 1;
  /* eslint-enable no-console */
}

main();
