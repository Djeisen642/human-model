/**
 * Escape-velocity probe — finds the state, if one exists, past which a run stops dying.
 *
 * The ARD-051 outcome labels are a *snapshot* judgement: they read the final decade and say what
 * the society looks like right now. They cannot say whether it will still be there in a thousand
 * ticks, and `docs/research-tuning-defaults.md` records the consequence — configs whose only
 * benefit is delay read as rescues at any horizon shorter than the delay they buy.
 *
 * This probe asks the forward-looking question instead: is there an observable level that doomed
 * runs never reach? It measures that two ways, and both are printed:
 *
 *   1. SEPARATION. Pool every landmark observation in every run. Split the runs by eventual fate
 *      and compare the best value each doomed run ever attained against the values survivors sit
 *      at. A threshold exists only where the doomed maximum falls below the survivor range — that
 *      is literally "off the scale the failing runs can reach".
 *   2. FORWARD SURVIVAL. For each candidate threshold, find each run's *first* crossing, then ask
 *      what fraction of those runs are still alive `--horizon` ticks later. Reported with a Wilson
 *      95% lower bound, because a threshold nothing has yet died above is only as strong as the
 *      number of runs that crossed it.
 *
 * The unit of analysis is the RUN, not the observation. Landmark rows inside one run are heavily
 * correlated, and pooling them would inflate n by the stride count and turn a 30-run result into a
 * fake 1800-run one.
 *
 * `--sustain K` requires the level to hold for K consecutive landmarks before a crossing counts.
 * This is the defence against the transient: `docs/research-thriving-reachability.md` records the
 * default config passing all four THRIVING gates at tick 60 and failing by tick 70.
 *
 * `--floor N` drops landmarks below N people from every table, and it is not optional tidying.
 * A dying run passes through states that read *perfect* on most single measures: with four people
 * left the commons refills to 100%, extraction falls below regen, and the adult Gini goes to zero.
 * Without the floor those death rattles are the top of every scale, and a threshold fitted to them
 * selects for runs about to go extinct. The floor asks for the best state a run reached while it
 * was still a functioning society.
 *
 * Usage:
 *   npx ts-node scripts/escape-velocity.ts [options]
 *
 * Options:
 *   --seeds 32          comma list of seeds, or a single N meaning seeds 1..N (default 1..16)
 *   --ticks 3000        ticks per run (default 3000)
 *   --persons 100       initial population (default 100)
 *   --stride 50         ticks between landmark observations (default 50)
 *   --horizon 1500      ticks a run must survive after crossing to count as escaped (default 1500)
 *   --sustain 4         consecutive landmarks the level must hold before a crossing counts (default 1)
 *   --floor 50          ignore landmarks below this population (default 50) — see below
 *   --gate SPEC         evaluate one joint gate, e.g. "population>=400,poolFill>=0.5,surplus>=0"
 *   --search            scan a grid of joint gates and rank those with no failures
 *   --arms file.json    replace the built-in arm set: {"name": ["KEY=VAL", …], …}
 *   --workers N         parallel worker processes (default: CPU count)
 *   --emit FILE         also write the raw landmark rows as JSON for re-analysis
 *   --analyze FILE      re-analyse an emitted file instead of running anything (free; use it to
 *                       retune --sustain, --gate and --floor without paying for the sims again)
 *   --only NAME         restrict the analysis to one arm. The sharpest test a gate faces: an arm
 *                       holding both survivors and deaths asks whether the gate reads state or
 *                       merely reads which config it is looking at.
 *   --verbose           print per-arm fate counts and each doomed run's best observed level
 *
 * See docs/research-escape-velocity.md.
 */

import { fork } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import LooperSingleton from '../src/App/LooperSingleton';
import Variables from '../src/Helpers/Variables';

/**
 * Built-in arm set. These span the known regimes: the default (dies by ~1200 ticks), the two
 * productivity repairs, an abundance case that holds population but strips the commons, and the
 * ARD-051 existence config that reaches THRIVING. A threshold is only worth anything if doomed and
 * surviving runs are both present in the sample, so the probe needs the whole spread.
 */
const DEFAULT_ARMS: Record<string, string[]> = {
  default: [],
  pin: ['INVENTION_DEPLETION_FASTER_WEIGHT=0', 'INVENTION_DEPLETION_SLOWER_WEIGHT=0'],
  'pin+fertility': [
    'INVENTION_DEPLETION_FASTER_WEIGHT=0',
    'INVENTION_DEPLETION_SLOWER_WEIGHT=0',
    'BASE_CHILDBIRTH_RATE=1.0',
  ],
  symmetric: ['EXTRACTION_PRODUCTIVITY_FLOOR=0.1'],
  abundance: [
    'NATURAL_RESOURCES_INITIAL=30000',
    'NATURAL_RESOURCE_CEILING_INITIAL=30000',
    'MAX_NATURAL_RESOURCE_CEILING=60000',
    'NATURAL_RESOURCE_CEILING_FLOOR=30000',
  ],
  thrive: [
    'NATURAL_RESOURCES_INITIAL=100000',
    'NATURAL_RESOURCE_CEILING_INITIAL=100000',
    'MAX_NATURAL_RESOURCE_CEILING=200000',
    'NATURAL_RESOURCE_CEILING_FLOOR=100000',
    'NATURAL_RESOURCE_REGEN_FRACTION=0.05',
    'CEILING_DEGRADATION_RATE=0',
    'TAX_RATE=0.10',
    'WELFARE_THRESHOLD=1e9',
    'COMMUNITY_POOL_RESERVE_FRACTION=0',
    'INVENTION_DEPLETION_FASTER_WEIGHT=0',
    'INVENTION_DEPLETION_SLOWER_WEIGHT=0',
    'CHILDBIRTH_AGE_SCALE=1000',
    'CHILDBIRTH_AGE_FLOOR=1.0',
    'BASE_CHILDBIRTH_RATE=0.03',
    'BASE_RELATIONSHIP_RATE=0.5',
    'BASE_BREAKUP_RATE=0.005',
    'JOB_LOSS_BASE=0.001',
  ],
};

/** One landmark observation: the state of a run at a single tick, plus what happened next. */
interface Landmark {
  /** Tick the observation was taken at. */
  tick: number;
  /** Living population. */
  population: number;
  /** Commons fill — pool ÷ ceiling. */
  poolFill: number;
  /** Ecological surplus over the preceding stride: (regen − extraction) ÷ regen. */
  surplus: number;
  /** Adult resource Gini (ARD 060). */
  gini: number;
  /** Mean happiness. */
  happiness: number;
  /** Fractional decline from the peak population seen so far in this run. */
  decline: number;
  /** Extraction productivity — the invention random walk's current value. */
  productivity: number;
  /** Employment rate among working-age persons. */
  employment: number;
  /** Share of the population in a fertile couple (both partners counted). */
  fertileShare: number;
}

/** Everything one simulation run contributes to the analysis. */
interface RunRecord {
  /** Arm name this run belongs to. */
  arm: string;
  /** PRNG seed. */
  seed: number;
  /** Tick the population first hit zero, or null if the run never went extinct. */
  extinctTick: number | null;
  /** Landmark observations, in tick order. */
  landmarks: Landmark[];
}

/** One job handed to a worker process. */
interface Job {
  /** Result key. */
  id: string;
  /** Arm name. */
  arm: string;
  /** PRNG seed. */
  seed: number;
  /** Ticks to run. */
  ticks: number;
  /** Initial population. */
  persons: number;
  /** Stride between landmarks. */
  stride: number;
  /** `KEY=VAL` Variables overrides for this run. */
  overrides: string[];
}

/** Apply `KEY=VALUE` to the static Variables class, returning a restore closure. */
function applyOverrides(pairs: string[]): () => void {
  const saved: [string, unknown][] = [];
  for (const pair of pairs) {
    const [key, raw] = pair.split('=');
    if (!(key in Variables)) throw new Error(`Unknown Variables constant: ${key}`);
    if (typeof (Variables as unknown as Record<string, unknown>)[key] !== 'number') {
      throw new Error(`Not a Variables constant: ${key}`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`Non-numeric override: ${pair}`);
    saved.push([key, (Variables as unknown as Record<string, unknown>)[key]]);
    (Variables as unknown as Record<string, unknown>)[key] = value;
  }
  Variables.validate();
  return () => {
    for (const [key, value] of saved) (Variables as unknown as Record<string, unknown>)[key] = value;
  };
}

/**
 * Runs one simulation and reduces its tick history to landmark rows.
 *
 * `surplus` is reconstructed from the pool series rather than instrumented in the engine:
 * realised extraction over a tick is `min(pool_prev + regen, ceiling) − pool`, and regen is
 * `ceiling × NATURAL_RESOURCE_REGEN_FRACTION`. The reconstruction is exact while the pool has
 * slack; once the pool is stripped, realised extraction equals regen by construction and surplus
 * pins at 0 no matter how far demand exceeds it. That is why `poolFill` must be read alongside it.
 *
 * @param job - the run to execute (overrides already applied by the caller)
 * @returns the run's landmark rows and extinction tick
 */
async function runOne(job: Job): Promise<RunRecord> {
  const sim = await LooperSingleton.getInstance().start(job.persons, job.ticks, job.seed, () => {}, {});
  const h = sim.history;

  let extinctTick: number | null = null;
  let runningPeak = job.persons;
  const landmarks: Landmark[] = [];

  for (let i = 0; i < h.length; i++) {
    const s = h[i];
    if (extinctTick === null && s.population === 0) extinctTick = s.tick;
    if (s.population > runningPeak) runningPeak = s.population;
    if ((i + 1) % job.stride !== 0) continue;

    const window = h.slice(Math.max(0, i + 1 - job.stride), i + 1);
    let regenSum = 0;
    let extractSum = 0;
    for (let k = 0; k < window.length; k++) {
      const cur = window[k];
      const prevPool = k === 0
        ? (i + 1 - job.stride <= 0 ? Variables.NATURAL_RESOURCES_INITIAL : h[i - job.stride].naturalResources)
        : window[k - 1].naturalResources;
      const regen = cur.naturalResourceCeiling * Variables.NATURAL_RESOURCE_REGEN_FRACTION;
      const afterRegen = Math.min(prevPool + regen, cur.naturalResourceCeiling);
      regenSum += regen;
      extractSum += Math.max(0, afterRegen - cur.naturalResources);
    }

    landmarks.push({
      tick: s.tick,
      population: s.population,
      poolFill: s.naturalResourceCeiling > 0 ? s.naturalResources / s.naturalResourceCeiling : 0,
      surplus: regenSum > 0 ? (regenSum - extractSum) / regenSum : 0,
      gini: s.resourceGini,
      happiness: s.averageHappiness,
      decline: runningPeak > 0 ? 1 - s.population / runningPeak : 0,
      productivity: s.extractionProductivity,
      employment: s.employmentRate,
      fertileShare: s.population > 0 ? (2 * s.fertileCoupleCount) / s.population : 0,
    });
  }

  return { arm: job.arm, seed: job.seed, extinctTick, landmarks };
}

// ----- Predictors -----

/** A scalar read off a landmark, oriented so that higher is the healthier direction. */
interface Predictor {
  /** Column name. */
  name: string;
  /** Key used in `--gate` specs. */
  key: string;
  /** Extract the value from a landmark row. */
  read: (l: Landmark) => number;
  /** Format for display. */
  fmt: (v: number) => string;
}

const PREDICTORS: Predictor[] = [
  { name: 'population', key: 'population', read: (l) => l.population, fmt: (v) => v.toFixed(0) },
  { name: 'poolFill', key: 'poolFill', read: (l) => l.poolFill, fmt: (v) => v.toFixed(3) },
  { name: 'surplus', key: 'surplus', read: (l) => l.surplus, fmt: (v) => v.toFixed(3) },
  { name: 'equality (1-gini)', key: 'equality', read: (l) => 1 - l.gini, fmt: (v) => v.toFixed(3) },
  { name: 'happiness', key: 'happiness', read: (l) => l.happiness, fmt: (v) => v.toFixed(2) },
  { name: 'atPeak (1-decline)', key: 'atPeak', read: (l) => 1 - l.decline, fmt: (v) => v.toFixed(3) },
  { name: 'productivity', key: 'productivity', read: (l) => l.productivity, fmt: (v) => v.toFixed(3) },
  { name: 'employment', key: 'employment', read: (l) => l.employment, fmt: (v) => v.toFixed(3) },
  { name: 'fertileShare', key: 'fertileShare', read: (l) => l.fertileShare, fmt: (v) => v.toFixed(3) },
];

/** One clause of a joint gate: a predictor that must sit at or above a level. */
interface Clause {
  /** The predictor being gated. */
  predictor: Predictor;
  /** Minimum acceptable value. */
  min: number;
}

/** A joint gate: every clause must hold at the same landmark. */
type Gate = Clause[];

/**
 * Parses a gate spec such as `population>=400,poolFill>=0.5,surplus>=0`.
 *
 * @param spec - comma-separated `key>=value` clauses
 * @returns the parsed gate
 */
function parseGate(spec: string): Gate {
  return spec.split(',').filter((s) => s.trim()).map((clause) => {
    const [key, raw] = clause.split('>=');
    const predictor = PREDICTORS.find((p) => p.key === key.trim());
    if (!predictor) throw new Error(`Unknown gate key: ${key} (have ${PREDICTORS.map((p) => p.key).join(', ')})`);
    return { predictor, min: Number(raw) };
  });
}

/** Renders a gate back into its spec form, for printing. */
function gateLabel(gate: Gate): string {
  return gate.map((c) => `${c.predictor.key}>=${c.predictor.fmt(c.min)}`).join(' ');
}

/**
 * True when every clause of the gate holds at this landmark.
 *
 * @param gate - the gate to test
 * @param l - the landmark
 * @returns whether the landmark clears the gate
 */
function gatePasses(gate: Gate, l: Landmark): boolean {
  return gate.every((c) => c.predictor.read(l) >= c.min);
}

// ----- Fates -----

/** What became of a run in the window following a crossing. */
interface Fate {
  /** Population hit zero within the horizon. */
  extinct: boolean;
  /** Survived the window and ended it within COLLAPSE range of its own forward peak. */
  held: boolean;
}

/**
 * Looks forward from a crossing and reports whether the run did OK.
 *
 * "Did OK" is deliberately stricter than "did not go extinct": a run that keeps 8 people alive for
 * 1500 ticks is not a society that escaped, and counting it as one is how a delay gets reported as
 * a rescue. `held` reuses the project's own COLLAPSE test (ARD 051) over the forward window: the
 * run must finish the window within `COLLAPSE_PEAK_DECLINE_FRACTION` of the highest population it
 * reached inside it. That passes a society that keeps growing and fails one that booms and busts,
 * which a trough-relative-to-crossing test would not.
 *
 * @param run - the run
 * @param crossTick - tick of the crossing
 * @param horizon - ticks to look forward
 * @returns the fate over [crossTick, crossTick + horizon]
 */
function fateAfter(run: RunRecord, crossTick: number, horizon: number): Fate {
  const extinct = run.extinctTick !== null && run.extinctTick <= crossTick + horizon;
  const window = run.landmarks.filter((l) => l.tick >= crossTick && l.tick <= crossTick + horizon);
  if (window.length === 0) return { extinct, held: false };
  const peak = Math.max(...window.map((l) => l.population));
  const end = window[window.length - 1].population;
  const decline = peak > 0 ? 1 - end / peak : 1;
  return { extinct, held: !extinct && decline < Variables.COLLAPSE_PEAK_DECLINE_FRACTION };
}

// ----- Statistics -----

/**
 * Wilson score lower bound on a proportion - the honest floor on "this fraction survived".
 * Chosen over the normal approximation because the interesting cell has zero failures, where the
 * normal interval collapses to a point and claims certainty from a handful of runs.
 *
 * @param successes - runs that survived
 * @param n - runs that crossed
 * @param z - standard normal quantile (1.96 for a 95% interval)
 * @returns lower bound in [0, 1]
 */
function wilsonLower(successes: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (centre - margin) / denom);
}

/**
 * Quantile of a numeric sample by linear interpolation.
 *
 * @param xs - the sample
 * @param q - quantile in [0, 1]
 * @returns the interpolated quantile, or NaN for an empty sample
 */
function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/**
 * First tick at which a run clears a gate for `sustain` consecutive landmarks.
 *
 * @param run - the run to scan
 * @param gate - the gate to clear
 * @param sustain - consecutive landmarks required
 * @param maxTick - crossings later than this are ignored (no forward horizon left)
 * @param floor - landmarks below this population are treated as a failure to clear
 * @returns the tick of the landmark completing the streak, or null
 */
function firstCrossing(run: RunRecord, gate: Gate, sustain: number, maxTick: number, floor: number): number | null {
  let streak = 0;
  for (const l of run.landmarks) {
    if (l.population >= floor && gatePasses(gate, l)) {
      streak++;
      if (streak >= sustain) return l.tick <= maxTick ? l.tick : null;
    } else {
      streak = 0;
    }
  }
  return null;
}

/** Aggregate result of testing one gate against a run set. */
interface GateResult {
  /** Runs that ever cleared the gate in time. */
  crossed: number;
  /** Of those, how many went extinct within the horizon. */
  extinct: number;
  /** Of those, how many were still alive and had not lost three quarters of their people. */
  held: number;
}

/**
 * Tests a gate against every run, one observation per run.
 *
 * @param runs - the run set
 * @param gate - the gate
 * @param sustain - consecutive landmarks required
 * @param horizon - forward window
 * @param maxCrossTick - latest crossing with a full horizon left
 * @param floor - minimum population for a landmark to count
 * @returns crossing and fate counts
 */
function evaluateGate(
  runs: RunRecord[],
  gate: Gate,
  sustain: number,
  horizon: number,
  maxCrossTick: number,
  floor: number,
): GateResult {
  let crossed = 0;
  let extinct = 0;
  let held = 0;
  for (const r of runs) {
    const t = firstCrossing(r, gate, sustain, maxCrossTick, floor);
    if (t === null) continue;
    crossed++;
    const fate = fateAfter(r, t, horizon);
    if (fate.extinct) extinct++;
    if (fate.held) held++;
  }
  return { crossed, extinct, held };
}

// ----- Worker mode -----

interface JobMsg { type: 'job'; job: Job }
interface DoneMsg { type: 'done' }
type ParentMsg = JobMsg | DoneMsg;

/** Worker entry point: run jobs sent over IPC and post the resulting run records back. */
function runWorker(): void {
  process.on('message', (msg: ParentMsg) => {
    if (msg.type === 'done') { process.exit(0); }
    const { job } = msg;
    const restore = applyOverrides(job.overrides);
    runOne(job).then((record) => {
      restore();
      process.send!({ type: 'result', id: job.id, record });
    }).catch((err) => {
      restore();
      console.error(err);
      process.exit(1);
    });
  });
  process.send!({ type: 'ready' });
}

/**
 * Runs all jobs across a pool of forked workers.
 *
 * @param jobs - the full job list
 * @param workerCount - how many child processes to fork
 * @returns id to run-record map, once every job has completed
 */
function dispatch(jobs: Job[], workerCount: number): Promise<Map<string, RunRecord>> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, RunRecord>();
    const nWorkers = Math.max(1, Math.min(workerCount, jobs.length));
    const children: ReturnType<typeof fork>[] = [];
    let next = 0;
    let remaining = jobs.length;
    let settled = false;

    const finish = (): void => {
      if (settled) return;
      settled = true;
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
      child.on('message', (msg: { type: string; id?: string; record?: RunRecord }) => {
        if (msg.type === 'result' && msg.id) {
          results.set(msg.id, msg.record as RunRecord);
          remaining--;
          process.stderr.write(`\r  ${jobs.length - remaining}/${jobs.length} runs`);
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

// ----- Parent mode -----

/**
 * Parses `--flag value` pairs, treating the listed flags as valueless switches.
 *
 * @param argv - argument list, less the node/script entries
 * @returns flag name to value map
 */
function parseArgs(argv: string[]): Record<string, string> {
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'verbose' || key === 'worker' || key === 'search') { opts[key] = 'true'; continue; }
    opts[key] = argv[++i] ?? '';
  }
  return opts;
}

/**
 * Expands a seed spec: a comma list, or a single N meaning seeds 1..N.
 *
 * @param spec - the raw `--seeds` argument
 * @returns the seed list
 */
function parseSeeds(spec: string | undefined): number[] {
  if (!spec) return Array.from({ length: 16 }, (_, i) => i + 1);
  if (spec.includes(',')) return spec.split(',').map((s) => Number(s.trim()));
  return Array.from({ length: Number(spec) }, (_, i) => i + 1);
}

// ----- Reporting -----

/**
 * Prints the separation table: what doomed runs could reach against what survivors sit at.
 *
 * A usable threshold needs the doomed maximum to sit below the survivor range. Where the two
 * overlap, no level of that measure means safety on its own - the doomed runs got there too.
 *
 * @param doomed - runs that went extinct
 * @param survivors - runs that did not
 * @param floor - minimum population for a landmark to count
 */
function printSeparation(doomed: RunRecord[], survivors: RunRecord[], floor: number): void {
  console.log('SEPARATION - can a doomed run reach the level a survivor sits at?\n');
  const header = '  measure'.padEnd(22) +
    'doomed: best ever reached'.padEnd(34) + 'survivors: typical'.padEnd(26) + 'verdict';
  console.log(header);
  console.log('  ' + '-'.repeat(header.length));

  const live = (r: RunRecord): Landmark[] => r.landmarks.filter((l) => l.population >= floor);

  for (const p of PREDICTORS) {
    const doomedBest = doomed
      .map((r) => live(r).map(p.read))
      .filter((vs) => vs.length > 0)
      .map((vs) => Math.max(...vs));
    const survivorVals = survivors.flatMap((r) => live(r).map(p.read)).filter((v) => Number.isFinite(v));
    if (doomedBest.length === 0 || survivorVals.length === 0) continue;

    const dMax = Math.max(...doomedBest);
    const dP90 = quantile(doomedBest, 0.9);
    const sMed = quantile(survivorVals, 0.5);
    const sP10 = quantile(survivorVals, 0.1);

    const verdict = sP10 > dMax
      ? 'CLEAN - survivors live above every doomed run'
      : sMed > dMax
        ? 'partial - the median survivor is out of doomed reach'
        : 'OVERLAP - no safe level on this measure alone';

    console.log(
      '  ' + p.name.padEnd(20) +
      `p90 ${p.fmt(dP90)}, max ${p.fmt(dMax)}`.padEnd(34) +
      `p10 ${p.fmt(sP10)}, med ${p.fmt(sMed)}`.padEnd(26) +
      verdict,
    );
  }
  console.log('');
}

/**
 * Prints the forward-survival table for one single-measure threshold grid.
 *
 * @param runs - every run in the sample
 * @param p - the predictor to threshold
 * @param sustain - consecutive landmarks the level must hold
 * @param horizon - ticks a run must survive after crossing
 * @param maxCrossTick - latest crossing tick with a full horizon left
 * @param floor - minimum population for a landmark to count
 */
function printForwardSurvival(
  runs: RunRecord[],
  p: Predictor,
  sustain: number,
  horizon: number,
  maxCrossTick: number,
  floor: number,
): void {
  const all = runs
    .flatMap((r) => r.landmarks.filter((l) => l.population >= floor).map(p.read))
    .filter((v) => Number.isFinite(v));
  if (all.length === 0) return;
  const grid = [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99].map((q) => quantile(all, q));
  const seen = new Set<string>();

  console.log(`  ${p.name}`);
  console.log('    level'.padEnd(16) + 'runs crossing'.padEnd(16) + 'went extinct'.padEnd(16) + 'held up (95% floor)');
  for (const x of grid) {
    const key = p.fmt(x);
    if (seen.has(key)) continue;
    seen.add(key);
    const g = evaluateGate(runs, [{ predictor: p, min: x }], sustain, horizon, maxCrossTick, floor);
    if (g.crossed === 0) continue;
    console.log(
      '    ' + `>= ${key}`.padEnd(12) +
      String(g.crossed).padEnd(16) +
      String(g.extinct).padEnd(16) +
      `${((100 * g.held) / g.crossed).toFixed(0)}%  (>= ${(100 * wilsonLower(g.held, g.crossed)).toFixed(0)}%)`,
    );
  }
  console.log('');
}

/**
 * Scans a grid of joint gates and ranks those that no run has yet failed.
 *
 * This is a search over many candidate gates, so the winner is selected on this sample and its
 * clean record is partly luck. Re-run the chosen gate on held-out seeds before believing it.
 *
 * @param runs - the run set
 * @param sustain - consecutive landmarks required
 * @param horizon - forward window
 * @param maxCrossTick - latest crossing with a full horizon left
 * @param floor - minimum population for a landmark to count
 */
function printGateSearch(
  runs: RunRecord[],
  sustain: number,
  horizon: number,
  maxCrossTick: number,
  floor: number,
): void {
  const popGrid = [100, 200, 400, 800, 1200];
  const poolGrid = [0.2, 0.4, 0.6, 0.8];
  const surplusGrid = [0, 0.1, 0.3, 0.5];
  const declineGrid = [0.75, 0.85, 0.95];

  const scored: { gate: Gate; res: GateResult }[] = [];
  for (const pop of popGrid) {
    for (const pool of poolGrid) {
      for (const sur of surplusGrid) {
        for (const dec of declineGrid) {
          const gate = parseGate(`population>=${pop},poolFill>=${pool},surplus>=${sur},atPeak>=${dec}`);
          scored.push({ gate, res: evaluateGate(runs, gate, sustain, horizon, maxCrossTick, floor) });
        }
      }
    }
  }

  const clean = scored
    .filter((s) => s.res.crossed >= 5 && s.res.held === s.res.crossed)
    .sort((a, b) => b.res.crossed - a.res.crossed);

  console.log(`GATE SEARCH - ${scored.length} joint gates tried, ranked by how many runs cleared them with no failure.`);
  console.log('A gate that nothing has failed is only as strong as the number of runs that cleared it.');
  console.log('This is a search: validate the winner on held-out seeds before believing the clean record.\n');

  if (clean.length === 0) {
    console.log('  No gate in the grid was cleared by 5+ runs without a failure.');
    const best = scored.filter((s) => s.res.crossed >= 5)
      .sort((a, b) => (b.res.held / b.res.crossed) - (a.res.held / a.res.crossed))[0];
    if (best) {
      console.log(`  Best available: ${gateLabel(best.gate)} - ${best.res.held}/${best.res.crossed} held.`);
    }
    console.log('');
    return;
  }

  console.log('  ' + 'gate'.padEnd(62) + 'runs cleared'.padEnd(14) + 'held (95% floor)');
  for (const s of clean.slice(0, 12)) {
    console.log(
      '  ' + gateLabel(s.gate).padEnd(62) +
      String(s.res.crossed).padEnd(14) +
      `${s.res.held}/${s.res.crossed}  (>= ${(100 * wilsonLower(s.res.held, s.res.crossed)).toFixed(0)}%)`,
    );
  }
  console.log('');
}

/** Probe entry point. */
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const seeds = parseSeeds(opts.seeds);
  const ticks = Number(opts.ticks ?? 3000);
  const persons = Number(opts.persons ?? 100);
  const stride = Number(opts.stride ?? 50);
  const horizon = Number(opts.horizon ?? 1500);
  const sustain = Number(opts.sustain ?? 1);
  const floor = Number(opts.floor ?? 50);
  const workers = Number(opts.workers ?? os.cpus().length);
  const verbose = opts.verbose === 'true';
  const arms: Record<string, string[]> = opts.arms
    ? JSON.parse(fs.readFileSync(opts.arms, 'utf8'))
    : DEFAULT_ARMS;

  const maxCrossTick = ticks - horizon;
  if (maxCrossTick <= 0) throw new Error('--horizon must be shorter than --ticks');

  if (opts.analyze) {
    const saved = JSON.parse(fs.readFileSync(opts.analyze, 'utf8')) as
      { ticks: number; stride?: number; runs: RunRecord[] };
    const savedMax = saved.ticks - horizon;
    if (savedMax <= 0) throw new Error(`--horizon must be shorter than the file's ${saved.ticks} ticks`);
    // --sustain counts landmarks, so what it means in ticks depends on the stride the file was
    // emitted with, not on any flag passed now. Print the duration so the two can't be confused.
    const savedStride = saved.stride ?? stride;
    const subset = opts.only ? saved.runs.filter((r) => r.arm === opts.only) : saved.runs;
    if (subset.length === 0) throw new Error(`No runs for arm ${opts.only}`);
    const names = opts.only ? [opts.only] : [...new Set(saved.runs.map((r) => r.arm))];
    console.log(`analysing ${opts.analyze}: ${subset.length} runs, ${saved.ticks} ticks, ` +
      `stride=${savedStride} horizon=${horizon} sustain=${sustain} (${sustain * savedStride} ticks) ` +
      `floor=${floor}` + (opts.only ? ` arm=${opts.only}` : '') + '\n');
    report(subset, opts, sustain, horizon, savedMax, floor, names, verbose);
    return;
  }

  const jobs: Job[] = [];
  for (const [arm, overrides] of Object.entries(arms)) {
    for (const seed of seeds) {
      jobs.push({ id: `${arm}::${seed}`, arm, seed, ticks, persons, stride, overrides });
    }
  }

  console.log(
    `arms=[${Object.keys(arms).join(',')}] seeds=${seeds.length} ticks=${ticks} stride=${stride} ` +
    `horizon=${horizon} sustain=${sustain} (${sustain * stride} ticks) floor=${floor} jobs=${jobs.length}`,
  );
  console.log(`crossings counted up to tick ${maxCrossTick}, so every one has ${horizon} ticks of forward observation\n`);

  const t0 = Date.now();
  const results = await dispatch(jobs, workers);
  process.stderr.write('\r');
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  const runs = [...results.values()];

  if (opts.emit) {
    fs.writeFileSync(opts.emit, JSON.stringify({ ticks, stride, horizon, sustain, floor, persons, arms, runs }));
    console.log(`wrote ${opts.emit}\n`);
  }

  console.log(`${runs.length} runs in ${elapsed}s\n`);
  report(runs, opts, sustain, horizon, maxCrossTick, floor, Object.keys(arms), verbose);
}

/**
 * Prints whichever tables the flags asked for.
 *
 * @param runs - the run set
 * @param opts - parsed command-line flags
 * @param sustain - consecutive landmarks required
 * @param horizon - forward window
 * @param maxCrossTick - latest crossing with a full horizon left
 * @param floor - minimum population for a landmark to count
 * @param armNames - arm names, in declaration order, for the per-arm breakdown
 * @param verbose - whether to print the per-arm breakdown
 */
function report(
  runs: RunRecord[],
  opts: Record<string, string>,
  sustain: number,
  horizon: number,
  maxCrossTick: number,
  floor: number,
  armNames: string[],
  verbose: boolean,
): void {
  const doomed = runs.filter((r) => r.extinctTick !== null);
  const survivors = runs.filter((r) => r.extinctTick === null);
  console.log(`${doomed.length} extinct, ${survivors.length} alive at the end of the run\n`);

  if (verbose) {
    for (const arm of armNames) {
      const rows = runs.filter((r) => r.arm === arm);
      const dead = rows.filter((r) => r.extinctTick !== null);
      const med = dead.length ? quantile(dead.map((r) => r.extinctTick!), 0.5).toFixed(0) : '-';
      console.log(`  ${arm.padEnd(16)} extinct ${dead.length}/${rows.length}  median extinction tick ${med}`);
    }
    console.log('');
  }

  if (opts.gate) {
    const gate = parseGate(opts.gate);
    const res = evaluateGate(runs, gate, sustain, horizon, maxCrossTick, floor);
    console.log(`GATE ${gateLabel(gate)} sustained ${sustain} landmark(s), floor ${floor}\n`);
    console.log(`  runs cleared it        ${res.crossed}/${runs.length}`);
    console.log(`  went extinct within ${horizon}   ${res.extinct}`);
    console.log(`  held up                ${res.held}/${res.crossed}` +
      (res.crossed ? `  (95% floor >= ${(100 * wilsonLower(res.held, res.crossed)).toFixed(0)}%)` : ''));
    const byArm = new Map<string, number>();
    const crossTicks: number[] = [];
    for (const r of runs) {
      const t = firstCrossing(r, gate, sustain, maxCrossTick, floor);
      if (t !== null) {
        byArm.set(r.arm, (byArm.get(r.arm) ?? 0) + 1);
        crossTicks.push(t);
      }
    }
    console.log(`  cleared by arm         ${[...byArm.entries()].map(([a, n]) => `${a}:${n}`).join(' ') || 'none'}`);

    // A gate can look perfect by detecting which arm a run is in rather than what state it reached.
    // The 2x2 is the check: a gate worth having must also separate fates *inside* a single arm.
    console.log('\n  confusion (every run, judged at its own crossing or at maxCrossTick if it never crossed):');
    console.log('    ' + 'arm'.padEnd(16) + 'cleared+held'.padEnd(14) + 'cleared+failed'.padEnd(16) +
      'never cleared, held'.padEnd(21) + 'never cleared, failed');
    for (const arm of armNames) {
      const rows = runs.filter((r) => r.arm === arm);
      if (rows.length === 0) continue;
      let ch = 0; let cf = 0; let nh = 0; let nf = 0;
      for (const r of rows) {
        const t = firstCrossing(r, gate, sustain, maxCrossTick, floor);
        const fate = fateAfter(r, t ?? maxCrossTick, horizon);
        if (t !== null) { if (fate.held) ch++; else cf++; } else if (fate.held) nh++; else nf++;
      }
      console.log('    ' + arm.padEnd(16) + String(ch).padEnd(14) + String(cf).padEnd(16) +
        String(nh).padEnd(21) + String(nf));
    }
    if (crossTicks.length) {
      // The whole point of an early-stopping criterion is that you stop. Report what it buys.
      const med = quantile(crossTicks, 0.5);
      const p90 = quantile(crossTicks, 0.9);
      console.log(`  crossing tick          median ${med.toFixed(0)}, p90 ${p90.toFixed(0)}`);
      console.log(`  ticks saved per cleared run if the run stops at the crossing: ` +
        `${(maxCrossTick + horizon - med).toFixed(0)} of ${maxCrossTick + horizon}`);
    }
    console.log('');
    return;
  }

  if (doomed.length === 0 || survivors.length === 0) {
    console.log('Need both doomed and surviving runs in the sample for a threshold to mean anything.');
    return;
  }

  printSeparation(doomed, survivors, floor);

  console.log('FORWARD SURVIVAL - of the runs that first cleared this level, how many were still alive and');
  console.log(`intact ${horizon} ticks later. One observation per run (first crossing only); Wilson 95% floor.\n`);
  for (const p of PREDICTORS) printForwardSurvival(runs, p, sustain, horizon, maxCrossTick, floor);

  if (opts.search === 'true' || opts.search === '') printGateSearch(runs, sustain, horizon, maxCrossTick, floor);
}

if (process.argv.includes('--worker')) {
  runWorker();
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
