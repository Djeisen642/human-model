import { TenYearSummary } from './Types';
import { TickSnapshot } from '../App/Simulation';
import Variables from './Variables';

/**
 * Builds a TenYearSummary from a 10-snapshot window.
 * Uses cumulative death counts stored on each snapshot to compute per-decade deltas.
 *
 * @param window - exactly 10 consecutive TickSnapshots for the decade
 * @param endTick - the closing tick number (10, 20, 30, …)
 * @param startPopulation - population count immediately before the decade began
 * @returns aggregate summary for the decade
 */
export function buildTenYearSummary(
  window: TickSnapshot[],
  endTick: number,
  startPopulation: number,
): TenYearSummary {
  const last = window[window.length - 1];
  const first = window[0];

  // Cumulative totals at the end of the tick before the decade started.
  const preCumulativeDeaths = first.cumulativeDeaths - first.deaths;
  const preCumulativeByMurder = first.cumulativeDeathsByMurder - first.deathsByMurder;
  const preCumulativeByIllness = first.cumulativeDeathsByIllness - first.deathsByIllness;
  const preCumulativeByDisaster = first.cumulativeDeathsByDisaster - first.deathsByDisaster;
  const preCumulativeBySuicide = first.cumulativeDeathsBySuicide - first.deathsBySuicide;
  const preCumulativeByOldAge = first.cumulativeDeathsByOldAge - first.deathsByOldAge;

  const totalDeaths = last.cumulativeDeaths - preCumulativeDeaths;
  const deathsByKilling = last.cumulativeDeathsByMurder - preCumulativeByMurder;
  const deathsByIllness = last.cumulativeDeathsByIllness - preCumulativeByIllness;
  const deathsByDisaster = last.cumulativeDeathsByDisaster - preCumulativeByDisaster;
  const deathsBySuicide = last.cumulativeDeathsBySuicide - preCumulativeBySuicide;
  const deathsByOldAge = last.cumulativeDeathsByOldAge - preCumulativeByOldAge;

  const avgResourceGini = avg(window.map(s => s.resourceGini));
  const avgResources = avg(window.map(s => s.averageResources));
  const avgHappiness = avg(window.map(s => s.averageHappiness));
  const avgNaturalResources = avg(window.map(s => s.naturalResources));
  const peakResourceGini = Math.max(...window.map(s => s.resourceGini));

  return {
    endTick,
    endPopulation: last.population,
    populationDelta: last.population - startPopulation,
    totalDeaths,
    deathsByOldAge,
    deathsByIllness,
    deathsBySuicide,
    deathsByKilling,
    deathsByDisaster,
    avgResourceGini,
    avgResources,
    avgHappiness,
    avgNaturalResources,
    peakResourceGini,
  };
}

/**
 * Returns the two-line header printed once before the tick loop begins.
 *
 * @param n - initial population size
 * @param ticks - total ticks to simulate
 * @param seed - PRNG seed
 * @returns formatted header string
 */
export function formatSimulationHeader(n: number, ticks: number, seed: number): string {
  return (
    `=== Simulation start: ${n} persons, ${ticks} ticks, seed ${seed} ===\n` +
    '[Yr ---] Pop           Gini            Resources  Happiness  Deaths'
  );
}

/**
 * Formats a single decade summary as one console line.
 *
 * @param summary - the decade to format
 * @returns formatted line string
 */
export function formatDecadeSummary(summary: TenYearSummary): string {
  const yr = String(summary.endTick).padStart(3, '0');
  const delta = summary.populationDelta >= 0
    ? `+${summary.populationDelta}`
    : String(summary.populationDelta);
  return (
    `[Yr ${yr}] ` +
    `Pop: ${summary.endPopulation} (${delta})  ` +
    `Gini: ${summary.avgResourceGini.toFixed(2)} (peak ${summary.peakResourceGini.toFixed(2)})  ` +
    `Resources: ${summary.avgResources.toFixed(1)}  ` +
    `Happiness: ${summary.avgHappiness.toFixed(1)}  ` +
    `Deaths: ${summary.totalDeaths} ` +
    `(ill:${summary.deathsByIllness} sui:${summary.deathsBySuicide} ` +
    `kill:${summary.deathsByKilling} dis:${summary.deathsByDisaster} age:${summary.deathsByOldAge})`
  );
}

/**
 * Classifies the simulation outcome based on the final decade's summary.
 * Checks in order: COLLAPSE, THRIVING, STRUGGLING, STABLE.
 *
 * @param finalDecade - the last TenYearSummary in decadeHistory
 * @param startPopulation - initial population at simulation start
 * @returns outcome label
 */
export function classifyOutcome(
  finalDecade: TenYearSummary,
  startPopulation: number,
): 'COLLAPSE' | 'STRUGGLING' | 'STABLE' | 'THRIVING' {
  const popFraction = finalDecade.endPopulation / startPopulation;
  if (
    finalDecade.avgResourceGini >= Variables.COLLAPSE_GINI_THRESHOLD ||
    popFraction < Variables.COLLAPSE_POPULATION_FRACTION
  ) {
    return 'COLLAPSE';
  }
  if (
    finalDecade.avgResourceGini < Variables.THRIVING_GINI_THRESHOLD &&
    finalDecade.avgHappiness >= Variables.THRIVING_HAPPINESS_THRESHOLD
  ) {
    return 'THRIVING';
  }
  if (
    finalDecade.avgResourceGini >= Variables.STRUGGLING_GINI_THRESHOLD ||
    finalDecade.avgHappiness < Variables.STRUGGLING_HAPPINESS_THRESHOLD
  ) {
    return 'STRUGGLING';
  }
  return 'STABLE';
}

/**
 * Builds the end-of-simulation console report string.
 *
 * @param decadeHistory - all decade summaries from the run
 * @param ticks - total ticks simulated
 * @param seed - PRNG seed
 * @param startPopulation - initial population count
 * @param naturalResources - remaining natural resources at end
 * @param naturalResourceCeiling - resource ceiling at end
 * @returns multi-line formatted report string
 */
export function formatEndReport(
  decadeHistory: TenYearSummary[],
  ticks: number,
  seed: number,
  startPopulation: number,
  naturalResources: number,
  naturalResourceCeiling: number,
): string {
  if (decadeHistory.length === 0) {
    return `=== End of Simulation (${ticks} ticks, seed ${seed}) ===\n(Run too short to produce a decade summary.)`;
  }

  const final = decadeHistory[decadeHistory.length - 1];
  const first = decadeHistory[0];
  const outcome = classifyOutcome(final, startPopulation);

  const totalDeaths = decadeHistory.reduce((s, d) => s + d.totalDeaths, 0);
  const byIllness = decadeHistory.reduce((s, d) => s + d.deathsByIllness, 0);
  const bySuicide = decadeHistory.reduce((s, d) => s + d.deathsBySuicide, 0);
  const byKilling = decadeHistory.reduce((s, d) => s + d.deathsByKilling, 0);
  const byDisaster = decadeHistory.reduce((s, d) => s + d.deathsByDisaster, 0);
  const byOldAge = decadeHistory.reduce((s, d) => s + d.deathsByOldAge, 0);

  const giniTrend = final.avgResourceGini - first.avgResourceGini;
  const giniTrendStr = giniTrend >= 0 ? `+${giniTrend.toFixed(2)}` : giniTrend.toFixed(2);

  const peakGiniDecade = decadeHistory.reduce(
    (best, d) => (d.peakResourceGini > best.peakResourceGini ? d : best),
    decadeHistory[0],
  );

  const decadeTableRows = decadeHistory.map(d => {
    const delta = d.populationDelta >= 0 ? `+${d.populationDelta}` : String(d.populationDelta);
    return (
      `  ${String(d.endTick).padStart(3, '0')}` +
      `  ${String(d.endPopulation).padStart(4)}` +
      `  ${delta.padStart(4)}` +
      `  ${d.avgResourceGini.toFixed(2)}` +
      `  ${d.peakResourceGini.toFixed(2).padStart(6)}` +
      `  ${d.avgResources.toFixed(1).padStart(5)}` +
      `  ${d.avgHappiness.toFixed(1).padStart(5)}` +
      `  ${String(d.totalDeaths).padStart(6)}`
    );
  });

  return [
    `=== End of Simulation (${ticks} ticks, seed ${seed}) ===`,
    '',
    `OUTCOME: ${outcome}`,
    `  Gini: ${final.avgResourceGini.toFixed(2)} avg, ${peakGiniDecade.peakResourceGini.toFixed(2)} peak (Yr ${String(peakGiniDecade.endTick).padStart(3, '0')})`,
    '',
    'POPULATION',
    `  Start: ${startPopulation}  End: ${final.endPopulation}  Total deaths: ${totalDeaths}`,
    `  By cause — illness: ${byIllness}  suicide: ${bySuicide}  killing: ${byKilling}  disaster: ${byDisaster}  old age: ${byOldAge}`,
    '',
    'INEQUALITY (Gini)',
    `  Start: ${first.avgResourceGini.toFixed(2)}  End: ${final.avgResourceGini.toFixed(2)}  Peak: ${peakGiniDecade.peakResourceGini.toFixed(2)} (Yr ${String(peakGiniDecade.endTick).padStart(3, '0')})`,
    `  Trend: ${giniTrend >= 0 ? 'rising' : 'falling'} (${giniTrendStr} over run)`,
    '',
    'RESOURCES',
    `  Avg resources/person: ${first.avgResources.toFixed(1)} → ${final.avgResources.toFixed(1)}`,
    `  Natural resources remaining: ${Math.round(naturalResources)} / ${Math.round(naturalResourceCeiling)} ceiling`,
    '',
    'HAPPINESS',
    `  Avg happiness: ${first.avgHappiness.toFixed(1)} → ${final.avgHappiness.toFixed(1)}`,
    `  Trend: ${final.avgHappiness >= first.avgHappiness ? 'rising' : 'declining'}`,
    '',
    'DECADE SUMMARY TABLE',
    '  Yr   Pop  ΔPop  Gini  PkGini    Res  Happy  Deaths',
    ...decadeTableRows,
  ].join('\n');
}

/**
 * @param values - numbers to average
 * @returns arithmetic mean, or 0 if empty
 */
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
