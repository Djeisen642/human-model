# ARD 016: Progress Reporting

**Status:** Proposed  
**Date:** 2026-05-01

## Context

The simulation runs silently. `LooperSingleton.start()` returns a completed `Simulation` object, but `index.ts` discards it — no output is produced during or after a run. For a 100-tick simulation this is fine to wait through; for longer runs or during development, there is no way to see whether the simulation is behaving sensibly, trending toward collapse, or stuck.

Progress reporting answers the question: *is the simulation doing something meaningful right now?*

Two natural cadences exist:
- **Per-tick**: every year of simulated time — useful for debugging but noisy over long runs
- **Per-decade**: every 10 ticks, aligned with `TenYearSummary` (ARD 015) — meaningful signal, low noise

## Decision

`LooperSingleton` prints a one-line decade summary to `console.log` each time a `TenYearSummary` is produced (i.e., every 10 ticks). No per-tick output by default.

**Format — one line per decade:**

```
[Yr 010] Pop: 97 (+3)  Gini: 0.42 (peak 0.51)  Resources: 48.2  Happiness: 4.1  Deaths: 3 (ill:1 sui:0 kill:0 dis:2 age:0)
```

Fields in order:
- `[Yr NNN]` — closing tick of the decade, zero-padded to 3 digits
- `Pop: NNN (±NN)` — end-of-decade population and delta from decade start
- `Gini: 0.NN (peak 0.NN)` — average and peak Gini for the decade (2 decimal places)
- `Resources: NN.N` — average resources per person across the decade
- `Happiness: N.N` — average happiness across the decade
- `Deaths: NN (ill:N sui:N kill:N dis:N age:N)` — total deaths and breakdown by cause

**Implementation:**

The print call lives in `LooperSingleton` immediately after the `TenYearSummary` is pushed to `decadeHistory`:

```typescript
if (t % 10 === 9) {
  const summary = buildTenYearSummary(window, t + 1);
  simulation.decadeHistory.push(summary);
  console.log(formatDecadeSummary(summary));
}
```

`formatDecadeSummary` is a pure function in a new `src/Helpers/Reporters.ts` file. Keeping formatting logic out of `LooperSingleton` and `Simulation` makes it independently testable and easy to change without touching simulation logic.

A header line is printed once before the loop begins:

```
=== Simulation start: 100 persons, 100 ticks, seed 42 ===
[Yr ---] Pop           Gini            Resources  Happiness  Deaths
```

## Reasoning

**Decade cadence, not per-tick.** Per-tick output is 100 lines for a standard run — too much to scan, and it couples output volume to simulation length. Decade output is 10 lines for a 100-tick run: readable at a glance, and aligned with the `TenYearSummary` data already being produced.

**`console.log` to stdout, not a file.** Progress reporting is ephemeral — it's for the observer running the simulation now, not for downstream analysis. File output is appropriate for the end-of-simulation report (ARD 017), not progress. Mixing concerns here would force callers to manage file handles just to watch a run.

**`Reporters.ts` for formatting, not `LooperSingleton`.** Formatting is presentation logic; the looper is orchestration logic. Separating them means: format changes don't require touching simulation control flow, and `formatDecadeSummary` can be unit-tested with a hand-crafted `TenYearSummary` without running a full simulation.

**No verbosity flag for now.** A `verbose` option that enables per-tick output would be useful eventually but adds interface complexity before there is a demonstrated need. Add it when someone actually needs it.

**Rejected: progress bar.** A progress bar (e.g., via a library) would require a production dependency and adds no informational value over the decade summary lines. The project has a zero-production-dependency constraint.

**Rejected: emit events instead of direct `console.log`.** An event emitter would let callers intercept output — useful for testing or redirecting to a file. The added complexity is not justified yet; `Reporters.ts` being a pure function is enough to keep it testable.

## Consequences

- `src/Helpers/Reporters.ts` is created with `formatDecadeSummary(summary: TenYearSummary): string` and `formatSimulationHeader(n: number, ticks: number, seed: number): string`
- `LooperSingleton` calls `formatSimulationHeader` before the loop and `formatDecadeSummary` after each `TenYearSummary` is pushed
- Tests for `Reporters.ts` use hand-crafted `TenYearSummary` objects — no simulation required
- Running `npm run start:dev` now produces visible output
- The decade-summary print depends on ARD 015 (`TenYearSummary`) being implemented first
- `console.log` calls in `LooperSingleton` may need to be suppressed in tests; inject a `logger` parameter with a default of `console.log` if test noise becomes a problem
