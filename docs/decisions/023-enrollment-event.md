# ARD 023: Enrollment Event

**Status:** Accepted
**Date:** 2026-05-16

## Context

`GraduationEvent` (ARD 021) clears `isWorkingOnEd` to NONE at graduation. `Simulation.seed()` only seeds `isWorkingOnEd` for persons aged ≤24. After graduation — or for any over-24 person who was never seeded as a student — no mechanism exists to re-enroll. This means education flows only through the initial young cohort and then stops: no person who graduates or ages past 24 can ever accumulate the education experience bonus again, and the job education multiplier (ARD 022) never helps anyone who wasn't lucky enough to be young at seed time.

Real-world: adults 25+ are 32% of total US college enrollment (NCES). Per-tick enrollment flow at 25–29 is ~2–2.5%; at 35–44 it is ~0.5%. Ignoring adult enrollment understates education's ongoing role in the collapse/thrive dynamics. See `docs/research-education.md`.

## Decision

Add a new `EnrollmentEvent` class (implements `IEvent`). In `EventFactory`, push it when the person is not enrolled, has not reached the top credential, and the enrollment roll passes:

```typescript
if (person.isWorkingOnEd === Constants.EDUCATION.NONE
    && person.education < Constants.EDUCATION.PHD
    && this.rng() < Variables.BASE_ENROLLMENT_RATE
        * person.learningIntent
        * ageModifier(person.age, Variables.ENROLLMENT_PEAK_AGE, Variables.ENROLLMENT_AGE_SCALE, Variables.ENROLLMENT_AGE_FLOOR)) {
  events.push(new EnrollmentEvent());
}
```

`EnrollmentEvent.execute()`:

```typescript
person.isWorkingOnEd = person.education + 1;
```

The person pursues the next level above their current credential. A person with `education = NONE` enrolls in HIGH_SCHOOL; a bachelor's graduate enrolls in a master's program; and so on. Employment (`hasJob`) does not block enrollment.

New constants in `Variables.ts` (values are calibration placeholders):

| Constant | Rationale |
|---|---|
| `BASE_ENROLLMENT_RATE` | Sets the per-tick enrollment probability ceiling; scaled down by `learningIntent` and `ageModifier` to match the empirical ~2–3% per-tick flow for peak-age adults |
| `ENROLLMENT_PEAK_AGE` | Age at which enrollment probability is highest; set near traditional college-entry age while accommodating adult learners |
| `ENROLLMENT_AGE_SCALE` | Controls how steeply enrollment falls with age; should be flatter than graduation — adult enrollment persists meaningfully into the 30s and 40s |
| `ENROLLMENT_AGE_FLOOR` | Non-zero minimum; some persons enroll in education late in life |

## Reasoning

**`learningIntent` gating over unconditional.** Research shows adult re-enrollment is strongly driven by self-motivation: career advancement (~39%) and personal growth (~two-thirds of adult learners). `learningIntent` is the closest available proxy. An unconditional base rate would enroll indiscriminate persons — those with `learningIntent ≈ 0` would enroll and then fail to engage (`ExperienceEvent` education bonus requires enrollment, but `LearnEvent` requires intent; low-intent students gain the experience bonus without the intelligence gains). Gating on intent keeps the two systems consistent.

**Employment does not block enrollment.** 70%+ of US college students have worked simultaneously for the past 25 years (Georgetown CEW). Blocking enrollment for employed persons would eliminate the most common adult learner profile. `ExperienceEvent` already handles the overlap: the education bonus takes precedence over the employment bonus when `isWorkingOnEd !== NONE`.

**Next level up (`education + 1`) over fixed level.** Re-taking a credential already held has no real-world parallel and would create a feedback loop where graduates of the highest seeded level perpetually re-enroll in the same program. The ladder model (NONE→HS→BS→MS→PhD) maps directly to the EDUCATION enum values and produces natural credential progression.

**Separate `EnrollmentEvent` class over inline `Simulation.seed()` fix.** Seeding over-24 persons with `education` values (noted in `docs/future-ideas.md`) addresses only the initial state; it does nothing for persons who graduate mid-simulation or for persons whose life circumstances change. An ongoing event gives education a live signal throughout the run rather than a one-time startup patch.

## Consequences

- `src/Events/EnrollmentEvent.ts` — new file implementing `IEvent`
- `src/Events/EventFactory.ts` — add conditional `EnrollmentEvent` push; before the `GraduationEvent` block so a person can enroll and graduate in the same tick only if they were already enrolled at tick start (enrollment sets `isWorkingOnEd`, graduation clears it — ordering ensures they cannot fire in the same tick for the same person)
- `src/Helpers/Variables.ts` — four new constants as listed above
- `src/tests/Events/EnrollmentEvent.test.ts` — tests must cover: non-enrolled person below PHD enrolls in `education + 1` on execute; PHD holder is never pushed by EventFactory; already-enrolled person is never pushed by EventFactory; `education = NONE` person enrolls in HIGH_SCHOOL; employment does not prevent enrollment (verify EventFactory pushes event for employed person)
- `docs/research-education.md` — already updated with adult enrollment data
- `docs/future-ideas.md` — "Seed `education` for persons over 24" remains a distinct concern (ongoing enrollment doesn't fix the first-decade warmup for persons who should already have credentials at seed time)
