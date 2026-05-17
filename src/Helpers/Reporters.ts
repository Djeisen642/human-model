import { PersonTypes, SurvivorSummary, TenYearSummary } from './Types';
import { TickSnapshot } from '../App/Simulation';
import Person from '../App/Person';
import Constants from './Constants';
import { countPerType } from './Classifier';
import Variables from './Variables';

/**
 * Builds a TenYearSummary from a consecutive snapshot window.
 * Accepts any non-empty window length (10 for full decades; <10 for the partial
 * trailing window when `ticks % 10 !== 0`, per ARD 031).
 *
 * @param window - consecutive TickSnapshots for the decade (or partial trailing window)
 * @param endTick - the closing tick number
 * @param startPopulation - population count immediately before the window began
 * @returns aggregate summary for the window
 */
export function buildTenYearSummary(
  window: TickSnapshot[],
  endTick: number,
  startPopulation: number,
): TenYearSummary {
  const last = window[window.length - 1];
  const first = window[0];

  // Cumulative totals at the end of the tick before the window started.
  const preCumulativeDeaths = first.cumulativeDeaths - first.deaths;
  const preCumulativeByMurder = first.cumulativeDeathsByMurder - first.deathsByMurder;
  const preCumulativeByIllness = first.cumulativeDeathsByIllness - first.deathsByIllness;
  const preCumulativeByDisaster = first.cumulativeDeathsByDisaster - first.deathsByDisaster;
  const preCumulativeBySuicide = first.cumulativeDeathsBySuicide - first.deathsBySuicide;
  const preCumulativeBirths = first.cumulativeBirths - first.births;

  const totalDeaths = last.cumulativeDeaths - preCumulativeDeaths;
  const deathsByKilling = last.cumulativeDeathsByMurder - preCumulativeByMurder;
  const deathsByIllness = last.cumulativeDeathsByIllness - preCumulativeByIllness;
  const deathsByDisaster = last.cumulativeDeathsByDisaster - preCumulativeByDisaster;
  const deathsBySuicide = last.cumulativeDeathsBySuicide - preCumulativeBySuicide;
  const births = last.cumulativeBirths - preCumulativeBirths;

  const avgResourceGini = avg(window.map(s => s.resourceGini));
  const avgResources = avg(window.map(s => s.averageResources));
  const avgHappiness = avg(window.map(s => s.averageHappiness));
  const avgNaturalResources = avg(window.map(s => s.naturalResources));
  const peakResourceGini = Math.max(...window.map(s => s.resourceGini));
  const avgCommunityPool = avg(window.map(s => s.communityPool));

  return {
    endTick,
    endPopulation: last.population,
    populationDelta: last.population - startPopulation,
    totalDeaths,
    deathsByIllness,
    deathsBySuicide,
    deathsByKilling,
    deathsByDisaster,
    avgResourceGini,
    avgResources,
    avgHappiness,
    avgNaturalResources,
    peakResourceGini,
    births,
    avgCommunityPool,
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
    `Births: ${summary.births}  ` +
    `Deaths: ${summary.totalDeaths} ` +
    `(ill:${summary.deathsByIllness} sui:${summary.deathsBySuicide} ` +
    `kill:${summary.deathsByKilling} dis:${summary.deathsByDisaster})`
  );
}

/** Possible outcome labels. EXTINCTION added in ARD 031. */
export type OutcomeLabel = 'EXTINCTION' | 'COLLAPSE' | 'STRUGGLING' | 'STABLE' | 'THRIVING';

/**
 * Classifies the simulation outcome based on the final decade's summary.
 * Checks in order: EXTINCTION, COLLAPSE, THRIVING, STRUGGLING, STABLE.
 *
 * @param finalDecade - the last TenYearSummary in decadeHistory
 * @param startPopulation - initial population at simulation start
 * @returns outcome label
 */
export function classifyOutcome(
  finalDecade: TenYearSummary,
  startPopulation: number,
): OutcomeLabel {
  if (finalDecade.endPopulation === 0) return 'EXTINCTION';
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
 * Human-readable rationale for an outcome label, citing the triggering metric.
 * ARD 016 specified this; surfaces the "why" alongside the label.
 *
 * @param finalDecade - the last TenYearSummary in decadeHistory
 * @param startPopulation - initial population at simulation start
 * @param outcome - the label returned by classifyOutcome
 * @returns one-line reason string
 */
export function explainOutcome(
  finalDecade: TenYearSummary,
  startPopulation: number,
  outcome: OutcomeLabel,
): string {
  const popFraction = finalDecade.endPopulation / startPopulation;
  const giniStr = finalDecade.avgResourceGini.toFixed(2);
  const happinessStr = finalDecade.avgHappiness.toFixed(1);
  switch (outcome) {
  case 'EXTINCTION':
    return 'Population reached 0';
  case 'COLLAPSE':
    if (finalDecade.avgResourceGini >= Variables.COLLAPSE_GINI_THRESHOLD) {
      return `Final-decade avg Gini ${giniStr} ≥ ${Variables.COLLAPSE_GINI_THRESHOLD.toFixed(2)} threshold`;
    }
    return `Population fell to ${(popFraction * 100).toFixed(0)}% of start (below ${(Variables.COLLAPSE_POPULATION_FRACTION * 100).toFixed(0)}%)`;
  case 'THRIVING':
    return `Final-decade Gini ${giniStr} below ${Variables.THRIVING_GINI_THRESHOLD.toFixed(2)} and happiness ${happinessStr} ≥ ${Variables.THRIVING_HAPPINESS_THRESHOLD.toFixed(1)}`;
  case 'STRUGGLING':
    if (finalDecade.avgResourceGini >= Variables.STRUGGLING_GINI_THRESHOLD) {
      return `Final-decade Gini ${giniStr} ≥ ${Variables.STRUGGLING_GINI_THRESHOLD.toFixed(2)} threshold`;
    }
    return `Final-decade happiness ${happinessStr} below ${Variables.STRUGGLING_HAPPINESS_THRESHOLD.toFixed(1)} threshold`;
  case 'STABLE':
    return `Gini ${giniStr} and happiness ${happinessStr} within stable band`;
  }
}

/**
 * Summarises the composition of the living population by age, education,
 * employment, health, and family status. ARD 031.
 *
 * @param living - current living population
 * @returns aggregate composition
 */
export function summarizeSurvivors(living: Person[]): SurvivorSummary {
  const summary: SurvivorSummary = {
    total: living.length,
    children: 0,
    working: 0,
    elderly: 0,
    educationCounts: {
      [Constants.EDUCATION.NONE]: 0,
      [Constants.EDUCATION.HIGH_SCHOOL]: 0,
      [Constants.EDUCATION.TRADE_SCHOOL]: 0,
      [Constants.EDUCATION.BACHELORS]: 0,
      [Constants.EDUCATION.MASTERS]: 0,
      [Constants.EDUCATION.PHD]: 0,
    },
    enrolled: 0,
    employed: 0,
    healthWell: 0,
    healthMild: 0,
    healthSevere: 0,
    avgIllness: 0,
    partnered: 0,
    withChildren: 0,
  };

  if (living.length === 0) return summary;

  let illnessSum = 0;
  for (const p of living) {
    if (p.age < 18) summary.children++;
    else if (p.age <= 65) summary.working++;
    else summary.elderly++;

    summary.educationCounts[p.education] = (summary.educationCounts[p.education] ?? 0) + 1;
    if (p.isWorkingOnEd !== Constants.EDUCATION.NONE) summary.enrolled++;

    if (p.age >= 18 && p.age <= 65 && p.hasJob) summary.employed++;

    if (p.illness < 0.1) summary.healthWell++;
    else if (p.illness < 0.5) summary.healthMild++;
    else summary.healthSevere++;
    illnessSum += p.illness;

    if (p.isInRelationshipWith !== null) summary.partnered++;
    if (p.hasChildren.length > 0) summary.withChildren++;
  }

  summary.avgIllness = illnessSum / living.length;
  return summary;
}

/**
 * Formats the SURVIVORS section as multi-line output. ARD 031.
 *
 * @param s - survivor summary
 * @returns lines of the section (caller joins with newlines)
 */
export function formatSurvivorSection(s: SurvivorSummary): string[] {
  const pct = (count: number, total: number): string =>
    total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '—';

  const edu = s.educationCounts;
  const employmentDenom = s.working;

  return [
    `SURVIVORS (${s.total})`,
    `  Age:        children ${s.children} (${pct(s.children, s.total)})  ` +
      `working ${s.working} (${pct(s.working, s.total)})  ` +
      `elderly ${s.elderly} (${pct(s.elderly, s.total)})`,
    `  Education:  NONE ${edu[Constants.EDUCATION.NONE] ?? 0}  ` +
      `HS ${edu[Constants.EDUCATION.HIGH_SCHOOL] ?? 0}  ` +
      `Trade ${edu[Constants.EDUCATION.TRADE_SCHOOL] ?? 0}  ` +
      `BA ${edu[Constants.EDUCATION.BACHELORS] ?? 0}  ` +
      `MA ${edu[Constants.EDUCATION.MASTERS] ?? 0}  ` +
      `PhD ${edu[Constants.EDUCATION.PHD] ?? 0}   ` +
      `(currently enrolled: ${s.enrolled})`,
    `  Employment: ${s.employed} / ${employmentDenom} working-age employed (${pct(s.employed, employmentDenom)})`,
    `  Health:     well ${s.healthWell} (<0.1)  ` +
      `mild ${s.healthMild} (0.1–0.5)  ` +
      `severe ${s.healthSevere} (≥0.5)   ` +
      `avg illness ${s.avgIllness.toFixed(2)}`,
    `  Family:     partnered ${s.partnered} (${pct(s.partnered, s.total)})  ` +
      `with children ${s.withChildren} (${pct(s.withChildren, s.total)})`,
  ];
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
 * @param personTypes - optional person types in effect; section omitted when empty (ARD 030)
 * @param seededTypeCounts - count of persons assigned to each type at seed time
 * @param living - current living population, for end-of-run type classification
 * @param extinctionTick - tick at which population first reached 0; undefined unless EXTINCTION
 * @param extractionEfficiency - final extractionEfficiency value (ARD 032)
 * @param inventionCounts - cumulative invention firings by branch (ARD 032)
 * @param inventionCounts.faster - count of depletion-faster firings
 * @param inventionCounts.slower - count of depletion-slower firings
 * @param inventionCounts.ceiling - count of ceiling-growth firings
 * @param communityPool - community pool balance at end of run (ARD 034)
 * @returns multi-line formatted report string
 */
export function formatEndReport(
  decadeHistory: TenYearSummary[],
  ticks: number,
  seed: number,
  startPopulation: number,
  naturalResources: number,
  naturalResourceCeiling: number,
  personTypes: PersonTypes = {},
  seededTypeCounts: Record<string, number> = {},
  living: Person[] = [],
  extinctionTick?: number,
  extractionEfficiency = 1.0,
  inventionCounts: { faster: number; slower: number; ceiling: number } = { faster: 0, slower: 0, ceiling: 0 },
  communityPool = 0,
): string {
  if (decadeHistory.length === 0) {
    return `=== End of Simulation (${ticks} ticks, seed ${seed}) ===\n(Run too short to produce a decade summary.)`;
  }

  const final = decadeHistory[decadeHistory.length - 1];
  const first = decadeHistory[0];
  const outcome = classifyOutcome(final, startPopulation);
  const reason = explainOutcome(final, startPopulation, outcome);

  const totalDeaths = decadeHistory.reduce((s, d) => s + d.totalDeaths, 0);
  const totalBirths = decadeHistory.reduce((s, d) => s + d.births, 0);
  const byIllness = decadeHistory.reduce((s, d) => s + d.deathsByIllness, 0);
  const bySuicide = decadeHistory.reduce((s, d) => s + d.deathsBySuicide, 0);
  const byKilling = decadeHistory.reduce((s, d) => s + d.deathsByKilling, 0);
  const byDisaster = decadeHistory.reduce((s, d) => s + d.deathsByDisaster, 0);
  const netPop = final.endPopulation - startPopulation;
  const netPopStr = netPop >= 0 ? `+${netPop}` : String(netPop);

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
      `  ${String(d.births).padStart(6)}` +
      `  ${d.avgResourceGini.toFixed(2)}` +
      `  ${d.peakResourceGini.toFixed(2).padStart(6)}` +
      `  ${d.avgResources.toFixed(1).padStart(5)}` +
      `  ${d.avgHappiness.toFixed(1).padStart(5)}` +
      `  ${String(d.totalDeaths).padStart(6)}`
    );
  });

  const lines = [
    `=== End of Simulation (${ticks} ticks, seed ${seed}) ===`,
    '',
    `OUTCOME: ${outcome}`,
    `  Reason: ${reason}`,
    `  Gini: ${final.avgResourceGini.toFixed(2)} avg, ${peakGiniDecade.peakResourceGini.toFixed(2)} peak (Yr ${String(peakGiniDecade.endTick).padStart(3, '0')})`,
  ];

  if (outcome === 'EXTINCTION' && extinctionTick !== undefined) {
    lines.push(`  Extinct as of Yr ${String(extinctionTick).padStart(3, '0')}`);
  }

  lines.push(
    '',
    'POPULATION',
    `  Start: ${startPopulation}  End: ${final.endPopulation}  Births: ${totalBirths}  Deaths: ${totalDeaths}   (net: ${netPopStr})`,
    `  By cause — illness: ${byIllness}  suicide: ${bySuicide}  killing: ${byKilling}  disaster: ${byDisaster}`,
    '',
    'INEQUALITY (Gini)',
    `  Start: ${first.avgResourceGini.toFixed(2)}  End: ${final.avgResourceGini.toFixed(2)}  Peak: ${peakGiniDecade.peakResourceGini.toFixed(2)} (Yr ${String(peakGiniDecade.endTick).padStart(3, '0')})`,
    `  Trend: ${giniTrend >= 0 ? 'rising' : 'falling'} (${giniTrendStr} over run)`,
    '',
    'RESOURCES',
    `  Avg resources/person: ${first.avgResources.toFixed(1)} → ${final.avgResources.toFixed(1)}`,
    `  Natural resources remaining: ${Math.round(naturalResources)} / ${Math.round(naturalResourceCeiling)} ceiling`,
    `  Community pool: ${Math.round(communityPool)}`,
    `  Inventions: ${inventionCounts.faster} faster  ${inventionCounts.slower} slower  ${inventionCounts.ceiling} ceiling   ` +
      `(final efficiency: ${extractionEfficiency.toFixed(2)}, ceiling: ${Math.round(naturalResourceCeiling)})`,
    '',
    'HAPPINESS',
    `  Avg happiness: ${first.avgHappiness.toFixed(1)} → ${final.avgHappiness.toFixed(1)}`,
    `  Trend: ${final.avgHappiness >= first.avgHappiness ? 'rising' : 'declining'}`,
  );

  if (living.length > 0) {
    const survivors = summarizeSurvivors(living);
    lines.push('', ...formatSurvivorSection(survivors));
  }

  const typeSection = formatPersonTypeSection(personTypes, seededTypeCounts, living, startPopulation, final.endPopulation);
  if (typeSection !== null) {
    lines.push('', ...typeSection);
  }

  lines.push(
    '',
    'DECADE SUMMARY TABLE',
    '  Yr   Pop  ΔPop  Births  Gini  PkGini    Res  Happy  Deaths',
    ...decadeTableRows,
  );
  return lines.join('\n');
}

/**
 * Formats the per-type cohort survival section. Returns null when no types are configured.
 *
 * @param personTypes - declared types
 * @param seededTypeCounts - count assigned to each type at seed time
 * @param living - current living population
 * @param startPopulation - initial population count
 * @param endPopulation - final population count
 * @returns the section's lines, or null when no types apply
 */
function formatPersonTypeSection(
  personTypes: PersonTypes,
  seededTypeCounts: Record<string, number>,
  living: Person[],
  startPopulation: number,
  endPopulation: number,
): string[] | null {
  const names = Object.keys(personTypes);
  if (names.length === 0) return null;

  const currentCounts = countPerType(living, personTypes);
  const pct = (count: number, total: number) => total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '—';

  const rows = names.map(name => {
    const seeded = seededTypeCounts[name] ?? 0;
    const current = currentCounts[name] ?? 0;
    const delta = current - seeded;
    const deltaStr = delta >= 0 ? `+${delta}` : String(delta);
    return (
      `  ${name.padEnd(14)}` +
      `  ${String(seeded).padStart(5)} (${pct(seeded, startPopulation).padStart(6)})` +
      `  ${String(current).padStart(5)} (${pct(current, endPopulation).padStart(6)})` +
      `  ${deltaStr.padStart(5)}`
    );
  });

  return [
    'COHORT SURVIVAL (ARD 030)',
    '  Type            Seeded            Current           Delta',
    ...rows,
  ];
}

/**
 * @param values - numbers to average
 * @returns arithmetic mean, or 0 if empty
 */
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
