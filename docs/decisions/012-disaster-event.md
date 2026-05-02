# ARD 012: Disaster

**Status:** Accepted  
**Date:** 2026-05-01

## Context

`Constants.CAUSE_OF_DEATH.DISASTER` exists but no disaster mechanic has been specified. Disasters are a background civilizational risk — floods, fires, famines — that affect groups of people, kill some outright, and ruin others economically. They are distinct from illness (individual, age-scaled) and suicide (despair-driven).

## Decision

**Trigger:** Probabilistic — each tick, a disaster occurs with probability `DISASTER_PROBABILITY`. Some years have no disaster at all; catastrophic years are rare.

**Scale:** When a disaster fires, it affects a random number of people drawn from a probability curve weighted toward small events. The affected count is scaled to population size so disasters remain proportionally meaningful as population changes.

**Effect on each affected person:** Two independent checks:

1. **Kill or survive** — determined by age and constitution. Frail persons (high age, low constitution) are more likely to die outright (`CAUSE_OF_DEATH.DISASTER`); young, healthy persons are more likely to survive with economic damage only.

2. **Economic damage** — all affected persons (including survivors) lose a random fraction of their resources in the range `[DISASTER_MIN_LOSS_FRACTION, DISASTER_MAX_LOSS_FRACTION]`. The fraction is random per person per disaster. No affected person loses 100% — even catastrophic disasters leave something.

```typescript
// Fraction lost is random per person, never total
const fractionLost = DISASTER_MIN_LOSS_FRACTION
  + rng() * (DISASTER_MAX_LOSS_FRACTION - DISASTER_MIN_LOSS_FRACTION);
person.resources = Math.max(0, person.resources * (1 - fractionLost));
```

**New constants in `Variables.ts`:**

```typescript
static DISASTER_PROBABILITY = 0.1;           // ~10% chance of any disaster per tick
static DISASTER_MAX_AFFECTED_FRACTION = 0.2; // curve upper bound as fraction of population
static DISASTER_MIN_LOSS_FRACTION = 0.1;     // minimum resource loss for affected persons
static DISASTER_MAX_LOSS_FRACTION = 0.9;     // maximum resource loss for affected persons
```

## Reasoning

**Probabilistic trigger, not every tick.** Real disasters don't strike every year. A flat per-tick probability means some years are disaster-free and rare years are catastrophic — which matches lived experience better than a constant background drain.

**Scaled affected count.** A fixed affected count (e.g. always 1–10 persons) becomes trivial at large populations and devastating at small ones. Scaling to population size preserves the proportional impact across different simulation configurations.

**Fractional resource loss, not flat amount.** A flat loss hits poor persons harder in absolute terms (losing 20 resources when you have 25 is catastrophic; losing 20 when you have 200 is painful but recoverable). A fractional loss is proportionally equal but still more consequential for the poor — losing 50% of 25 leaves you with 12.5 (below the critical happiness threshold), while losing 50% of 200 leaves you with 100 (comfortable). This produces meaningful Gini signal.

**No 100% loss.** Even total disasters leave survivors with something. A 90% loss is effectively ruinous for a poor person without being a hard edge case.

**Age and constitution determine survival.** Disasters are physically demanding to survive. The young and healthy are more likely to make it through; the old and frail are more likely to die outright. This is consistent with real disaster mortality patterns.

**No pod/proximity targeting yet.** Family clusters living near each other would naturally be co-affected by local disasters. This is recorded in `docs/future-ideas.md` for when a proximity model is introduced.

## Consequences

- `DisasterEvent` (or disaster logic within `MisfortuneEvent` — see ARD 013) selects affected persons each tick via the probability curve
- Each affected person receives resource loss; survival check uses age and constitution
- `Variables.ts` gains four new constants: `DISASTER_PROBABILITY`, `DISASTER_MAX_AFFECTED_FRACTION`, `DISASTER_MIN_LOSS_FRACTION`, `DISASTER_MAX_LOSS_FRACTION`
- Tests must cover: no disaster tick (probability gate fails), single affected person, multiple affected persons, kill vs. survive split, resource loss clamped above zero
