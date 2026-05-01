# ARD 017: End-of-Simulation Report

**Status:** Proposed  
**Date:** 2026-05-01

## Context

Progress reporting (ARD 016) shows what happened decade by decade while the simulation runs. That answers "is it doing something?" but not "what was the outcome?" A researcher or developer reviewing a completed run needs a consolidated verdict: did this civilization collapse, thrive, or muddle through?

The end-of-simulation report answers: *what was the overall outcome, and what drove it?*

This is distinct from the per-decade progress output in both purpose and audience. Progress output is ephemeral — it scrolls past. The end report is the artifact you save, share, and compare across runs with different seeds or parameters.

## Decision

After `LooperSingleton.start()` completes the tick loop, it prints an end-of-simulation report to `console.log` and also writes it as a JSON file to `./output/report-<seed>-<timestamp>.json`.

**Console output — structured sections:**

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
  Yr  Pop   ΔPop  Gini  PkGini  Res   Happy  Deaths
  010  98    -2   0.31  0.38   61.2   5.8     4
  ...
```

**Outcome classification:**

A single label is derived from the final decade's data:

| Label | Condition |
|-------|-----------|
| `COLLAPSE` | Final-decade avg Gini ≥ 0.60, or final population < 20% of start |
| `STRUGGLING` | Final-decade avg Gini ≥ 0.45, or final avg happiness < 3.0 |
| `STABLE` | Neither of the above |
| `THRIVING` | Final-decade avg Gini < 0.30 and final avg happiness ≥ 6.0 |

These thresholds are named constants in `Variables.ts` (`COLLAPSE_GINI_THRESHOLD`, `STRUGGLING_GINI_THRESHOLD`, etc.) so they can be tuned without touching report logic.

**JSON file:**

```json
{
  "meta": { "ticks": 100, "seed": 42, "timestamp": "2026-05-01T..." },
  "outcome": "COLLAPSE",
  "outcomeReason": "Gini exceeded 0.60 in final decade",
  "finalSnapshot": { /* last TickSnapshot */ },
  "decadeHistory": [ /* all TenYearSummary objects */ ],
  "fullHistory": [ /* all TickSnapshot objects */ ]
}
```

The JSON contains the full `history` and `decadeHistory` arrays, making it usable for offline analysis (spreadsheets, plotting) without re-running the simulation.

**Implementation:**

`formatEndReport(simulation: Simulation, n: number, ticks: number, seed: number): string` and `classifyOutcome(simulation: Simulation): { label: string; reason: string }` live in `src/Helpers/Reporters.ts` (same file as ARD 016's `formatDecadeSummary`).

`writeReportJSON(simulation: Simulation, seed: number): void` lives in `src/Helpers/ReportWriter.ts` — separate from `Reporters.ts` because it performs I/O (requires `fs`) and must be kept out of the pure formatting layer.

`index.ts` calls both after `looper.start()` returns:

```typescript
const simulation = looper.start();
console.log(formatEndReport(simulation, 100, 100, 42));
writeReportJSON(simulation, 42);
```

The `output/` directory is created if it doesn't exist; it is gitignored.

## Reasoning

**Outcome label with a reason string.** A numeric Gini at the end is information; "COLLAPSE — Gini exceeded 0.60" is a verdict. Labeling forces the model to have an explicit definition of collapse, which is the research question the simulation exists to study. The threshold constants being in `Variables.ts` makes them easy to calibrate.

**Console + JSON, not either/or.** The console report is for the human running the simulation right now. The JSON is for any downstream use (comparing seeds, plotting trends, sharing results). They serve different audiences at zero extra cost.

**`ReportWriter.ts` separate from `Reporters.ts`.** `Reporters.ts` is pure functions (string in, string out) — testable without mocking `fs`. `ReportWriter.ts` does I/O and is tested with integration tests or not unit-tested at all. Mixing them would force `fs` mocks into formatter tests.

**Full history in the JSON.** Decade summaries are convenient but lossy — a single bad year is averaged away. Including `fullHistory` in the JSON means a researcher can always reconstruct the decade summaries or compute their own aggregations. Storage cost is negligible (100 objects per run).

**Thresholds as named constants, not magic numbers.** The collapse/thrive thresholds are the simulation's core hypothesis. Burying `0.60` in report logic would make them invisible. Named constants in `Variables.ts` document the hypothesis and make it easy to run comparative studies by changing one value.

**Rejected: HTML report.** An HTML report with charts would be compelling but requires either a production dependency (chart library) or hand-rolled SVG generation. Neither fits the zero-production-dependency constraint. JSON output + any spreadsheet tool achieves the same goal.

**Rejected: outcome determined by `Simulation` itself.** Classification logic belongs in the reporting layer, not in the simulation model. `Simulation` models the world; it shouldn't know what "collapse" means for the purposes of a report. Keeping classification in `Reporters.ts` means the definition of collapse can be changed without touching the simulation.

## Consequences

- `src/Helpers/Reporters.ts` gains `formatEndReport` and `classifyOutcome`
- `src/Helpers/ReportWriter.ts` is created with `writeReportJSON`; it uses Node's `fs` module
- `Variables.ts` gains `COLLAPSE_GINI_THRESHOLD`, `STRUGGLING_GINI_THRESHOLD`, `STRUGGLING_HAPPINESS_THRESHOLD`, `THRIVING_GINI_THRESHOLD`, `THRIVING_HAPPINESS_THRESHOLD`, `COLLAPSE_POPULATION_FRACTION`
- `output/` directory added to `.gitignore`
- `index.ts` changes from a two-liner to a four-liner (import formatEndReport, writeReportJSON; call both)
- The end report depends on ARD 015 (`TenYearSummary`) and ARD 016 (`Reporters.ts`) being implemented first
- Tests for `classifyOutcome` use hand-crafted `Simulation`-like objects and cover all four outcome labels and boundary conditions
- `ReportWriter.ts` is integration-tested (write file, read it back, parse JSON) or excluded from unit tests with a clear note
