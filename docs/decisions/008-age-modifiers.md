# ARD 008: Age-Based Modifiers

**Status:** Accepted  
**Date:** 2026-04-26

## Context

All persons currently participate in events at equal probability regardless of age. A 2-year-old and a 40-year-old have the same chance of inventing something; a 70-year-old and a 25-year-old face the same mortality risk. Neither is remotely realistic.

Two independent age effects need modeling:

**Mortality** follows a U-shaped curve across the lifespan — high in infancy, lowest in the mid-to-late 20s, rising steeply through old age. This pattern is one of the most consistent findings in human demography (Gompertz, 1825; Makeham, 1860). The current hard cutoff at `OLD_AGE = 60` is a poor substitute: it produces a cliff rather than a gradient, and it is too young — people in the real world commonly live well past 60.

**Productive capacity** follows a bell curve — low in childhood, peaking in early-to-mid adulthood, declining gradually into old age. Research on creative and intellectual output (Simonton, 1988; Salthouse, 2010) places peak complex cognitive performance in the 35–45 range. Physical and reactive tasks peak earlier (~25); accumulated-knowledge tasks peak later (~50–60). For a general-purpose modifier a peak around 35–40 is a defensible synthesis.

`AgeEvent` currently kills persons at `OLD_AGE`. This decision replaces that mechanism.

## Decision

**Remove the hard old-age death cutoff from `AgeEvent`.** `AgeEvent` only increments `age`. Death from aging is absorbed into the mortality modifier on `MisfortuneEvent`.

**Add two computed getters to `Person`:**

```typescript
/** Multiplier on base illness/death probability. U-shaped: high at birth, minimum near PRIME_AGE, rising steeply in old age. */
get ageMortalityModifier(): number {
  return 1 + AGE_DEATH_CURVATURE * Math.pow(this.age - PRIME_AGE, 2);
}

/** Multiplier on event intent probability. Bell curve: low in childhood, peaks near PEAK_AGE, floors at AGE_MODIFIER_FLOOR in old age. */
get ageProductivityModifier(): number {
  const raw = 1 - Math.pow((this.age - PEAK_AGE) / AGE_SCALE, 2);
  return Math.max(AGE_MODIFIER_FLOOR, raw);
}
```

**`MisfortuneEvent`** multiplies the base `ILLNESS` rate by `person.ageMortalityModifier` to get the per-tick death probability.

**`EventFactory`** multiplies each person's intent value by `person.ageProductivityModifier` before the probability check:

```typescript
if (this.rng() < person.stealingIntent * person.ageProductivityModifier) events.push(new StealEvent(this.rng));
if (this.rng() < person.killingIntent * person.ageProductivityModifier)  events.push(new KillEvent(this.rng));
// etc.
```

This means a young or old person can still commit murder — their `killingIntent` is nonzero — but the suppressed modifier makes it proportionally unlikely.

**New constants in `Variables.ts`:**

```typescript
export const PRIME_AGE = 28;           // age of minimum mortality
export const AGE_DEATH_CURVATURE = 0.001;  // controls steepness of U-curve

export const PEAK_AGE = 40;            // age of maximum productivity
export const AGE_SCALE = 50;           // controls width of bell curve
export const AGE_MODIFIER_FLOOR = 0.1; // minimum productivity modifier (never zero)
```

**Remove `OLD_AGE` from `Variables.ts`** — it is no longer used.

## Reasoning

**Computed getters on `Person`, not a helper class.** Both modifiers are pure functions of `age`, which is a `Person` property. Placing them as getters keeps age-related logic with the entity it describes. Callers (`EventFactory`, `MisfortuneEvent`) read a named property rather than calling a free function with a raw number.

**Parabola as approximation.** The true mortality curve is closer to a Gompertz exponential (mortality doubles roughly every 8 years after age 30). The parabola underestimates late-life mortality acceleration but is adequate for a stylized model and requires no math beyond basic arithmetic. If late-age dynamics become important to the research question, the formula can be swapped without changing anything else.

**Asymmetry is partially addressed by `PEAK_AGE = 40` and `AGE_SCALE = 50`.** At these values a 15-year-old (0.75 modifier) and a 65-year-old (0.75 modifier) are symmetric around the peak — which overstates how capable a 15-year-old is relative to a 65-year-old on knowledge-intensive tasks. This is an accepted simplification for V1; per-event sensitivity weights could refine it later.

**`AGE_MODIFIER_FLOOR = 0.1`** prevents anyone from being completely inert. A very old person still has a small chance of acting; a very young person still has a small chance of committing murder. The floor keeps the model consistent with the research finding that extreme age suppresses but does not eliminate behavior.

**`MisfortuneEvent` owns age-scaled mortality, not `AgeEvent`.** `AgeEvent` is a mechanical bookkeeper — it advances time. Mortality belongs to misfortune: illness, accident, the body failing. Mixing time-keeping with probabilistic death in a single event blurs two distinct things. The hard cutoff was a workaround for the absence of a proper mortality model; it is no longer needed.

**`OLD_AGE` constant removed.** Keeping it would imply the hard cutoff might be used somewhere; removing it makes the architectural change unambiguous.

## Consequences

- `AgeEvent` only increments `person.age`; no death logic
- `Person` gains two computed getters: `ageMortalityModifier` and `ageProductivityModifier`
- `MisfortuneEvent` death check: `if (this.rng() < ILLNESS * person.ageMortalityModifier)`
- `EventFactory` wraps each intent with `* person.ageProductivityModifier` before the probability draw
- `Variables.ts` gains five constants (`PRIME_AGE`, `AGE_DEATH_CURVATURE`, `PEAK_AGE`, `AGE_SCALE`, `AGE_MODIFIER_FLOOR`) and loses `OLD_AGE`
- Age distribution of the living population becomes a meaningful observable — a young or elderly-skewed population behaves measurably differently from a prime-age one
- Tests for `AgeEvent` should confirm it no longer kills; tests for `Person` should confirm modifier values at representative ages (infant, child, prime, elder)
