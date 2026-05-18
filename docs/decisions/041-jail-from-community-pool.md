# ARD 041: JailEvent Gather Funded From Community Pool

**Status:** Accepted
**Date:** 2026-05-17

## Context

ARD 035 specified `JailEvent` as the substitute economy for incarcerated persons: a flat `JAIL_GATHER_AMOUNT` is added to their resources each tick and a flat `JAIL_CONSUMPTION_AMOUNT` is deducted. The gather is created from nothing — it is not pulled from any source. With ARDs 039 and 040 closing the gather and windfall accounting leaks, `JailEvent` becomes the only remaining non-conservative inflow. Conceptually it should not be: incarceration is administered by the community, so the resources used to sustain a prisoner ought to come from the community's funds.

## Decision

`JailEvent.execute()` debits `JAIL_GATHER_AMOUNT` from `simulation.communityPool` and credits the same amount to `person.resources`. When the community pool is insufficient, the prisoner receives only what is available (clamped). Consumption is unchanged — food consumed is destroyed (sink), matching `ConsumptionEvent`.

```typescript
const granted = Math.min(Variables.JAIL_GATHER_AMOUNT, simulation.communityPool);
simulation.communityPool -= granted;
person.resources += granted;

const cost = Variables.JAIL_CONSUMPTION_AMOUNT;
if (person.resources < cost) {
  person.illness = Math.min(1, person.illness + Variables.STARVATION_ILLNESS_RATE);
  person.resources = 0;
} else {
  person.resources -= cost;
}
```

When `communityPool === 0`, the prisoner gets nothing and immediately falls into the starvation branch via the existing consumption check. This is the intended dynamic: an empty community pool means the state can no longer feed its prisoners; they starve.

## Reasoning

**Community pool over natural resource pool.** Prisoners are not foraging; they are dependents of the community. Routing through `communityPool` matches the real-world institutional model and reuses ARD 034's existing funding chain (tax + jail forfeitures). Pool-sourcing would conflate jailing with subsistence foraging and break the institutional framing.

**Community pool over personal-resource-only.** Prisoners forfeit most resources at sentencing (ARD 035), so a "no gather while jailed" rule effectively guarantees starvation within a few ticks regardless of community state. That makes jail a de facto death sentence, which would dominate the inequality dynamics in unintended ways. Funding from `communityPool` lets the community choose how prison-tolerant it is via the welfare/forfeit/tax balance.

**Clamp when pool insufficient over fixed grant or refuse.** Same reasoning as ARD 040: the simpler design uses `Math.min` and lets the consumption check handle starvation. No new edge case in the event itself.

**Consumption stays a sink.** Routing prisoner consumption back to the community pool would be technically more conservative but conceptually wrong — the food is eaten, not returned. Matches `ConsumptionEvent` (ARD 024) treatment.

## Consequences

- `src/Events/JailEvent.ts` — replace flat gather with pool-clamped grant per Decision.
- `src/tests/Events/JailEvent.test.ts` — add cases: prisoner receives full grant when pool sufficient; receives partial grant when pool nearly empty; receives nothing when pool is zero (and triggers starvation); community pool decreases by exactly the granted amount.
- `CLAUDE.md` — update JailEvent line under "What's implemented" and the Key design decisions bullet for ARD 035 to note community-pool sourcing.
- Empirically: in runs where `communityPool` is healthy (high TAX_RATE, low welfare demand), jail acts as designed — incarcerated persons stay alive. In runs where the community pool is exhausted, jail becomes a death sentence. This is a meaningful new collapse dynamic — institutional failure cascades into prisoner mortality.
- Cross-references: modifies the jail mechanics established in [ARD 035](./035-jail-and-retribution.md); depends on `communityPool` introduced by [ARD 034](./034-community-pool-tax-welfare.md); paired with [ARD 039](./039-gather-productivity-model.md) and [ARD 040](./040-windfall-from-pool.md) as the resource-conservation triad.
