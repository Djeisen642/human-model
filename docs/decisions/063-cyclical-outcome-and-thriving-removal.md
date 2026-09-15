# ARD 063: Cyclical Outcome Label; Removal of THRIVING

**Status:** Proposed
**Date:** 2026-09-15

## Context

`classifyOutcome` (ARD 051) reads population trajectory as decline from the run's all-time peak:
past `COLLAPSE_PEAK_DECLINE_FRACTION`/`STRUGGLING_PEAK_DECLINE_FRACTION` and the label falls to
COLLAPSE/STRUGGLING, regardless of what produced the decline. That assumption — decline from peak
means collapse — holds for the model's default one-shot overshoot dynamic, which is all ARD 051 had
measured. It breaks for a population that oscillates.

`docs/research-scale-robustness.md` (2026-09-15) found the first configuration that does not go
extinct: founding population and the commons scaled together, extraction productivity pinned.
24 of 24 seeds survive 8000 ticks across 687 completed boom-bust cycles. Re-classifying one such run
at every decade boundary across one full cycle (27 stopping points, identical dynamics) returned
COLLAPSE 20 times and STRUGGLING 7 times. The label is mostly a function of where in its cycle the
run happens to be measured, because a population cycling between 3800 and 32 spends most of a cycle
more than 50% below its own peak — the peak being an overshoot the population never held for long,
not a level it fell from.

The same study found THRIVING structurally incompatible with this regime, not merely absent from it.
THRIVING requires population near peak *and* the commons at ≥40% of ceiling simultaneously
(`THRIVING_MAX_PEAK_DECLINE_FRACTION`, `THRIVING_RESOURCE_FRACTION`); in every cycling run measured,
the population peak is what draws the commons down — the trough decade sits at 98% commons fill with
79 people alive, the peak decade at 0.0% fill with 3180 alive. `docs/research-thriving-reachability.md`
had already shown THRIVING is reachable transiently and under hand-picked configurations, so this is
not a re-litigation of that finding; it is a second, narrower one — the model's only known
non-extinct regime is one THRIVING can never describe, by construction of what population overshoot
does to a shared pool. Carrying a label the model's sole surviving regime is structurally barred from
earning has no calibration use going forward.

## Decision

**Add a CYCLICAL outcome**, and use it to correct the population-trajectory signal instead of
widening or re-tuning the existing peak-decline thresholds. Callers already compute
`CycleDetector.detectCycles` over the run's tick-level population series for the sweep harness's
`cyc`/`stable` columns; `classifyOutcome` now takes that same `CycleMetrics` result as a parameter
rather than recomputing it, so the classifier stays a pure decision over already-computed signals.

Revised order of checks:

1. **EXTINCTION** — unchanged, population 0.
2. **COLLAPSE by inequality** — final-decade Gini at or above `COLLAPSE_GINI_THRESHOLD`, checked
   unconditionally. Extreme inequality is a collapse signal regardless of population phase, so
   cycling does not suppress it.
3. **Population-trajectory read** — if `CycleMetrics.stableCycle` is true (a confirmed, non-ratcheting
   oscillation — `detectCycles`'s existing definition, unchanged), peak-relative decline is not
   evaluated; the trajectory is read as cycling, not declining. Otherwise, trajectory falls back to
   today's peak-decline check unchanged.
4. **COLLAPSE by decline** — only reachable when not cycling: peak-decline at or above
   `COLLAPSE_PEAK_DECLINE_FRACTION`.
5. **STRUGGLING** — any of: Gini at or above `STRUGGLING_GINI_THRESHOLD`, happiness below
   `STRUGGLING_HAPPINESS_THRESHOLD`, commons fill below `STRUGGLING_RESOURCE_FRACTION`, or (only when
   not cycling) peak-decline at or above `STRUGGLING_PEAK_DECLINE_FRACTION`. Unchanged except that a
   cycling population cannot trigger this branch through peak-decline — it can still trigger it
   through Gini, happiness, or the commons, exactly as a non-cycling population can.
6. **CYCLICAL** — `stableCycle` is true and nothing above fired: a sustained, non-collapsing
   oscillation with acceptable inequality, wellbeing, and commons fill.
7. **STABLE** — residual, unchanged in meaning: near peak, not cycling, no stress signal.

**THRIVING is removed** as an outcome label and as a category the project measures against. The four
existing THRIVING_* thresholds are dropped, following the precedent ARD 051 itself set when it
dropped `COLLAPSE_POPULATION_FRACTION`.

**New constants** (`Variables.ts`): the minimum confirmed-cycle count and trough-hold fraction that
`classifyOutcome` requires of `CycleMetrics` to accept a run as cycling. These may start from
`CycleDetector`'s existing `minCycles`/`troughHoldFraction` defaults, but are named explicitly here
because a signal now driving an outcome label — rather than descriptive sweep-harness output — is a
calibration surface that deserves the same visibility as the other outcome thresholds.

## Reasoning

**Rejected: keep peak-decline unconditional and just widen the THRIVING/STABLE band.** A wider band
still gets crossed twice per cycle; it makes the misclassification rarer, not absent, and produces no
label that actually names what a cycling population is doing. The measured problem is that the signal
is being asked the wrong question of a phase that repeats, not that its threshold is miscalibrated.

**Rejected: compute cycle detection at decade resolution inside `classifyOutcome` itself**, rather
than accepting the caller's tick-level `CycleMetrics`. This would duplicate a second, differently
calibrated cycle detector alongside the one `scripts/sweep.ts` already runs and reports every session
as `cyc`/`stable`, and at 10-tick resolution it would need its own smoothing and threshold tuning
with no existing validation. Reusing the exact computation already exercised in every sweep session
keeps one definition of "cycling" in the codebase.

**Rejected: make CYCLICAL a top-level bucket checked before the Gini/happiness/commons stress
signals**, independent of them. This would let a population that is cycling but genuinely
impoverished or unequal read as a positive-sounding label — precisely the failure mode ARD 051 was
written to close, where a run that looks fine on one axis reads as healthy regardless of the others.
CYCLICAL only replaces the *peak-decline* signal; the other three dimensions keep first claim on
STRUGGLING/COLLAPSE.

**Rejected: keep THRIVING and simply document that it does not fire under cycling.** Every future
study on the model's only known non-extinct regime would need to re-explain why the "good" label is
absent from the "doesn't die" result — dead weight that misleads by omission rather than informing.
Retiring it removes a target the project's own dynamics forbid the surviving regime from reaching,
rather than asking every reader to independently rediscover that.

## Consequences

- `OutcomeLabel` (`src/Helpers/Types.ts` or `Reporters.ts`, wherever it is currently declared) drops
  `'THRIVING'`, adds `'CYCLICAL'`.
- `classifyOutcome` and `explainOutcome` (`src/Helpers/Reporters.ts`) take an additional
  `CycleMetrics` parameter; `explainOutcome` gains a CYCLICAL case (cycle count and trough trend) and
  loses the THRIVING case.
- Call sites compute `detectCycles` over the tick-level population series once and pass the result
  in, rather than `classifyOutcome` reaching for raw history itself: `scripts/sweep.ts` (already
  computes this per run for its own columns — becomes single-computation, dual-use),
  `src/Helpers/ReportWriter.ts`, `formatEndReport` in `src/Helpers/Reporters.ts`, and
  `scripts/thrive-probe.ts`.
- `scripts/thrive-probe.ts` measures gate failure against a label that no longer exists and should be
  retired or repurposed as a cyclical-reachability probe; not required by this ARD, flagged for the
  implementer.
- `ReportWriter.ts`'s outcome-color legend drops THRIVING's entry, gains one for CYCLICAL.
- `Variables.ts` drops `THRIVING_GINI_THRESHOLD`, `THRIVING_HAPPINESS_THRESHOLD`,
  `THRIVING_MAX_PEAK_DECLINE_FRACTION`, `THRIVING_RESOURCE_FRACTION`; adds the two CYCLICAL
  cycle-confirmation constants named above.
- Tests (`src/tests/Helpers/Reporters.test.ts`) must cover: a confirmed stable cycle with acceptable
  Gini/happiness/commons → CYCLICAL; a confirmed stable cycle with extreme Gini → COLLAPSE (overrides
  cycling); a confirmed stable cycle with low happiness or a depleted commons → STRUGGLING (overrides
  cycling); fewer than the required confirmed cycles → ordinary peak-decline logic applies, not
  CYCLICAL; a decaying-envelope oscillation (`stableCycle` false because troughs ratchet down) →
  COLLAPSE/STRUGGLING via peak-decline, same as an oscillation-free decline. All existing THRIVING
  test cases are replaced, not merely deleted.
- `docs/future-ideas.md`'s `OSCILLATING` label item is subsumed by this ARD; move it to Discarded
  once implemented.
- `docs/model-reference.md` and `docs/odd-protocol.md` need their `classifyOutcome`/outcome-label
  bullets updated to describe five labels (EXTINCTION, COLLAPSE, STRUGGLING, CYCLICAL, STABLE).
- `CLAUDE.md`'s opening framing names THRIVING as the research goal and primary success state; it
  needs rewriting to state the goal in terms this taxonomy can actually award — a population that
  sustains itself, cycling or stable, without collapsing — rather than a four-gate simultaneous state
  the one surviving regime found so far cannot reach by construction.
- Research docs that measured against THRIVING under the old taxonomy
  (`research-thriving-reachability.md`, `research-untested-variables.md`, `research-scale-robustness.md`,
  `research-zero-variability-followup.md`, `calibration-guide.md`'s narrative sections) are historical
  records of what was measured and are not rewritten — per the documentation conventions, a result
  that no longer applies gets a dated annotation pointing here, not a deletion. `calibration-guide.md`
  additionally needs its live guidance (not its historical findings) updated to describe the new label
  and to note that `stable`/`cyc` sweep columns now feed the outcome column directly rather than being
  a separate descriptive statistic.
- Refines [ARD 051](./051-multidimensional-outcome-classification.md) (the classifier it defined) and
  reuses [`CycleDetector`](../../src/Helpers/CycleDetector.ts) (introduced as sweep-only measurement
  tooling, promoted here to feed an outcome label — the promotion `CycleDetector`'s own module header
  flagged as ARD-level). Motivated by
  [`docs/research-scale-robustness.md`](../research-scale-robustness.md) and
  [`docs/research-thriving-reachability.md`](../research-thriving-reachability.md).
