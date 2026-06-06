# ARD 053: Relationship Formation Minimum Age and Rate Recalibration

**Status:** Proposed
**Date:** 2026-06-06

## Context

Two related gaps in `RelationshipEvent` surfaced after ARD 052 added children to the initial population:

1. **No minimum age gate.** `RelationshipEvent` fires for every living person each tick. The
   `ageModifier` bell curve (peak at `RELATIONSHIP_PEAK_AGE`) produces a low-but-nonzero modifier
   even at age one, meaning seeded children could form partnerships as they age through early ticks.
   This is implausible and was never a concern before because the seeded age floor was 15.

2. **Post-crash recovery is too slow.** The pairing prevalence measurement
   (`docs/research-pairing-prevalence.md`) showed that at low population the random-other draw rarely
   returns an unpartnered person, collapsing the effective formation rate even though `BASE_RELATIONSHIP_RATE`
   is adequate at full population. Crash recovery therefore stalls: the few surviving adults cannot
   re-pair quickly enough to resume reproduction before the population dies out.

## Decision

### 1. Relationship minimum age: `RELATIONSHIP_MIN_AGE`

Add a hard age gate at the top of `RelationshipEvent.execute()`: persons younger than
`RELATIONSHIP_MIN_AGE` skip both the formation and dissolution branches entirely. The threshold is set
to the commonly recognised lower bound for consensual adult relationships. This removes the
`ageModifier` floor as a mechanism for pre-adolescent partnerships and cleanly separates childhood
(ARD 052's new age range) from the partnership lifecycle.

### 2. `BASE_RELATIONSHIP_RATE` raised

Raise `BASE_RELATIONSHIP_RATE` from its current value. The existing value produces adequate steady-state
pairing mathematically but post-crash recovery is too slow at low population. A higher value accelerates
re-pairing after a crash without materially shifting steady-state behaviour, and partially compensates
for the mate-finding Allee effect at low density. Calibrate so the steady-state paired fraction sits
within the empirical target range established in `docs/research-pairing-prevalence.md`.

## Reasoning

**Alternative: rely solely on `ageModifier` to suppress child partnerships**
The bell curve floor is small but nonzero at young ages, so it does not fully prevent child
partnerships — it only makes them rare. A hard gate is unambiguous and removes a latent source of
implausible behaviour with no downside: the `ageModifier` continues to govern the formation probability
above the threshold.

**Alternative: lower `BASE_BREAKUP_RATE` instead of raising `BASE_RELATIONSHIP_RATE`**
A lower dissolution rate keeps existing pairs together longer but does not accelerate re-pairing after
a crash, where the problem is formation, not dissolution. Survivors of a crash are mostly unpartnered
(their partners died); lowering breakup rate has no effect on their ability to find new partners. Raising
formation rate is the direct lever on crash recovery.

**Alternative: put both decisions in ARD 052**
The minimum age gate is architecturally motivated by ARD 052 (children now exist in the seed) but it
is a change to `RelationshipEvent`, not to `Simulation.seed()`. Supersession is cleaner with it here:
a future revision to the age threshold or the rate constant supersedes this ARD without touching the
seeding ARD.

## Consequences

**Files that change:**
- `src/Events/RelationshipEvent.ts` — `RELATIONSHIP_MIN_AGE` guard at top of `execute()`
- `src/Helpers/Variables.ts` — add `RELATIONSHIP_MIN_AGE`; raise `BASE_RELATIONSHIP_RATE`

**Tests that must be written / updated:**
- `RelationshipEvent.test.ts`: persons under `RELATIONSHIP_MIN_AGE` are skipped in both the formation
  and dissolution branches; persons at and above `RELATIONSHIP_MIN_AGE` follow existing behaviour
