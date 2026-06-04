# ARD 049: Mortality Rebalance — Illness Senescence Carries Old-Age Death; Suicide Recalibrated

**Status:** Accepted
**Date:** 2026-06-04

## Context

The death model is dominated by a single miscalibrated mechanic. Across seeds, **suicide is
~80–90% of all deaths** (seed 42: 70 of 80), illness is a rounding error (2 of 80), and there is
no old-age death at all — the only causes are murder, illness, disaster, and suicide. Full audit
and empirical anchors are in `docs/research-mortality.md`.

Two coupled defects produce this:

1. **Suicide is ~30–330× real rates.** The suicide probability (which falls as happiness rises)
   puts even the happiest person at ~0.27%/yr — ~30× the global average (~0.009%/yr) — and a
   typical person at ~0.4%/yr, the rate seen in recently-hospitalized depression patients.
   ARD 019 flagged its scale constant as "a guess."

2. **Illness never accumulates, so the age-mortality channel never fires.** Illness recovery
   outpaces onset by roughly 8×, and ARD 048's constitution decay is too weak to move
   constitution more than a point or two by old age — so the per-tick illness balance is negative
   for essentially everyone and illness sits at zero. Because illness death is severity-gated
   (zero illness → zero probability), the age-mortality curve from ARD 008 exists but only ever
   multiplies a number that is already zero.

Net effect: the elderly cannot die of disease, so they die of suicide instead (happiness drifts
down with age and dwindling resources), and population dynamics track the happiness→suicide curve
rather than inequality/resource health — corrupting the primary collapse/thrive signal.

## Decision

Rebalance mortality so that **age-related death is disease-mediated through the existing illness
channel** (no separate "natural"/"old age" cause — that is not a real distinct mechanism; aging
raises disease incidence and severity), and **suicide returns to a realistic rate**.

### 1. Illness recovery decays with age (senescence)

Illness recovery becomes harder with age: past a start age, the recovery probability is scaled
down by a senescence factor that falls linearly with age toward a non-zero floor (healing
weakens but never fully vanishes). Below the start age recovery is unimpaired, so acute illness
in the young still clears normally. Onset is unchanged in form.

The point is to flip the per-tick illness balance by age. For healthy working-age persons
recovery still outweighs onset, so illness trends to zero; in old age recovery falls below onset
(graded by constitution), so chronic illness accumulates. The accumulated severity then feeds
the existing age-modified illness-death roll — the elderly become chronically ill and die of
disease, with no new death path required.

### 2. Recalibrate illness so disease can accumulate

Onset is raised and recovery lowered so the balance can actually flip in old age — the previous
~8× recovery dominance was too large for age-scaling alone to overcome. The illness-death
severity scalar is re-tuned so that the resulting annual death probability for the chronically
ill elderly lands near SSA period-life-table values (`q(x)` ≈ 1.5% / 5% / 16% at ages 65 / 80 /
90). These are calibration values; exact numbers live in `Variables.ts` and are tuned by
observing run output.

### 3. Recalibrate suicide

The suicide rate is cut by one-to-two orders of magnitude so that a typical-happiness person
faces roughly the ~0.01–0.05%/yr band and even a happiness-zero person stays at or below ~1%/yr
(the ceiling seen in the highest-risk clinical subpopulations). The happiness-dependent shape of
the suicide probability is unchanged; only its scale moves.

### New constants

Three constants govern the senescence factor: a **start age** (when recovery capacity begins to
decline; before it, the young heal normally), a **per-year decay** (how fast healing fails with
age), and a **floor** (a minimum so the very old can still occasionally recover). Four existing
constants are recalibrated in value only: illness onset, illness recovery, the illness-death
severity scalar, and the suicide scale.

## Reasoning

**Rejected: a separate "natural causes" death path** (a new cause of death with its own
age-driven mortality rate). This was the first draft of the recommendation. It was dropped because "old age" / "natural causes" is not a
real distinct cause — WHO ICD guidance discourages it, and age-related death is overwhelmingly
disease-mediated. A parallel age-driven death formula would also need calibrating against the
illness path to avoid double-counting. Routing old-age mortality through illness keeps one
mortality channel, matches the biology, and reuses the age-shaped `ageMortalityModifier` that
already exists.

**Rejected: pure recalibration of the existing onset/recovery constants (no senescence term).**
Illness onset already rises with age and recovery already falls, but the existing age scaler is
linear and shallow — far too weak to overcome recovery's dominance by old age. Raising the base
rates enough to flip the balance through age-scaling alone would also push young, low-constitution
persons into chronic illness. A dedicated senescence decay on recovery concentrates the effect in
old age (the empirically correct location: healing capacity, not just disease incidence, declines
with age) and is the lever the research doc explicitly licensed ("make recovery decay with age").

**Rejected: an age term added directly to the illness-death roll.** Adding the age-disease
contribution straight into the death probability (rather than into accumulated severity) would be
the easiest to calibrate, but it bypasses the illness state entirely — the elderly would die at
rising rates while still showing zero illness, breaking the link between visible severity,
happiness (illness lowers happiness), and the survivor health report. Accumulating real severity
via senescence keeps the illness state coherent for everything that reads it.

**Suicide shape unchanged.** A happiness *threshold* shape (risk only below some floor) was
considered but deferred — the existing happiness-dependent curve is acceptable once the scale is
realistic, and changing both shape and magnitude at once would make the recalibration harder to
reason about.

## Consequences

- The illness recovery roll gains the senescence factor; the four recalibrated values and three
  new senescence constants live in the variables file. No new events, fields, or causes of death.
- Calibration is empirical and the validation target is concrete: a healthy run should show
  **illness ≫ suicide** (suicide ~1–3% of deaths) with the elderly dying of disease rather than
  suicide. Re-run the seed sweep in `docs/research-mortality.md` and confirm suicide share drops
  from ~80% to single digits and the population still turns over in old age (no immortality).
- Tests must cover: senescence is inert below the start age and declines above it; it floors so
  the very old can still recover; with it applied, an old low-constitution person's illness
  trends up while a healthy working-age person's trends down; the illness-death severity gate
  (zero illness → no illness death) still holds. Existing illness/suicide tests re-tune to the
  new values.
- Documentation: `CLAUDE.md` and `docs/odd-protocol.md` updated for the senescence recovery
  sub-model and the rebalanced mortality description.
- Cross-references: refines [ARD 018](./018-illness-live-state.md) (recovery gains a senescence
  factor; the live-state and independent-roll decisions are unchanged) and recalibrates the
  suicide constant from [ARD 019](./019-misfortune-illness-death-revision.md) (formula and
  severity-gating unchanged); relies on the age-mortality curve from
  [ARD 008](./008-age-modifiers.md) and interacts with the constitution decay in
  [ARD 048](./048-stat-caps-and-age-decay.md). Research basis: `docs/research-mortality.md`.
