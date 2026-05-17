import * as fs from 'fs';
import * as path from 'path';
import Simulation from '../App/Simulation';
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
    ? classifyOutcome(decadeHistory[decadeHistory.length - 1], n)
    : 'STABLE';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `report-${seed}-${outcome}-${timestamp}.html`;
  const filepath = path.join(resolvedOutputDir, filename);

  const html = buildHTML(simulation, n, ticks, seed, outcome);
  fs.writeFileSync(filepath, html, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Report written to: ${filepath}`);
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

    return {
      gini: d.avgResourceGini.toFixed(4),
      population: d.endPopulation,
      births: d.births,
      avgResources: d.avgResources.toFixed(2),
      naturalResources: d.avgNaturalResources.toFixed(2),
      ceiling: mean(chunk.map(c => c.naturalResourceCeiling)).toFixed(2),
      communityPool: d.avgCommunityPool.toFixed(2),
      happiness: d.avgHappiness.toFixed(4),
      illness: mean(chunk.map(c => c.averageIllness)).toFixed(4),
      employmentRate: mean(chunk.map(c => c.employmentRate)).toFixed(4),
      killingIntent: mean(chunk.map(c => c.population > 0 ? c.aggregateKillingIntent / c.population : 0)).toFixed(5),
      stealingIntent: mean(chunk.map(c => c.population > 0 ? c.aggregateStealingIntent / c.population : 0)).toFixed(5),
      jailed: mean(chunk.map(c => c.jailedPopulation)).toFixed(1),
      murders: chunk.reduce((sum, c) => sum + c.deathsByMurder, 0),
      steals: chunk.reduce((sum, c) => sum + c.stealsCommitted, 0),
      deathsIllness: d.deathsByIllness,
      deathsSuicide: d.deathsBySuicide,
      deathsMurder: d.deathsByKilling,
      deathsDisaster: d.deathsByDisaster,
      deathsOldAge: d.deathsByOldAge
    };
  });

  const ticks_ = decadeLabels;
  const giniSeries = aggregatedHistory.map(a => a.gini);
  const populationSeries = aggregatedHistory.map(a => a.population);
  const birthsSeries = aggregatedHistory.map(a => a.births);
  const avgResourceSeries = aggregatedHistory.map(a => a.avgResources);
  const naturalResourceSeries = aggregatedHistory.map(a => a.naturalResources);
  const ceilingSeries = aggregatedHistory.map(a => a.ceiling);
  const communityPoolSeries = aggregatedHistory.map(a => a.communityPool);
  const happinessSeries = aggregatedHistory.map(a => a.happiness);
  const illnessSeries_ = aggregatedHistory.map(a => a.illness);
  const employmentSeries = aggregatedHistory.map(a => a.employmentRate);
  const killingIntentSeries = aggregatedHistory.map(a => a.killingIntent);
  const stealingIntentSeries = aggregatedHistory.map(a => a.stealingIntent);
  const jailedSeries = aggregatedHistory.map(a => a.jailed);
  const murdersPerTickSeries = aggregatedHistory.map(a => a.murders);
  const stealsPerTickSeries = aggregatedHistory.map(a => a.steals);
  const deathsIllnessTickSeries = aggregatedHistory.map(a => a.deathsIllness);
  const deathsSuicideTickSeries = aggregatedHistory.map(a => a.deathsSuicide);
  const deathsMurderTickSeries = aggregatedHistory.map(a => a.deathsMurder);
  const deathsDisasterTickSeries = aggregatedHistory.map(a => a.deathsDisaster);
  const deathsOldAgeTickSeries = aggregatedHistory.map(a => a.deathsOldAge);

  const illnessSeries = decadeHistory.map(d => d.deathsByIllness);
  const suicideSeries = decadeHistory.map(d => d.deathsBySuicide);
  const killingSeries = decadeHistory.map(d => d.deathsByKilling);
  const disasterSeries = decadeHistory.map(d => d.deathsByDisaster);
  const oldAgeSeries = decadeHistory.map(d => d.deathsByOldAge);

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
      extractionEfficiency: s.extractionEfficiency,
      births: s.births,
      averageHappiness: s.averageHappiness,
      communityPool: s.communityPool,
      averageIllness: s.averageIllness,
      employmentRate: s.employmentRate,
      stealsCommitted: s.stealsCommitted,
      jailedPopulation: s.jailedPopulation,
      deathsByMurder: s.deathsByMurder,
      deathsByIllness: s.deathsByIllness,
      deathsBySuicide: s.deathsBySuicide,
      deathsByDisaster: s.deathsByDisaster,
      deathsByOldAge: s.deathsByOldAge,
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
    simulation.extractionEfficiency,
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Simulation Report — Seed ${seed} — ${outcome}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      background: #f7f8fa;
      color: #1a1a2e;
      min-height: 100vh;
    }
    .page-header {
      background: #1a1a2e;
      color: #fff;
      padding: 1.5rem 2rem;
      border-bottom: 4px solid ${outcomeColor};
    }
    .page-header h1 { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.01em; }
    .page-header .meta { margin-top: 0.4rem; font-size: 0.85rem; color: #aab; display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .meta-pill {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 999px;
      padding: 0.2rem 0.7rem;
      font-size: 0.8rem;
    }
    .outcome-badge {
      display: inline-block;
      background: ${outcomeColor};
      color: #fff;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border-radius: 6px;
      padding: 0.3rem 0.9rem;
      margin-top: 0.9rem;
    }
    .main { max-width: 1120px; margin: 0 auto; padding: 2rem 1.5rem 3rem; }
    .section-title {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #888;
      margin: 2.5rem 0 1rem;
    }
    .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
    .charts-grid .span-full { grid-column: 1 / -1; }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
      padding: 1.25rem 1.5rem 1.5rem;
    }
    pre {
      background: #1a1a2e;
      color: #c9d1d9;
      padding: 1.25rem 1.5rem;
      border-radius: 10px;
      overflow-x: auto;
      font-size: 0.78rem;
      line-height: 1.65;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      tab-size: 2;
    }
    @media (max-width: 700px) {
      .charts-grid { grid-template-columns: 1fr; }
      .charts-grid .span-full { grid-column: 1; }
      .page-header { padding: 1.25rem; }
    }
  </style>
</head>
<body>
  <header class="page-header">
    <h1>Human Model — Simulation Report</h1>
    <div class="meta">
      <span class="meta-pill">Seed ${seed}</span>
      <span class="meta-pill">${ticks} ticks</span>
      <span class="meta-pill">${n} initial persons</span>
    </div>
    <div class="outcome-badge">${outcome}</div>
  </header>

  <main class="main">
    <div class="section-title">Time Series</div>
    <div class="charts-grid">
      <div class="card"><canvas id="giniChart"></canvas></div>
      <div class="card"><canvas id="populationChart"></canvas></div>
      <div class="card"><canvas id="happinessChart"></canvas></div>
      <div class="card"><canvas id="healthEmploymentChart"></canvas></div>
      <div class="card span-full"><canvas id="poolDynamicsChart"></canvas></div>
      <div class="card"><canvas id="intentChart"></canvas></div>
      <div class="card"><canvas id="crimeChart"></canvas></div>
      <div class="card span-full"><canvas id="jailChart"></canvas></div>
      <div class="card span-full"><canvas id="deathsPerTickChart"></canvas></div>
      <div class="card span-full"><canvas id="deathsChart"></canvas></div>
    </div>

    <div class="section-title">Raw Output</div>
    <pre>${consoleReport}</pre>
  </main>

  <script>
    ${chartDefaults}
    const _data = ${embeddedData};
    const tickLabels = ${JSON.stringify(ticks_)};

    new Chart(document.getElementById('giniChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [{ label: 'Resource Gini', data: ${JSON.stringify(giniSeries)},
          borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.06)',
          fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 }]
      },
      options: ${chartOptions('Inequality (Gini) Over Time', ', y: { min: 0, max: 1, grid: { color: \'#f0f0f0\' } }')}
    });

    new Chart(document.getElementById('populationChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [
          { label: 'Population', data: ${JSON.stringify(populationSeries)},
            borderColor: '#2980b9', backgroundColor: 'rgba(41,128,185,0.06)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 },
          { label: 'Births per Decade', data: ${JSON.stringify(birthsSeries)},
            borderColor: '#16a085', backgroundColor: 'transparent',
            tension: 0.2, pointRadius: 0, borderWidth: 2, borderDash: [4,3], yAxisID: 'y2' }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Population & Births Over Time', font: { size: 13, weight: '600' }, padding: { bottom: 12 } },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { grid: { color: '#f0f0f0' } },
          y: { position: 'left', grid: { color: '#f0f0f0' } },
          y2: { position: 'right', grid: { drawOnChartArea: false }, beginAtZero: true }
        }
      }
    });

    new Chart(document.getElementById('happinessChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [{ label: 'Avg Happiness', data: ${JSON.stringify(happinessSeries)},
          borderColor: '#f39c12', backgroundColor: 'rgba(243,156,18,0.06)',
          fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 }]
      },
      options: ${chartOptions('Happiness Over Time', ', y: { min: 0, grid: { color: "#f0f0f0" } }')}
    });

    new Chart(document.getElementById('healthEmploymentChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [
          { label: 'Avg Illness', data: ${JSON.stringify(illnessSeries_)},
            borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.06)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 },
          { label: 'Employment Rate', data: ${JSON.stringify(employmentSeries)},
            borderColor: '#27ae60', backgroundColor: 'transparent',
            tension: 0.2, pointRadius: 0, borderWidth: 2, borderDash: [4,3], yAxisID: 'y2' }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Health & Employment Over Time', font: { size: 13, weight: '600' }, padding: { bottom: 12 } },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { grid: { color: '#f0f0f0' } },
          y: { position: 'left', min: 0, max: 1, grid: { color: '#f0f0f0' }, title: { display: true, text: 'Illness [0–1]' } },
          y2: { position: 'right', min: 0, max: 1, grid: { drawOnChartArea: false }, title: { display: true, text: 'Employment Rate [0–1]' } }
        }
      }
    });

    new Chart(document.getElementById('poolDynamicsChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [
          { label: 'Natural Resources', data: ${JSON.stringify(naturalResourceSeries)},
            borderColor: '#8e44ad', backgroundColor: 'rgba(142,68,173,0.06)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 },
          { label: 'Resource Ceiling', data: ${JSON.stringify(ceilingSeries)},
            borderColor: '#34495e', backgroundColor: 'transparent',
            tension: 0.2, pointRadius: 0, borderWidth: 2, borderDash: [5,3] },
          { label: 'Avg Resources / Person', data: ${JSON.stringify(avgResourceSeries)},
            borderColor: '#27ae60', backgroundColor: 'transparent',
            tension: 0.2, pointRadius: 0, borderWidth: 2, yAxisID: 'y2' },
          { label: 'Community Pool', data: ${JSON.stringify(communityPoolSeries)},
            borderColor: '#1abc9c', backgroundColor: 'transparent',
            tension: 0.2, pointRadius: 0, borderWidth: 2, borderDash: [3,2], yAxisID: 'y2' }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Resources Over Time', font: { size: 13, weight: '600' }, padding: { bottom: 12 } },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { grid: { color: '#f0f0f0' } },
          y: { position: 'left', grid: { color: '#f0f0f0' }, title: { display: true, text: 'Natural Resources' } },
          y2: { position: 'right', grid: { drawOnChartArea: false }, beginAtZero: true, title: { display: true, text: 'Per-Person / Pool' } }
        }
      }
    });

    new Chart(document.getElementById('intentChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [
          { label: 'Avg Killing Intent', data: ${JSON.stringify(killingIntentSeries)},
            borderColor: '#c0392b', backgroundColor: 'rgba(192,57,43,0.06)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 },
          { label: 'Avg Stealing Intent', data: ${JSON.stringify(stealingIntentSeries)},
            borderColor: '#7d3c98', backgroundColor: 'rgba(125,60,152,0.06)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 }
        ]
      },
      options: ${chartOptions('Antisocial Intent Per Capita', ', y: { min: 0, grid: { color: "#f0f0f0" } }')}
    });

    new Chart(document.getElementById('crimeChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [
          { label: 'Murders', data: ${JSON.stringify(murdersPerTickSeries)},
            borderColor: '#c0392b', backgroundColor: 'rgba(192,57,43,0.06)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 },
          { label: 'Thefts', data: ${JSON.stringify(stealsPerTickSeries)},
            borderColor: '#7d3c98', backgroundColor: 'rgba(125,60,152,0.06)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2, yAxisID: 'y2' }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Crime Activity Per Decade', font: { size: 13, weight: '600' }, padding: { bottom: 12 } },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { grid: { color: '#f0f0f0' } },
          y: { position: 'left', beginAtZero: true, grid: { color: '#f0f0f0' }, title: { display: true, text: 'Murders' } },
          y2: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Thefts' } }
        }
      }
    });

    new Chart(document.getElementById('jailChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [
          { label: 'Jailed Population', data: ${JSON.stringify(jailedSeries)},
            borderColor: '#d35400', backgroundColor: 'rgba(211,84,0,0.08)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 }
        ]
      },
      options: ${chartOptions('Jailed Population Over Time', ', y: { beginAtZero: true, grid: { color: "#f0f0f0" } }')}
    });

    new Chart(document.getElementById('deathsPerTickChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [
          { label: 'Illness',  data: ${JSON.stringify(deathsIllnessTickSeries)},
            borderColor: '#e67e22', backgroundColor: 'rgba(230,126,34,0.4)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5 },
          { label: 'Suicide',  data: ${JSON.stringify(deathsSuicideTickSeries)},
            borderColor: '#8e44ad', backgroundColor: 'rgba(142,68,173,0.4)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5 },
          { label: 'Murder',   data: ${JSON.stringify(deathsMurderTickSeries)},
            borderColor: '#c0392b', backgroundColor: 'rgba(192,57,43,0.4)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5 },
          { label: 'Disaster', data: ${JSON.stringify(deathsDisasterTickSeries)},
            borderColor: '#2c3e50', backgroundColor: 'rgba(44,62,80,0.4)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5 },
          { label: 'Old Age',  data: ${JSON.stringify(deathsOldAgeTickSeries)},
            borderColor: '#95a5a6', backgroundColor: 'rgba(149,165,166,0.4)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Deaths by Cause Over Time', font: { size: 13, weight: '600' }, padding: { bottom: 12 } },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { grid: { color: '#f0f0f0' } },
          y: { beginAtZero: true, grid: { color: '#f0f0f0' } }
        }
      }
    });

    new Chart(document.getElementById('deathsChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(decadeLabels)},
        datasets: [
          { label: 'Illness',  data: ${JSON.stringify(illnessSeries)},  backgroundColor: 'rgba(230,126,34,0.85)' },
          { label: 'Suicide',  data: ${JSON.stringify(suicideSeries)},  backgroundColor: 'rgba(142,68,173,0.85)' },
          { label: 'Killing',  data: ${JSON.stringify(killingSeries)},  backgroundColor: 'rgba(231,76,60,0.85)' },
          { label: 'Disaster', data: ${JSON.stringify(disasterSeries)}, backgroundColor: 'rgba(44,62,80,0.85)' },
          { label: 'Old Age',  data: ${JSON.stringify(oldAgeSeries)},   backgroundColor: 'rgba(149,165,166,0.85)' }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Deaths by Cause per Decade', font: { size: 13, weight: '600' }, padding: { bottom: 12 } },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { stacked: true, grid: { color: '#f0f0f0' } },
          y: { stacked: true, grid: { color: '#f0f0f0' } }
        }
      }
    });
  </script>
</body>
</html>`;
}
