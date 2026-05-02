# ARD 015: End-of-Simulation Report

**Status:** Accepted  
**Date:** 2026-05-01

## Context

Progress reporting (ARD 015) shows what happened decade by decade while the simulation runs. That answers "is it doing something?" but not "what was the outcome?" A researcher reviewing a completed run needs a consolidated verdict — did this civilization collapse, thrive, or muddle through — and enough visual data to understand *why*.

The end-of-simulation report answers: *what was the overall outcome, and what drove it?*

This is distinct from progress output in both purpose and audience. Progress output is ephemeral — it scrolls past. The end report is the artifact you save, share, and compare across runs with different seeds or parameters. Graphs make trends (Gini rising, population declining) immediately legible in a way tables cannot.

## Decision

After `LooperSingleton.start()` completes the tick loop, `index.ts` prints a text summary to `console.log` and writes an HTML report with embedded charts to `./output/report-<seed>-<timestamp>.html`.

### Console output

```
=== End of Simulation (100 ticks, seed 42) ===

OUTCOME: COLLAPSE
  Reason: Gini exceeded 0.60 in final decade (peak 0.71)

POPULATION
  Start: 100  End: 61  Total deaths: 39
  By cause — illness: 14  suicide: 8  killing: 5  disaster: 9  old age: 3

INEQUALITY (Gini)
  Start: 0.28  End: 0.68  Peak: 0.71 (Yr 090)
  Trend: rising (+0.40 over run)

RESOURCES
  Avg resources/person: 31.4 → 18.2
  Natural resources remaining: 2840 / 5000 ceiling

HAPPINESS
  Avg happiness: 5.1 → 2.9
  Trend: declining

DECADE SUMMARY TABLE
  Yr  Pop  ΔPop  Gini  PkGini  Res   Happy  Deaths
  010  98    -2  0.31   0.38  61.2    5.8       4
  ...
```

### HTML report with charts

`ReportWriter.ts` generates a self-contained HTML file. Chart.js is loaded from a CDN `<script>` tag — this does not violate the zero-npm-production-dependency constraint (no package is installed; the browser fetches it at view time). If offline use is needed, the script tag can be swapped for an inlined minified copy of Chart.js as a future enhancement.

**Charts included:**

| Chart | Type | X-axis | Y-series |
|-------|------|--------|----------|
| Inequality over time | Line | Tick (year) | `resourceGini` |
| Population over time | Line | Tick | `population` |
| Resources over time | Line | Tick | `averageResources`, `naturalResources` (dual Y or normalized) |
| Happiness over time | Line | Tick | `averageHappiness` |
| Deaths by cause per decade | Stacked bar | Decade | illness / suicide / killing / disaster / old age |

All data is embedded in the HTML as an inline `<script>` block containing a JSON literal — no external data file or server required. The file opens in any browser by double-clicking.

**HTML structure:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Simulation Report — Seed 42 — COLLAPSE</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h1>Simulation Report</h1>
  <p>Seed: 42 | Ticks: 100 | Outcome: <strong>COLLAPSE</strong></p>
  <p>Reason: Gini exceeded 0.60 in final decade (peak 0.71)</p>

  <!-- one <canvas> per chart -->
  <canvas id="giniChart"></canvas>
  ...

  <script>
    const data = { /* embedded JSON: meta, decadeHistory, fullHistory */ };
    // Chart.js initialization for each canvas
  </script>
</body>
</html>
```

**Outcome classification:**

A single label derived from the final decade's `TenYearSummary` (ARD 015):

| Label | Condition |
|-------|-----------|
| `COLLAPSE` | Final-decade avg Gini ≥ 0.60, or final population < 20% of start |
| `STRUGGLING` | Final-decade avg Gini ≥ 0.45, or final avg happiness < 3.0 |
| `STABLE` | Neither of the above |
| `THRIVING` | Final-decade avg Gini < 0.30 and final avg happiness ≥ 6.0 |

Thresholds are named constants in `Variables.ts` (`COLLAPSE_GINI_THRESHOLD`, `STRUGGLING_GINI_THRESHOLD`, `STRUGGLING_HAPPINESS_THRESHOLD`, `THRIVING_GINI_THRESHOLD`, `THRIVING_HAPPINESS_THRESHOLD`, `COLLAPSE_POPULATION_FRACTION`).

**Implementation:**

`formatEndReport` and `classifyOutcome` live in `src/Helpers/Reporters.ts` (pure functions, no I/O — same file as ARD 015 formatters).

`writeReportHTML(simulation: Simulation, n: number, ticks: number, seed: number): void` lives in `src/Helpers/ReportWriter.ts`; it uses Node's `fs` module to write the file.

`index.ts` after the run:

```typescript
const simulation = looper.start();
console.log(formatEndReport(simulation, 100, 100, 42));
writeReportHTML(simulation, 100, 100, 42);
```

The `output/` directory is created if it doesn't exist; it is gitignored.

## Reasoning

**HTML with charts, not JSON.** The primary goal is understanding outcome and trends. A chart makes a rising Gini or a collapsing population immediately legible; a JSON file requires a separate tool to visualize. Since we're already generating a file, the marginal cost of writing HTML instead of JSON is small.

**Chart.js via CDN, not a production npm dependency.** Loading Chart.js from a CDN at view time does not require `npm install` and does not appear in `package.json` — the zero-production-dependency constraint is about the npm dependency graph, not about what a generated HTML file may reference. The trade-off is that viewing the report requires internet access; this is acceptable for a development/research tool. An inlined fallback is a future option.

**All data embedded inline in the HTML.** No separate data file, no local server, no CORS issues. Double-clicking the `.html` file in any browser shows the full report. The full `history` array (one entry per tick) is included so charts can plot per-year data, not just decade aggregates.

**Per-tick data for line charts; per-decade for death breakdown.** The collapse/thrive signal lives in the per-tick Gini and resource curves — decade averaging hides the moment collapse begins. Death-by-cause is better as a stacked bar per decade because per-tick death counts are too small and noisy to plot meaningfully.

**Outcome label on the page title and heading.** When comparing multiple HTML files, the verdict should be visible without opening the file. `report-42-COLLAPSE-2026-05-01.html` is self-describing.

**`classifyOutcome` in `Reporters.ts`, not `Simulation`.** Classification is a reporting concern, not a simulation concern. `Simulation` models the world; it should not know what "collapse" means for a report. Keeping it in `Reporters.ts` means the definition can change without touching simulation logic.

**Rejected: JSON output.** JSON requires a separate tool to visualize. HTML with embedded Chart.js gives immediate visual feedback. The raw data is still available inside the HTML `<script>` block for anyone who wants to extract it.

**Rejected: SVG charts hand-rolled without a library.** Hand-rolled SVG is verbose, fragile, and hard to read. Chart.js via CDN produces professional charts with axes, legends, and tooltips at zero npm cost.

## Consequences

- `src/Helpers/ReportWriter.ts` is created with `writeReportHTML`; uses Node `fs`
- `src/Helpers/Reporters.ts` gains `formatEndReport` and `classifyOutcome`
- `Variables.ts` gains the six outcome-classification threshold constants
- `output/` is added to `.gitignore`
- `index.ts` imports and calls `formatEndReport` (console) and `writeReportHTML` (file) after the run
- The HTML report depends on ARD 015 (`TenYearSummary`, `Reporters.ts`) being implemented first
- `ReportWriter.ts` is integration-tested (write file, read it back, check it contains expected strings) or noted as excluded from unit tests
- `classifyOutcome` tests cover all four labels and boundary conditions
- Viewing the HTML report requires an internet connection to load Chart.js from the CDN; offline use requires manually inlining the library
