import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import Simulation from '../App/Simulation';
import Constants from './Constants';
import { classifyOutcome, formatEndReport } from './Reporters';

/**
 * Writes a self-contained HTML report to <outputDir>/report-<seed>-<outcome>-<timestamp>.html.
 * Creates the output directory if it does not exist.
 * All chart data is embedded inline; Chart.js is loaded from CDN at view time.
 *
 * @param simulation - completed simulation
 * @param n - initial population size
 * @param ticks - total ticks simulated
 * @param seed - PRNG seed
 * @param outputDir - directory to write the report into; defaults to ./output
 */
export function writeReportHTML(simulation: Simulation, n: number, ticks: number, seed: number, outputDir?: string): void {
  const resolvedOutputDir = outputDir ?? path.resolve(process.cwd(), 'output');
  if (!fs.existsSync(resolvedOutputDir)) {
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  const decadeHistory = simulation.decadeHistory;
  const outcome = decadeHistory.length > 0
    ? classifyOutcome(decadeHistory, n)
    : 'STABLE';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `report-${seed}-${outcome}-${timestamp}.html`;
  const filepath = path.join(resolvedOutputDir, filename);

  const html = buildHTML(simulation, n, ticks, seed, outcome);
  fs.writeFileSync(filepath, html, 'utf8');
  const url = `file://${filepath}`;
  const link = `]8;;${url}${filepath}]8;;`;
  // eslint-disable-next-line no-console
  console.log(`Report written to: ${link}`);
}

/**
 * @param simulation - completed simulation
 * @param n - initial population size
 * @param ticks - total ticks simulated
 * @param seed - PRNG seed
 * @param outcome - classified outcome label
 * @returns full HTML string for the report
 */
function buildHTML(
  simulation: Simulation,
  n: number,
  ticks: number,
  seed: number,
  outcome: string,
): string {
  const history = simulation.history;
  const decadeHistory = simulation.decadeHistory;

  const decadeLabels = decadeHistory.map(d => `Yr ${d.endTick}`);

  const aggregatedHistory = decadeHistory.map((d, i) => {
    const startTick = i === 0 ? 0 : decadeHistory[i - 1].endTick;
    const endTick = d.endTick;
    const chunk = history.slice(startTick, endTick);
    
    const mean = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const decadeDeaths = d.deathsByIllness + d.deathsBySuicide + d.deathsByKilling + d.deathsByDisaster;
    const meanPopulation = mean(chunk.map(c => c.population));
    // Deaths per 100 living persons over the decade — separates mortality pressure from raw population scale.
    const deathRate = meanPopulation > 0 ? (decadeDeaths / meanPopulation) * 100 : 0;
    // Commons fill: how full the accessible pool is relative to its (degrading) ceiling — the ARD 051 ecological-strain dimension.
    const commonsFill = mean(chunk.map(c => c.naturalResourceCeiling > 0 ? c.naturalResources / c.naturalResourceCeiling : 0));
    // Mean per-tier living-population counts across the decade (indexed by Constants.EDUCATION value).
    const education = Array.from({ length: 6 }, (_, tier) =>
      mean(chunk.map(c => c.educationCounts?.[tier] ?? 0)));

    return {
      gini: d.avgResourceGini.toFixed(4),
      population: d.endPopulation,
      births: d.births,
      deathRate: deathRate.toFixed(2),
      avgResources: d.avgResources.toFixed(2),
      consumption: mean(chunk.map(c => c.totalConsumption)).toFixed(2),
      naturalResources: d.avgNaturalResources.toFixed(2),
      ceiling: mean(chunk.map(c => c.naturalResourceCeiling)).toFixed(2),
      commonsFill: commonsFill.toFixed(4),
      productivity: mean(chunk.map(c => c.extractionProductivity)).toFixed(4),
      communityPool: d.avgCommunityPool.toFixed(2),
      happiness: d.avgHappiness.toFixed(4),
      illness: mean(chunk.map(c => c.averageIllness)).toFixed(4),
      employmentRate: mean(chunk.map(c => c.employmentRate)).toFixed(4),
      averageAge: mean(chunk.map(c => c.averageAge)).toFixed(2),
      medianAge: mean(chunk.map(c => c.medianAge)).toFixed(2),
      education: education.map(v => v.toFixed(2)),
      killingIntent: mean(chunk.map(c => c.population > 0 ? c.aggregateKillingIntent / c.population : 0)).toFixed(5),
      stealingIntent: mean(chunk.map(c => c.population > 0 ? c.aggregateStealingIntent / c.population : 0)).toFixed(5),
      jailed: mean(chunk.map(c => c.jailedPopulation)).toFixed(1),
      totalCoupleCount: mean(chunk.map(c => c.totalCoupleCount)).toFixed(1),
      fertileCoupleCount: mean(chunk.map(c => c.fertileCoupleCount)).toFixed(1),
      steals: chunk.reduce((sum, c) => sum + c.stealsCommitted, 0),
      deathsIllness: d.deathsByIllness,
      deathsSuicide: d.deathsBySuicide,
      deathsMurder: d.deathsByKilling,
      deathsDisaster: d.deathsByDisaster
    };
  });

  const ticks_ = decadeLabels;
  const giniSeries = aggregatedHistory.map(a => a.gini);
  const populationSeries = aggregatedHistory.map(a => a.population);
  const birthsSeries = aggregatedHistory.map(a => a.births);
  const deathRateSeries = aggregatedHistory.map(a => a.deathRate);
  const avgResourceSeries = aggregatedHistory.map(a => a.avgResources);
  const consumptionSeries = aggregatedHistory.map(a => a.consumption);
  const naturalResourceSeries = aggregatedHistory.map(a => a.naturalResources);
  const ceilingSeries = aggregatedHistory.map(a => a.ceiling);
  const commonsFillSeries = aggregatedHistory.map(a => a.commonsFill);
  const productivitySeries = aggregatedHistory.map(a => a.productivity);
  const communityPoolSeries = aggregatedHistory.map(a => a.communityPool);
  const happinessSeries = aggregatedHistory.map(a => a.happiness);
  const illnessSeries_ = aggregatedHistory.map(a => a.illness);
  const employmentSeries = aggregatedHistory.map(a => a.employmentRate);
  const averageAgeSeries = aggregatedHistory.map(a => a.averageAge);
  const medianAgeSeries = aggregatedHistory.map(a => a.medianAge);
  // One series per education tier for the stacked distribution chart.
  const educationTierSeries = Array.from({ length: 6 }, (_, tier) =>
    aggregatedHistory.map(a => a.education[tier]));
  const killingIntentSeries = aggregatedHistory.map(a => a.killingIntent);
  const stealingIntentSeries = aggregatedHistory.map(a => a.stealingIntent);
  const jailedSeries = aggregatedHistory.map(a => a.jailed);
  const stealsPerTickSeries = aggregatedHistory.map(a => a.steals);
  const totalCoupleSeries = aggregatedHistory.map(a => a.totalCoupleCount);
  const fertileCoupleSeries = aggregatedHistory.map(a => a.fertileCoupleCount);
  const deathsIllnessTickSeries = aggregatedHistory.map(a => a.deathsIllness);
  const deathsSuicideTickSeries = aggregatedHistory.map(a => a.deathsSuicide);
  const deathsMurderTickSeries = aggregatedHistory.map(a => a.deathsMurder);
  const deathsDisasterTickSeries = aggregatedHistory.map(a => a.deathsDisaster);

  const illnessSeries = decadeHistory.map(d => d.deathsByIllness);
  const suicideSeries = decadeHistory.map(d => d.deathsBySuicide);
  const killingSeries = decadeHistory.map(d => d.deathsByKilling);
  const disasterSeries = decadeHistory.map(d => d.deathsByDisaster);

  // Age-at-death distribution: bucket every deceased person by age decade, split by cause.
  const AGE_BUCKET_SIZE = 10;
  const AGE_BUCKET_COUNT = 10; // 0–9 … 80–89, plus a final 90+ bucket
  const ageDeathLabels = Array.from({ length: AGE_BUCKET_COUNT }, (_, i) =>
    i === AGE_BUCKET_COUNT - 1 ? `${(AGE_BUCKET_COUNT - 1) * AGE_BUCKET_SIZE}+` : `${i * AGE_BUCKET_SIZE}–${i * AGE_BUCKET_SIZE + AGE_BUCKET_SIZE - 1}`);
  const ageDeathByCause: Record<number, number[]> = {
    [Constants.CAUSE_OF_DEATH.ILLNESS]: new Array(AGE_BUCKET_COUNT).fill(0),
    [Constants.CAUSE_OF_DEATH.SUICIDE]: new Array(AGE_BUCKET_COUNT).fill(0),
    [Constants.CAUSE_OF_DEATH.MURDER]: new Array(AGE_BUCKET_COUNT).fill(0),
    [Constants.CAUSE_OF_DEATH.DISASTER]: new Array(AGE_BUCKET_COUNT).fill(0),
  };
  for (const p of simulation.getDeceased()) {
    const cause = p.causeOfDeath?.cause;
    if (cause === undefined || !(cause in ageDeathByCause)) continue;
    const bucket = Math.min(AGE_BUCKET_COUNT - 1, Math.floor(p.age / AGE_BUCKET_SIZE));
    ageDeathByCause[cause][bucket] += 1;
  }
  const ageDeathIllnessSeries = ageDeathByCause[Constants.CAUSE_OF_DEATH.ILLNESS];
  const ageDeathSuicideSeries = ageDeathByCause[Constants.CAUSE_OF_DEATH.SUICIDE];
  const ageDeathMurderSeries = ageDeathByCause[Constants.CAUSE_OF_DEATH.MURDER];
  const ageDeathDisasterSeries = ageDeathByCause[Constants.CAUSE_OF_DEATH.DISASTER];

  const embeddedData = JSON.stringify({
    meta: { seed, ticks, n, outcome },
    decadeHistory,
    history: history.map(s => ({
      tick: s.tick,
      population: s.population,
      resourceGini: s.resourceGini,
      averageResources: s.averageResources,
      naturalResources: s.naturalResources,
      naturalResourceCeiling: s.naturalResourceCeiling,
      extractionProductivity: s.extractionProductivity,
      births: s.births,
      averageHappiness: s.averageHappiness,
      communityPool: s.communityPool,
      averageIllness: s.averageIllness,
      employmentRate: s.employmentRate,
      stealsCommitted: s.stealsCommitted,
      jailedPopulation: s.jailedPopulation,
      totalCoupleCount: s.totalCoupleCount,
      fertileCoupleCount: s.fertileCoupleCount,
      averageAge: s.averageAge,
      medianAge: s.medianAge,
      totalConsumption: s.totalConsumption,
      educationCounts: s.educationCounts,
      deathsByMurder: s.deathsByMurder,
      deathsByIllness: s.deathsByIllness,
      deathsBySuicide: s.deathsBySuicide,
      deathsByDisaster: s.deathsByDisaster,
    })),
  });

  const extinctionTick = simulation.history.find(s => s.population === 0)?.tick;
  const consoleReport = formatEndReport(
    decadeHistory,
    ticks,
    seed,
    n,
    simulation.naturalResources,
    simulation.naturalResourceCeiling,
    simulation.personTypes,
    simulation.seededTypeCounts,
    simulation.getLiving(),
    extinctionTick !== undefined ? extinctionTick + 1 : undefined,
    simulation.extractionProductivity,
    {
      faster: simulation.inventionFasterCount,
      slower: simulation.inventionSlowerCount,
      ceiling: simulation.inventionCeilingCount,
    },
    simulation.communityPool,
  ).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const outcomeColors: Record<string, string> = {
    EXTINCTION: '#7b241c',
    COLLAPSE: '#c0392b',
    STRUGGLING: '#d35400',
    STABLE: '#2471a3',
    THRIVING: '#1e8449',
  };
  const outcomeColor = outcomeColors[outcome] ?? '#555';

  const chartDefaults = `
    Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#555';
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
  `;

  const chartOptions = (title: string, extras = '') => `{
    responsive: true,
    plugins: {
      title: { display: true, text: '${title}', font: { size: 13, weight: '600' }, padding: { bottom: 12 } },
      legend: { position: 'bottom' }
    },
    scales: { x: { grid: { color: '#f0f0f0' } }, y: { grid: { color: '#f0f0f0' } }${extras} }
  }`;

  const templateSource = fs.readFileSync(path.join(__dirname, 'report-template.hbs'), 'utf8');
  const template = Handlebars.compile(templateSource);

  return template({
    seed,
    ticks,
    n,
    outcome,
    outcomeColor,
    consoleReport,
    chartDefaults,
    embeddedData,
    ticks_: JSON.stringify(ticks_),
    giniSeries: JSON.stringify(giniSeries),
    populationSeries: JSON.stringify(populationSeries),
    birthsSeries: JSON.stringify(birthsSeries),
    deathRateSeries: JSON.stringify(deathRateSeries),
    avgResourceSeries: JSON.stringify(avgResourceSeries),
    consumptionSeries: JSON.stringify(consumptionSeries),
    naturalResourceSeries: JSON.stringify(naturalResourceSeries),
    ceilingSeries: JSON.stringify(ceilingSeries),
    commonsFillSeries: JSON.stringify(commonsFillSeries),
    productivitySeries: JSON.stringify(productivitySeries),
    communityPoolSeries: JSON.stringify(communityPoolSeries),
    happinessSeries: JSON.stringify(happinessSeries),
    illnessSeries_: JSON.stringify(illnessSeries_),
    employmentSeries: JSON.stringify(employmentSeries),
    averageAgeSeries: JSON.stringify(averageAgeSeries),
    medianAgeSeries: JSON.stringify(medianAgeSeries),
    educationNoneSeries: JSON.stringify(educationTierSeries[0]),
    educationHsSeries: JSON.stringify(educationTierSeries[1]),
    educationTradeSeries: JSON.stringify(educationTierSeries[2]),
    educationBachelorsSeries: JSON.stringify(educationTierSeries[3]),
    educationMastersSeries: JSON.stringify(educationTierSeries[4]),
    educationPhdSeries: JSON.stringify(educationTierSeries[5]),
    killingIntentSeries: JSON.stringify(killingIntentSeries),
    stealingIntentSeries: JSON.stringify(stealingIntentSeries),
    jailedSeries: JSON.stringify(jailedSeries),
    stealsPerTickSeries: JSON.stringify(stealsPerTickSeries),
    deathsIllnessTickSeries: JSON.stringify(deathsIllnessTickSeries),
    deathsSuicideTickSeries: JSON.stringify(deathsSuicideTickSeries),
    deathsMurderTickSeries: JSON.stringify(deathsMurderTickSeries),
    deathsDisasterTickSeries: JSON.stringify(deathsDisasterTickSeries),
    decadeLabels: JSON.stringify(decadeLabels),
    illnessSeries: JSON.stringify(illnessSeries),
    suicideSeries: JSON.stringify(suicideSeries),
    killingSeries: JSON.stringify(killingSeries),
    disasterSeries: JSON.stringify(disasterSeries),
    totalCoupleSeries: JSON.stringify(totalCoupleSeries),
    fertileCoupleSeries: JSON.stringify(fertileCoupleSeries),
    ageDeathLabels: JSON.stringify(ageDeathLabels),
    ageDeathIllnessSeries: JSON.stringify(ageDeathIllnessSeries),
    ageDeathSuicideSeries: JSON.stringify(ageDeathSuicideSeries),
    ageDeathMurderSeries: JSON.stringify(ageDeathMurderSeries),
    ageDeathDisasterSeries: JSON.stringify(ageDeathDisasterSeries),
    happinessOptions: chartOptions('Happiness Over Time', ', y: { min: 0, grid: { color: "#f0f0f0" } }'),
    intentOptions: chartOptions('Antisocial Intent Per Capita', ', y: { min: 0, grid: { color: "#f0f0f0" } }'),
    ageOptions: chartOptions('Population Age Structure', ', y: { beginAtZero: true, grid: { color: "#f0f0f0" }, title: { display: true, text: "Age (years)" } }')
  });
}
