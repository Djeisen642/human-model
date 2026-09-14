/**
 * Metric probe — exploratory diagnostic for the `peakGini` measurement hypothesis.
 *
 * The sweep harness reports `peakGini` (max resource Gini over the whole run). That maximum
 * is typically attained during the terminal crash at populations of ~10-30, so it behaves like
 * a max-of-noise statistic and appears insensitive to parameters that demonstrably move
 * inequality. This script re-measures the same runs under alternative Gini statistics so the
 * two can be compared directly. See `docs/research-gini-metric.md`.
 *
 * Reports per swept value (median across seeds):
 *   peakGini      - max Gini over all living ticks (what `npm run sweep` prints today)
 *   giniAtPeakPop - Gini at the single tick where population peaked
 *   matureGini    - median Gini over ticks where population >= MATURE_POP_FRACTION of that run's peak
 *
 * Exploratory tooling, not a project-sanctioned metric: the MATURE_POP_FRACTION cutoff is a
 * judgment call and needs sign-off before any of these become the harness's headline column.
 *
 * Usage:
 *   npx ts-node scripts/metric-probe.ts [options]
 *
 * Options:
 *   --seeds N            number of seeds to run (default 8)
 *   --seed-start N       first seed (default 1); use to get an independent seed family
 *   --mature-fraction F  mature-phase cutoff as a fraction of run peak (default 0.5)
 *   --ticks N            ticks per run (default 700)
 *   --persons N          initial population (default 100)
 *   --set KEY=VAL        override a Variables constant for every run (repeatable)
 *   --sweep KEY=a,b,c    run the whole seed set once per value of KEY
 *
 * Examples:
 *   npx ts-node scripts/metric-probe.ts --sweep TAX_RATE=0,0.02,0.1,0.2
 *   npx ts-node scripts/metric-probe.ts --seeds 12 --sweep HELP_FRACTION=0.02,0.3,0.6
 */
import LooperSingleton from '../src/App/LooperSingleton';
import Simulation from '../src/App/Simulation';
import Variables from '../src/Helpers/Variables';
import { resourceGini } from '../src/Helpers/Inequality';

/** Default population floor, as a fraction of a run's own peak, defining the "mature" phase. */
const DEFAULT_MATURE_POP_FRACTION = 0.5;

interface Row { pop: number; gini: number }

/** Median of a numeric array; 0 for an empty array. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

let rows: Row[] = [];
const originalSnapshot = Simulation.prototype.snapshot;
// eslint-disable-next-line func-names
Simulation.prototype.snapshot = function (this: Simulation) {
  const snap = originalSnapshot.call(this);
  const living = this.getLiving();
  // Same adult-only basis the snapshot and KillEvent use (ARD 060), so this probe's
  // baseline column stays comparable with `npm run sweep`'s.
  rows.push({ pop: living.length, gini: resourceGini(living) });
  return snap;
};

interface RunResult { peakGini: number; atPeakPop: number; mature: number; peakPop: number; extinct: boolean }

/** Run one simulation and reduce its tick series to the three Gini statistics. */
async function runOne(
  persons: number,
  ticks: number,
  seed: number,
  matureFraction: number,
): Promise<RunResult | null> {
  rows = [];
  await LooperSingleton.getInstance().start(persons, ticks, seed, () => {}, {});
  const live = rows.filter(r => r.pop > 0);
  if (live.length === 0) return null;
  const peakPop = Math.max(...live.map(r => r.pop));
  const mature = live.filter(r => r.pop >= matureFraction * peakPop).map(r => r.gini);
  return {
    peakGini: Math.max(...live.map(r => r.gini)),
    atPeakPop: live.find(r => r.pop === peakPop)!.gini,
    mature: median(mature),
    peakPop,
    extinct: rows.some(r => r.pop === 0),
  };
}

/** Parse a CLI numeric argument, failing loudly rather than silently yielding NaN. */
function num(raw: string | undefined, flag: string): number {
  const n = Number(raw);
  if (raw === undefined || raw === '' || !Number.isFinite(n)) {
    throw new Error(`${flag} expects a number, got: ${raw ?? '(missing)'}`);
  }
  return n;
}

/** Parse `--flag value` / `KEY=VAL` argv into options. */
function parseArgs(argv: string[]) {
  let seeds = 8;
  let seedStart = 1;
  let ticks = 700;
  let persons = 100;
  let matureFraction = DEFAULT_MATURE_POP_FRACTION;
  const sets: [string, number][] = [];
  let sweepKey = '';
  let sweepVals: number[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--seeds') { seeds = num(argv[i + 1], a); i += 1; } else if (a === '--seed-start') { seedStart = num(argv[i + 1], a); i += 1; } else if (a === '--mature-fraction') { matureFraction = num(argv[i + 1], a); i += 1; } else if (a === '--ticks') { ticks = num(argv[i + 1], a); i += 1; } else if (a === '--persons') { persons = num(argv[i + 1], a); i += 1; } else if (a === '--set') {
      const [k, v] = (argv[i + 1] ?? '').split('=');
      sets.push([k, num(v, `--set ${k}`)]);
      i += 1;
    } else if (a === '--sweep') {
      const [k, v] = (argv[i + 1] ?? '').split('=');
      sweepKey = k;
      sweepVals = (v ?? '').split(',').map(x => num(x, `--sweep ${k}`));
      i += 1;
    }
  }
  return { seeds, seedStart, ticks, persons, matureFraction, sets, sweepKey, sweepVals };
}

async function main(): Promise<void> {
  const {
    seeds, seedStart, ticks, persons, matureFraction, sets, sweepKey, sweepVals,
  } = parseArgs(process.argv.slice(2));
  const vars = Variables as unknown as Record<string, number>;

  for (const [k, v] of sets) {
    if (!(k in vars)) throw new Error(`unknown Variables key: ${k}`);
    vars[k] = v;
  }
  if (sweepKey && !(sweepKey in vars)) throw new Error(`unknown Variables key: ${sweepKey}`);

  const values = sweepKey ? sweepVals : [NaN];
  const baseline = sweepKey ? vars[sweepKey] : NaN;
  const seedList = Array.from({ length: seeds }, (_, i) => seedStart + i);

  console.log(`seeds=${seedStart}..${seedStart + seeds - 1} ticks=${ticks} persons=${persons}`
    + `${sets.length ? ` set:${sets.map(([k, v]) => `${k}=${v}`).join(',')}` : ''}`
    + `${sweepKey ? ` sweep:${sweepKey}` : ''}`);
  console.log(`mature phase = ticks with pop >= ${matureFraction * 100}% of that run's peak\n`);
  const label = sweepKey || 'baseline';
  console.log(`${label.padEnd(30)} | peakGini  giniAtPeakPop  matureGini  peakPop  extinct`);
  console.log('-'.repeat(88));

  for (const value of values) {
    if (sweepKey) vars[sweepKey] = value;
    const pg: number[] = []; const ap: number[] = []; const mt: number[] = []; const pp: number[] = [];
    let extinct = 0;
    for (const seed of seedList) {
      const r = await runOne(persons, ticks, seed, matureFraction);
      if (!r) continue;
      pg.push(r.peakGini); ap.push(r.atPeakPop); mt.push(r.mature); pp.push(r.peakPop);
      if (r.extinct) extinct += 1;
    }
    const name = sweepKey ? `${sweepKey}=${value}` : 'baseline';
    console.log(
      `${name.padEnd(30)} | ${median(pg).toFixed(3).padStart(8)}  ${median(ap).toFixed(3).padStart(13)}  `
      + `${median(mt).toFixed(3).padStart(10)}  ${median(pp).toFixed(0).padStart(7)}  ${extinct}/${seedList.length}`,
    );
  }
  if (sweepKey) vars[sweepKey] = baseline;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
