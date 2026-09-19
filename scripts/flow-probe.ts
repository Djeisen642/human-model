/**
 * Diagnostic: the per-person distribution of resource flow, decade by decade.
 *
 * Every resource figure the model records is a mean or a sum — `TickSnapshot.totalConsumption` is a
 * per-tick total, `TenYearSummary.avgResources` a mean of means — so the only spread statistic
 * anywhere is `resourceGini`, a single scalar. This prints the actual distributions as
 * box-and-whisker rows, one per decade, for four per-person quantities:
 *
 * - **extract** — extraction capacity per tick, `experience × (BASE_GATHER_AMOUNT +
 *   intelligence × INTELLIGENCE_GATHER_SCALAR) × extractionProductivity`. This is *potential*, not
 *   what the person got: `GatherResourcesEvent` takes `min(output, naturalResources)`, so once the
 *   pool binds the realised figure is lower and depends on shuffle order. Read it as an upper
 *   bound, and read the gap between it and a stripped commons as the rationing.
 * - **consume** — the per-tick living cost `ConsumptionEvent` deducts.
 * - **net** — extract − consume. The share of the box sitting below zero is the share of the
 *   population that cannot cover its own costs at full extraction, which is what the extraction
 *   cliff in `docs/research-extraction-need-ratio.md` is made of.
 * - **hold** — resources in hand. This is what `resourceGini` compresses into one number.
 *
 * Consumption is deliberately included even though it is nearly degenerate (1.0 for an adult, 1.5×
 * for an elder, 2% of own resources for a parentally subsidised child): a flat box next to a wide
 * one is the point — the variance in this model is all on the income side, none on the outgo side.
 *
 * Usage:
 *   npx ts-node scripts/flow-probe.ts [options]
 *
 * Options:
 *   --seed 1            seed (default 1)
 *   --ticks 2000        ticks to run (default 2000)
 *   --persons 300       founding population (default 300)
 *   --every 10          print one row per N decades (default 10, i.e. every 100 ticks)
 *   --metric net        which quantity to chart: extract | consume | net | hold (default net)
 *   --set KEY=VAL       Variables override (repeatable)
 *   --tsv               emit every decade as TSV instead of the chart, for plotting elsewhere
 */

import LooperSingleton from '../src/App/LooperSingleton';
import Simulation from '../src/App/Simulation';
import Person from '../src/App/Person';
import Variables from '../src/Helpers/Variables';
import { fiveNumberSummary, FiveNumber } from '../src/Helpers/Statistics';
import { applyOverrides } from '../src/Helpers/HarnessOverrides';

/** The four per-person quantities this probe summarises. */
const METRICS = ['extract', 'consume', 'net', 'hold'] as const;
type Metric = typeof METRICS[number];

/** One decade's five-number summary for every metric, plus the commons state that produced it. */
interface DecadeRow {
  endTick: number;
  population: number;
  poolFill: number;
  /** Share of the living population whose extraction capacity is below their own living cost. */
  shareUnderwater: number;
  summaries: Record<Metric, FiveNumber>;
}

/**
 * Extraction capacity for one person this tick, before the pool rations it.
 *
 * @param p - the person
 * @param productivity - the simulation's current extraction productivity
 * @returns resources the person would gather from an unlimited pool
 */
function extractionPotential(p: Person, productivity: number): number {
  return p.experience * (Variables.BASE_GATHER_AMOUNT + p.intelligence * Variables.INTELLIGENCE_GATHER_SCALAR) * productivity;
}

/**
 * Living cost `ConsumptionEvent` will deduct from one person this tick.
 *
 * @param p - the person
 * @returns the per-tick consumption cost
 */
function consumptionCost(p: Person): number {
  if (p.age < Variables.CONSUMPTION_CHILD_MAX_AGE && p.livingParents.length > 0) {
    return p.resources * Variables.CONSUMPTION_CHILD_RESOURCE_RATE;
  }
  return Variables.CONSUMPTION_BASE * (p.age >= Variables.CONSUMPTION_ELDER_MIN_AGE ? Variables.CONSUMPTION_ELDER_MULTIPLIER : 1);
}

/** Parse `--flag value` pairs and the repeatable `--set` overrides from argv. */
function parseArgs(argv: string[]): { opts: Record<string, string>; sets: string[] } {
  const opts: Record<string, string> = {};
  const sets: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (key === 'tsv') { opts.tsv = 'true'; continue; }
    const val = argv[++i] ?? '';
    if (key === 'set') sets.push(val);
    else opts[key] = val;
  }
  return { opts, sets };
}

/**
 * Render one five-number summary as a fixed-width box-and-whisker row.
 *
 * @param f - the summary to draw
 * @param lo - value at the left edge of the track
 * @param hi - value at the right edge of the track
 * @param width - track width in characters
 * @param zero - when set, mark this value with a `|` so a sign change is visible
 * @returns the drawn row
 */
function boxRow(f: FiveNumber, lo: number, hi: number, width: number, zero?: number): string {
  const cells = new Array(width).fill(' ');
  const at = (v: number): number => Math.max(0, Math.min(width - 1, Math.round(((v - lo) / (hi - lo)) * (width - 1))));
  if (zero !== undefined && zero > lo && zero < hi) cells[at(zero)] = '|';
  for (let i = at(f.whiskerLow); i <= at(f.whiskerHigh); i++) cells[i] = '-';
  cells[at(f.whiskerLow)] = '|';
  cells[at(f.whiskerHigh)] = '|';
  for (let i = at(f.q1); i <= at(f.q3); i++) cells[i] = '#';
  cells[at(f.median)] = '@';
  return cells.join('');
}

async function main(): Promise<void> {
  const { opts, sets } = parseArgs(process.argv.slice(2));
  const seed = Number(opts.seed ?? 1);
  const ticks = Number(opts.ticks ?? 2000);
  const persons = Number(opts.persons ?? 300);
  const every = Number(opts.every ?? 10);
  const metric = (opts.metric ?? 'net') as Metric;
  if (!METRICS.includes(metric)) throw new Error(`--metric must be one of ${METRICS.join(' | ')}`);

  const restore = applyOverrides(sets);
  const rows: DecadeRow[] = [];
  try {
    await LooperSingleton.getInstance().start(persons, ticks, seed, () => {}, {}, (sim: Simulation, endTick: number) => {
      const living = sim.getLiving();
      if (living.length === 0) return;
      const productivity = sim.extractionProductivity;
      const samples: Record<Metric, number[]> = { extract: [], consume: [], net: [], hold: [] };
      for (const p of living) {
        const e = extractionPotential(p, productivity);
        const c = consumptionCost(p);
        samples.extract.push(e);
        samples.consume.push(c);
        samples.net.push(e - c);
        samples.hold.push(p.resources);
      }
      const last = sim.history[sim.history.length - 1];
      rows.push({
        endTick,
        population: living.length,
        poolFill: last.naturalResourceCeiling > 0 ? last.naturalResources / last.naturalResourceCeiling : 0,
        shareUnderwater: samples.net.filter((v) => v < 0).length / samples.net.length,
        summaries: {
          extract: fiveNumberSummary(samples.extract),
          consume: fiveNumberSummary(samples.consume),
          net: fiveNumberSummary(samples.net),
          hold: fiveNumberSummary(samples.hold),
        },
      });
    });
  } finally {
    restore();
  }

  if (rows.length === 0) { console.log('No surviving decade to summarise — the population died before the first decade boundary.'); return; }

  if (opts.tsv === 'true') {
    console.log(['endTick', 'population', 'poolFill', 'shareUnderwater', 'metric', 'n', 'min', 'whiskerLow', 'q1', 'median', 'q3', 'whiskerHigh', 'max', 'outliers'].join('\t'));
    for (const r of rows) {
      for (const m of METRICS) {
        const f = r.summaries[m];
        console.log([r.endTick, r.population, r.poolFill.toFixed(4), r.shareUnderwater.toFixed(4), m, f.n,
          f.min.toFixed(3), f.whiskerLow.toFixed(3), f.q1.toFixed(3), f.median.toFixed(3),
          f.q3.toFixed(3), f.whiskerHigh.toFixed(3), f.max.toFixed(3), f.outliers].join('\t'));
      }
    }
    return;
  }

  const shown = rows.filter((_, i) => i % every === 0 || i === rows.length - 1);
  const all = shown.flatMap((r) => [r.summaries[metric].whiskerLow, r.summaries[metric].whiskerHigh]);
  const lo = Math.min(0, ...all), hi = Math.max(...all);
  const width = 52;

  console.log(`flow-probe  seed=${seed} ticks=${ticks} persons=${persons} metric=${metric}` +
    (sets.length ? `  set:{${sets.join(' ')}}` : ''));
  console.log(`per-person ${metric}, one row per ${every * 10} ticks.  | whisker  # quartile  @ median` +
    (metric === 'net' ? '   (| at zero = covering own costs)' : ''));
  console.log(`scale ${lo.toFixed(1)} → ${hi.toFixed(1)}.  "under" is the share of people whose extraction`);
  console.log('capacity is below their own living cost — the starvation pressure, on every metric.\n');
  console.log('  tick   pop  pool  median         q1..q3  ' + 'distribution'.padEnd(width) + '  under');
  console.log('-'.repeat(width + 51));
  for (const r of shown) {
    const f = r.summaries[metric];
    console.log(
      String(r.endTick).padStart(6) + '  ' +
      String(r.population).padStart(4) + '  ' +
      (100 * r.poolFill).toFixed(0).padStart(3) + '%  ' +
      f.median.toFixed(2).padStart(6) + '  ' +
      (f.q1.toFixed(1) + '..' + f.q3.toFixed(1)).padStart(13) + '  ' +
      boxRow(f, lo, hi, width, metric === 'net' ? 0 : undefined) + '  ' +
      (100 * r.shareUnderwater).toFixed(0).padStart(3) + '%',
    );
  }
  console.log('\nextract is potential, not realised: GatherResourcesEvent takes min(output, pool), so');
  console.log('once the pool is stripped the realised figure is lower and depends on shuffle order.');
}

main().catch((e) => { console.error(e); process.exit(1); });
