# ARD 057: Founding Resource Distribution — Child Subsidy and Compressed Adult Wealth

**Status:** Accepted
**Date:** 2026-06-06

## Context

`Simulation.seed()` draws `resources` uniformly on `[0, 100)` for *every* seeded person,
children included. Two problems follow from the project's treatment of resource Gini as
the primary collapse signal:

1. **Rich toddlers.** A seeded 2-year-old can hold 95 personal resources while their
   assigned parents hold 5. This contradicts the rest of the model: `ChildbirthEvent`
   newborns start at 0 (ARD 037), the happiness getter and `ConsumptionEvent` treat
   children as parentally subsidized (they read living-parents' resources, not the child's),
   and welfare targets children with no resources. Only the seed mints independently wealthy
   children.
2. **Artificial adult inequality.** A uniform `[0, 100)` draw has a Gini of ≈0.33. The run
   therefore *begins* at moderate inequality purely from the seed shape, not from any
   emergent dynamic — contaminating the one metric the project most cares about reading.

## Decision

Split resource seeding by life stage:

- **Children** (`age < WORKING_AGE_MIN`) seed with `resources = 0`. They are parentally
  subsidized exactly as newborns and the consumption/happiness model already assume; their
  zero is a real structural dependency, not missing wealth. This also makes the seed's
  contribution to Gini consistent with what the running model produces once births dominate
  (newborns already enter at 0 and count in the Gini).
- **Adults** (`age >= WORKING_AGE_MIN`) seed from a compressed band centered on
  `SEED_ADULT_RESOURCES_MEAN` with relative half-width `SEED_ADULT_RESOURCES_SPREAD`, i.e. a
  uniform draw on `[mean·(1 − spread), mean·(1 + spread))`. The Gini of that band is
  `spread/3`, so `SEED_ADULT_RESOURCES_SPREAD` is the direct knob on starting *adult*
  inequality — chosen low so the run starts near resource parity and any inequality that
  appears is emergent.

New constants:
- `SEED_ADULT_RESOURCES_MEAN` — central starting wealth for adults.
- `SEED_ADULT_RESOURCES_SPREAD` — relative half-width of the adult band; sets seed-time adult
  Gini (`= spread/3`).

The `drawField` personType override path is unchanged: a type that declares a `resources`
range still gets its explicit `[min, max)`; only the default (no-override) behavior splits
by life stage.

## Reasoning

**Alternative: children 0, adults keep uniform `[0, 100)` (the "Children 0, adults uniform"
option).** Fixes the rich-toddler case but leaves the ≈0.33 artificial adult Gini — the more
damaging of the two problems, since Gini is the collapse signal. Compressing the adult band
is the half that actually de-contaminates the metric.

**Alternative: seed a right-skewed (lognormal) adult distribution to mimic real-world
wealth inequality.** Superficially more realistic, but it *reintroduces* high starting Gini
by construction — the exact artefact we are removing. The model is meant to *generate*
inequality from kill/steal/inheritance dynamics; seeding it in would make emergent and
seeded inequality indistinguishable. Start near parity and let the mechanisms do the work.

**Alternative: give children a small nonzero allowance instead of 0.** Rejected for
consistency: newborns already enter at 0 and the consumption path keys child support off
`livingParents`, not the child's own balance. A nonzero child seed would be the only place in
the model where dependent children hold independent wealth.

## Consequences

**Files that change:**
- `src/App/Simulation.ts` — `seed()`: branch the default `resources` draw on
  `age < WORKING_AGE_MIN` (→ 0) vs. adult (→ compressed band).
- `src/Helpers/Variables.ts` — add `SEED_ADULT_RESOURCES_MEAN`, `SEED_ADULT_RESOURCES_SPREAD`.

**Tests:**
- `Simulation.test.ts`: seeded children (`age < WORKING_AGE_MIN`) have `resources === 0`;
  seeded adult resources fall within `[mean·(1−spread), mean·(1+spread))`; the Gini of the
  adult-only resource vector is approximately `spread/3` at large `n`.

**Side effects and known weaknesses:**
- The RNG sequence changes; prior results are not comparable.
- The *overall* tick-0 Gini (children + adults) will reflect the child-dependency zeros, just
  as the running model's Gini does once births accumulate — this is intended consistency, not
  a regression. Reports that want adult-only inequality already have the survivor breakdown.
- Orphaned seeded children (no eligible parent assigned in ARD 052's pass) now start at 0 and
  pay full consumption, leaning harder on the thin early community pool — the same weakness
  ARD 052 already flagged, slightly sharpened. Acceptable: orphan rate at seed is low and
  welfare (ARD 034) is the intended backstop.
