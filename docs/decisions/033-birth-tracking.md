# ARD 033: Birth Tracking

**Status:** Accepted
**Date:** 2026-05-17

## Context

`ChildbirthEvent` (ARD 029) adds new persons via `simulation.add(child)`. The report's POPULATION section shows total deaths and a per-decade population delta — but the delta conflates births and deaths. A run with "stable population from lots of both" looks identical at the delta level to "very little of either," and those are very different societies.

The model already tracks per-tick deaths by cause with cumulative running totals (`tickDeathCauses`, `cumulativeDeathsBy*`). Births deserve symmetric treatment: per-tick count, cumulative count, decade rollup. Without it, the most direct fertility signal is invisible to reports.

## Decision

### TickSnapshot additions

```typescript
interface TickSnapshot {
  // ... existing fields ...
  /** Births this tick. */
  births: number;
  /** Cumulative births up to and including this tick. */
  cumulativeBirths: number;
}
```

### Simulation API

```typescript
class Simulation {
  private tickBirths = 0;

  recordBirth(): void {
    this.tickBirths++;
  }
}
```

`ChildbirthEvent` calls `simulation.recordBirth()` after `simulation.add(child)`. The initial seed loop does *not* call `recordBirth` — seeding produces the initial cohort, not births.

`snapshot()` reads `tickBirths`, writes `births` and `cumulativeBirths` (the latter as `prev?.cumulativeBirths + births`), then zeroes `tickBirths`. Same lifecycle as `tickDeathCauses`.

### TenYearSummary addition

```typescript
interface TenYearSummary {
  // ... existing fields ...
  births: number;
}
```

`buildTenYearSummary` derives the decade's `births` from `cumulativeBirths` deltas — same pattern as the existing death-cause deltas.

### Report surfaces

- **Console report POPULATION section:**
  ```
  Start: 100  End: 87  Births: 32  Deaths: 45   (net: −13)
  ```
- **Decade summary table:** gains a `Births` column between `ΔPop` and `Deaths`.
- **HTML report:** births overlaid on the population chart as a separate dataset (dashed line on the same axis).

## Reasoning

**Symmetric with deaths.** `tickDeathCauses` already provides the model — per-tick counter, cumulative on snapshot, deltas in decade summaries. Births inherit the shape with no new pattern.

**`recordBirth()` not inside `simulation.add()`.** Seeding calls `add()` for the initial population; making `add()` count births would double-count. Explicit `recordBirth()` keeps the call sites honest.

**Per-tick and cumulative on the snapshot, not just one.** Cumulative-only would force consumers to derive deltas everywhere; per-tick-only would force the same for run totals. Both fields cost two numbers and remove the derive-everywhere tax. Matches how deaths are stored.

**Rejected: count births via `Person.childOf.length` scans.** Already in place, but counting per tick would mean scanning all living persons every tick. An O(1) counter is strictly cheaper.

**Rejected: track births by cause / mother age / parents' education.** Future-ideas territory. The first useful question is "did people have children?" — total births answers it. Slicing by parent attribute is an extension that can ride atop these fields when warranted.

## Consequences

- `src/App/Simulation.ts` — `TickSnapshot` gains two fields; `Simulation` gains `tickBirths` and `recordBirth()`; `snapshot()` writes the two fields and zeroes the counter
- `src/Helpers/Types.ts` — `TenYearSummary` gains `births`
- `src/Events/ChildbirthEvent.ts` — calls `simulation.recordBirth()` after `simulation.add(child)`
- `src/Helpers/Reporters.ts` — `buildTenYearSummary` computes `births` from cumulative delta; `formatEndReport` POPULATION section adds Births and Net; `formatDecadeSummary` and the decade table add the Births column
- `src/Helpers/ReportWriter.ts` — adds a births dataset to the population chart
- Tests: birth counter increments only on `ChildbirthEvent`, not on seed; `recordBirth` correctly increments and is flushed by `snapshot`; decade summary computes correct births delta at boundaries; formatter renders births in POPULATION and decade table
- Existing consumers ignore the new fields; backwards-compatible
