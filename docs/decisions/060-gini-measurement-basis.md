# ARD 060: Gini Measured Over Adults, Not All Living

**Status:** Proposed
**Date:** 2026-09-14

## Context

`Simulation.snapshot()` computes `resourceGini` over every living person's `resources`, and
`KillEvent.execute()` independently recomputes the same quantity over the same population to drive
the inequality→violence multiplier. That population includes dependent children, and the model
treats a child's `resources` as *not* being their standard of living everywhere else:

- newborns enter at 0 (ARD 037) and founding minors are seeded at 0 (ARD 057);
- `ConsumptionEvent` charges children a token fraction of their own resources rather than the flat
  adult rate, explicitly because parents subsidise them (ARD 024);
- `Person.happiness` substitutes the *parents'* average resources for a child's own (ARD 014).

So the headline collapse signal is computed over a quantity the rest of the model declines to treat
as welfare. The consequence is that measured inequality mixes adult inequality with the dependency
ratio: a society whose adults are equal reads as unequal simply for having children, and because
population growth raises the child share, growth pushes the number up on its own. ARD 051's
THRIVING gate wants low Gini *and* a population at its peak, so the two conditions are partly
fighting each other for a reason unrelated to inequality.

Measured across 600 decade-observations of default-config runs
(`docs/research-thriving-reachability.md`): the gap between the two bases is negligible below a 5%
child share, peaks at a median of +0.086 in the 25–35% band, and reaches +0.19 at the extreme. In
6.7% of decades the adult population is below the THRIVING threshold while the all-living number is
not — the pathology fires, but it is a minority case, not the dominant reason THRIVING is rare.

## Decision

Measure the Gini coefficient over persons at or above `WORKING_AGE_MIN`, and use that one
definition everywhere the model speaks of inequality: the per-tick snapshot that feeds reporting and
outcome classification, and `KillEvent`'s inequality→violence multiplier. The selection lives in one
shared helper so the two call sites cannot drift apart.

When no adults are alive the coefficient is 0, consistent with the existing empty-input behaviour.

No new constants. ARD 051's three Gini thresholds are re-derived on the new basis rather than
carried over: each is moved to the value occupying the same quantile of the adult-basis distribution
that it occupied on the all-living distribution, measured against a reference set of default-config
runs. This preserves what each label was calibrated to mean instead of silently loosening every
verdict. The derived values live in `Variables.ts`; the measurement backing them is recorded in
`docs/research-thriving-reachability.md`.

## Reasoning

**Rejected: keep the all-living basis.** The defence would be that children's poverty is real and a
society with many destitute dependents *is* unequal. But the model already rejects that reading of a
child's `resources` field in three separate places (consumption, happiness, seeding). Measuring
inequality over a number the model itself refuses to treat as a child's welfare is incoherent, and
the incoherence is load-bearing because it couples the inequality signal to the birth rate.

**Rejected: working-age only (18–65).** Closer to a market-income measure and it would also remove
retirees' drawdown from the signal. It loses because elderly poverty is something this model
deliberately represents — `HAPPINESS_RESOURCE_*_ELDERLY` thresholds are set higher than the adult
ones and `CONSUMPTION_ELDER_MULTIPLIER` charges the old more, so an impoverished elderly cohort is a
genuine inequality the signal should see. Excluding them would hide a real failure mode in a model
whose mortality is concentrated in old age (ARD 049).

**Rejected: household Gini with pooled resources.** This is how real Gini is reported and it would
handle dependants correctly by construction. It loses on scope: the model has no household. ARD 025
explicitly deferred resource pooling between partners, so adopting household Gini would bundle a
resource-pooling decision into a measurement change, and the pooling decision has its own
consequences for `StealEvent`, `ChildbirthEvent`'s resource factor, and estate distribution (ARD
042). Worth revisiting if partner pooling is ever built.

**Rejected: add adult Gini alongside and leave the signal alone.** Safest, and it would let existing
research remain directly comparable. It loses because it does not fix anything — the model would
carry two numbers both called Gini, the collapse verdict would still key off the one with the known
defect, and the next reader would have to learn which is which.

**Rejected: change reporting and classification only, leaving `KillEvent` on the all-living basis.**
This would avoid any change to simulation dynamics, which is a real benefit for comparability. It
loses because `KillEvent`'s multiplier represents *perceived social inequality* driving violence —
the same construct the report claims to measure. Two different numbers for one construct is exactly
the kind of thing a future reader would have to guess about.

**On the quantile-preserving recalibration.** The alternative is a fixed offset subtracted from each
threshold. That fails because the gap between the bases is not constant — it varies from ~0 to ~0.19
with the child share, so any single offset is wrong across most of the range. Quantile preservation
asks the narrower question the thresholds actually encode: what share of observed states should each
label claim.

## Consequences

- `Simulation.snapshot()` and `KillEvent.execute()` both route through a shared adult-resources
  selection; the `gini()` helper itself is unchanged.
- `Variables.ts` — `THRIVING_GINI_THRESHOLD`, `STRUGGLING_GINI_THRESHOLD` and
  `COLLAPSE_GINI_THRESHOLD` take their re-derived values. The two lower thresholds move down; the
  upper tails of the two distributions coincide, so the COLLAPSE threshold is expected to stand.
- **Simulation dynamics change.** Adult Gini reads at or below the all-living value in ~87% of
  decades, so `KillEvent`'s multiplier weakens slightly and murder rates fall marginally. In the
  remaining ~13% the adult basis reads *higher* — children can hold more than the poorest adults
  once welfare and estates (ARD 042) have moved resources around — so the effect is not uniformly
  one-directional.
- Tests must cover: children are excluded from the coefficient; changing a child's resources does
  not move it; a population with no living adults yields 0; a population of adults only is
  unchanged from current behaviour; `KillEvent` and `snapshot()` report the same value for the same
  population. Existing Gini assertions in `Simulation.test.ts` and `KillEvent.test.ts` need their
  fixtures revisited, since several seed children with resources.
- `docs/odd-protocol.md` — the purpose statement, the `TickSnapshot` observation list, and
  `KillEvent`'s attempt formula all describe Gini over the whole population and must be updated.
- **Historical research numbers break.** Every Gini figure in `docs/research-*.md` predating this
  ARD is on the all-living basis. Per the documentation convention, those are annotated with a dated
  note rather than deleted or recomputed.
- Builds on [ARD 051](./051-multidimensional-outcome-classification.md) (whose thresholds are
  recalibrated) and reads the child-subsidy treatment established by
  [ARD 024](./024-consumption-event.md), [ARD 014](./014-happiness-model-revision.md) and
  [ARD 057](./057-founding-resource-distribution.md). Modifies the signal
  [ARD 027](./027-kill-event.md) consumes. Resolves the "Resource Gini counts dependent children's
  structural zeros" item in `docs/future-ideas.md`.
