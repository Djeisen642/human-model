# ARD 015: Ten-Year Summary

**Status:** Proposed  
**Date:** 2026-05-01

## Context

`TickSnapshot` captures a point-in-time cross-section of the simulation each tick. Over a 100-tick run, single-year snapshots carry a lot of noise — a bad Gini in one year may be a transient spike or the start of a collapse. There is no built-in way to see trends over a meaningful window.

A 10-tick (10-year) summary aggregates the snapshots from each decade, giving a cleaner signal on whether civilization is trending toward collapse or stability. It also matches how longitudinal research data is typically reported (decade-over-decade comparisons).

## Decision

Every 10 ticks, `LooperSingleton` produces a `TenYearSummary` and appends it to `Simulation.decadeHistory`. The summary is computed from the 10 `TickSnapshot` objects that just completed (ticks `n-9` through `n`).

**New type — `TenYearSummary`:**

```typescript
interface TenYearSummary {
  /** The tick that closed this decade (10, 20, 30, …). */
  endTick: number;

  /** Population alive at the end of the decade. */
  endPopulation: number;

  /** Net population change over the decade (end − start). */
  populationDelta: number;

  /** Total deaths over the decade, broken out by cause. */
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

  /** Peak Gini observed in the decade — the worst single-year inequality. */
  peakResourceGini: number;
}
```

Death counts are **deltas** (how many died during the decade), not cumulative totals. They are derived by subtracting the cumulative death counts at the start of the decade from those at the end, using values already stored in each `TickSnapshot`.

**Trigger in `LooperSingleton`:**

```typescript
if (tick % 10 === 0) {
  const window = simulation.history.slice(tick - 10, tick);
  simulation.decadeHistory.push(buildTenYearSummary(window, tick));
}
```

`buildTenYearSummary` is a pure function (or static method on `Simulation`) that takes the 10 snapshots and the closing tick number and returns a `TenYearSummary`.

**New field on `Simulation`:**

```typescript
decadeHistory: TenYearSummary[] = [];
```

## Reasoning

**Aggregate over the window, don't sample a single tick.** Averaging across 10 ticks dampens year-on-year noise (a drought year, a plague year) and reveals whether the underlying trajectory is improving or worsening. A single-tick sample would still be noisy and would not represent the decade.

**Store on `Simulation`, not in `LooperSingleton`.** `Simulation` owns all observability state (`history`, `deceased`, etc.). Adding `decadeHistory` there keeps `LooperSingleton` a thin orchestrator and makes summaries accessible to anything that holds a `Simulation` reference.

**`tick % 10 === 0` in `LooperSingleton`.** The loop already controls tick timing. Placing the decade check there avoids threading tick-count knowledge into `Simulation` itself.

**Death counts as deltas, not cumulative.** A summary covering years 41–50 should report deaths *in that decade*, not all deaths since the beginning. Delta computation is straightforward because `TickSnapshot` already stores cumulative death counts — subtract the value at the start of the window from the value at the end.

**`peakResourceGini` alongside `avgResourceGini`.** The average Gini tells you the decade's baseline inequality; the peak tells you whether there were acute spikes. A decade can have a tolerable average but a catastrophic single-year spike — both matter for the collapse signal.

**Rejected: rolling summary updated every tick.** A rolling 10-tick window updated each tick would be more continuous but adds complexity and duplicates most of what `TickSnapshot` already provides. Decade-aligned boundaries are simpler, easier to reason about, and match how external observers would audit results.

**Rejected: summary inside `TickSnapshot`.** Embedding aggregate fields in the per-tick snapshot conflates two different granularities in one type. Keeping them separate preserves the clean distinction between point-in-time (snapshot) and period-aggregate (summary).

## Consequences

- `src/App/Simulation.ts` gains `decadeHistory: TenYearSummary[]` and the `TenYearSummary` type (or the type lives in `src/Helpers/Types.ts`)
- `src/App/LooperSingleton.ts` gains a `tick % 10 === 0` branch that calls `buildTenYearSummary` and pushes the result
- A `buildTenYearSummary` pure function must be implemented and unit-tested in isolation
- Tests must cover: correct endTick values, correct population delta, correct death deltas at decade boundaries, correct averaging, peak Gini extraction
- The 10-tick window assumption means the first summary appears after tick 10; runs shorter than 10 ticks produce no summaries
- `TickSnapshot` must expose cumulative death-by-cause counts for the delta computation to work; if these are not yet tracked, they must be added
