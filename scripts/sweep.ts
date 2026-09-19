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
 * oscillate persistently rather than booming once and going extinct, plus `orph%` (pooled) and `orphPk%` (worst
 * single-tick share of children who are orphaned) and `welf%` (share of person-ticks drawing
 * welfare) as family-structure and redistribution-reach stress signals.
 *
 * Two columns come from `GrowthDetector` and answer "is anything running away?": `popTrd` is the
 * population's end-to-end log-growth per 1000 ticks (0 means the run finishes where it started,
 * +0.69 means it doubled, −0.69 means it halved), and `rnwy` counts seeds where *any* tracked
 * series — population, resource ceiling, extraction productivity, mean personal resources — is
 * still growing exponentially at the end after a ≥10× rise. A `rnwy` above zero means the run was
 * truncated mid-explosion and its end-state numbers describe the clock, not the model.
 *
 * `good%` exists because the outcome label is read off the FINAL decade, so in an oscillating
 * regime it depends on where in the cycle the clock stopped. It re-classifies the same run at each
 * of the last 30 decade boundaries and reports the share that read CYCLICAL or STABLE. A config in
 * a genuinely good state scores high; one that merely stopped in a flattering decade does not.
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
 *   --verbose             also print every individual run, plus the classifier gate that drove its label
 *
 * Examples:
 *   npm run sweep -- --seeds 40 --ticks 300 --sweep BASE_CHILDBIRTH_RATE=0.2,0.3,0.4
 *   npm run sweep -- --seeds 20 --set MAX_NATURAL_RESOURCE_CEILING=12000 --verbose
 */

import * as os from 'os';
import LooperSingleton from '../src/App/LooperSingleton';
import Simulation from '../src/App/Simulation';
import Variables from '../src/Helpers/Variables';
import { classifyOutcome, explainOutcome, OutcomeLabel } from '../src/Helpers/Reporters';
import { detectCycles } from '../src/Helpers/CycleDetector';
import { detectGrowth } from '../src/Helpers/GrowthDetector';
import { applyOverrides, parseSeeds } from '../src/Helpers/HarnessOverrides';
import { dispatch, isWorkerProcess, serveWorker } from './workerPool';
import {
  DEFAULT_PROGRESS_FILE, ProgressRow, ProgressSnapshot, writeProgress,
} from '../src/Helpers/RunProgress';
import { serveProgressOverHttp } from './progressServer';

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
  orphanShare: number; // orphaned children ÷ all children, pooled over every tick of the run
  peakOrphanShare: number; // worst single-tick orphan share (ticks with at least one child).
  // Max-of-noise, same defect class as peakGini: at a cycle trough the child population falls to a
  // handful, so one orphan reads as 100%. Read orphanShare instead. See docs/research-productivity-band.md.
  welfareShare: number; // welfare-eligible persons ÷ living population, pooled over every tick
  outcome: OutcomeLabel;
  numCycles: number; // complete boom-bust oscillations detected in the population series
  period: number; // avg ticks between successive peaks
  troughTrend: number; // last trough ÷ first trough (≈1 holds, <1 ratchets toward extinction)
  stableCycle: boolean; // sustained, non-collapsing oscillation
  reason: string; // which classifier gate drove the label — the diagnosis, not just the verdict
  popTrendPerK: number; // population log-growth per 1000 ticks, end to end (0 = finishes where it started)
  popExpShare: number; // share of windows where population is growing exponentially
  goodShare: number; // share of the last PHASE_WINDOW_DECADES stopping points reading CYCLICAL or STABLE
  runawaySeries: string[]; // tracked series still exploding when the clock stopped
}

interface Job {
  seed: number;
  ticks: number;
  persons: number;
  overrides: string[]; // ["KEY=VAL", ...] applied to Variables for this run
}

/** Threshold below which the pool counts as "bound" (commons exhausted) for boundFraction. */
const BOUND_THRESHOLD = 0.05;

/**
 * How many decade boundaries at the end of a run to re-classify for `good%`.
 *
 * The outcome label is read off the FINAL decade, so in an oscillating regime it depends on where
 * in the cycle the clock happened to stop: the same run reads CYCLICAL at a trough decade (commons
 * refilled) and STRUGGLING at a peak decade (commons stripped). 30 decades is 300 ticks, a little
 * over one cycle period in the scaled-commons regime, so the window spans every phase and the
 * resulting share is phase-robust where the single label is a coin flip.
 */
const PHASE_WINDOW_DECADES = 30;

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
  let orphanTotal = 0;
  let childTotal = 0;
  let peakOrphanShare = 0;
  let welfareTotal = 0;
  let popTotal = 0;
  for (const s of h) {
    welfareTotal += s.welfareRecipients;
    popTotal += s.population;
    orphanTotal += s.orphanCount;
    childTotal += s.childPopulation;
    if (s.childPopulation > 0) {
      const share = s.orphanCount / s.childPopulation;
      if (share > peakOrphanShare) peakOrphanShare = share;
    }
    if (s.population > peakPop) peakPop = s.population;
    if (s.population < minPop) minPop = s.population;
    if (s.resourceGini > peakGini) peakGini = s.resourceGini;
    if (s.naturalResourceCeiling > 0 && s.naturalResources < BOUND_THRESHOLD * s.naturalResourceCeiling) boundTicks++;
    if (extinctTick === null && s.population === 0) extinctTick = s.tick;
  }

  const cycles = detectCycles(h.map((s) => s.population), {
    minCycles: Variables.CYCLICAL_MIN_CYCLES,
    troughHoldFraction: Variables.CYCLICAL_TROUGH_HOLD_FRACTION,
  });

  // Four series can run away, and each means something different: population (a boom the clock cut
  // short), ceiling (technology lifting carrying capacity without bound), productivity (parking at
  // its cap), mean resources (wealth compounding faster than it is consumed). minLevel is scaled
  // per series because productivity lives near 1 while population lives in the thousands.
  const popGrowth = detectGrowth(h.map((s) => s.population));
  const tracked: [string, ReturnType<typeof detectGrowth>][] = [
    ['population', popGrowth],
    ['ceiling', detectGrowth(h.map((s) => s.naturalResourceCeiling))],
    ['productivity', detectGrowth(h.map((s) => s.extractionProductivity), { minLevel: 0.001 })],
    ['resources', detectGrowth(h.map((s) => s.averageResources), { minLevel: 0.1 })],
  ];

  const outcome = classifyOutcome(sim.decadeHistory, persons, cycles);

  // Re-classify the same run as if the clock had stopped at each of the last PHASE_WINDOW_DECADES
  // decade boundaries. A config that is genuinely in a good state scores high here; one that merely
  // stopped in a flattering decade does not.
  const populations = h.map((s) => s.population);
  const decades = sim.decadeHistory;
  let goodStops = 0, totalStops = 0;
  for (let k = Math.max(2, decades.length - PHASE_WINDOW_DECADES); k <= decades.length; k++) {
    const label = classifyOutcome(decades.slice(0, k), persons, detectCycles(
      populations.slice(0, Math.min(populations.length, k * 10)),
      { minCycles: Variables.CYCLICAL_MIN_CYCLES, troughHoldFraction: Variables.CYCLICAL_TROUGH_HOLD_FRACTION },
    ));
    totalStops++;
    if (label === 'CYCLICAL' || label === 'STABLE') goodStops++;
  }

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
    orphanShare: childTotal > 0 ? orphanTotal / childTotal : 0,
    peakOrphanShare,
    welfareShare: popTotal > 0 ? welfareTotal / popTotal : 0,
    outcome,
    reason: explainOutcome(sim.decadeHistory, persons, outcome, cycles),
    numCycles: cycles.numCycles,
    period: cycles.period,
    troughTrend: cycles.troughTrend,
    stableCycle: cycles.stableCycle,
    popTrendPerK: 1000 * popGrowth.trendRate,
    popExpShare: popGrowth.share,
    goodShare: totalStops > 0 ? goodStops / totalStops : 0,
    runawaySeries: tracked.filter(([, g]) => g.runaway).map(([name]) => name),
  };
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

/**
 * Summarise one finished job for the status file.
 *
 * Deliberately a handful of headline fields rather than the whole `RunMetrics`: the file is read
 * by a human mid-run who wants to know whether the configuration is going anywhere, and the full
 * metrics are printed by the final table anyway.
 *
 * @param index - the job's position in the dispatch order
 * @param jobs - every job in the run
 * @param seeds - the seed list, used to recover which sweep value this job belongs to
 * @param sweepKey - the swept Variables key, or null when not sweeping
 * @param sweepVals - the swept values, in job-matrix order
 * @param result - the finished job's metrics
 * @returns one row for the status file
 */
function progressRow(
  index: number, jobs: Job[], seeds: number[], sweepKey: string | null,
  sweepVals: string[], result: RunMetrics,
): ProgressRow {
  const row: ProgressRow = { seed: jobs[index].seed };
  if (sweepKey) row[sweepKey] = sweepVals[Math.floor(index / seeds.length)];
  row.outcome = result.outcome;
  row.endPop = result.endPop;
  row.peakPop = result.peakPop;
  row.popTrd = Number(result.popTrendPerK.toFixed(2));
  row.cyc = result.numCycles;
  return row;
}

async function main(): Promise<void> {
  const { opts, sets } = parseArgs(process.argv.slice(2));
  const seeds = parseSeeds(opts.seeds, [1, 2, 3, 4, 5, 6, 7, 8]);
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
      jobs.push({ seed, ticks, persons, overrides });
    }
  }

  const nWorkers = Math.max(1, Math.min(workers, jobs.length));
  console.log(`seeds=[${seeds.join(',')}] ticks=${ticks} persons=${persons} jobs=${jobs.length} workers=${nWorkers}` +
    (sets.length ? ` set:{${sets.join(' ')}}` : '') + (sweepKey ? ` sweep:${sweepKey}` : ''));
  console.log('');

  const t0 = Date.now();

  // Progress is published to a status file after every job so a long run can be inspected while
  // it works, and — the reason this exists — so killing it keeps the rows it already finished.
  const statusPath = opts.status ?? DEFAULT_PROGRESS_FILE;
  const snapshot: ProgressSnapshot = {
    pid: process.pid,
    tool: 'sweep',
    label: `${jobs.length} jobs, ${ticks} ticks, ${persons} persons` +
      (sweepKey ? `, sweeping ${sweepKey}` : '') + (sets.length ? `, set:{${sets.join(' ')}}` : ''),
    startedAtMs: t0,
    updatedAtMs: t0,
    total: jobs.length,
    completed: 0,
    inFlight: 0,
    done: false,
    rows: [],
  };
  writeProgress(statusPath, snapshot);

  // `--port` additionally serves the same snapshot over HTTP, always current rather than as of the
  // last completed job. Opt-in: two concurrent sweeps would otherwise collide on one port.
  const closeServer = opts.port
    ? serveProgressOverHttp(Number(opts.port), () => ({ ...snapshot, updatedAtMs: Date.now() }))
    : null;

  // A job can run for many minutes, so without a heartbeat the file's timestamp would make a
  // healthy run look wedged. Unref'd so it never keeps the process alive on its own.
  const heartbeat = setInterval(() => {
    snapshot.updatedAtMs = Date.now();
    writeProgress(statusPath, snapshot);
  }, 10_000);
  heartbeat.unref();

  const controller = new AbortController();
  let stopping = false;
  const requestStop = (signalName: string): void => {
    if (stopping) return;
    stopping = true;
    console.log(`\n[${signalName}] stopping after in-flight jobs; reporting what finished.`);
    controller.abort();
  };
  process.on('SIGINT', () => requestStop('SIGINT'));
  process.on('SIGTERM', () => requestStop('SIGTERM'));

  const flat = await dispatch<Job, RunMetrics>(jobs, workers, __filename, {
    signal: controller.signal,
    onDispatch: (inFlight): void => {
      snapshot.inFlight = inFlight;
      snapshot.updatedAtMs = Date.now();
      writeProgress(statusPath, snapshot);
    },
    onProgress: (completedCount, total, index, result): void => {
      snapshot.completed = completedCount;
      snapshot.inFlight = Math.max(0, snapshot.inFlight - 1);
      snapshot.updatedAtMs = Date.now();
      snapshot.rows.push(progressRow(index, jobs, seeds, sweepKey, sweepVals, result));
      writeProgress(statusPath, snapshot);
    },
  });
  clearInterval(heartbeat);
  closeServer?.();
  snapshot.done = true;
  snapshot.inFlight = 0;
  snapshot.updatedAtMs = Date.now();
  writeProgress(statusPath, snapshot);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  // Jobs were emitted sweep-value-major, seed-minor, and come back in the same order. A stopped
  // run leaves holes, so unfinished slots are dropped rather than aggregated as if they were data.
  const results = new Map<string, RunMetrics>();
  jobs.forEach((job, i) => {
    const r = flat[i];
    if (r !== undefined) results.set(`${sweepVals[Math.floor(i / seeds.length)]}::${job.seed}`, r);
  });
  if (stopping) {
    console.log(`(stopped: ${results.size} of ${jobs.length} jobs completed; rows below cover only those)\n`);
  }

  const header = (sweepKey ? `${sweepKey.padEnd(28)}  ` : '') +
    `outcomes (n=${seeds.length})`.padEnd(34) + `  endPop  peakPop  peakGini  bound%  orph%  orphPk%  welf%  extinct  cyc  stable  good%  popTrd  rnwy`;
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const sv of sweepVals) {
    // A stopped run has no result for some seeds. Aggregating over the seeds that did finish is
    // the only honest option, so every count below is denominated in `n`, not the requested seed
    // count — a 3/5 extinction rate from a run that was cut short must not read as 3/12.
    const rows = seeds
      .map((seed) => results.get(`${sv}::${seed}`))
      .filter((r): r is RunMetrics => r !== undefined);
    if (rows.length === 0) continue;
    const n = rows.length;
    const extinctCount = rows.filter((r) => r.extinctTick !== null).length;
    const stableCount = rows.filter((r) => r.stableCycle).length;
    const runawayCount = rows.filter((r) => r.runawaySeries.length > 0).length;
    const label = sweepKey ? `${sweepKey}=${sv}`.padEnd(28) + '  ' : '';
    console.log(
      label +
      tally(rows.map((r) => r.outcome)).padEnd(34) + '  ' +
      String(median(rows.map((r) => r.endPop))).padStart(6) + '  ' +
      String(median(rows.map((r) => r.peakPop))).padStart(7) + '  ' +
      median(rows.map((r) => r.peakGini)).toFixed(2).padStart(8) + '  ' +
      (100 * median(rows.map((r) => r.boundFraction))).toFixed(0).padStart(5) + '%  ' +
      (100 * median(rows.map((r) => r.orphanShare))).toFixed(1).padStart(4) + '%  ' +
      (100 * median(rows.map((r) => r.peakOrphanShare))).toFixed(0).padStart(6) + '%  ' +
      (100 * median(rows.map((r) => r.welfareShare))).toFixed(0).padStart(4) + '%  ' +
      `${extinctCount}/${n}`.padStart(7) + '  ' +
      String(median(rows.map((r) => r.numCycles))).padStart(3) + '  ' +
      `${stableCount}/${n}`.padStart(6) + '  ' +
      (100 * median(rows.map((r) => r.goodShare))).toFixed(0).padStart(4) + '%  ' +
      median(rows.map((r) => r.popTrendPerK)).toFixed(2).padStart(6) + '  ' +
      `${runawayCount}/${n}`.padStart(4),
    );
    if (verbose) {
      for (const r of rows) {
        console.log(
          `    seed ${String(r.seed).padStart(3)}  ${r.outcome.padEnd(11)} ` +
          `end=${String(r.endPop).padStart(4)} peak=${String(r.peakPop).padStart(4)} min=${String(r.minPop).padStart(4)} ` +
          `gini=${r.peakGini.toFixed(2)} bound=${(100 * r.boundFraction).toFixed(0)}% ` +
          `orph=${(100 * r.orphanShare).toFixed(1)}%/pk${(100 * r.peakOrphanShare).toFixed(0)}% ` +
          `welf=${(100 * r.welfareShare).toFixed(0)}% ` +
          `cyc=${r.numCycles} per=${r.period.toFixed(0)} trTrend=${r.troughTrend.toFixed(2)}${r.stableCycle ? ' STABLE-CYCLE' : ''} ` +
          `good=${(100 * r.goodShare).toFixed(0)}% popTrd=${r.popTrendPerK.toFixed(2)}/kt exp=${(100 * r.popExpShare).toFixed(0)}%` +
          `${r.runawaySeries.length ? ` RUNAWAY[${r.runawaySeries.join(',')}]` : ''} ` +
          `deaths(ill/mur/dis/sui)=${r.illness}/${r.murder}/${r.disaster}/${r.suicide} births=${r.births} ` +
          `${r.extinctTick !== null ? `extinct@${r.extinctTick}` : ''}`,
        );
        console.log(`                   why: ${r.reason}`);
      }
    }
  }
  console.log(`\n(${results.size}${results.size === jobs.length ? '' : ` of ${jobs.length}`} runs in ${elapsed}s)`);
}

if (isWorkerProcess()) {
  serveWorker<Job, RunMetrics>(async (job) => {
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
