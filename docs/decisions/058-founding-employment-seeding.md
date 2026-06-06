# ARD 058: Founding Employment Seeding

**Status:** Accepted
**Date:** 2026-06-06

## Context

`Person.hasJob` defaults to `false` and `Simulation.seed()` never sets it, so the founding
population is 100% unemployed at tick 0. Three consequences, none reflecting the dynamics
under study:

1. Every working-age adult takes the `HAPPINESS_UNEMPLOYED_PENALTY` (the happiness getter
   penalizes unemployment only for ages `WORKING_AGE_MIN..WORKING_AGE_MAX`), depressing
   early happiness and inflating early suicide pressure.
2. `employmentRate` starts at 0 and `JobEvent` must climb the whole population out of an
   artificial crater over the first dozen-plus ticks — an economic transient unrelated to
   collapse/thrive.
3. The starting state is demographically impossible: no going-concern society is fully
   jobless.

## Decision

At the end of `seed()` (after stats are drawn), seed employment among working-age persons
(`WORKING_AGE_MIN <= age <= WORKING_AGE_MAX`) toward a target rate, biased by employability
so it mirrors `JobEvent`'s gain logic rather than being uniform-random:

1. For each working-age person compute an employability score reusing `JobEvent`'s gain
   scalars: `experience·JOB_GAIN_EXPERIENCE_SCALAR + charisma·JOB_GAIN_CHARISMA_SCALAR`,
   multiplied by the education factor `(1 + education·EDUCATION_JOB_GAIN_SCALAR)`, plus a
   `rng()·SEED_EMPLOYMENT_SCORE_NOISE` jitter so ties break and employment isn't a pure
   deterministic ranking of stats.
2. Employ the top `round(SEED_EMPLOYMENT_RATE · workingAgeCount)` persons by score.

Children and persons above `WORKING_AGE_MAX` are left unemployed (not in school/retired) —
consistent with the happiness model, which applies no unemployment penalty outside working
age, and with `JobEvent`, whose work age profile makes job gain negligible for them.

New constants:
- `SEED_EMPLOYMENT_RATE` — target fraction of working-age persons employed at tick 0.
- `SEED_EMPLOYMENT_SCORE_NOISE` — magnitude of the random jitter added to the employability
  score; controls how much luck vs. stats decides who starts employed.

Reusing the existing `JOB_GAIN_*` / `EDUCATION_JOB_GAIN_SCALAR` constants (rather than new
ones) keeps the seed's notion of "employable" identical to the runtime's.

## Reasoning

**Alternative: flat random employment at the target rate (the "Flat target rate" option).**
Hits the rate but ignores that employability correlates with experience, charisma, and
education in `JobEvent`. It would seed a high-experience 40-year-old jobless as often as a
low-experience one, producing a starting economy inconsistent with the gain mechanic that
governs every subsequent tick. Ranking by the same score the runtime uses keeps seed and
runtime coherent.

**Alternative: leave everyone unemployed (status quo).** Keeps the artificial 0% crater and
its happiness/suicide/economic transient — the problem this ARD exists to remove.

**Alternative: per-person calibrated probability `p = RATE · scoreFactor` with a
reference-score constant.** Genuinely probabilistic, but holding the population mean at the
target requires a reference-score constant that must be re-tuned whenever the resource/age/
stat seed distributions shift (e.g. ARD 056/057). Rank-and-take-top-N hits the target rate
exactly and by construction, with no coupling to the other seed distributions.

## Consequences

**Files that change:**
- `src/App/Simulation.ts` — `seed()`: add a post-stat employment pass over working-age persons.
- `src/Helpers/Variables.ts` — add `SEED_EMPLOYMENT_RATE`, `SEED_EMPLOYMENT_SCORE_NOISE`.

**Tests:**
- `Simulation.test.ts`: after `seed()`, the employed fraction of working-age persons equals
  `round(SEED_EMPLOYMENT_RATE · workingAgeCount) / workingAgeCount`; no person with
  `age < WORKING_AGE_MIN` or `age > WORKING_AGE_MAX` has `hasJob === true`; with noise low,
  employed persons skew to higher experience/charisma than unemployed working-age persons.

**Side effects and known weaknesses:**
- The RNG sequence changes; prior results are not comparable.
- `round(rate · count)` employs an exact integer; for tiny working-age populations the
  realized rate can differ from the target by the rounding granularity (acceptable).
- Seeded jobs have no tenure memory, so `JobEvent`'s loss branch can shed some of them in the
  first ticks — intended; the seed sets the *level*, the runtime takes over the *churn*.
