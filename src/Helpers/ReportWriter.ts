import * as fs from 'fs';
import * as path from 'path';
import Simulation from '../App/Simulation';
import { classifyOutcome, formatEndReport } from './Reporters';

/**
 * Writes a self-contained HTML report to ./output/report-<seed>-<outcome>-<timestamp>.html.
 * Creates the output directory if it does not exist.
 * All chart data is embedded inline; Chart.js is loaded from CDN at view time.
 *
 * @param simulation - completed simulation
 * @param n - initial population size
 * @param ticks - total ticks simulated
 * @param seed - PRNG seed
 */
export function writeReportHTML(simulation: Simulation, n: number, ticks: number, seed: number): void {
  const outputDir = path.resolve(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const decadeHistory = simulation.decadeHistory;
  const outcome = decadeHistory.length > 0
    ? classifyOutcome(decadeHistory[decadeHistory.length - 1], n)
    : 'STABLE';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `report-${seed}-${outcome}-${timestamp}.html`;
  const filepath = path.join(outputDir, filename);

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

  const ticks_ = history.map(s => s.tick);
  const giniSeries = history.map(s => s.resourceGini.toFixed(4));
  const populationSeries = history.map(s => s.population);
  const avgResourceSeries = history.map(s => s.averageResources.toFixed(2));
  const naturalResourceSeries = history.map(s => s.naturalResources.toFixed(2));
  const happinessSeries = history.map(s => s.averageHappiness.toFixed(4));

  const decadeLabels = decadeHistory.map(d => `Yr ${d.endTick}`);
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
      averageHappiness: s.averageHappiness,
    })),
  });

  const consoleReport = formatEndReport(
    decadeHistory,
    ticks,
    seed,
    n,
    simulation.naturalResources,
    simulation.naturalResourceCeiling,
  ).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const outcomeColors: Record<string, string> = {
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
      <div class="card"><canvas id="resourcesChart"></canvas></div>
      <div class="card"><canvas id="happinessChart"></canvas></div>
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
        datasets: [{ label: 'Population', data: ${JSON.stringify(populationSeries)},
          borderColor: '#2980b9', backgroundColor: 'rgba(41,128,185,0.06)',
          fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 }]
      },
      options: ${chartOptions('Population Over Time')}
    });

    new Chart(document.getElementById('resourcesChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [
          { label: 'Avg Resources / Person', data: ${JSON.stringify(avgResourceSeries)},
            borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.06)',
            fill: true, tension: 0.2, pointRadius: 0, borderWidth: 2 },
          { label: 'Natural Resources Pool', data: ${JSON.stringify(naturalResourceSeries)},
            borderColor: '#8e44ad', backgroundColor: 'transparent',
            tension: 0.2, pointRadius: 0, borderWidth: 2, borderDash: [5,3], yAxisID: 'y2' }
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
          y: { position: 'left', grid: { color: '#f0f0f0' } },
          y2: { position: 'right', grid: { drawOnChartArea: false } }
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
