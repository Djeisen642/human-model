# ARD 016: Progress Reporting and Ten-Year Summary

**Status:** Proposed  
**Date:** 2026-05-01

## Context

The simulation runs silently. `LooperSingleton.start()` returns a completed `Simulation` object, but `index.ts` discards it — no output is produced during or after a run. For a 100-tick simulation this is fine to wait through; for longer runs or during development, there is no way to see whether the simulation is behaving sensibly, trending toward collapse, or stuck.

Progress reporting answers: *is the simulation doing something meaningful right now?*

Two natural cadences exist:
- **Per-tick**: every year of simulated time — useful for debugging but noisy over long runs
- **Per-decade**: every 10 ticks — meaningful signal, low noise, aligned with how longitudinal data is typically reported

## Decision

Every 10 ticks, `LooperSingleton` builds a `TenYearSummary`, appends it to `Simulation.decadeHistory`, and prints a one-line summary to `console.log`. No per-tick output by default.

### `TenYearSummary` data structure

`TenYearSummary` is a plain interface defined in `src/Helpers/Types.ts`:

```typescript
interface TenYearSummary {
  /** The tick that closed this decade (10, 20, 30, …). */
  endTick: number;

  /** Population alive at the end of the decade. */
  endPopulation: number;

  /** Net population change over the decade (end − start). */
  populationDelta: number;

  /** Total deaths over the decade and breakdown by cause (deltas, not cumulative). */
  totalDeaths: number;
  deathsByOldAge: number;
  deathsByIllness: number;
  deathsBySuicide: number;
  deathsByKilling: number;
  deathsByDisaster: number;

  /** Average Gini coefficient across the 10 ticks. */
  avgResourceGini: number;

  /** Average resources per living person across the 10 ticks. */
  avgResources: number;

  /** Average happiness across the 10 ticks. */
  avgHappiness: number;

  /** Average natural resource pool level across the 10 ticks. */
  avgNaturalResources: number;

  /** Worst single-year Gini observed in the decade. */
  peakResourceGini: number;
}
```

Death counts are **deltas** (deaths during this decade only), derived by subtracting the cumulative death counts at the start of the decade from those at the end — using values already stored in each `TickSnapshot`.

### `Simulation.decadeHistory`

`Simulation` gains one new field:

```typescript
decadeHistory: TenYearSummary[] = [];
```

### Trigger in `LooperSingleton`

```typescript
if (t % 10 === 9) {
  const window = simulation.history.slice(t - 9, t + 1);
  const summary = buildTenYearSummary(window, t + 1);
  simulation.decadeHistory.push(summary);
  console.log(formatDecadeSummary(summary));
}
```

`buildTenYearSummary` is a pure function that takes the 10 snapshots and the closing tick and returns a `TenYearSummary`. It lives in `src/Helpers/Reporters.ts`.

### Console format — one line per decade

A header is printed once before the loop:

```
=== Simulation start: 100 persons, 100 ticks, seed 42 ===
[Yr ---] Pop           Gini            Resources  Happiness  Deaths
```

Then one line per decade:

```
[Yr 010] Pop: 97 (+3)  Gini: 0.42 (peak 0.51)  Resources: 48.2  Happiness: 4.1  Deaths: 3 (ill:1 sui:0 kill:0 dis:2 age:0)
```

Fields: closing tick, end population + delta, avg and peak Gini, avg resources, avg happiness, total deaths and breakdown by cause.

## Reasoning

**Decade cadence, not per-tick.** Per-tick output is 100 lines for a standard run — too much to scan, and it couples output volume to run length. Decade output is 10 lines: readable at a glance.

**Death counts as deltas.** A decade summary covering years 41–50 should report deaths *in that decade*, not since the beginning. Delta computation is straightforward since `TickSnapshot` already stores cumulative counts.

**`peakResourceGini` alongside `avgResourceGini`.** The average Gini tells you the decade's baseline inequality; the peak captures acute spikes. A decade can have a tolerable average but a catastrophic single-year spike — both matter for the collapse signal.

**`TenYearSummary` in `Types.ts`, not its own file.** It's a plain data interface with no behaviour. `Types.ts` already holds `RNG`; lightweight value types belong there rather than in their own files.

**Store on `Simulation`, not `LooperSingleton`.** `Simulation` owns all observability state (`history`, `deceased`, etc.). Adding `decadeHistory` there keeps `LooperSingleton` a thin orchestrator and makes summaries accessible to anything that holds a `Simulation` reference.

**`Reporters.ts` for formatting, not `LooperSingleton`.** Formatting is presentation logic; the looper is orchestration logic. `formatDecadeSummary` can be unit-tested with a hand-crafted `TenYearSummary` without running a full simulation.

**Rejected: per-tick output.** 100 lines per run is noise, not signal. Decade output is enough to catch runaway Gini or population collapse while the simulation is still running.

**Rejected: rolling window updated every tick.** Decade-aligned boundaries are simpler, easier to reason about, and match how external observers would audit results.

**Rejected: progress bar.** Requires a production dependency; the project has a zero-npm-production-dependency constraint. A progress bar also hides the actual signal values.

## Consequences

- `src/Helpers/Types.ts` gains the `TenYearSummary` interface
- `src/App/Simulation.ts` gains `decadeHistory: TenYearSummary[]`
- `src/Helpers/Reporters.ts` is created with `buildTenYearSummary`, `formatDecadeSummary`, and `formatSimulationHeader`
- `LooperSingleton` calls `formatSimulationHeader` before the loop and builds/pushes/prints each decade summary on `t % 10 === 9`
- `TickSnapshot` must expose cumulative death-by-cause counts for delta computation; if not yet present, they must be added
- Tests for `buildTenYearSummary` cover: correct endTick, correct deltas at decade boundaries, correct averaging, peak Gini extraction
- Tests for `formatDecadeSummary` use hand-crafted `TenYearSummary` objects — no simulation required
- First summary appears after tick 10; runs shorter than 10 ticks produce no summaries
- `console.log` in `LooperSingleton` may need suppression in tests; inject a `logger` parameter defaulting to `console.log` if noise becomes a problem
