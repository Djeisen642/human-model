# ARD 008: Age-Based Modifiers

**Status:** Accepted  
**Date:** 2026-04-26

## Context

All persons currently participate in events at equal probability regardless of age. A 2-year-old and a 40-year-old have the same chance of inventing something; a 70-year-old and a 25-year-old face the same mortality risk. Neither is remotely realistic.

Two independent age effects need modeling:

**Mortality** follows a U-shaped curve across the lifespan — high in infancy, lowest in the mid-to-late 20s, rising steeply through old age. This pattern is one of the most consistent findings in human demography (Gompertz, 1825; Makeham, 1860). The current hard cutoff at `OLD_AGE = 60` is a poor substitute: it produces a cliff rather than a gradient, and it is too young — people in the real world commonly live well past 60.

**Productive capacity** varies by activity and by age. A single global modifier cannot capture that childbirth has a steep biological decline after ~38, that physically demanding work peaks in the mid-20s, that intellectual invention peaks in the late 30s to mid-40s, or that learning capacity is highest in adolescence and early adulthood. Each activity has a distinct age profile backed by research (Simonton, 1988; Salthouse, 2010; Menken et al., 1986 on fertility).

`AgeEvent` currently kills persons at `OLD_AGE`. This decision replaces that mechanism and establishes the pattern for per-event age tuning.

## Decision

**Remove the hard old-age death cutoff from `AgeEvent`.** `AgeEvent` only increments `age`. Death from aging is absorbed into the mortality modifier on `MisfortuneEvent`.

**Add a helper function `ageModifier` in `src/Helpers/AgeModifier.ts`:**

```typescript
/** Returns a [floor, 1] multiplier representing how age affects a given activity. */
export function ageModifier(age: number, peakAge: number, scale: number, floor: number): number {
  const raw = 1 - Math.pow((age - peakAge) / scale, 2);
  return Math.max(floor, raw);
}
```

**Add a mortality modifier getter on `Person`** for the U-shaped death curve:

```typescript
/** Multiplier on base illness/death probability. Minimum near PRIME_AGE, rising toward infancy and old age. */
get ageMortalityModifier(): number {
  return 1 + AGE_DEATH_CURVATURE * Math.pow(this.age - PRIME_AGE, 2);
}
```

**`MisfortuneEvent`** multiplies the base `ILLNESS` rate by `person.ageMortalityModifier`:

```typescript
if (this.rng() < ILLNESS * person.ageMortalityModifier) simulation.kill(person, CAUSE_OF_DEATH.ILLNESS);
```

**`EventFactory`** calls `ageModifier` per-event with activity-specific constants:

```typescript
const age = person.age;

// Steep fertility cliff — biologically grounded
if (this.rng() < CHILDBIRTH_BASE_RATE * ageModifier(age, CHILDBIRTH_PEAK_AGE, CHILDBIRTH_AGE_SCALE, CHILDBIRTH_AGE_FLOOR))
  events.push(new ChildbirthEvent(this.rng));

// Gradual work decline — physical and cognitive capacity
if (this.rng() < person.workIntent * ageModifier(age, WORK_PEAK_AGE, WORK_AGE_SCALE, WORK_AGE_FLOOR))
  events.push(new WorkEvent(this.rng));

// Invention peaks later — requires accumulated knowledge
if (this.rng() < person.inventionIntent * ageModifier(age, INVENTION_PEAK_AGE, INVENTION_AGE_SCALE, INVENTION_AGE_FLOOR))
  events.push(new InventionEvent(this.rng));

// Killing is physical and impulsive — peaks young
if (this.rng() < person.killingIntent * ageModifier(age, KILL_PEAK_AGE, KILL_AGE_SCALE, KILL_AGE_FLOOR))
  events.push(new KillEvent(this.rng));
```

**New constants in `Variables.ts`** — mortality curve:

```typescript
export const PRIME_AGE = 28;              // age of minimum mortality
export const AGE_DEATH_CURVATURE = 0.001; // controls steepness of U-curve
```

Per-event age constants follow the naming pattern `<EVENT>_PEAK_AGE`, `<EVENT>_AGE_SCALE`, `<EVENT>_AGE_FLOOR`. Representative starting values:

| Event | Peak age | Scale | Floor | Rationale |
|---|---|---|---|---|
| Childbirth | 26 | 12 | 0.02 | Fertility peaks mid-20s; steep cliff after 38 |
| Work | 35 | 40 | 0.1 | Broad productive period; gradual late decline |
| Gathering | 28 | 35 | 0.1 | Physical labor; peaks late 20s |
| Exercise | 24 | 35 | 0.1 | Physical peak earlier than cognitive |
| Learning | 18 | 45 | 0.15 | Fluid intelligence peaks in late teens/early 20s |
| Stealing | 24 | 30 | 0.05 | Physical + impulsive; peaks young |
| Killing | 24 | 30 | 0.05 | Same profile as stealing |
| Relationships | 26 | 35 | 0.1 | Social formation peaks in 20s–30s |
| Invention | 40 | 45 | 0.1 | Accumulated knowledge; peaks later |
| Lying | 32 | 40 | 0.1 | Social intelligence; broad peak in adulthood |

**Remove `OLD_AGE` from `Variables.ts`** — it is no longer used.

## Reasoning

**Per-event constants rather than a global modifier.** A single `ageProductivityModifier` getter on `Person` cannot represent the difference between childbirth's steep fertility cliff and invention's late peak. The per-event approach makes the simulation more truthful to how age actually operates — different capacities decline at different rates — and makes each activity independently tunable as a research parameter.

**`ageModifier` as a free helper function, not a `Person` getter.** The function takes `(age, peakAge, scale, floor)` — it is parameterized, not specific to any one activity. A `Person` getter would hardcode one set of parameters. The helper lives in `Helpers/` alongside `SeededRandom` and is called by `EventFactory` with per-event constants. `Person` retains only `ageMortalityModifier` because that curve is specific to the person's biological state, not to any event.

**Parabola as approximation.** The true mortality curve is closer to a Gompertz exponential; the true fertility curve is closer to a logistic decline. The parabola captures the shape with minimal arithmetic. Constants in `Variables.ts` make replacement tractable if a more accurate curve is needed.

**Floor prevents complete inaction.** `AGE_MODIFIER_FLOOR` ensures no activity reaches zero probability from age alone. A 70-year-old can still commit murder; a 5-year-old can still learn. The floor is the claim that age suppresses but does not eliminate. Childbirth gets a very low floor (0.02) because post-menopausal birth is effectively zero in the real world, but not literally impossible in a stylized model.

**`MisfortuneEvent` owns age-scaled mortality, not `AgeEvent`.** `AgeEvent` is a mechanical bookkeeper — it advances time. Mortality belongs to misfortune. The hard cutoff was a workaround for the absence of a proper mortality model; it is no longer needed.

## Consequences

- `AgeEvent` only increments `person.age`; no death logic
- `src/Helpers/AgeModifier.ts` exports `ageModifier(age, peakAge, scale, floor): number`
- `Person` gains `ageMortalityModifier` computed getter; loses any global productivity getter
- `MisfortuneEvent` death check: `if (this.rng() < ILLNESS * person.ageMortalityModifier)`
- `EventFactory` calls `ageModifier(person.age, ...)` per-event with named constants
- `Variables.ts` gains mortality constants (`PRIME_AGE`, `AGE_DEATH_CURVATURE`) plus per-event age constants for every wired event; loses `OLD_AGE`
- **Every new event added to `EventFactory` must document its age profile** — peak age, scale, floor — and add the corresponding constants to `Variables.ts`. See CLAUDE.md.
- Tests for `AgeEvent` confirm it no longer kills; tests for `ageModifier` confirm output at representative ages; tests for `Person.ageMortalityModifier` confirm U-shape
