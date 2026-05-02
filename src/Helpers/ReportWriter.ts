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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Simulation Report — Seed ${seed} — ${outcome}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: sans-serif; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    h1 { margin-bottom: 0.25rem; }
    .outcome { font-size: 1.4rem; font-weight: bold; margin-bottom: 1.5rem; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
    canvas { width: 100% !important; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.85rem; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Simulation Report</h1>
  <p>Seed: <strong>${seed}</strong> | Ticks: <strong>${ticks}</strong> | Initial population: <strong>${n}</strong></p>
  <div class="outcome">Outcome: ${outcome}</div>

  <div class="charts">
    <div><canvas id="giniChart"></canvas></div>
    <div><canvas id="populationChart"></canvas></div>
    <div><canvas id="resourcesChart"></canvas></div>
    <div><canvas id="happinessChart"></canvas></div>
    <div style="grid-column: 1 / -1"><canvas id="deathsChart"></canvas></div>
  </div>

  <h2>Console Report</h2>
  <pre>${consoleReport}</pre>

  <script>
    const _data = ${embeddedData};

    const tickLabels = ${JSON.stringify(ticks_)};

    new Chart(document.getElementById('giniChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [{ label: 'Resource Gini', data: ${JSON.stringify(giniSeries)}, borderColor: '#e74c3c', tension: 0.1, pointRadius: 0 }]
      },
      options: { plugins: { title: { display: true, text: 'Inequality (Gini) Over Time' } }, scales: { y: { min: 0, max: 1 } } }
    });

    new Chart(document.getElementById('populationChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [{ label: 'Population', data: ${JSON.stringify(populationSeries)}, borderColor: '#2980b9', tension: 0.1, pointRadius: 0 }]
      },
      options: { plugins: { title: { display: true, text: 'Population Over Time' } } }
    });

    new Chart(document.getElementById('resourcesChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [
          { label: 'Avg Resources/Person', data: ${JSON.stringify(avgResourceSeries)}, borderColor: '#27ae60', tension: 0.1, pointRadius: 0 },
          { label: 'Natural Resources Pool', data: ${JSON.stringify(naturalResourceSeries)}, borderColor: '#8e44ad', tension: 0.1, pointRadius: 0, yAxisID: 'y2' }
        ]
      },
      options: {
        plugins: { title: { display: true, text: 'Resources Over Time' } },
        scales: { y: { position: 'left' }, y2: { position: 'right', grid: { drawOnChartArea: false } } }
      }
    });

    new Chart(document.getElementById('happinessChart'), {
      type: 'line',
      data: {
        labels: tickLabels,
        datasets: [{ label: 'Avg Happiness', data: ${JSON.stringify(happinessSeries)}, borderColor: '#f39c12', tension: 0.1, pointRadius: 0 }]
      },
      options: { plugins: { title: { display: true, text: 'Happiness Over Time' } }, scales: { y: { min: 0 } } }
    });

    new Chart(document.getElementById('deathsChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(decadeLabels)},
        datasets: [
          { label: 'Illness', data: ${JSON.stringify(illnessSeries)}, backgroundColor: '#e67e22' },
          { label: 'Suicide', data: ${JSON.stringify(suicideSeries)}, backgroundColor: '#8e44ad' },
          { label: 'Killing', data: ${JSON.stringify(killingSeries)}, backgroundColor: '#e74c3c' },
          { label: 'Disaster', data: ${JSON.stringify(disasterSeries)}, backgroundColor: '#2c3e50' },
          { label: 'Old Age', data: ${JSON.stringify(oldAgeSeries)}, backgroundColor: '#95a5a6' }
        ]
      },
      options: {
        plugins: { title: { display: true, text: 'Deaths by Cause per Decade' } },
        scales: { x: { stacked: true }, y: { stacked: true } }
      }
    });
  </script>
</body>
</html>`;
}
