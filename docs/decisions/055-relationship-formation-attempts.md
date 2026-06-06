# ARD 055: Multiple Relationship Formation Attempts per Tick

**Status:** Accepted
**Date:** 2026-06-06

## Context

ARD 054 introduced an age-gap compatibility modifier that discounts cross-generational
pairings. With a simulated population spread across a wide age range, most random partner
draws land far from the person's own age and receive a low modifier. The single-attempt-per-tick
formation branch therefore rarely succeeds, and the overall paired fraction collapsed from
~50% to ~30% — well below the empirical target in `docs/research-pairing-prevalence.md`.

The problem is not that the per-attempt probability is wrong; it is that one attempt per year
is too few when most attempts draw an incompatible candidate and are discarded.

## Decision

Allow the formation branch to draw up to `RELATIONSHIP_MAX_FORMATION_ATTEMPTS` candidates
per tick, stopping early as soon as a relationship forms. Each draw is an independent
probability check (same formula as ARD 054: base rate × charisma × person-age modifier ×
age-gap modifier). The person's own-age component of the probability is computed once per tick
and reused across attempts; only the age-gap term varies per draw.

One new constant:
- `RELATIONSHIP_MAX_FORMATION_ATTEMPTS` — upper bound on candidate draws per tick per person; calibrated so the paired fraction at steady state returns to the empirical target

The dissolution branch is unchanged.

## Reasoning

**Alternative: raise `BASE_RELATIONSHIP_RATE`**
A higher base rate would restore overall pairing volume, but it does so by inflating the
acceptance probability for every drawn candidate — including the old ones the age-gap modifier
was introduced to discount. Multiple attempts preserve the per-pair age-gap signal: a
close-in-age draw still has a high acceptance probability; a cross-generational draw still has
a low one. Raising the rate would undo the intent of ARD 054.

**Alternative: raise `RELATIONSHIP_AGE_GAP_SCALE`**
A larger scale softens the age-gap penalty so more cross-age draws succeed. This restores
pairing volume by accepting more mismatched pairs — the opposite of what ARD 054 intended.
Multiple attempts achieve the same volume by giving each person more chances to draw a
compatible partner, not by relaxing the compatibility criterion.

**Alternative: weighted partner selection**
Draw candidates with probability proportional to age compatibility rather than uniformly.
This guarantees that drawn candidates are close in age, but it requires scanning the population
to build a weight vector each formation attempt — O(n) per attempt vs O(1). For a mechanism
that runs every tick for every person, that cost compounds quickly.

## Consequences

**Files that change:**
- `src/Events/RelationshipEvent.ts` — formation branch wrapped in a loop up to `RELATIONSHIP_MAX_FORMATION_ATTEMPTS`
- `src/Helpers/Variables.ts` — add `RELATIONSHIP_MAX_FORMATION_ATTEMPTS`

**Tests that must be written:**
- `RelationshipEvent.test.ts`: when the first draw fails due to the age-gap modifier but a
  second draw would succeed (closer in age), the relationship forms — confirming the retry loop
  fires
