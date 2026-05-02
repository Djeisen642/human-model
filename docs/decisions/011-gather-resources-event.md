# ARD 011: GatherResourcesEvent

**Status:** Accepted  
**Date:** 2026-05-01

## Context

ARD 007 established the resource pool mechanics and specified that `GatherResourcesEvent` pulls from the pool using a formula `extracted = min(f(experience, intelligence), pool / extractionEfficiency)`, but left `f` undefined. The extraction formula is a non-obvious design choice — different formulas produce meaningfully different inequality dynamics.

## Decision

**Trigger:** Unconditional — fires every tick for every living person. Gathering is survival behavior, not a choice. (See ARD 010.)

**Extraction formula:**

```typescript
const potential = person.experience * (Variables.BASE_GATHER_AMOUNT + person.intelligence * Variables.INTELLIGENCE_GATHER_SCALAR);
const available = simulation.naturalResources / simulation.extractionEfficiency;
const extracted = Math.min(potential, available);

person.resources += extracted;
simulation.naturalResources -= extracted * simulation.extractionEfficiency;
```

**Calibration intent:** The constants `BASE_GATHER_AMOUNT`, `INTELLIGENCE_GATHER_SCALAR`, `NATURAL_RESOURCE_CEILING_INITIAL`, and `NATURAL_RESOURCE_REGEN_RATE` form a system that must be calibrated together. The target: a population of 100 persons at typical seeded stats should feel meaningful resource pressure around year 50–70, with full pool exhaustion requiring either bad invention outcomes or significant population growth. The constants are tuning levers, not locked-in values.

**Interaction with MisfortuneEvent:** Gathering and misfortune are independent — both fire unconditionally each tick. A person can gather resources and die in the same tick.

## Reasoning

**Experience-primary, intelligence as floor.** A purely additive formula (`BASE + int * A + exp * B`) treats intelligence and experience as independent contributors. But gathering capacity is really accumulated skill — experience is what you've learned to do; intelligence determines how much a given amount of experience is worth. A person with zero experience (newborn) gathers almost nothing regardless of intelligence. A purely multiplicative formula (`int * exp * SCALAR`) collapses to zero at experience=0, which happens at birth and early life. The chosen formula — `experience * (BASE + intelligence * SCALAR)` — gives intelligence a meaningful floor (BASE) while making experience the primary driver.

**Intelligence affects gathering independently through learning.** The alternative (Option 3 in discussion) was to have intelligence affect gathering only indirectly via LearnEvent, keeping stat roles clean. This is noted in `docs/future-ideas.md` as a candidate if the simulation shows intelligence and experience over-correlating.

**Unconditional, not base-rate probabilistic.** Some years people gather less, some more — but the attempt is universal. Introducing probability would make starvation partly random rather than purely structural, which obscures the inequality signal.

**Independent from misfortune.** The interaction between illness severity and gathering capacity is a meaningful future addition (a sick person gathers less) but is not specified here. See `docs/future-ideas.md`.

## Consequences

- `GatherResourcesEvent` always appears in `EventFactory.getEventsFor()` return array
- `Variables.ts` gains `BASE_GATHER_AMOUNT` and `INTELLIGENCE_GATHER_SCALAR`; initial values are placeholders pending calibration
- Pool depletion rate depends on population size and stat distribution — must be observed empirically before tuning
- Tests must cover: extraction at zero experience (near zero output), pool-limited extraction (available < potential), typical and max stat profiles
