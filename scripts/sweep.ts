/**
 * Simulation sweep harness — run many simulations in parallel and print a metrics table.
 *
 * Runs the tick loop in-process across a set of seeds, optionally sweeping one `Variables`
 * constant over several values and/or overriding others. Work is distributed across a pool of
 * forked worker processes (one per CPU by default), each running its share of the seed×value
 * matrix in its own process — so `Variables` overrides are isolated per process and many initial
 * conditions run on all cores. Per run it extracts metrics from `simulation.history`; per sweep
 * value it aggregates across seeds so you can see at a glance which parameter value gives a
 * bounded, non-degenerate population instead of eyeballing single-seed trajectories. The table
 * also reports cycle metrics from `CycleDetector` — `cyc` (median boom-bust oscillations) and
 * `stable` (count of seeds showing a sustained, non-collapsing cycle) — to find regimes that
 * oscillate persistently rather than booming once and going extinct.
 *
 * Usage:
 *   npx ts-node scripts/sweep.ts [options]   (or: npm run sweep -- [options])
 *
 * Options:
 *   --seeds 42,7,1,99     comma list of seeds, or a single N meaning seeds 1..N (default 1..8)
 *   --ticks 200           ticks per run (default 200)
 *   --persons 100         initial population (default 100)
 *   --set KEY=VAL         override a Variables constant for every run (repeatable)
 *   --sweep KEY=a,b,c     run the whole seed set once per value of KEY (one sweep dimension)
 *   --workers N           parallel worker processes (default: CPU count)
 *   --verbose             also print every individual run, not just the per-value aggregate
 *
 * Examples:
 *   npm run sweep -- --seeds 40 --ticks 300 --sweep BASE_CHILDBIRTH_RATE=0.2,0.3,0.4
 *   npm run sweep -- --seeds 20 --set MAX_NATURAL_RESOURCE_CEILING=12000 --verbose
 */

import { fork } from 'child_process';
import * as os from 'os';
import LooperSingleton from '../src/App/LooperSingleton';
import Simulation from '../src/App/Simulation';
import Variables from '../src/Helpers/Variables';
import { classifyOutcome, OutcomeLabel } from '../src/Helpers/Reporters';
import { detectCycles } from '../src/Helpers/CycleDetector';

interface RunMetrics {
  seed: number;
  endPop: number;
  peakPop: number;
  minPop: number;
  extinctTick: number | null;
  peakGini: number;
  illness: number;
  murder: number;
  disaster: number;
  suicide: number;
  births: number;
  boundFraction: number; // share of ticks the commons pool sits below 5% of its ceiling
  outcome: OutcomeLabel;
  numCycles: number; // complete boom-bust oscillations detected in the population series
  period: number; // avg ticks between successive peaks
  troughTrend: number; // last trough ÷ first trough (≈1 holds, <1 ratchets toward extinction)
  stableCycle: boolean; // sustained, non-collapsing oscillation
}

interface Job {
  id: string;
  seed: number;
  ticks: number;
  persons: number;
  overrides: string[]; // ["KEY=VAL", ...] applied to Variables for this run
}

/** Threshold below which the pool counts as "bound" (commons exhausted) for boundFraction. */
const BOUND_THRESHOLD = 0.05;

/** Apply `KEY=VALUE` to the static Variables class, returning a restore closure. */
function applyOverrides(pairs: string[]): () => void {
  const saved: [string, unknown][] = [];
  for (const pair of pairs) {
    const [key, raw] = pair.split('=');
    if (!(key in Variables)) throw new Error(`Unknown Variables constant: ${key}`);
    saved.push([key, (Variables as unknown as Record<string, unknown>)[key]]);
    (Variables as unknown as Record<string, unknown>)[key] = Number(raw);
  }
  return () => {
    for (const [key, value] of saved) (Variables as unknown as Record<string, unknown>)[key] = value;
  };
}

/** Run one simulation (overrides already applied) and reduce its history to a metrics row. */
async function runOne(seed: number, ticks: number, persons: number): Promise<RunMetrics> {
  const sim: Simulation = await LooperSingleton.getInstance().start(persons, ticks, seed, () => {}, {});
  const h = sim.history;
  const last = h[h.length - 1];

  let peakPop = 0;
  let minPop = Infinity;
  let peakGini = 0;
  let boundTicks = 0;
  let extinctTick: number | null = null;
  for (const s of h) {
    if (s.population > peakPop) peakPop = s.population;
    if (s.population < minPop) minPop = s.population;
    if (s.resourceGini > peakGini) peakGini = s.resourceGini;
    if (s.naturalResourceCeiling > 0 && s.naturalResources < BOUND_THRESHOLD * s.naturalResourceCeiling) boundTicks++;
    if (extinctTick === null && s.population === 0) extinctTick = s.tick;
  }

  const cycles = detectCycles(h.map((s) => s.population));

  return {
    seed,
    endPop: last.population,
    peakPop,
    minPop: minPop === Infinity ? 0 : minPop,
    extinctTick,
    peakGini,
    illness: last.cumulativeDeathsByIllness,
    murder: last.cumulativeDeathsByMurder,
    disaster: last.cumulativeDeathsByDisaster,
    suicide: last.cumulativeDeathsBySuicide,
    births: last.cumulativeBirths,
    boundFraction: boundTicks / h.length,
    outcome: classifyOutcome(sim.decadeHistory, persons),
    numCycles: cycles.numCycles,
    period: cycles.period,
    troughTrend: cycles.troughTrend,
    stableCycle: cycles.stableCycle,
  };
}

// ----- Worker mode: receive jobs over IPC, run them, return metrics -----

interface JobMsg { type: 'job'; job: Job }
interface DoneMsg { type: 'done' }
type ParentMsg = JobMsg | DoneMsg;

function runWorker(): void {
  process.on('message', (msg: ParentMsg) => {
    if (msg.type === 'done') { process.exit(0); }
    const { job } = msg;
    const restore = applyOverrides(job.overrides);
    runOne(job.seed, job.ticks, job.persons).then(metrics => {
      restore();
      process.send!({ type: 'result', id: job.id, metrics });
    }).catch(err => {
      restore();
      console.error(err);
      process.exit(1);
    });
  });
  process.send!({ type: 'ready' });
}

// ----- Parent mode: build the matrix, dispatch to a worker pool, aggregate -----

function parseArgs(argv: string[]): { opts: Record<string, string>; sets: string[] } {
  const opts: Record<string, string> = {};
  const sets: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'verbose') { opts.verbose = 'true'; continue; }
    const val = argv[++i] ?? '';
    if (key === 'set') sets.push(val);
    else opts[key] = val;
  }
  return { opts, sets };
}

function parseSeeds(spec: string | undefined): number[] {
  if (!spec) return [1, 2, 3, 4, 5, 6, 7, 8];
  if (spec.includes(',')) return spec.split(',').map((s) => Number(s.trim()));
  return Array.from({ length: Number(spec) }, (_, i) => i + 1);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function tally(labels: OutcomeLabel[]): string {
  const counts = new Map<string, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  return [...counts.entries()].map(([k, v]) => `${k}×${v}`).join(' ');
}

/** Run all jobs across a pool of forked workers; resolve with id→metrics when every job is done. */
function dispatch(jobs: Job[], workerCount: number): Promise<Map<string, RunMetrics>> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, RunMetrics>();
    const nWorkers = Math.max(1, Math.min(workerCount, jobs.length));
    const children: ReturnType<typeof fork>[] = [];
    let next = 0;
    let remaining = jobs.length;
    let settled = false;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      // Tell every worker to exit so their IPC channels close and the parent can terminate.
      for (const c of children) if (c.connected) c.send({ type: 'done' });
      resolve(results);
    };

    for (let w = 0; w < nWorkers; w++) {
      const child = fork(__filename, ['--worker'], {
        execArgv: ['-r', 'ts-node/register/transpile-only'],
      });
      children.push(child);
      const pump = (): void => {
        if (settled) return;
        if (next < jobs.length) child.send({ type: 'job', job: jobs[next++] });
        else child.send({ type: 'done' });
      };
      child.on('message', (msg: { type: string; id?: string; metrics?: RunMetrics }) => {
        if (msg.type === 'result' && msg.id) {
          results.set(msg.id, msg.metrics as RunMetrics);
          remaining--;
        }
        if (remaining === 0) finish();
        else pump();
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code && code !== 0 && !settled) reject(new Error(`worker exited with code ${code}`));
      });
    }
  });
}

async function main(): Promise<void> {
  const { opts, sets } = parseArgs(process.argv.slice(2));
  const seeds = parseSeeds(opts.seeds);
  const ticks = Number(opts.ticks ?? 200);
  const persons = Number(opts.persons ?? 100);
  const verbose = opts.verbose === 'true';
  const workers = Number(opts.workers ?? os.cpus().length);

  let sweepKey: string | null = null;
  let sweepVals: string[] = [''];
  if (opts.sweep) {
    const [k, vlist] = opts.sweep.split('=');
    sweepKey = k;
    sweepVals = vlist.split(',');
  }

  // Build the full job matrix.
  const jobs: Job[] = [];
  for (const sv of sweepVals) {
    for (const seed of seeds) {
      const overrides = [...sets];
      if (sweepKey) overrides.push(`${sweepKey}=${sv}`);
      jobs.push({ id: `${sv}::${seed}`, seed, ticks, persons, overrides });
    }
  }

  const nWorkers = Math.max(1, Math.min(workers, jobs.length));
  console.log(`seeds=[${seeds.join(',')}] ticks=${ticks} persons=${persons} jobs=${jobs.length} workers=${nWorkers}` +
    (sets.length ? ` set:{${sets.join(' ')}}` : '') + (sweepKey ? ` sweep:${sweepKey}` : ''));
  console.log('');

  const t0 = Date.now();
  const results = await dispatch(jobs, workers);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const header = (sweepKey ? `${sweepKey.padEnd(28)}  ` : '') +
    `outcomes (n=${seeds.length})`.padEnd(34) + `  endPop  peakPop  peakGini  bound%  extinct  cyc  stable`;
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const sv of sweepVals) {
    const rows = seeds.map((seed) => results.get(`${sv}::${seed}`)!);
    const extinctCount = rows.filter((r) => r.extinctTick !== null).length;
    const stableCount = rows.filter((r) => r.stableCycle).length;
    const label = sweepKey ? `${sweepKey}=${sv}`.padEnd(28) + '  ' : '';
    console.log(
      label +
      tally(rows.map((r) => r.outcome)).padEnd(34) + '  ' +
      String(median(rows.map((r) => r.endPop))).padStart(6) + '  ' +
      String(median(rows.map((r) => r.peakPop))).padStart(7) + '  ' +
      median(rows.map((r) => r.peakGini)).toFixed(2).padStart(8) + '  ' +
      (100 * median(rows.map((r) => r.boundFraction))).toFixed(0).padStart(5) + '%  ' +
      `${extinctCount}/${seeds.length}`.padStart(7) + '  ' +
      String(median(rows.map((r) => r.numCycles))).padStart(3) + '  ' +
      `${stableCount}/${seeds.length}`.padStart(6),
    );
    if (verbose) {
      for (const r of rows) {
        console.log(
          `    seed ${String(r.seed).padStart(3)}  ${r.outcome.padEnd(11)} ` +
          `end=${String(r.endPop).padStart(4)} peak=${String(r.peakPop).padStart(4)} min=${String(r.minPop).padStart(4)} ` +
          `gini=${r.peakGini.toFixed(2)} bound=${(100 * r.boundFraction).toFixed(0)}% ` +
          `cyc=${r.numCycles} per=${r.period.toFixed(0)} trTrend=${r.troughTrend.toFixed(2)}${r.stableCycle ? ' STABLE-CYCLE' : ''} ` +
          `deaths(ill/mur/dis/sui)=${r.illness}/${r.murder}/${r.disaster}/${r.suicide} births=${r.births} ` +
          `${r.extinctTick !== null ? `extinct@${r.extinctTick}` : ''}`,
        );
      }
    }
  }
  console.log(`\n(${jobs.length} runs in ${elapsed}s)`);
}

if (process.argv.includes('--worker')) {
  runWorker();
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
