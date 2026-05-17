# ARD 032: Pool Dynamics and Invention Counters in Snapshots

**Status:** Proposed
**Date:** 2026-05-17

## Context

`InventionEvent` (ARD 007) mutates `extractionEfficiency` and `naturalResourceCeiling` over the course of a run — the two main feedback levers from technological/social change on the resource pool. The end report shows their final values, but their trajectory is invisible: the HTML report plots `naturalResources`, but the ceiling and efficiency that produced that curve aren't captured anywhere outside the live `Simulation` fields, which are gone by the time the report is read.

Three concrete gaps:

1. A run where invention drives `extractionEfficiency` toward the 0.01 floor (drained pool) and a run where invention doubles the ceiling can produce visually similar `naturalResources` curves for very different reasons.
2. Without per-tick ceiling/efficiency series, the user can't answer "did invention save us or kill us?"
3. Cumulative invention firings by outcome (faster / slower / ceiling) are the most actionable single rollup. They aren't tracked.

## Decision

### TickSnapshot additions

```typescript
interface TickSnapshot {
  // ... existing fields ...
  /** Pool cost per unit gathered at end of tick; modified by InventionEvent. */
  extractionEfficiency: number;
  /** Maximum accessible resources at end of tick; grown by InventionEvent. */
  naturalResourceCeiling: number;
}
```

Written by `Simulation.snapshot()` from `this.extractionEfficiency` and `this.naturalResourceCeiling`. Pure observability — no simulation-state change.

### Invention firing counters on `Simulation`

```typescript
class Simulation {
  inventionFasterCount = 0;
  inventionSlowerCount = 0;
  inventionCeilingCount = 0;
}
```

`InventionEvent.execute()` increments the matching counter when each branch fires. Cumulative across the run; not snapshotted per tick (invention is rare; a run-total is enough for the report).

### Report surfaces

- **HTML report:** a new chart "Resource Pool Dynamics" plotting three lines: `naturalResources` (left axis), `naturalResourceCeiling` (left axis, dashed), and `extractionEfficiency` (right axis). Reuses the dual-axis pattern already in the resources chart.
- **Console report:** RESOURCES section gains one line:
  ```
  Inventions: 12 faster  9 slower  5 ceiling   (final efficiency: 0.74, ceiling: 6200)
  ```

## Reasoning

**Snapshot fields, not derived later.** Reconstructing `extractionEfficiency` from a list of invention firings would require an ordered event log, plus the formula in two places. One number per tick is cheap and unambiguous.

**Cumulative counters, not per-tick series.** Invention firings are infrequent (a few per decade at most). Per-tick zero-or-one columns would bloat the snapshot for no analytical gain. A run-total tells the story.

**Counters on `Simulation`, not `Person.inventions`.** Persons don't currently have a record of inventions they triggered (ARD 028 made the same choice for windfall — "no record" when there's no specific victim or beneficiary). Counters are the right granularity.

**Rejected: derive efficiency change-rate from extracted-per-tick deltas.** Would require also tracking total extraction per tick (another schema change), and would be lossy when extraction is zero. Capturing the value directly is simpler.

**Rejected: tracking each invention as an `InventionRecord` object.** Records are for inter-person events (KillingRecord, StealingRecord). Invention has no victim and no specific beneficiary — counters are the right shape.

## Consequences

- `src/App/Simulation.ts` — `TickSnapshot` gains two fields; `snapshot()` writes them; three counter fields added; no other changes
- `src/Events/InventionEvent.ts` — each branch increments the matching counter before mutating
- `src/Helpers/Reporters.ts` (`formatEndReport`) — RESOURCES section gains the Inventions line
- `src/Helpers/ReportWriter.ts` — adds a "Resource Pool Dynamics" chart card and Chart.js block
- Existing `TickSnapshot` consumers ignore the new fields; backwards-compatible
- Tests: snapshot writes the two new fields; each invention branch increments its counter; report renders the Inventions line; no invention firings → "Inventions: 0 faster  0 slower  0 ceiling"
