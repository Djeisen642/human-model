/**
 * Demographic throughput probe — does a lever that changes births actually change population?
 *
 * `scripts/sweep.ts` reports peak population but not births, so a lever can raise fertility
 * substantially while the commons absorbs the entire gain and the population never moves. That
 * distinction is invisible in the sweep table and is the difference between "this lever does
 * nothing" and "this lever works and the model is resource-limited". This probe reports median
 * cumulative births alongside median peak population across a seed set, so the two can be read
 * together.
 *
 * Mean happiness is sampled over a leading window (default 60 ticks) rather than the whole run,
 * because post-extinction ticks report a population-weighted mean of zero and would otherwise
 * swamp the signal.
 *
 * Usage:
 *   npx ts-node scripts/throughput-probe.ts --sweep KEY=v1,v2,... [options]
 *
 * Options:
 *   --sweep KEY=a,b,c   Variables constant to vary (required)
 *   --seeds 24          comma list of seeds, or a single N meaning seeds 1..N (default 1..24)
 *   --ticks 300         ticks per run (default 300)
 *   --persons 100       initial population (default 100)
 *   --set KEY=VAL       fixed Variables override applied to every arm (repeatable)
 *   --window 60         leading ticks used for the mean-happiness sample (default 60)
 *
 * See docs/research-untested-variables.md.
 */

import LooperSingleton from '../src/App/LooperSingleton';
import Simulation from '../src/App/Simulation';
import Variables from '../src/Helpers/Variables';

/**
 * Median of a numeric array; returns 0 for an empty input.
 *
 * @param xs - values to reduce
 * @returns the median, or 0 when `xs` is empty
 */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * Parse `--flag value` pairs and repeatable `--set KEY=VAL` overrides from argv.
 *
 * @param argv - argument list, excluding the node and script paths
 * @returns the parsed flags and the collected `--set` overrides
 */
function parseArgs(argv: string[]): { opts: Record<string, string>; sets: string[] } {
  const opts: Record<string, string> = {};
  const sets: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1];
    if (key === 'set') { sets.push(value); i++; continue; }
    opts[key] = value;
    i++;
  }
  return { opts, sets };
}

/**
 * Apply `KEY=VALUE` pairs to the static Variables class, returning a restore closure.
 *
 * @param pairs - overrides in `KEY=VALUE` form
 * @returns a function that restores every overridden constant to its prior value
 */
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

/**
 * Run one arm of the sweep and print its median births, peak population and early happiness.
 *
 * @param label - row label identifying this arm
 * @param overrides - Variables overrides applied for the duration of the arm
 * @param seeds - seeds to run
 * @param ticks - ticks per run
 * @param persons - initial population per run
 * @param window - leading tick count used for the mean-happiness sample
 */
async function runArm(
  label: string, overrides: string[], seeds: number[], ticks: number, persons: number, window: number,
): Promise<void> {
  const restore = applyOverrides(overrides);
  try {
    const births: number[] = [], peaks: number[] = [], haps: number[] = [];
    let extinct = 0;
    for (const seed of seeds) {
      const sim: Simulation = await LooperSingleton.getInstance().start(persons, ticks, seed, () => {}, {});
      const h = sim.history;
      births.push(h[h.length - 1].cumulativeBirths);
      peaks.push(Math.max(...h.map((s) => s.population)));
      const early = h.slice(0, window);
      haps.push(early.reduce((a, s) => a + s.averageHappiness, 0) / early.length);
      if (h[h.length - 1].population === 0) extinct++;
    }
    console.log(
      `${label.padEnd(32)} medBirths=${String(median(births)).padStart(6)}` +
      `  medPeakPop=${String(median(peaks)).padStart(6)}` +
      `  medHappiness(t<${window})=${median(haps).toFixed(2).padStart(6)}` +
      `  extinct=${extinct}/${seeds.length}`,
    );
  } finally {
    restore();
  }
}

/**
 * Entry point: run every sweep value over the seed set and print one row each.
 *
 * @returns a promise that resolves once every arm has been run
 */
async function main(): Promise<void> {
  const { opts, sets } = parseArgs(process.argv.slice(2));
  if (!opts.sweep) throw new Error('--sweep KEY=v1,v2,... is required');
  const [sweepKey, rawValues] = opts.sweep.split('=');
  const values = rawValues.split(',');

  const seedSpec = opts.seeds ?? '24';
  const seeds = seedSpec.includes(',')
    ? seedSpec.split(',').map(Number)
    : Array.from({ length: Number(seedSpec) }, (_, i) => i + 1);
  const ticks = Number(opts.ticks ?? 300);
  const persons = Number(opts.persons ?? 100);
  const window = Number(opts.window ?? 60);

  console.log(`seeds=[${seeds.join(',')}] ticks=${ticks} persons=${persons} sweep=${sweepKey}` +
    (sets.length ? ` sets=[${sets.join(' ')}]` : ''));
  for (const value of values) {
    await runArm(`${sweepKey}=${value}`, [...sets, `${sweepKey}=${value}`], seeds, ticks, persons, window);
  }
}

main();
