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
 *   --rng-seed 1       seed for the permutation and bootstrap draws, so results reproduce (default 1)
 *
 * See docs/calibration-guide.md.
 */

import LooperSingleton from '../src/App/LooperSingleton';
import Simulation from '../src/App/Simulation';
import Variables from '../src/Helpers/Variables';
import SeededRandom from '../src/Helpers/SeededRandom';
import {
  mcnemarExact, pairedPermutationTest, bootstrapPairedDifference,
  median, seedsNeededForRateChange,
} from '../src/Helpers/Statistics';

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

/** Apply `KEY=VALUE` pairs to the static Variables class, returning a restore closure. */
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

/** Run one arm over the seed set and return its per-seed measurements, in seed order. */
async function runArm(
  overrides: string[], seeds: number[], ticks: number, persons: number,
): Promise<RunMeasures[]> {
  const restore = applyOverrides(overrides);
  try {
    const out: RunMeasures[] = [];
    for (const seed of seeds) {
      const sim: Simulation = await LooperSingleton.getInstance().start(persons, ticks, seed, () => {}, {});
      const history = sim.history;
      const last = history[history.length - 1];
      let peak = 0, trough = Infinity, empty = 0;
      for (const s of history) {
        peak = Math.max(peak, s.population);
        if (s.population > 0) trough = Math.min(trough, s.population);
        if (s.naturalResourceCeiling > 0 && s.naturalResources / s.naturalResourceCeiling < 0.05) empty++;
      }
      // Count peaks in the population series as a simple, threshold-free cycle proxy.
      let cycles = 0;
      for (let i = 2; i < history.length - 2; i++) {
        const p = history[i].population;
        if (p > 20 && p > history[i - 2].population && p > history[i + 2].population
          && p >= history[i - 1].population && p >= history[i + 1].population) cycles++;
      }
      out.push({
        extinct: last.population === 0 ? 1 : 0,
        peakPopulation: peak,
        endPopulation: last.population,
        troughPopulation: trough === Infinity ? 0 : trough,
        cycles,
        ticksWithCommonsEmpty: Math.round((100 * empty) / history.length),
      });
    }
    return out;
  } finally {
    restore();
  }
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
  const spec = opts.seeds ?? '48';
  const seeds = spec.includes(',') ? spec.split(',').map(Number)
    : Array.from({ length: Number(spec) }, (_, i) => i + 1);
  const ticks = Number(opts.ticks ?? 2000);
  const persons = Number(opts.persons ?? 100);
  const rngSeed = Number(opts['rng-seed'] ?? 1);

  console.log(`Comparing ${seeds.length} seeds at ${ticks} ticks, ${persons} starting people.`);
  console.log(`  baseline:  ${[...both, ...a].join(' ') || '(stock defaults)'}`);
  console.log(`  treatment: ${[...both, ...b].join(' ') || '(stock defaults)'}`);
  console.log('  Both arms use the same seeds, so each run is compared against its own twin.');

  const baseline = await runArm([...both, ...a], seeds, ticks, persons);
  const treatment = await runArm([...both, ...b], seeds, ticks, persons);

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

main();
