# ARD 017: Experience Growth and Decay

**Status:** Proposed
**Date:** 2026-05-02

## Context

`Person.experience` is randomized in `Simulation.seed()` to `[0, age]` and then never updated, despite being the primary multiplier in `GatherResourcesEvent` (ARD 011). A 90-year-old carries the experience they were assigned at age 15 for life. The field is treated as time-accumulating but is in fact static — a latent bug.

Fixing it is non-obvious because experience interacts with several yet-to-be-implemented mechanics (education, employment, idleness) and with `intelligence` ("can't teach an old dog new tricks").

## Decision

Add a new unconditional event, `ExperienceEvent`, fired once per living person per tick:

```typescript
let growth = Variables.BASE_EXPERIENCE_GROWTH;
if (person.age < Variables.EXPERIENCE_CHILDHOOD_AGE) {
  growth *= Variables.EXPERIENCE_CHILDHOOD_FACTOR;
}

const intelligenceFade = ageModifier(
  person.age,
  Variables.LEARNING_PEAK_AGE,
  Variables.LEARNING_AGE_SCALE,
  Variables.LEARNING_AGE_FLOOR,
);
growth += person.intelligence * Variables.INTELLIGENCE_EXPERIENCE_SCALAR * intelligenceFade;

if (person.isWorkingOnEd) {
  growth += Variables.EDUCATION_EXPERIENCE_BONUS;
} else if (person.hasJob) {                                   // see Job dependency below
  growth += Variables.EMPLOYMENT_EXPERIENCE_BONUS;
} else if (person.age >= Variables.EXPERIENCE_ELDERLY_AGE) {
  growth -= Variables.ELDERLY_IDLENESS_DECAY;
} else {
  growth -= Variables.ADULT_IDLENESS_DECAY;
}

person.experience = Math.max(
  0,
  Math.min(Variables.EXPERIENCE_CAP, person.experience + growth),
);
```

**Constants (placeholders pending calibration):**

| Constant | Initial | Rationale |
|---|---|---|
| `BASE_EXPERIENCE_GROWTH` | `1.0` | One year of experience per year lived. |
| `EXPERIENCE_CHILDHOOD_AGE` | `5` | Below this, growth is attenuated. |
| `EXPERIENCE_CHILDHOOD_FACTOR` | `0.2` | Pre-5 grows at 1/5 the rate. |
| `INTELLIGENCE_EXPERIENCE_SCALAR` | `0.05` | At intelligence=10, peak fade=1.0, boost is +0.5/tick. |
| `EDUCATION_EXPERIENCE_BONUS` | `0.5` | School accelerates experience. |
| `EMPLOYMENT_EXPERIENCE_BONUS` | `0.3` | Work accelerates, slightly less than school. |
| `ADULT_IDLENESS_DECAY` | `0.5` | Working-age unemployed lose half a year per tick. |
| `ELDERLY_IDLENESS_DECAY` | `0.2` | Retirees decay slower. |
| `EXPERIENCE_ELDERLY_AGE` | `65` | Matches happiness elderly threshold. |
| `EXPERIENCE_CAP` | `50` | Career-length ceiling; prevents centenarian dominance. |

**Seeding:** `Simulation.seed()` clamps to `[0, min(age, EXPERIENCE_CAP)]`.

**Intelligence fade reuses the learning age curve** (`LEARNING_*` constants) — same shape, single anchor.

**Wiring:** `EventFactory` returns `ExperienceEvent` unconditionally. Order: AgeEvent → ExperienceEvent → GatherResourcesEvent → MisfortuneEvent. Age update visible to experience update; experience update visible to gather.

## Reasoning

**Time-based growth with intelligence as accelerator.** Two alternatives rejected:

1. *Pure time-based* (`experience += 1`): ignores that smart people learn faster.
2. *Pure intelligence-multiplicative* (`experience += intelligence * k`): smart idler still accumulates expertise — contradicts idleness-decay intuition.

The chosen additive form keeps each lever (time, intelligence, activity, idleness) independently observable in calibration.

**Childhood attenuation rather than hard cutoff.** A no-growth-before-15 cutoff would create a discontinuity once childbirth is implemented; pre-5 attenuation reflects developmental reality without the cliff.

**Asymmetric idleness decay.** Working-age unemployment is an active failure to engage; skills atrophy fast. Retirement is normal disengagement; fades slower. Symmetric decay either over-punishes retirees or under-signals joblessness.

**Floor 0, cap 50.** Floor prevents negative gather output. Cap prevents centenarians from dominating extraction; also reflects empirical career-length diminishing returns.

**Reuse of learning age curve.** The "old dog" effect is the same curve as `LearnEvent` firing rate (ARD 008). One curve, one anchor.

## Consequences

- New file `src/Events/ExperienceEvent.ts` implementing `IEvent`; mirror test.
- `Variables.ts` gains the 10 constants above (all calibration placeholders).
- `EventFactory.getEventsFor()` adds `ExperienceEvent` between `AgeEvent` and `GatherResourcesEvent`.
- `Simulation.seed()` clamps seeded experience to `[0, min(age, EXPERIENCE_CAP)]`.
- `GatherResourcesEvent` formula unchanged but behaviour shifts (experience is now moving).
- CLAUDE.md updates ("What's implemented", "Key design decisions") in the implementation commit.
- Tests must cover: typical adult growth; childhood attenuation; intelligence fade past learning peak; education bonus; idleness decay (adult + elderly); cap and floor enforcement; seed clamp.

### Job dependency

`Job` is unimplemented (see CLAUDE.md "What's not implemented yet"), so `person.hasJob` doesn't exist yet and every working-age post-graduate falls through to `ADULT_IDLENESS_DECAY`. All post-graduation working-age adults lose experience every tick until Job lands — relevant for calibration. The `hasJob` branch is written ahead so structure survives the Job ARD; the constant may need re-tuning then.

### Open follow-ups

- `person.illness` is similarly dead state — covered by ARD 018.
- `intelligence` and `constitution` have no cap/decay — see `docs/future-ideas.md` "Stat caps and age-based decay."
- Initial constants are guesses; revise after observing simulations.
