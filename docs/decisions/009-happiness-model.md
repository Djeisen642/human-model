# ARD 009: Happiness Model

**Status:** Superseded by ARD 014  
**Date:** 2026-04-26

## Context

`Person.happiness` existed as a stub — it returned `+5` if the person had a job and `-3` otherwise, floored at 0. It appeared in `TickSnapshot.averageHappiness` but carried almost no information: a population where everyone has a job looks identical to one where nobody does, because the floor hides the -3 case.

`happiness` is one of the simulation's core observability signals. It needs to vary meaningfully across individuals so that `averageHappiness` in the snapshot can actually indicate whether a population is thriving or under stress.

The design question is: which factors, at what magnitudes, and with what structure?

## Decision

`happiness` remains a computed getter (not a stored stat) on `Person`. It sums five independent additive contributions and applies a floor of 0:

```typescript
get happiness(): number {
  let happiness = 0;

  happiness += this.hasJob ? 5 : -3;

  if (this.resources < 10) happiness -= 5;
  else if (this.resources < 30) happiness -= 2;
  else if (this.resources >= 70) happiness += 3;

  if (this.isInRelationshipWith !== null) happiness += 3;

  if (this.age < 18) happiness -= 1;
  else if (this.age > 65) happiness -= 3;

  happiness -= Math.round(this.illness * 5);

  return Math.max(0, happiness);
}
```

**Factor summary:**

| Factor | Effect |
|---|---|
| Job | +5 / −3 |
| Resources critical (< 10) | −5 |
| Resources low (< 30) | −2 |
| Resources comfortable (≥ 70) | +3 |
| In relationship | +3 |
| Age < 18 | −1 |
| Age > 65 | −3 |
| Illness | −round(illness × 5), range 0..−5 |

## Reasoning

**Why these five factors.** Job, resources, social connection, age, and health are the four domains that emerge consistently across subjective wellbeing research (Diener, 1984; OECD Better Life Index). They are also the domains this simulation already tracks via existing fields. No new stats are required.

**Why additive rather than multiplicative.** The factors are largely independent stressors and benefits. Multiplicative interactions (e.g., "illness makes job loss worse") may be more realistic in some cases, but they make individual factor contributions opaque and harder to tune. The additive model keeps each contribution legible and independently adjustable.

**Why integer magnitudes.** The magnitudes are calibrated so that a fully thriving person (job, comfortable resources, relationship, prime age, healthy) scores around 14, and a severely stressed person (no job, critical resources, elderly, very ill) would score well below 0 before flooring. The +5/−3 job range from the original stub is retained as the anchor; other factors are scaled relative to it.

**Why a resource tier structure rather than a continuous function.** `resources` will swing sharply each tick once gathering events are wired. A continuous linear function would produce noisy, hard-to-interpret happiness curves. Three tiers (critical, neutral, comfortable) capture the qualitatively different states — survival threat, adequate, flourishing — without false precision.

**Why the floor is 0, not a negative value.** `averageHappiness` in `TickSnapshot` is a diagnostic, not a utility sum. A negative floor would require rescaling when comparing runs. Zero as floor means "the population is at worst neutral in the snapshot sense"; the depth of misery is expressed by how many people are *at* zero, which is visible via distribution analysis, not by the average going negative.

**What is deliberately excluded:**

- *Relative deprivation* (Luttmer 2005): happiness relative to peers, not absolute resources. This is in `docs/future-ideas.md`. It requires a proximity or peer-group definition that does not yet exist.
- *Hedonic adaptation* (Easterlin; Kahneman-Deaton): diminishing returns above subsistence, making resource accumulation decouple from happiness. Also in `future-ideas.md`. The tier structure approximates this crudely (no benefit above 70), but a log-shaped function would be more accurate.
- *Loss aversion asymmetry*: resource drops should hurt more than equivalent gains help. Not modeled here; the tier structure is symmetric in that crossing a boundary up and down has the same magnitude.

These exclusions are deliberate. Each would add a meaningful collapse/thrive signal, but each also introduces dependencies (proximity definitions, persistent history) that do not exist yet.

## Consequences

- `averageHappiness` in `TickSnapshot` now varies across ticks as resources and ages shift — it is a meaningful signal once `GatherResourcesEvent` and `MisfortuneEvent` are wired
- The floor of 0 means the aggregate can never go negative; deep misery is visible as many people bunched at 0, not as a negative mean
- Illness contributes 0 to happiness until `MisfortuneEvent` starts setting `person.illness`; the getter is forward-compatible
- Any future expansion of this model (relative deprivation, hedonic adaptation, etc.) should supersede this ARD rather than quietly patching the getter
