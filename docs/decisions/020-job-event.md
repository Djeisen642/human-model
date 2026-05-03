# ARD 020: Job Gain and Loss

**Status:** Accepted
**Date:** 2026-05-03

## Context

`Person.hasJob` exists and already affects two systems: `happiness` (±5/−3 for working-age adults, ARD 014) and `ExperienceEvent` (`EMPLOYMENT_EXPERIENCE_BONUS` each tick, ARD 017). Nothing sets `hasJob` after seeding. The field is randomised at startup but never changes during the simulation, so employment is static — a person hired at tick 0 stays employed forever, and vice versa. This removes one of the primary inequality levers: differential access to employment and the compounding advantage it creates.

## Decision

Add a single `JobEvent` (unconditional) that handles both gain and loss each tick.

**Gain** — fires when `person.hasJob === false`:

```typescript
const gainProb = (person.experience * JOB_GAIN_EXPERIENCE_SCALAR
                + person.charisma   * JOB_GAIN_CHARISMA_SCALAR)
               * ageModifier(person.age, WORK_PEAK_AGE, WORK_AGE_SCALE, WORK_AGE_FLOOR);
if (rng() < gainProb) person.hasJob = true;
```

**Loss** — fires when `person.hasJob === true`:

```typescript
const lossProb = JOB_LOSS_BASE
               + JOB_LOSS_STAT_SCALAR * (1 / (person.experience + 1))
                                      * (1 / (person.charisma   + 1));
if (rng() < lossProb) person.hasJob = false;
```

New constants in `Variables.ts` (all calibration placeholders):

| Constant | Value | Rationale |
|---|---|---|
| `JOB_GAIN_EXPERIENCE_SCALAR` | `0.01` | At experience=25 contributes 0.25 to gain prob; high baseline |
| `JOB_GAIN_CHARISMA_SCALAR` | `0.02` | At charisma=5 contributes 0.10; social skill matters more per unit |
| `JOB_LOSS_BASE` | `0.02` | ~2% flat loss rate per tick; models random economic shocks |
| `JOB_LOSS_STAT_SCALAR` | `0.5` | At avg stats (~25 exp, ~5 cha) adds ~0.003; at low stats (1,1) adds ~0.125 |

The work age profile (`WORK_PEAK_AGE = 35`, `WORK_AGE_SCALE = 40`, `WORK_AGE_FLOOR = 0.1`) is already defined in `Variables.ts` (ARD 008). No hard age cutoffs — the floor of 0.1 means children and elderly have a small but non-zero probability, consistent with pre-modern labour patterns.

`JobEvent` is inserted into the unconditional event list in `EventFactory`, before `MisfortuneEvent` so that the employment bonus feeds into the same tick's downstream effects.

## Reasoning

**Experience + charisma over experience alone.** Charisma is currently unused. Job-getting is the natural first home for it — hiring is social. Using both stats keeps them distinctly meaningful: intelligence drives knowledge accumulation, experience drives productive output, charisma drives social access to opportunity.

**Blend for loss over pure stat-inverse.** A symmetric inverse of gain would make job loss purely meritocratic. Real job loss has a random component — restructuring, economic downturns, bad luck — that a flat base rate captures. The stat-inverse term still means low-capability people churn more, but even high-stat people face a residual loss rate. Without the flat base, high-experience/charisma people effectively have permanent employment once hired, which removes an important volatility channel.

**Single file over JobGainEvent + JobLossEvent.** Gain and loss share the same constants and the same age profile. Splitting them would duplicate those references without adding testability or supersession clarity — any revision to the formula would touch both files anyway.

**No hard age cutoffs.** Every other event uses `ageModifier()` without hard bounds. Cutting at 18/65 would bake modern labour law into a civilisation-spanning simulation. The work age profile already suppresses early-childhood and elderly employment to low probability via the floor.

**Education deferred.** Education tier is an intuitive multiplier on gain probability — higher education opens better job markets. Implementing it now would create a hard dependency on `GraduationEvent`, which isn't yet built. Deferred to `docs/future-ideas.md`.

## Consequences

- `src/Events/JobEvent.ts` — new file implementing `IEvent`
- `src/Events/EventFactory.ts` — import and insert `JobEvent` into unconditional list, before `MisfortuneEvent`
- `src/Helpers/Variables.ts` — four new constants: `JOB_GAIN_EXPERIENCE_SCALAR`, `JOB_GAIN_CHARISMA_SCALAR`, `JOB_LOSS_BASE`, `JOB_LOSS_STAT_SCALAR`
- `src/tests/Events/JobEvent.test.ts` — tests must cover: unemployed person gains job when `rng()` is below threshold; employed person loses job when `rng()` is below threshold; neither fires when `rng()` is above threshold; gain probability increases with higher experience and charisma; loss probability decreases with higher experience and charisma; age modifier suppresses probability at extreme ages
- No changes to `Person`, `Simulation`, or records — `hasJob` is already a field; no record type is needed for employment transitions
