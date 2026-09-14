/**
 * THRIVING reachability probe — runs the tick loop and reports, per decade, the four
 * ARD-051 outcome dimensions and whether they would jointly trip THRIVING.
 *
 * Unlike `scripts/sweep.ts` (which aggregates outcome labels across seeds), this prints the
 * reason* a run misses THRIVING: which of the four gates fails, and how far off it is. The
 * per-decade rows use a prefix peak — the peak population seen so far — so each row answers
 * "what would `classifyOutcome` have returned had the run ended here". The final row calls
 * `classifyOutcome` on the full decade history.
 *
 * Usage:
 *   npx ts-node scripts/thrive-probe.ts [options]
 *
 * Options:
 *   --ticks 800        ticks per run (default 800)
 *   --persons 100      initial population (default 100)
 *   --seeds 8          comma list of seeds, or a single N meaning seeds 1..N (default 1..8)
 *   --set KEY=VAL      override a Variables constant (repeatable)
 *   --types path.json  ARD-030 personTypes definition to seed with
 *   --decades          print one row per decade, not just the final verdict
 *
 * See docs/research-thriving-reachability.md.
 */

import * as fs from 'fs';
import LooperSingleton from '../src/App/LooperSingleton';
import Variables from '../src/Helpers/Variables';
import { classifyOutcome, OutcomeLabel } from '../src/Helpers/Reporters';
import { PersonTypes } from '../src/Helpers/Types';

const args = process.argv.slice(2);
const overrides: string[] = [];
let ticks = 800;
let persons = 100;
let seeds = [1, 2, 3, 4, 5, 6, 7, 8];
let showDecades = false;
let personTypes: PersonTypes = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set') overrides.push(args[++i]);
  else if (args[i] === '--ticks') ticks = Number(args[++i]);
  else if (args[i] === '--persons') persons = Number(args[++i]);
  else if (args[i] === '--decades') showDecades = true;
  else if (args[i] === '--types') personTypes = JSON.parse(fs.readFileSync(args[++i], 'utf8'));
  else if (args[i] === '--seeds') {
    const raw = args[++i];
    seeds = raw.includes(',')
      ? raw.split(',').map(Number)
      : Array.from({ length: Number(raw) }, (_, k) => k + 1);
  } else throw new Error(`Unknown argument: ${args[i]}`);
}

for (const pair of overrides) {
  const [key, raw] = pair.split('=');
  if (!(key in Variables)) throw new Error(`Unknown Variables constant: ${key}`);
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`Non-numeric override: ${pair}`);
  (Variables as unknown as Record<string, unknown>)[key] = value;
}

/** One decade's reading of the four THRIVING gates, plus the diagnostics that explain a miss. */
interface DecadeRow {
  /** Closing tick of the decade. */
  tick: number;
  /** Living population at the close of the decade. */
  population: number;
  /** Final-decade average Gini. */
  gini: number;
  /** Final-decade average happiness. */
  happiness: number;
  /** Decline from the peak population seen up to this decade, as a fraction. */
  decline: number;
  /** Commons fill: average pool divided by average ceiling. */
  pool: number;
  /** True when all four THRIVING gates pass for this decade. */
  thriving: boolean;
  /** Average personal resources. */
  resources: number;
  /** Births and deaths within the decade. */
  births: number;
  /** Deaths within the decade. */
  deaths: number;
  /** Employment rate among working-age persons at the closing tick. */
  employment: number;
  /** Extraction productivity at the closing tick — the invention random walk's current value. */
  productivity: number;
  /** Median age at the closing tick. */
  medianAge: number;
  /** Fertile couples at the closing tick. */
  fertileCouples: number;
}

/**
 * Runs one seed and prints its decade rows (when requested) plus a one-line verdict.
 * @param seed - PRNG seed for the run
 * @returns the outcome label `classifyOutcome` assigns to the completed run
 */
async function run(seed: number): Promise<OutcomeLabel> {
  const simulation = await LooperSingleton.getInstance().start(persons, ticks, seed, () => {}, personTypes);
  const decades = simulation.decadeHistory;
  const peak = Math.max(persons, ...decades.map(d => d.endPopulation));

  let runningPeak = persons;
  const rows: DecadeRow[] = decades.map(d => {
    const snapshot = simulation.history[Math.min(d.endTick - 1, simulation.history.length - 1)];
    runningPeak = Math.max(runningPeak, d.endPopulation);
    const decline = runningPeak > 0 ? 1 - d.endPopulation / runningPeak : 0;
    const pool = d.avgNaturalResourceCeiling > 0 ? d.avgNaturalResources / d.avgNaturalResourceCeiling : 0;
    return {
      tick: d.endTick,
      population: d.endPopulation,
      gini: d.avgResourceGini,
      happiness: d.avgHappiness,
      decline,
      pool,
      thriving:
        d.avgResourceGini < Variables.THRIVING_GINI_THRESHOLD &&
        d.avgHappiness >= Variables.THRIVING_HAPPINESS_THRESHOLD &&
        decline < Variables.THRIVING_MAX_PEAK_DECLINE_FRACTION &&
        pool >= Variables.THRIVING_RESOURCE_FRACTION,
      resources: d.avgResources,
      births: d.births,
      deaths: d.totalDeaths,
      employment: snapshot.employmentRate,
      productivity: snapshot.extractionProductivity,
      medianAge: snapshot.medianAge,
      fertileCouples: snapshot.fertileCoupleCount,
    };
  });

  if (showDecades) {
    for (const r of rows) {
       
      console.log(
        `   t${String(r.tick).padStart(3)} pop=${String(r.population).padStart(4)}` +
        ` gini=${r.gini.toFixed(3)} hap=${r.happiness.toFixed(2)}` +
        ` dec=${(r.decline * 100).toFixed(0)}% pool=${(r.pool * 100).toFixed(0)}%` +
        ` res=${r.resources.toFixed(0)} b/d=${r.births}/${r.deaths}` +
        ` emp=${(r.employment * 100).toFixed(0)}% prod=${r.productivity.toFixed(2)}` +
        ` mAge=${r.medianAge.toFixed(0)} fc=${r.fertileCouples}${r.thriving ? '  <<THRIVE' : ''}`,
      );
    }
  }

  const final = rows[rows.length - 1];
  const outcome = classifyOutcome(decades, persons);
  const failed = [
    final.gini < Variables.THRIVING_GINI_THRESHOLD ? '' : 'GINI',
    final.happiness >= Variables.THRIVING_HAPPINESS_THRESHOLD ? '' : 'HAP',
    final.decline < Variables.THRIVING_MAX_PEAK_DECLINE_FRACTION ? '' : 'DECL',
    final.pool >= Variables.THRIVING_RESOURCE_FRACTION ? '' : 'POOL',
  ].filter(Boolean).join(',');

   
  console.log(
    `seed ${String(seed).padStart(3)} ${outcome.padEnd(11)}` +
    ` pop=${String(final.population).padStart(4)}/peak${String(peak).padStart(4)}` +
    ` gini=${final.gini.toFixed(3)} hap=${final.happiness.toFixed(2)}` +
    ` dec=${(final.decline * 100).toFixed(0)}% pool=${(final.pool * 100).toFixed(0)}%` +
    `  fail=[${failed}]${rows.some(r => r.thriving) ? '  ANY-DECADE-THRIVE' : ''}`,
  );
  return outcome;
}

(async () => {
   
  console.log(`# ticks=${ticks} persons=${persons} sets=[${overrides.join(' ')}]`);
  const tally: Record<string, number> = {};
  for (const seed of seeds) {
    const outcome = await run(seed);
    tally[outcome] = (tally[outcome] ?? 0) + 1;
  }
   
  console.log(`TALLY ${Object.entries(tally).map(([k, v]) => `${k}×${v}`).join(' ')}`);
})();
