# ARD 054: Relationship Age Preference

**Status:** Accepted
**Date:** 2026-06-06

## Context

`RelationshipEvent` draws a partner uniformly at random from all living persons
(`getRandomOther()`). There is no preference for age proximity. Since `ChildbirthEvent`
uses `coupleAge = max(person.age, partner.age)`, a young adult paired with an old founding-cohort
member has near-zero fertility even though the young adult is at peak reproductive age. The crash
diagnosis (`docs/research-crash-diagnosis.md`) showed that at the population peak, ~150 young adults
(34% of population) are alive but births have collapsed by 61% — in large part because many young
adults are in cross-generational pairs that suppress their fertility.

The same gap exists in `Simulation.seed()`: adults are shuffled and paired sequentially without any
age signal, so the initial population contains the same proportion of implausibly wide age-gap pairs.

## Decision

### 1. Age-gap compatibility modifier in `RelationshipEvent`

Multiply the formation probability by `ageGapModifier = ageModifier(|age1 − age2|, 0, RELATIONSHIP_AGE_GAP_SCALE, RELATIONSHIP_AGE_GAP_FLOOR)` — the existing bell-curve helper centred at zero age gap.

At zero gap the modifier is one (no effect); it falls as the gap grows, reaching `RELATIONSHIP_AGE_GAP_FLOOR` at very large gaps. The modifier applies only to the **formation** branch; dissolution uses the existing flat `BASE_BREAKUP_RATE` and is unaffected. Cross-generational pairings remain possible — they are just proportionally less frequent, consistent with the empirical literature on assortative mating.

Two new constants:
- `RELATIONSHIP_AGE_GAP_SCALE` — width of the compatibility bell curve; controls how steeply preference falls with age difference
- `RELATIONSHIP_AGE_GAP_FLOOR` — minimum compatibility at arbitrarily large age gaps; ensures cross-generational relationships remain possible at a realistic low rate

### 2. Age-proximate pairing in `Simulation.seed()`

Replace the current uniform-shuffle-and-pair-sequentially seeding with a greedy nearest-age pairing: sort unpartnered adults by age, then pair each with their closest-in-age unpartnered candidate, until `SEED_PAIRING_FRACTION` is reached. This produces an initial population consistent with the age-preference the live simulation will apply each tick, without introducing a separate tunable rate for seeding.

## Reasoning

**Alternative: hard maximum age gap**
A `MAX_RELATIONSHIP_AGE_GAP` constant blocks formation entirely above the threshold. This is simpler
to reason about but creates an artificial cliff and is sensitive to calibration — a threshold that is
too narrow prevents realistic older–younger relationships; too wide has no effect. The bell-curve
modifier degrades gracefully and mirrors every other preference in the model.

**Alternative: age-weighted partner selection (sorted draw)**
Weight the `getRandomOther()` draw by age proximity so that close-in-age candidates are drawn more
often. This is the correct full solution but requires scanning the population each time to build a
weight vector — O(n) per formation attempt vs the current O(1). Given that RelationshipEvent runs
for every person every tick, the cost is non-trivial and grows with population. The probability
modifier achieves the same directional effect: a young adult still sometimes draws and pursues an
older candidate, but at a discounted probability. The O(1) cost is preserved.

**Alternative: apply preference only to seeding, not to live simulation**
Seeding is a one-shot operation where computational cost is irrelevant, so the two contexts could use
different mechanisms. This would mean the initial population is age-proximate but the live simulation
is not — inconsistent, and would leave the fundamental fertility-trap untouched for all pairings
formed after tick zero.

**Alternative: change `ChildbirthEvent` to use `avg` age instead of `max` age**
Using `avg(age1, age2)` instead of `max` would raise fertility for young-old couples. This is a
fertility-model decision that belongs in a separate ARD (it changes what "couple age" means
biologically) and may have unintended interactions with the illness and resource factors. The
age-preference fix is upstream: fewer young-old pairings form in the first place.

## Consequences

**Files that change:**
- `src/Events/RelationshipEvent.ts` — multiply formation probability by `ageGapModifier`
- `src/App/Simulation.ts` — replace shuffle-and-pair-sequentially with nearest-age greedy pairing
- `src/Helpers/Variables.ts` — add `RELATIONSHIP_AGE_GAP_SCALE`, `RELATIONSHIP_AGE_GAP_FLOOR`

**Tests that must be written:**
- `RelationshipEvent.test.ts`: formation probability for a large age gap is strictly lower than for a small gap given the same rng threshold; formation still fires at large gap when rng is sufficiently low (floor is nonzero)
- `Simulation.test.ts`: seeded pairs are more age-proximate than random (median age gap of seeded pairs is below the median expected from a uniform random shuffle)
