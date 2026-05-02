# ARD 017: Experience Growth and Decay

**Status:** Proposed
**Date:** 2026-05-02

## Context

`Person.experience` is initialized to 0, randomized in `Simulation.seed()` to `[0, age]`, and consumed by `GatherResourcesEvent` (ARD 011) as the primary multiplier on extraction output. After seeding, it is never updated — there is no event that increments, decays, or otherwise mutates it. A 90-year-old person carries the experience value they were assigned at age 15 for the rest of their life. This is a latent bug in the simulation: the field is treated as time-accumulating in the gather formula but is in fact static.

Fixing it requires deciding *how* experience grows. The choice is non-obvious because experience interacts with several yet-to-be-implemented mechanics: education (`isWorkingOnEd`), employment (the planned `Job` event), and idleness. It also interacts with `intelligence` — the conventional wisdom that "you can't teach an old dog new tricks" implies intelligence accelerates learning differently at different ages.

## Decision

Add a new unconditional event, `ExperienceEvent`, that fires once per living person per tick. It applies the following per-tick update:

```typescript
// 1. Base growth, attenuated for early childhood
let growth = Variables.BASE_EXPERIENCE_GROWTH;
if (person.age < Variables.EXPERIENCE_CHILDHOOD_AGE) {
  growth *= Variables.EXPERIENCE_CHILDHOOD_FACTOR;
}

// 2. Intelligence multiplier on growth, faded by age via the learning curve
const intelligenceFade = ageModifier(
  person.age,
  Variables.LEARNING_PEAK_AGE,
  Variables.LEARNING_AGE_SCALE,
  Variables.LEARNING_AGE_FLOOR,
);
growth += person.intelligence * Variables.INTELLIGENCE_EXPERIENCE_SCALAR * intelligenceFade;

// 3. Activity bonus / idleness decay (mutually exclusive branches)
if (person.isWorkingOnEd) {
  growth += Variables.EDUCATION_EXPERIENCE_BONUS;
} else if (person.hasJob) {                                   // see "Job dependency" below
  growth += Variables.EMPLOYMENT_EXPERIENCE_BONUS;
} else if (person.age >= Variables.EXPERIENCE_ELDERLY_AGE) {
  growth -= Variables.ELDERLY_IDLENESS_DECAY;
} else {
  growth -= Variables.ADULT_IDLENESS_DECAY;
}

// 4. Clamp to [0, cap]
person.experience = Math.max(
  0,
  Math.min(Variables.EXPERIENCE_CAP, person.experience + growth),
);
```

**Constants (placeholders pending calibration):**

| Constant | Initial | Rationale |
|---|---|---|
| `BASE_EXPERIENCE_GROWTH` | `1.0` | One year of experience per year lived as baseline. |
| `EXPERIENCE_CHILDHOOD_AGE` | `5` | Below this, growth is attenuated. |
| `EXPERIENCE_CHILDHOOD_FACTOR` | `0.2` | Pre-5 grows at 1/5 the rate. |
| `INTELLIGENCE_EXPERIENCE_SCALAR` | `0.05` | At max intelligence (10) and peak fade (1.0), boost is `+0.5/tick`. |
| `EDUCATION_EXPERIENCE_BONUS` | `0.5` | School accelerates experience. |
| `EMPLOYMENT_EXPERIENCE_BONUS` | `0.3` | Work also accelerates, slightly less than school. |
| `ADULT_IDLENESS_DECAY` | `0.5` | Working-age unemployed lose half a year of experience per year idle. |
| `ELDERLY_IDLENESS_DECAY` | `0.2` | Retirees decay slower — accumulated expertise fades less in the absence of strenuous re-engagement. |
| `EXPERIENCE_ELDERLY_AGE` | `65` | Matches existing happiness elderly threshold (Person.ts). |
| `EXPERIENCE_CAP` | `50` | Plausible career-length ceiling; prevents runaway gather output for centenarians. |

**Seeding update:** `Simulation.seed()` must clamp seeded experience to `[0, min(age, EXPERIENCE_CAP)]` so a person seeded above the cap doesn't enter the simulation in violation of the invariant.

**Intelligence fade reuses the learning age curve** (`LEARNING_PEAK_AGE`, `LEARNING_AGE_SCALE`, `LEARNING_AGE_FLOOR`) rather than introducing a separate set of constants. The shape is the same — both express "the rate at which a person absorbs new knowledge as a function of age" — and a single curve avoids drift between the two.

**Wiring:** `EventFactory.getEventsFor(person)` returns `ExperienceEvent` unconditionally alongside `AgeEvent`, `GatherResourcesEvent`, and `MisfortuneEvent`. Order within the unconditional block: `AgeEvent` first (so the new age is in effect when other events read it), then `ExperienceEvent`, then `GatherResourcesEvent` (so updated experience is reflected in this tick's gather), then `MisfortuneEvent`.

## Reasoning

**Time-based growth with intelligence as accelerator, not multiplier.** Three formulations were considered:

1. **Pure time-based:** `experience += 1 per tick`. Simple but ignores that smart people learn faster.
2. **Pure intelligence-multiplicative:** `experience += intelligence * SCALAR`. Couples too tightly to one stat; a smart person who never works/studies still accumulates expertise, which contradicts the idleness-decay intuition.
3. **Additive base + intelligence boost (chosen):** Time provides the floor; intelligence accelerates via a faded curve; activity adds; idleness subtracts. Each lever is independently observable in calibration.

**Childhood attenuation rather than a hard cutoff.** Earlier draft proposed no growth before age 15. The actual decision (pre-5 grows slowly, ages 5+ grow normally) better reflects developmental reality and removes a discontinuity that would otherwise cause a noisy jump at age 15 once childbirth is implemented.

**Asymmetric idleness decay (elderly slower).** Working-age unemployment indicates an active failure to engage — skills atrophy faster. Post-retirement disengagement is normal and physiologically/cognitively different; expertise fades but more gradually. Symmetric decay would either be too punishing for retirees (forcing them into rapid uselessness) or too gentle on the unemployed (blunting the collapse signal from joblessness).

**Floor at 0, cap at career-length.** Floor prevents negative experience from tipping `GatherResourcesEvent` into negative output. Cap prevents pathological compounding: without it, a centenarian who exercised, learned, and worked their entire life would have experience ~100, intelligence ~30+ (LearnEvent has no cap either — separate problem, see future ideas), and dominate the resource pool. Cap also reflects empirical career length — there are diminishing returns to further experience past mid-career.

**Reuse of the learning age curve for intelligence fade.** The "old dog, new tricks" effect is the same curve as the LearnEvent firing rate (per ARD 008's age-profile guidance). Defining a new curve would invite drift; reusing the existing one keeps a single semantic anchor. If empirical results require decoupling them later, that's a small refactor.

## Consequences

- **New file:** `src/Events/ExperienceEvent.ts` implementing `IEvent`. Mirror test in `src/tests/Events/ExperienceEvent.test.ts`.
- **`Variables.ts` gains 10 new constants** listed in the table above. All marked as calibration placeholders.
- **`EventFactory.getEventsFor()` gains `ExperienceEvent`** in the unconditional block, ordered between `AgeEvent` and `GatherResourcesEvent`.
- **`Simulation.seed()` updated** to clamp seeded experience to `[0, min(age, EXPERIENCE_CAP)]`.
- **`GatherResourcesEvent` formula is unchanged** — but its behavior changes meaningfully because experience is now a moving target.
- **CLAUDE.md updates:** "What's implemented" gains `ExperienceEvent`. "Key design decisions" gains a bullet referencing this ARD. Variables.ts entry expands.
- **Tests must cover:** growth at typical adult age; childhood attenuation; intelligence fade past learning-curve peak; education bonus; idleness decay (adult and elderly); cap enforcement; floor enforcement; seed-clamping for old persons.

### Job dependency

The `hasJob` branch in the update rule above does not yet correspond to anything in the model — the `Job` event is in CLAUDE.md's "What's not implemented yet" list. Until `Job` lands, every working-age person without `isWorkingOnEd = true` falls through to the `ADULT_IDLENESS_DECAY` branch, meaning *all post-graduation working-age adults will be losing experience every tick*. This is a meaningful effect on simulation outcomes — gather output will trend down for the unemployed majority — and is worth flagging to anyone calibrating constants in this state.

Two reasonable responses when `Job` lands:
1. Re-tune `ADULT_IDLENESS_DECAY` once a non-trivial fraction of the population is employed. Likely the cleaner path.
2. Replace the `hasJob` shape with whatever the `Job` ARD ends up specifying (employment as a continuous fraction, multiple job types with different bonuses, etc.).

This ARD's update rule is intentionally written as if `hasJob` exists so the structure survives the Job ARD without restructuring — only the property access and the `EMPLOYMENT_EXPERIENCE_BONUS` constant may need adjustment.

### Open follow-ups

- **`person.illness` is similarly dead state** — separate ARD (planned 018) covers that.
- **`intelligence` and `constitution` have no cap or decay** — separate concern; tracked in `docs/future-ideas.md` under "Stat caps and age-based decay."
- **Calibration:** initial constants are guesses. Expect to revise after observing simulations.
