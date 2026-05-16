# ARD 022: Job Event Education Multiplier

**Status:** Accepted
**Date:** 2026-05-16

## Context

ARD 020 (`JobEvent`) explicitly deferred education tier as a multiplier on job-gain probability, pending `GraduationEvent`. ARD 021 now defines graduation mechanics and establishes `person.education` as a written field. The dependency is satisfied.

The current gain formula uses only `experience`, `charisma`, and `ageModifier`. US Bureau of Labor Statistics data shows an employment rate of 88% for bachelor's-degree holders vs. 60% for those without a high school diploma — a ~1.47× ratio. Without this multiplier, education has no effect on job access, breaking the education → employment → resources chain that is the primary mechanism by which education affects income inequality (Gini).

## Decision

Add an education multiplier to the gain branch in `JobEvent`:

```typescript
const educationMultiplier = 1 + person.education * Variables.EDUCATION_JOB_GAIN_SCALAR;
const gainProb = (person.experience * Variables.JOB_GAIN_EXPERIENCE_SCALAR
               + person.charisma   * Variables.JOB_GAIN_CHARISMA_SCALAR)
              * ageModifier(person.age, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR)
              * educationMultiplier;
```

New constant in `Variables.ts`:

| Constant | Value | Rationale |
|---|---|---|
| `EDUCATION_JOB_GAIN_SCALAR` | `0.15` | At BACHELORS (3): multiplier = 1.45; at HIGH_SCHOOL (1): 1.15. Calibrated to the empirical ~1.47× employment rate ratio between BA+ and no-diploma populations (BLS). Calibration placeholder. |

No change to the job-loss formula. Education does reduce unemployment risk empirically (re-employment probability rises ~6–7 points per additional year of schooling), but the loss formula already captures this indirectly — educated persons accumulate higher experience and charisma, which suppresses the stat-inverse loss term. A direct education multiplier on loss would double-count.

## Reasoning

**Multiplicative over additive.** An additive term (e.g., `gainProb += education * scalar`) would be dominated by the experience/charisma terms at high stats, making education irrelevant for capable workers. A multiplicative term scales proportionally — education improves job access at all stat levels, consistent with empirical findings that education benefits are not confined to low-skill workers.

**NONE (0) as a transparent baseline.** At `education = NONE`, `educationMultiplier = 1.0`, leaving the ARD 020 formula unchanged. No existing calibration is disrupted; the multiplier is additive in effect only above NONE.

**No education effect on job loss.** Experience and charisma both rise through the enrollment period (ExperienceEvent education bonus, LearnEvent intelligence→experience chain). Education's job-retention benefit is already mediated through those stats. Adding a direct education multiplier to the loss formula would create double-counting and make loss probability harder to reason about.

## Consequences

- `src/Events/JobEvent.ts` — compute `educationMultiplier` and apply it to `gainProb` in the gain branch only
- `src/Helpers/Variables.ts` — one new constant: `EDUCATION_JOB_GAIN_SCALAR`
- `src/tests/Events/JobEvent.test.ts` — extend existing tests: gain probability is higher for a person with `education = BACHELORS` than the same person with `education = NONE`; `education = NONE` produces the same result as the pre-ARD 022 formula
- No changes to `Person`, `Simulation`, records, or `EventFactory`
