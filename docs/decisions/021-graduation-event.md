# ARD 021: Graduation Event

**Status:** Accepted
**Date:** 2026-05-16

## Context

`Person.education` and `Person.isWorkingOnEd` both exist (type: `Constants.EDUCATION` numeric tier). `ExperienceEvent` already grants `EDUCATION_EXPERIENCE_BONUS` each tick when `isWorkingOnEd !== NONE` (ARD 017). But `education` is never written anywhere — no event transitions `isWorkingOnEd` to `education`, and no code reads `education`. The field is inert. `Simulation.seed()` also leaves `isWorkingOnEd` at NONE for everyone, so no person ever accumulates the education bonus. Without enrollment seeding and a graduation transition, education is entirely disconnected from collapse/thrive dynamics.

## Decision

### Enrollment seeding

In `Simulation.seed()`, after `person.age` is set, assign `isWorkingOnEd` based on age:

- Age ≤ `GRADUATION_HS_MAX_AGE` (17): `isWorkingOnEd = HIGH_SCHOOL` with probability `GRADUATION_HS_SEED_RATE` (0.7)
- Age ≤ `GRADUATION_COLLEGE_MAX_AGE` (24): `isWorkingOnEd = BACHELORS` with probability `GRADUATION_COLLEGE_SEED_RATE` (0.4)
- Older persons: `isWorkingOnEd` remains `NONE`

Persons older than 24 start with `education = NONE`. This is the same simplification used by `hasJob` (everyone starts unemployed and builds employment via `JobEvent`). The first decade of the simulation bootstraps both systems from scratch; this is an acceptable model warmup cost.

### Graduation mechanic

`GraduationEvent` is added to the event list in `EventFactory` when the person is enrolled and the graduation roll passes:

```typescript
if (person.isWorkingOnEd !== Constants.EDUCATION.NONE
    && this.rng() < Variables.BASE_GRADUATION_RATE
        * ageModifier(person.age, Variables.GRADUATION_PEAK_AGE, Variables.GRADUATION_AGE_SCALE, Variables.GRADUATION_AGE_FLOOR)) {
  events.push(new GraduationEvent());
}
```

`GraduationEvent.execute()`:

```typescript
person.education = person.isWorkingOnEd;
person.isWorkingOnEd = Constants.EDUCATION.NONE;
person.intelligence += 1;
```

No re-enrollment after graduation. The person stops being a student.

### New constants in `Variables.ts`

| Constant | Value | Rationale |
|---|---|---|
| `BASE_GRADUATION_RATE` | `0.2` | 5-tick average completion at peak age; calibrated against the finding that 44% of US bachelor's students finish in ≤4 years and the 6-year completion rate is ~64% (NCES) |
| `GRADUATION_PEAK_AGE` | `22` | Modal bachelor's graduation age in the US |
| `GRADUATION_AGE_SCALE` | `30` | Moderate falloff; adult learners (age 30–40) still graduate at roughly half the peak rate |
| `GRADUATION_AGE_FLOOR` | `0.15` | Elderly enrolled persons retain a small but non-zero chance each tick |
| `GRADUATION_HS_MAX_AGE` | `17` | Upper age for high-school enrollment seeding |
| `GRADUATION_COLLEGE_MAX_AGE` | `24` | Upper age for college enrollment seeding |
| `GRADUATION_HS_SEED_RATE` | `0.7` | ~86% of US 15–17 year-olds are enrolled; 0.7 is a conservative proxy accounting for early dropouts |
| `GRADUATION_COLLEGE_SEED_RATE` | `0.4` | ~39% of US 18–24 year-olds are enrolled in college (NCES 2022) |

## Reasoning

**Per-tick probability over fixed duration.** Fixed duration would require tracking enrollment-start tick — a new field on `Person` — and level-specific duration constants (HS=4 ticks, BS=4, MS=2, PhD=5). The per-tick model produces a realistic distribution of completion times without additional state, and handles dropout implicitly (students who die before rolling a graduation are non-completers, as in the real world). `BASE_GRADUATION_RATE = 0.2` yields an average of 5 ticks to graduate at peak age, within the empirical 4–6 year range.

**No `learningIntent` gating on graduation.** `learningIntent` already gates `LearnEvent` and scales the intelligence contribution to `ExperienceEvent`. Adding it to graduation probability would penalize low-intent students twice: they already fall behind during enrollment (fewer `LearnEvent` fires, slower experience growth). The graduation roll represents sustained academic work accumulated over many ticks — a per-tick motivation pull is the wrong model for a multi-year commitment.

**Intelligence +1 at graduation.** A 2018 meta-analysis (Ritchie & Tucker-Drob, n=600k) finds 1–5 IQ points per additional year of education. A degree represents ~4–5 years; +1 on the sim's 1–10 intelligence scale is conservative and proportionally grounded. The compounding downstream effect (intelligence → experience growth → resources) makes the real payoff larger than the direct stat change.

**No auto-advance to next education level.** After graduating, `isWorkingOnEd = NONE`. Pursuing a master's after a bachelor's is a distinct enrollment decision that belongs in a future event, not the graduation transition. Building it now would require modeling enrollment motivation and cost without validated mechanics.

**Seed only HIGH_SCHOOL and BACHELORS.** TRADE_SCHOOL, MASTERS, and PHD are valid enum values but distinguishing their seeding rates requires finer demographic data and adds constants without a clear payoff yet. The two-level seed captures the primary enrollment population; higher degrees can be seeded when a differentiated payoff warrants it.

## Consequences

- `src/Events/GraduationEvent.ts` — new file implementing `IEvent`
- `src/App/Simulation.ts` — `seed()` adds enrollment logic after `person.age` is set
- `src/Events/EventFactory.ts` — adds conditional `GraduationEvent` push; import `Constants`
- `src/Helpers/Variables.ts` — eight new constants as listed above
- `src/tests/Events/GraduationEvent.test.ts` — tests must cover: enrolled person graduates when `rng()` is below threshold; `education` is set to the prior `isWorkingOnEd` value; `isWorkingOnEd` is reset to NONE; `intelligence` increments by 1; non-enrolled person never triggers graduation in `EventFactory`; age modifier suppresses graduation probability at extreme ages
- `src/tests/App/Simulation.test.ts` — extend seeding tests: persons aged ≤17 receive `isWorkingOnEd = HIGH_SCHOOL` at the expected rate; persons aged 18–24 receive `isWorkingOnEd = BACHELORS` at the expected rate; persons aged ≥25 have `isWorkingOnEd = NONE`
- `docs/future-ideas.md` — move "Education payoff on stats" from Required to Discarded (resolved by this ARD and ARD 022)
- `CLAUDE.md` — update "What's implemented" and remove graduation from "What's not implemented yet" when code lands
