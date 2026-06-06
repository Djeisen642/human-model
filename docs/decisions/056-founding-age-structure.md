# ARD 056: Tapering Founding Age Structure

**Status:** Accepted
**Date:** 2026-06-06

## Context

`Simulation.seed()` draws age uniformly on `[SEED_AGE_FLOOR, 50)` (the literal `50`
is hardcoded at the `drawField(rng, 'age', …)` call). ARD 052 lowered the floor to
admit children but left two artefacts:

1. **No elders.** The hard cap of 50 means the senescence machinery built for old age
   — illness-recovery senescence (ARD 049), age-based stat decay (ARD 048), the
   U-shaped `ageMortalityModifier`, the elderly consumption multiplier and happiness
   thresholds — never engages at seed. The founding population has to *age into* the
   regime the model is largely about.
2. **Flat pyramid.** A uniform draw seeds as many 49-year-olds as 5-year-olds. No real
   demography is flat; the over-weighted top of the distribution concentrates the
   founding cohort and feeds the synchronized boom-bust wave ARD 052 already noted.

## Decision

Replace the uniform age draw with a monotonically tapering distribution (more young,
fewer old) spanning `[SEED_AGE_FLOOR, SEED_AGE_MAX]`. Age is drawn by transforming a
uniform variate `u` through a power curve, `age = SEED_AGE_FLOOR + (SEED_AGE_MAX −
SEED_AGE_FLOOR) · u^SEED_AGE_DISTRIBUTION_EXPONENT`, floored to an integer. An exponent
above 1 concentrates draws toward the floor, yielding an expansive pyramid that tapers
smoothly to `SEED_AGE_MAX`; the exponent is the single knob on how steep the taper is.

New constants:
- `SEED_AGE_MAX` — oldest seedable age; replaces the hardcoded `50`. Set high enough that
  elders are present and the senescence mechanisms engage from tick 0.
- `SEED_AGE_DISTRIBUTION_EXPONENT` — power applied to the uniform variate; `>1` skews
  young and controls taper steepness. `1` reproduces a uniform draw over the new range.

`SEED_AGE_FLOOR` is unchanged. Education seeding already branches on age thresholds and
needs no change; the older ages it now sees fall through to the existing adult-education
hierarchy.

## Reasoning

**Alternative: keep uniform, only raise the cap (the "Uniform, extend to ~80" option).**
This admits elders but keeps a flat pyramid — equal numbers of toddlers and
octogenarians. That *over*-weights the old relative to any real population and inverts the
fertility base (too few young relative to old), making the founding cohort top-heavy and
the boom-bust wave worse, not better. The taper is the part that matters; extending the
cap alone trades one unrealistic shape for another.

**Alternative: seed from an empirical age-structure table (census pyramid).** More
faithful, but bakes a country/year-specific lookup table into `Variables.ts`, is brittle
to maintain, and buys precision the model does not need — the simulation studies dynamics,
not a specific nation's census. A one-parameter power taper captures "more young, fewer
old" with a single tunable constant and no external data dependency.

## Consequences

**Files that change:**
- `src/App/Simulation.ts` — `seed()`: replace the uniform `age` draw with the power-taper
  transform over `[SEED_AGE_FLOOR, SEED_AGE_MAX]`. The `drawField` override path for
  `age` (personTypes) still applies its own `[min, max)`; only the default bounds/shape change.
- `src/Helpers/Variables.ts` — add `SEED_AGE_MAX`, `SEED_AGE_DISTRIBUTION_EXPONENT`.

**Tests:**
- `Simulation.test.ts`: all seeded ages lie within `[SEED_AGE_FLOOR, SEED_AGE_MAX]`; with a
  large `n` the population contains persons above `WORKING_AGE_MAX` (elders exist) and the
  count of young (`< WORKING_AGE_MIN`) exceeds the count of elders (taper holds); median age
  is below the midpoint of the range (skew is young).

**Side effects and known weaknesses:**
- The RNG sequence for a given seed changes; prior sweep/research results are not comparable
  across this change (note in any research doc re-run afterward).
- Elders now present at tick 0 raise early illness/old-age mortality (intended — the model
  should exercise senescence immediately rather than after a warm-up).
- A power taper is a smooth monotonic decline, not a true pyramid with a child-mortality
  notch or a retirement bulge; it is deliberately the simplest shape that fixes the flat-top
  artefact. Replacing it with a richer distribution is a future ARD if the demography proves
  too coarse.
