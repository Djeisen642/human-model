# ARD 031: Survivor Composition and EXTINCTION Outcome

**Status:** Accepted
**Date:** 2026-05-17

## Context

The end-of-simulation report (ARD 016) answers "what was the outcome?" and summarizes trends in Gini, resources, and happiness. It does not answer "what kind of society survived?" The COHORT SURVIVAL section (ARD 030) reports per-type counts, but only when the run configured `personTypes`; default runs have no characterization of the living population at end.

Three related gaps:

1. **No view of final-state composition.** Education levels, employment, illness severity, partnership and parenthood rates, and age distribution are immediately available on `Person` objects but absent from the report. These are the most direct indicators of *whether the survivors are a society* (working-age, educated, healthy, partnered) or *a remnant* (elderly, ill, isolated).

2. **Population=0 hidden behind COLLAPSE.** When everyone dies, `classifyOutcome` returns `COLLAPSE` because the population-fraction trigger fires. The verdict line still says "Trend: declining" for happiness and Gini, reading like inequality improved rather than that everyone died. `docs/future-ideas.md` flagged this in the "Very useful" tier.

3. **Partial-decade summary.** When `ticks` isn't a multiple of 10, the final N (<10) ticks are unsummarized; `formatEndReport` uses the last full decade, which may be stale by up to 9 ticks. The new SURVIVORS section computes from live state, but the decade-level metrics it sits alongside should reflect the actual end of the run. Also flagged in `docs/future-ideas.md`.

## Decision

### SURVIVORS section

A new section in `formatEndReport`, rendered when `living.length > 0`, between `HAPPINESS` and `COHORT SURVIVAL` (or before `DECADE SUMMARY TABLE` when no types are configured):

```
SURVIVORS (87)
  Age:        children 12 (13.8%)  working 64 (73.6%)  elderly 11 (12.6%)
  Education:  NONE 9  HS 41  BA 22  MA 11  PhD 4   (currently enrolled: 7)
  Employment: 48 / 64 working-age employed (75.0%)
  Health:     well 71 (<0.1)  mild 12 (0.1–0.5)  severe 4 (≥0.5)   avg illness 0.09
  Family:     partnered 38 (43.7%)  with children 29 (33.3%)
```

Buckets:
- **Age:** child (<18), working (18–65), elderly (>65)
- **Illness:** well (<0.1), mild ([0.1, 0.5)), severe (≥0.5)
- **Education:** one count per `EDUCATION` constant; "currently enrolled" = `isWorkingOnEd !== NONE`
- **Employment:** percentage among working-age (18–65), matching the happiness model's working-age band (ARD 014)
- **Family:** `isInRelationshipWith !== null`; `hasChildren.length > 0`

A new pure helper `summarizeSurvivors(living: Person[]): SurvivorSummary` in `Reporters.ts`; `formatSurvivorSection(summary: SurvivorSummary): string[]` renders it. `SurvivorSummary` is added to `Types.ts`.

### EXTINCTION outcome label

Add `'EXTINCTION'` to the `classifyOutcome` return union. Trigger: `finalDecade.endPopulation === 0`. Checked **first** (more specific than COLLAPSE).

When EXTINCTION fires:
- The `OUTCOME` line says `EXTINCTION` and is followed by `Extinct as of Yr NNN`, where NNN is the earliest tick in `history` with `population === 0`.
- The SURVIVORS section is omitted.
- The HTML report uses a distinct outcome color (darker than COLLAPSE).

### Partial-decade summary

After the main tick loop in `LooperSingleton.start()`, if `ticks % 10 !== 0`, build one final `TenYearSummary` over the remaining snapshots (window length = `ticks % 10`) and append it to `decadeHistory`. The summary's `endTick` is the actual `ticks` value (e.g., 95). All downstream code already iterates `decadeHistory` and uses `endTick` for labelling.

`buildTenYearSummary` is unchanged — it already accepts any non-empty window via the caller's `slice(...)`. The looper passes the correct `startPopulation` from the last full-decade boundary.

## Reasoning

**SURVIVORS as a fixed section, not type-gated.** COHORT SURVIVAL (ARD 030) is conditional on `personTypes`. Most research runs won't configure types, so the report has nothing about the population's final composition. SURVIVORS gives every run a baseline; COHORT SURVIVAL extends it when types are present.

**Buckets, not full distributions.** Three buckets per continuous dimension is enough to characterize health/age in a one-line summary; full histograms are noise for a text report and the HTML layer can extend later.

**EXTINCTION as its own label, not a sub-flag on COLLAPSE.** Treating extinction as a subset of COLLAPSE is technically correct but loses information at the verdict layer. Filename comparison (`report-42-EXTINCTION-...html` vs `report-42-COLLAPSE-...html`) becomes self-describing. Rejected: keeping `COLLAPSE` with a sub-flag — every comparator scanning labels would still have to special-case extinction.

**Population=0 detection on `finalDecade.endPopulation`, not on `simulation.getLiving().length`.** Both work, but the former keeps `classifyOutcome` operating purely over its input (the final decade summary) rather than peeking at live state. Consistent with the rest of the function.

**Partial summary appended to `decadeHistory`, not a separate `partialDecadeSummary` field.** Rejected: a parallel field would require every consumer (table rendering, chart labels, "final decade" lookup) to be partial-aware. Appending keeps a single source of truth and treats partial windows as just shorter decades. The cost is that `decadeHistory` is no longer guaranteed to contain only 10-tick windows — acceptable, because every consumer already reads `endTick` for labelling.

**Compute partial summary in `LooperSingleton`, not `formatEndReport`.** The partial window needs `startPopulation` from the last decade boundary, which the looper already tracks. Doing it in the formatter would re-derive that state from snapshots.

**Rejected: per-person details in the report.** Listing every survivor's stats would explode the report size and isn't actionable. Bucketed aggregates communicate shape without bloat.

## Consequences

- `src/Helpers/Types.ts` gains `SurvivorSummary` interface
- `src/Helpers/Reporters.ts` gains `summarizeSurvivors`, `formatSurvivorSection`; `formatEndReport` inserts SURVIVORS when `living.length > 0`
- `classifyOutcome` return type widens to include `'EXTINCTION'`; new branch checked first
- `formatEndReport` adds `Extinct as of Yr NNN` line under OUTCOME when label is EXTINCTION
- `src/Helpers/ReportWriter.ts` adds EXTINCTION to `outcomeColors` map (darker red)
- `src/App/LooperSingleton.ts` builds a partial-decade summary after the loop when `ticks % 10 !== 0`
- `CLAUDE.md` updated under "Key design decisions" and "What's implemented"
- Tests cover: every survivor bucket; EXTINCTION boundary (population 0 vs 1); partial-decade summary correctness (window length, startPopulation, deltas); report rendering with and without survivors; report with EXTINCTION
- Known weakness: SURVIVORS is a snapshot at the final tick, not averaged over a window — a single-tick fluke can land in the section. Acceptable; the decade summary in the same report carries the averaged context
