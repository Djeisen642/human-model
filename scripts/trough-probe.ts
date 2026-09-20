/**
 * Boom-bust trough-depth probe — how far down does each cycle actually go?
 *
 * Trough depth is the measure that predicts extinction in an oscillating regime: a run dies when
 * one cycle happens to bottom out at zero, so the floor the cycles hold matters more than any
 * end-state number. `docs/research-productivity-band.md` already argued trough depth should be
 * preferred over extinction counts in follow-up work, but nothing reported it.
 *
 * The two columns that look like they do are both floored by the founding population and so go
 * blind exactly where a healthy configuration lives. `sweep.ts`'s `min=` scans the whole history
 * including the startup ticks, and `compare.ts`'s "lowest population reached" does the same, so
 * once a configuration's cycles hold above their starting size both report the founding population
 * for every seed and stop discriminating. Measured at 100 founders: the default commons reports
 * `min=` 7–25 (a real trough) while the 3x commons reports 99–109 for all 24 seeds — not a
 * trough at all, but the starting value showing through. Actual median troughs there are ~221.
 *
 * This probe reports the distribution of the troughs `CycleDetector` already finds (exposed as
 * `troughValues` so the numbers here and the `cyc`/`trTrend` columns cannot drift apart), dropping
 * the leading pivot, which is the founding population rather than a cycle trough.
 *
 * Usage:
 *   npx ts-node scripts/trough-probe.ts [options]
 *
 * Options:
 *   --seeds 24          comma list of seeds, or a single N meaning seeds 1..N (default 1..3)
 *   --ticks 6000        ticks per run (default 6000; needs enough for several cycles)
 *   --persons 100       initial population (default 100)
 *   --set KEY=VAL       Variables override applied to every run (repeatable)
 *   --swing 0.2         fractional reversal required to confirm a pivot (default 0.2, as CycleDetector)
 *   --tsv               emit tab-separated rows instead of the formatted table
 *
 * See docs/research-clean-long-run-100-founders.md.
 */

import LooperSingleton from '../src/App/LooperSingleton';
import Variables from '../src/Helpers/Variables';
import { detectCycles } from '../src/Helpers/CycleDetector';
import { applyOverrides, parseSeeds } from '../src/Helpers/HarnessOverrides';

/** One run's trough statistics. */
interface TroughStats {
  /** The seed that produced the run. */
  seed: number;
  /** Number of cycle troughs found, excluding the founding-population pivot. */
  count: number;
  /** Shallowest trough, or NaN when no cycle completed. */
  max: number;
  /** Median trough, or NaN when no cycle completed. */
  median: number;
  /** Deepest trough — the one that predicts extinction — or NaN when no cycle completed. */
  min: number;
  /** Highest population the run reached. */
  peak: number;
}

/**
 * Parse `--flag value` arguments, collecting repeatable `--set` overrides separately.
 *
 * @param argv - process arguments after the script name
 * @returns the flag map and the list of `KEY=VAL` overrides
 */
function parseArgs(argv: string[]): { opts: Record<string, string>; sets: string[] } {
  const opts: Record<string, string> = {};
  const sets: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (key === 'tsv') { opts.tsv = 'true'; continue; }
    const val = argv[++i] ?? '';
    if (key === 'set') sets.push(val); else opts[key] = val;
  }
  return { opts, sets };
}

/**
 * Median of a numeric list.
 *
 * @param xs - the values, which may be in any order
 * @returns the median, or NaN when the list is empty
 */
function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Run one seed and summarise its cycle troughs.
 *
 * @param seed - the RNG seed
 * @param ticks - ticks to run
 * @param persons - founding population
 * @param swing - fractional reversal required to confirm a pivot, passed to `detectCycles`
 * @returns the run's trough statistics
 */
async function runOne(seed: number, ticks: number, persons: number, swing: number): Promise<TroughStats> {
  const sim = await LooperSingleton.getInstance().start(persons, ticks, seed, () => {}, {});
  const pop = sim.history.map((s) => s.population);
  const metrics = detectCycles(pop, {
    minCycles: Variables.CYCLICAL_MIN_CYCLES,
    troughHoldFraction: Variables.CYCLICAL_TROUGH_HOLD_FRACTION,
    reversalThreshold: swing,
  });
  // Drop the leading trough: it is the founding population, not a cycle trough — a run that grows
  // from tick 0 registers its starting size as a minimum. Including it is exactly the bias this
  // probe exists to avoid, and is why `sweep.ts`'s `min=` column misreads healthy configurations.
  const troughs = metrics.troughValues.slice(1);
  const sorted = [...troughs].sort((a, b) => a - b);
  return {
    seed,
    count: troughs.length,
    min: sorted[0] ?? NaN,
    median: median(troughs),
    max: sorted[sorted.length - 1] ?? NaN,
    peak: pop.reduce((a, b) => Math.max(a, b), 0),
  };
}

/**
 * Entry point — run the seed set and print one row per seed plus a pooled summary.
 *
 * @returns nothing
 */
async function main(): Promise<void> {
  const { opts, sets } = parseArgs(process.argv.slice(2));
  const seeds = parseSeeds(opts.seeds, [1, 2, 3]);
  const ticks = Number(opts.ticks ?? 6000);
  const persons = Number(opts.persons ?? 100);
  const swing = Number(opts.swing ?? 0.2);
  const tsv = opts.tsv === 'true';

  if (!tsv) {
    console.log(`seeds=[${seeds.join(',')}] ticks=${ticks} persons=${persons} swing=${swing}` +
      (sets.length ? ` set:{${sets.join(' ')}}` : ''));
    console.log('\n  seed  troughs   deepest   median  shallowest     peak');
    console.log('  ----------------------------------------------------------');
  } else {
    console.log('seed\ttroughs\tdeepest\tmedian\tshallowest\tpeak');
  }

  const all: TroughStats[] = [];
  for (const seed of seeds) {
    const restore = applyOverrides(sets);
    try {
      const r = await runOne(seed, ticks, persons, swing);
      all.push(r);
      if (tsv) console.log(`${r.seed}\t${r.count}\t${r.min}\t${r.median}\t${r.max}\t${r.peak}`);
      else console.log(`  ${String(r.seed).padStart(4)}  ${String(r.count).padStart(7)}  ` +
        `${String(r.min).padStart(8)}  ${String(r.median).padStart(7)}  ` +
        `${String(r.max).padStart(10)}  ${String(r.peak).padStart(7)}`);
    } finally {
      restore();
    }
  }

  const deepest = all.map((r) => r.min).filter((x) => !Number.isNaN(x));
  const medians = all.map((r) => r.median).filter((x) => !Number.isNaN(x));
  if (!tsv && deepest.length > 0) {
    console.log(`\n  across ${deepest.length} seeds: deepest trough ${Math.min(...deepest)}–${Math.max(...deepest)}, ` +
      `median trough ${median(medians)}`);
    console.log('  The deepest trough is the number that predicts extinction: a cycle that bottoms');
    console.log('  out near zero is one unlucky draw from ending the run.');
  }
}

void main();
