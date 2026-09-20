/**
 * Compare two sweep configurations and say whether the difference is real.
 *
 * `scripts/sweep.ts` prints medians and counts, which have to be eyeballed. Eyeballing is how this
 * project has repeatedly published differences that later failed to reproduce — see the re-measured
 * claims in `docs/research-sweep-session-2026-09-14.md`. This runs both arms over the *same seeds*
 * and reports, for each measure, whether the gap is bigger than chance.
 *
 * Both arms share a seed set, so the comparison is paired: seed 7 gets the same starting population
 * and the same random stream in both arms. Pairing cancels seed-level luck and is far more sensitive
 * than comparing two medians. Yes/no measures use an exact McNemar test on the runs where the arms
 * disagree; measured quantities use a sign-flip permutation test with a bootstrap range for the size
 * of the change. See `src/Helpers/Statistics.ts`.
 *
 * When a difference is NOT established, the tool says how many seeds would have been needed, so a
 * null reads as "too small to tell with this many runs" rather than "no effect".
 *
 * Both arms' runs are dispatched to one pool of forked workers, so a comparison uses every core.
 * The runs are independent and seeded, so which worker takes which job cannot change any result.
 *
 * Usage:
 *   npx ts-node scripts/compare.ts --seeds 48 --ticks 2000 --b BASE_CHILDBIRTH_RATE=1.0
 *
 * Options:
 *   --seeds 48         comma list of seeds, or a single N meaning seeds 1..N (default 1..48)
 *   --ticks 2000       ticks per run (default 2000)
 *   --persons 100      initial population (default 100)
 *   --a KEY=VAL        baseline override (repeatable; omit entirely for stock defaults)
 *   --b KEY=VAL        treatment override (repeatable)
 *   --both KEY=VAL     override applied to BOTH arms (repeatable) — e.g. a fixed background config
 *   --workers N        parallel worker processes (default: CPU count)
 *   --rng-seed 1       seed for the permutation and bootstrap draws, so results reproduce (default 1)
 *
 * See docs/calibration-guide.md.
 */

import * as os from 'os';
import LooperSingleton from '../src/App/LooperSingleton';
import Simulation from '../src/App/Simulation';
import SeededRandom from '../src/Helpers/SeededRandom';
import {
  mcnemarExact, pairedPermutationTest, bootstrapPairedDifference,
  median, seedsNeededForRateChange,
} from '../src/Helpers/Statistics';
import Variables from '../src/Helpers/Variables';
import { detectCycles } from '../src/Helpers/CycleDetector';
import { applyOverrides, parseSeeds } from '../src/Helpers/HarnessOverrides';
import { dispatch, isWorkerProcess, serveWorker } from './workerPool';
import { DEFAULT_PROGRESS_FILE, ProgressSnapshot, writeProgress } from '../src/Helpers/RunProgress';

/** Permutations drawn per comparison; also sets the finest probability the test can resolve. */
const PERMUTATIONS = 10_000;

/** Per-run measurements extracted from one simulation history. */
interface RunMeasures {
  extinct: number;
  peakPopulation: number;
  endPopulation: number;
  troughPopulation: number;
  cycles: number;
  ticksWithCommonsEmpty: number;
}

/** The measures compared, in report order, with a plain label and whether bigger is better. */
const MEASURES: { key: keyof RunMeasures; label: string; binary?: boolean }[] = [
  { key: 'extinct', label: 'Runs ending with everyone dead', binary: true },
  { key: 'peakPopulation', label: 'Peak population' },
  { key: 'endPopulation', label: 'Population at the end' },
  { key: 'troughPopulation', label: 'Lowest population reached' },
  { key: 'cycles', label: 'Boom-bust cycles completed' },
  { key: 'ticksWithCommonsEmpty', label: 'Share of ticks with the pool stripped (%)' },
];

/** Parse `--flag value` pairs and the repeatable override flags from argv. */
function parseArgs(argv: string[]): { opts: Record<string, string>; a: string[]; b: string[]; both: string[] } {
  const opts: Record<string, string> = {};
  const a: string[] = [], b: string[] = [], both: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (key === 'a') { a.push(value); i++; continue; }
    if (key === 'b') { b.push(value); i++; continue; }
    if (key === 'both') { both.push(value); i++; continue; }
    opts[key] = value;
    i++;
  }
  return { opts, a, b, both };
}

/** One simulation to run: an arm's overrides plus the seed and size it runs at. */
interface Job {
  overrides: string[];
  seed: number;
  ticks: number;
  persons: number;
}

/** Run one simulation (overrides already applied) and reduce its history to the compared measures. */
async function runOne(seed: number, ticks: number, persons: number): Promise<RunMeasures> {
  const sim: Simulation = await LooperSingleton.getInstance().start(persons, ticks, seed, () => {}, {});
  const history = sim.history;
  const last = history[history.length - 1];
  let peak = 0, trough = Infinity, empty = 0;
  for (const s of history) {
    peak = Math.max(peak, s.population);
    if (s.population > 0) trough = Math.min(trough, s.population);
    if (s.naturalResourceCeiling > 0 && s.naturalResources / s.naturalResourceCeiling < 0.05) empty++;
  }
  // Cycles come from `detectCycles`, the same call (and the same Variables thresholds) that feeds
  // sweep.ts's `cyc` column and `classifyOutcome`, so the three cannot disagree about what a cycle
  // is. This previously counted every local maximum in the RAW tick series as a "threshold-free
  // proxy", which counted jitter, not cycles — and the jitter count falls as the population grows,
  // because a bigger population is relatively less noisy. Measured on one seed at 6000 ticks: the
  // local-max count read 83 for a small-world run against 53 for a big-world one, while the real
  // cycle counts were 23 and 24. So the proxy reversed the sign of the comparison and the tool
  // reported the artifact as a REAL DIFFERENCE. See docs/research-clean-long-run-100-founders.md.
  const cycles = detectCycles(history.map((s) => s.population), {
    minCycles: Variables.CYCLICAL_MIN_CYCLES,
    troughHoldFraction: Variables.CYCLICAL_TROUGH_HOLD_FRACTION,
  }).numCycles;
  return {
    extinct: last.population === 0 ? 1 : 0,
    peakPopulation: peak,
    endPopulation: last.population,
    troughPopulation: trough === Infinity ? 0 : trough,
    cycles,
    ticksWithCommonsEmpty: Math.round((100 * empty) / history.length),
  };
}

/**
 * Render a probability as plain English odds, e.g. "about 1 in 2,000".
 *
 * The permutation test cannot resolve below 1/(iterations+1), so anything at that floor is reported
 * as an upper bound rather than a measurement.
 *
 * @param p - probability of seeing a gap this big when the arms truly match
 * @param floor - smallest probability the underlying test can distinguish from zero
 * @returns a phrase a reader can act on without knowing what a p-value is
 */
function asOdds(p: number, floor = 0): string {
  if (p >= 0.5) return 'more likely than not to be chance';
  if (floor > 0 && p <= floor * 1.0001) return `less than 1 in ${Math.round(1 / floor).toLocaleString('en-US')}`;
  const oneIn = Math.round(1 / p);
  if (oneIn >= 1e6) return 'less than 1 in a million';
  return `about 1 in ${oneIn.toLocaleString('en-US')}`;
}

/** Turn a probability into a verdict a reader can act on without knowing what a p-value is. */
function verdict(p: number): string {
  if (p < 0.01) return 'REAL DIFFERENCE';
  if (p < 0.05) return 'PROBABLY REAL';
  return 'TOO CLOSE TO CALL';
}

/** Report the yes/no measure using the paired exact test, plus a power note when it is inconclusive. */
function reportBinary(label: string, baseline: number[], treatment: number[], seeds: number): void {
  const baseCount = baseline.reduce((x, y) => x + y, 0);
  const treatCount = treatment.reduce((x, y) => x + y, 0);
  let onlyBaseline = 0, onlyTreatment = 0;
  for (let i = 0; i < baseline.length; i++) {
    if (baseline[i] === 1 && treatment[i] === 0) onlyBaseline++;
    if (baseline[i] === 0 && treatment[i] === 1) onlyTreatment++;
  }
  const p = mcnemarExact(onlyBaseline, onlyTreatment);
  console.log(`\n${label}`);
  console.log(`  baseline ${baseCount}/${seeds}   treatment ${treatCount}/${seeds}`);
  console.log(`  disagreed on ${onlyBaseline + onlyTreatment} seeds (${onlyBaseline} baseline-only, ${onlyTreatment} treatment-only)`);
  console.log(`  ${verdict(p)} — a gap this big by chance: ${asOdds(p)}`);
  if (p >= 0.05) {
    const needed = seedsNeededForRateChange(baseCount / seeds, treatCount / seeds);
    console.log(`  not established. To pin down a gap this size you would need about `
      + `${needed === Infinity ? 'infinitely many' : needed} seeds per arm (you ran ${seeds}).`);
  }
}

/** Report a measured quantity using the paired permutation test and a bootstrap range. */
function reportContinuous(label: string, baseline: number[], treatment: number[], rngSeed: number): void {
  const p = pairedPermutationTest(baseline, treatment, new SeededRandom(rngSeed).asRNG(), PERMUTATIONS);
  const range = bootstrapPairedDifference(baseline, treatment, new SeededRandom(rngSeed + 1).asRNG());
  const round = (x: number) => (Math.abs(x) >= 10 ? Math.round(x) : Math.round(x * 10) / 10);
  console.log(`\n${label}`);
  console.log(`  baseline median ${round(median(baseline))}   treatment median ${round(median(treatment))}`);
  console.log(`  typical change per seed: ${range.estimate > 0 ? '+' : ''}${round(range.estimate)} `
    + `(plausibly ${round(range.low)} to ${round(range.high)})`);
  console.log(`  ${verdict(p)} — a shift this big by chance: ${asOdds(p, 1 / (PERMUTATIONS + 1))}`);
  if (range.low <= 0 && range.high >= 0) console.log('  the plausible range includes zero, so even the direction is unsettled.');
}

/** Entry point: run both arms over one seed set and report each measure. */
async function main(): Promise<void> {
  const { opts, a, b, both } = parseArgs(process.argv.slice(2));
  const seeds = parseSeeds(opts.seeds ?? '48', []);
  const ticks = Number(opts.ticks ?? 2000);
  const persons = Number(opts.persons ?? 100);
  const rngSeed = Number(opts['rng-seed'] ?? 1);
  const workers = Number(opts.workers ?? os.cpus().length);

  console.log(`Comparing ${seeds.length} seeds at ${ticks} ticks, ${persons} starting people.`);
  console.log(`  baseline:  ${[...both, ...a].join(' ') || '(stock defaults)'}`);
  console.log(`  treatment: ${[...both, ...b].join(' ') || '(stock defaults)'}`);
  console.log('  Both arms use the same seeds, so each run is compared against its own twin.');

  // Both arms in one pool: 2N independent jobs saturate the cores better than one arm at a time.
  const jobs: Job[] = [
    ...seeds.map((seed) => ({ overrides: [...both, ...a], seed, ticks, persons })),
    ...seeds.map((seed) => ({ overrides: [...both, ...b], seed, ticks, persons })),
  ];
  const t0 = Date.now();

  // Same status file as the sweep, for the same reason: a paired comparison at 48 seeds is a long
  // wait, and `npm run progress` should answer "how far along" without stopping anything.
  const statusPath = opts.status ?? DEFAULT_PROGRESS_FILE;
  const snapshot: ProgressSnapshot = {
    pid: process.pid,
    tool: 'compare',
    label: `${jobs.length} jobs (${seeds.length} paired seeds), ${ticks} ticks, ${persons} persons`,
    startedAtMs: t0,
    updatedAtMs: t0,
    total: jobs.length,
    completed: 0,
    inFlight: 0,
    done: false,
    rows: [],
  };
  writeProgress(statusPath, snapshot);

  const all = await dispatch<Job, RunMeasures>(jobs, workers, __filename, {
    onDispatch: (inFlight): void => {
      snapshot.inFlight = inFlight;
      snapshot.updatedAtMs = Date.now();
      writeProgress(statusPath, snapshot);
    },
    onProgress: (completedCount): void => {
      snapshot.completed = completedCount;
      snapshot.inFlight = Math.max(0, snapshot.inFlight - 1);
      snapshot.updatedAtMs = Date.now();
      writeProgress(statusPath, snapshot);
    },
  });
  snapshot.done = true;
  snapshot.updatedAtMs = Date.now();
  writeProgress(statusPath, snapshot);

  // Uninterrupted dispatch fills every slot; compare has no stop path because a partial arm cannot
  // be paired against a complete one, and a half-paired test is worse than no test.
  const complete = all.filter((r): r is RunMeasures => r !== undefined);
  if (complete.length !== jobs.length) throw new Error('comparison did not complete; refusing to report a partial pairing');
  const baseline = complete.slice(0, seeds.length);
  const treatment = complete.slice(seeds.length);
  console.log(`  ${jobs.length} runs on ${Math.max(1, Math.min(workers, jobs.length))} workers`
    + ` in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

  for (const m of MEASURES) {
    const x = baseline.map((r) => r[m.key]);
    const y = treatment.map((r) => r[m.key]);
    if (m.binary) reportBinary(m.label, x, y, seeds.length);
    else reportContinuous(m.label, x, y, rngSeed);
  }

  console.log(`\n${MEASURES.length} measures were compared. When nothing truly differs, expect a false alarm`
    + ` in roughly 1 run of this tool in ${Math.round(1 / (1 - (1 - 0.05) ** MEASURES.length))}.`
    + ' Treat a single surprising measure with suspicion; treat a measure you predicted in advance as stronger evidence.');
}

if (isWorkerProcess()) {
  serveWorker<Job, RunMeasures>(async (job) => {
    const restore = applyOverrides(job.overrides);
    try {
      return await runOne(job.seed, job.ticks, job.persons);
    } finally {
      restore();
    }
  });
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
