import { PersonTypes, SurvivorSummary, TenYearSummary } from './Types';
import { TickSnapshot } from '../App/Simulation';
import Person from '../App/Person';
import Constants from './Constants';
import { countPerType } from './Classifier';
import Variables from './Variables';
import { CycleMetrics } from './CycleDetector';

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
  const avgNaturalResourceCeiling = avg(window.map(s => s.naturalResourceCeiling));
  const peakResourceGini = Math.max(...window.map(s => s.resourceGini));
  const avgCommunityPool = avg(window.map(s => s.communityPool));
  const avgChildPopulation = avg(window.map(s => s.childPopulation));
  const avgOrphanCount = avg(window.map(s => s.orphanCount));
  const avgWelfareRecipients = avg(window.map(s => s.welfareRecipients));
  const avgPopulation = avg(window.map(s => s.population));

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
    avgNaturalResourceCeiling,
    peakResourceGini,
    births,
    avgCommunityPool,
    avgChildPopulation,
    avgOrphanCount,
    avgWelfareRecipients,
    avgPopulation,
  };
}

/**
 * Share of a sub-population within its cohort, as a fraction in [0, 1].
 * Used for orphans-within-children and welfare-recipients-within-population, both of which
 * hit an empty denominator in a dying run.
 *
 * @param part - size of the sub-population
 * @param whole - size of the cohort it is measured against
 * @returns part ÷ whole, or 0 when the cohort is empty
 */
export function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
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
  return `=== Simulation start: ${n} persons, ${ticks} ticks, seed ${seed} ===`;
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
    `Orphans: ${summary.avgOrphanCount.toFixed(1)}  ` +
    `Deaths: ${summary.totalDeaths} ` +
    `(ill:${summary.deathsByIllness} sui:${summary.deathsBySuicide} ` +
    `kill:${summary.deathsByKilling} dis:${summary.deathsByDisaster})`
  );
}

/** Possible outcome labels. EXTINCTION added in ARD 031; CYCLICAL replaced THRIVING in ARD 063. */
export type OutcomeLabel = 'EXTINCTION' | 'COLLAPSE' | 'STRUGGLING' | 'CYCLICAL' | 'STABLE';

/** Derived signals the outcome verdict reads, across four collapse/thrive dimensions (ARD 051). */
interface OutcomeMetrics {
  /** Population at the end of the final decade. */
  finalPop: number;
  /** Decline from the run's peak population, as a fraction in [0, 1]. */
  peakDecline: number;
  /** Commons fill fraction: final-decade avg pool ÷ avg ceiling, in [0, 1]. */
  poolFraction: number;
  /** Final-decade average Gini. */
  gini: number;
  /** Final-decade average happiness. */
  happiness: number;
}

/**
 * Derives the four-dimensional outcome signals from the decade history: population trajectory
 * (decline from the run's peak), inequality, wellbeing, and ecological strain (commons fill).
 * The starting population counts as a candidate peak so a run that only ever declines is measured
 * against its true high-water mark. See ARD 051.
 *
 * @param decadeHistory - all decade summaries in order
 * @param startPopulation - initial population at simulation start
 * @returns the derived signals for the final decade
 */
function outcomeMetrics(decadeHistory: TenYearSummary[], startPopulation: number): OutcomeMetrics {
  const final = decadeHistory[decadeHistory.length - 1];
  const peakPop = Math.max(startPopulation, ...decadeHistory.map(d => d.endPopulation));
  const peakDecline = peakPop > 0 ? 1 - final.endPopulation / peakPop : 0;
  const poolFraction = final.avgNaturalResourceCeiling > 0
    ? final.avgNaturalResources / final.avgNaturalResourceCeiling
    : 0;
  return {
    finalPop: final.endPopulation,
    peakDecline,
    poolFraction,
    gini: final.avgResourceGini,
    happiness: final.avgHappiness,
  };
}

/**
 * Classifies the simulation outcome on population trajectory, inequality, wellbeing, and
 * ecological strain (ARD 051, revised by ARD 063). Checked in order: EXTINCTION, COLLAPSE by
 * inequality, COLLAPSE/STRUGGLING by peak-relative decline (skipped when the population is a
 * confirmed stable cycle), STRUGGLING by inequality/wellbeing/commons, CYCLICAL, STABLE.
 *
 * Peak-relative decline is a collapse signal for a one-shot overshoot but not for a population
 * that oscillates: a run cycling between a high and a low reads as deep in decline for most of
 * every cycle, even while the oscillation itself is sustained and non-collapsing. `cycles` (the
 * caller's own `CycleDetector.detectCycles` result over the run's tick-level population series —
 * already computed for the sweep harness's `cyc`/`stable` columns, so this reuses rather than
 * recomputes) settles that ambiguity: when it confirms a stable cycle, peak-decline is not
 * evaluated and the trajectory reads as cycling instead of declining. Gini, happiness, and commons
 * fill are unaffected — a cycling population can still read STRUGGLING or COLLAPSE on any of those.
 *
 * @param decadeHistory - all decade summaries in order (the last is the final decade)
 * @param startPopulation - initial population at simulation start
 * @param cycles - cycle metrics for the run's population series (`CycleDetector.detectCycles`)
 * @returns outcome label
 */
export function classifyOutcome(
  decadeHistory: TenYearSummary[],
  startPopulation: number,
  cycles: CycleMetrics,
): OutcomeLabel {
  const m = outcomeMetrics(decadeHistory, startPopulation);
  if (m.finalPop === 0) return 'EXTINCTION';

  // COLLAPSE by inequality: checked unconditionally — extreme inequality collapses the label
  // regardless of population phase.
  if (m.gini >= Variables.COLLAPSE_GINI_THRESHOLD) return 'COLLAPSE';

  const cycling = cycles.stableCycle;

  // COLLAPSE by decline: only reachable when the population is not a confirmed stable cycle.
  if (!cycling && m.peakDecline >= Variables.COLLAPSE_PEAK_DECLINE_FRACTION) {
    return 'COLLAPSE';
  }

  // STRUGGLING: any single stress signal — inequality, immiseration, ecological strain, or
  // (only when not cycling) notable decline from peak.
  if (
    m.gini >= Variables.STRUGGLING_GINI_THRESHOLD ||
    m.happiness < Variables.STRUGGLING_HAPPINESS_THRESHOLD ||
    m.poolFraction < Variables.STRUGGLING_RESOURCE_FRACTION ||
    (!cycling && m.peakDecline >= Variables.STRUGGLING_PEAK_DECLINE_FRACTION)
  ) {
    return 'STRUGGLING';
  }

  // CYCLICAL: a sustained, non-collapsing oscillation that cleared every other stress signal.
  if (cycling) return 'CYCLICAL';

  return 'STABLE';
}

/**
 * Human-readable rationale for an outcome label, naming whichever dimension drove it
 * (ARD 051, revised by ARD 063).
 *
 * @param decadeHistory - all decade summaries in order
 * @param startPopulation - initial population at simulation start
 * @param outcome - the label returned by classifyOutcome
 * @param cycles - cycle metrics for the run's population series, as passed to classifyOutcome
 * @returns one-line reason string
 */
export function explainOutcome(
  decadeHistory: TenYearSummary[],
  startPopulation: number,
  outcome: OutcomeLabel,
  cycles: CycleMetrics,
): string {
  const m = outcomeMetrics(decadeHistory, startPopulation);
  const giniStr = m.gini.toFixed(2);
  const happyStr = m.happiness.toFixed(1);
  const declineStr = `${(m.peakDecline * 100).toFixed(0)}%`;
  const poolStr = `${(m.poolFraction * 100).toFixed(0)}%`;
  switch (outcome) {
  case 'EXTINCTION':
    return 'Population reached 0';
  case 'COLLAPSE':
    if (m.gini >= Variables.COLLAPSE_GINI_THRESHOLD) {
      return `Final-decade avg Gini ${giniStr} ≥ ${Variables.COLLAPSE_GINI_THRESHOLD.toFixed(2)} threshold`;
    }
    return `Population fell ${declineStr} from peak (≥ ${(Variables.COLLAPSE_PEAK_DECLINE_FRACTION * 100).toFixed(0)}%)`;
  case 'STRUGGLING':
    if (m.gini >= Variables.STRUGGLING_GINI_THRESHOLD) {
      return `Final-decade Gini ${giniStr} ≥ ${Variables.STRUGGLING_GINI_THRESHOLD.toFixed(2)} threshold`;
    }
    if (m.happiness < Variables.STRUGGLING_HAPPINESS_THRESHOLD) {
      return `Final-decade happiness ${happyStr} below ${Variables.STRUGGLING_HAPPINESS_THRESHOLD.toFixed(1)} threshold`;
    }
    if (m.poolFraction < Variables.STRUGGLING_RESOURCE_FRACTION) {
      return `Commons drawn down to ${poolStr} of ceiling (below ${(Variables.STRUGGLING_RESOURCE_FRACTION * 100).toFixed(0)}%) — ecological strain`;
    }
    return `Population down ${declineStr} from peak (≥ ${(Variables.STRUGGLING_PEAK_DECLINE_FRACTION * 100).toFixed(0)}%)`;
  case 'CYCLICAL':
    return `Sustained boom-bust cycle (${cycles.numCycles} cycles, trough trend ${cycles.troughTrend.toFixed(2)}), `
      + `Gini ${giniStr}, happiness ${happyStr}, commons ${poolStr} full — not declining, oscillating`;
  case 'STABLE':
    return `Gini ${giniStr}, happiness ${happyStr}, population near peak, commons ${poolStr} full — within stable band`;
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
    orphans: 0,
  };

  if (living.length === 0) return summary;

  let illnessSum = 0;
  for (const p of living) {
    if (p.age < Variables.WORKING_AGE_MIN) summary.children++;
    else if (p.age <= Variables.WORKING_AGE_MAX) summary.working++;
    else summary.elderly++;

    summary.educationCounts[p.education] = (summary.educationCounts[p.education] ?? 0) + 1;
    if (p.isWorkingOnEd !== Constants.EDUCATION.NONE) summary.enrolled++;

    if (p.age >= Variables.WORKING_AGE_MIN && p.age <= Variables.WORKING_AGE_MAX && p.hasJob) summary.employed++;

    if (p.illness < Variables.HEALTH_WELL_THRESHOLD) summary.healthWell++;
    else if (p.illness < Variables.HEALTH_MILD_THRESHOLD) summary.healthMild++;
    else summary.healthSevere++;
    illnessSum += p.illness;

    if (p.isInRelationshipWith !== null) summary.partnered++;
    if (p.hasChildren.length > 0) summary.withChildren++;
    if (p.age < Variables.WORKING_AGE_MIN && p.livingParents.length === 0) summary.orphans++;
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
    `  Health:     well ${s.healthWell} (<${Variables.HEALTH_WELL_THRESHOLD})  ` +
      `mild ${s.healthMild} (${Variables.HEALTH_WELL_THRESHOLD}–${Variables.HEALTH_MILD_THRESHOLD})  ` +
      `severe ${s.healthSevere} (≥${Variables.HEALTH_MILD_THRESHOLD})   ` +
      `avg illness ${s.avgIllness.toFixed(2)}`,
    `  Family:     partnered ${s.partnered} (${pct(s.partnered, s.total)})  ` +
      `with children ${s.withChildren} (${pct(s.withChildren, s.total)})  ` +
      `orphans ${s.orphans} of ${s.children} children (${pct(s.orphans, s.children)})`,
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
 * @param extractionProductivity - final extractionProductivity value (ARD 032)
 * @param inventionCounts - cumulative invention firings by branch (ARD 032)
 * @param inventionCounts.faster - count of depletion-faster firings
 * @param inventionCounts.slower - count of depletion-slower firings
 * @param inventionCounts.ceiling - count of ceiling-growth firings
 * @param communityPool - community pool balance at end of run (ARD 034)
 * @param cycles - cycle metrics for the run's population series (ARD 063); defaults to "no
 *   confirmed cycle" so callers that do not care about the CYCLICAL dimension need not compute one
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
  extractionProductivity = 1.0,
  inventionCounts: { faster: number; slower: number; ceiling: number } = { faster: 0, slower: 0, ceiling: 0 },
  communityPool = 0,
  cycles: CycleMetrics = { numCycles: 0, period: 0, amplitude: 1, troughTrend: 1, stableCycle: false, extinct: false },
): string {
  if (decadeHistory.length === 0) {
    return `=== End of Simulation (${ticks} ticks, seed ${seed}) ===\n(Run too short to produce a decade summary.)`;
  }

  const final = decadeHistory[decadeHistory.length - 1];
  const first = decadeHistory[0];
  const outcome = classifyOutcome(decadeHistory, startPopulation, cycles);
  const reason = explainOutcome(decadeHistory, startPopulation, outcome, cycles);

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

  // Orphan load is reported as a share of the child population — the raw count tracks the
  // population boom, the share tracks how often children are actually losing their parents.
  const peakOrphanDecade = decadeHistory.reduce(
    (best, d) => (d.avgOrphanCount > best.avgOrphanCount ? d : best),
    decadeHistory[0],
  );
  const peakWelfareDecade = decadeHistory.reduce(
    (best, d) => (d.avgWelfareRecipients > best.avgWelfareRecipients ? d : best),
    decadeHistory[0],
  );
  const welfarePct = (d: TenYearSummary): string =>
    `${(share(d.avgWelfareRecipients, d.avgPopulation) * 100).toFixed(0)}%`;
  const orphanPct = (d: TenYearSummary): string =>
    `${(share(d.avgOrphanCount, d.avgChildPopulation) * 100).toFixed(0)}%`;

  const decadeTableRows = decadeHistory.map(d => {
    const delta = d.populationDelta >= 0 ? `+${d.populationDelta}` : String(d.populationDelta);
    return (
      `  ${String(d.endTick).padStart(3, '0')}` +
      `  ${String(d.endPopulation).padStart(4)}` +
      `  ${delta.padStart(4)}` +
      `  ${String(d.births).padStart(6)}` +
      `  ${d.avgOrphanCount.toFixed(1).padStart(7)}` +
      `  ${d.avgWelfareRecipients.toFixed(1).padStart(7)}` +
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
    `  Orphans: ${first.avgOrphanCount.toFixed(1)} (${orphanPct(first)}) → ${final.avgOrphanCount.toFixed(1)} (${orphanPct(final)})   ` +
      `peak ${peakOrphanDecade.avgOrphanCount.toFixed(1)} (Yr ${String(peakOrphanDecade.endTick).padStart(3, '0')})   [decade averages, % of children]`,
    '',
    'INEQUALITY (Gini)',
    `  Start: ${first.avgResourceGini.toFixed(2)}  End: ${final.avgResourceGini.toFixed(2)}  Peak: ${peakGiniDecade.peakResourceGini.toFixed(2)} (Yr ${String(peakGiniDecade.endTick).padStart(3, '0')})`,
    `  Trend: ${giniTrend >= 0 ? 'rising' : 'falling'} (${giniTrendStr} over run)`,
    '',
    'RESOURCES',
    `  Avg resources/person: ${first.avgResources.toFixed(1)} → ${final.avgResources.toFixed(1)}`,
    `  Natural resources remaining: ${Math.round(naturalResources)} / ${Math.round(naturalResourceCeiling)} ceiling`,
    `  Community pool: ${Math.round(communityPool)}`,
    `  On welfare: ${first.avgWelfareRecipients.toFixed(1)} (${welfarePct(first)}) → ${final.avgWelfareRecipients.toFixed(1)} (${welfarePct(final)})   ` +
      `peak ${peakWelfareDecade.avgWelfareRecipients.toFixed(1)} (Yr ${String(peakWelfareDecade.endTick).padStart(3, '0')})   [decade averages, % of population]`,
    `  Inventions: ${inventionCounts.faster} faster  ${inventionCounts.slower} slower  ${inventionCounts.ceiling} ceiling   ` +
      `(final efficiency: ${extractionProductivity.toFixed(2)}, ceiling: ${Math.round(naturalResourceCeiling)})`,
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
    '  Yr   Pop  ΔPop  Births  Orphans  Welfare  Gini  PkGini    Res  Happy  Deaths',
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
