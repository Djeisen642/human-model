# ARD 040: WindfallEvent Sourced From Natural Resource Pool

**Status:** Accepted
**Date:** 2026-05-17

## Context

ARD 028 introduced `WindfallEvent` as an inequality counter-force: a flat exogenous draw added to a person's resources. The amount appeared from nothing — no pool was debited. Combined with ARD 039's gather conservation, windfall becomes the only remaining non-conservative inflow in the model. Even at small magnitude (~0.1–0.3 expected per person per tick), over the model's lifetime it accumulates to tens of free resource units per person and reinforces the same accounting problem ARD 039 fixes: personal welfare drifts upward independent of commons state. The "external luck" framing is real, but in a closed simulation any "luck" must be sourced from something — otherwise the collapse model can never fully collapse.

## Decision

`WindfallEvent.execute()` debits the windfall amount from `simulation.naturalResources` and credits it to the person. The pool is the source of "luck" — foraging finds, wild bounties, unattributed natural windfall. Conservation now holds across the gather/windfall pair.

```typescript
const drawn = Variables.WINDFALL_BASE_AMOUNT + this.rng() * Variables.WINDFALL_VARIANCE;
const granted = Math.min(drawn, simulation.naturalResources);
person.resources += granted;
simulation.naturalResources -= granted;
```

When pool is empty (`naturalResources === 0`), `granted` is 0 — no windfall fires. This is intentional: windfall is a pool-gated event. The factory-level age/probability gate (ARD 028) is unchanged; the gating happens at execute time via the pool clamp rather than refusing to construct the event, so the existing factory test surface is undisturbed.

No new constants. No new field on `Simulation`.

## Reasoning

**Pool-sourced over community-pool-sourced.** Routing windfall through `communityPool` (welfare-style) would make it a redistribution event, not a luck event. That collapses the distinction with welfare (ARD 034) and loses the inequality counter-force ARD 028 was built for — welfare already targets low-resource persons; windfall is meant to hit anyone via random draw. Pool-sourcing preserves the "external" character: windfall comes from the commons, not from other people.

**Pool-sourced over removing the event.** Without windfall, the inequality-widening from `KillEvent` and `StealEvent` has no counter-force (ARD 028's original justification). Removing windfall would push the model toward unconditional collapse trajectories; we want runs that can recover.

**Silent clamp when pool insufficient over partial-then-zero behavior.** The simpler design (grant whatever pool has, even if less than the draw) preserves the gate semantics with no new edge cases. A "skip when pool < drawn" rule would create a discontinuity at the boundary.

**No record class.** Same reasoning as ARD 028 — no perpetrator, no victim, observable via aggregates.

## Consequences

- `src/Events/WindfallEvent.ts` — constructor signature unchanged; `execute()` now debits the pool per Decision.
- `src/Helpers/Variables.ts` — no changes (constants retained).
- `src/tests/Events/WindfallEvent.test.ts` — update assertions: pool decreases by the granted amount; pool clamps at zero (windfall draws partial or nothing); person.resources increases by the granted amount.
- The model now has a single non-conservative inflow: `JailEvent`'s flat gather (addressed in ARD 041) and exogenous taxation flows. With ARDs 039, 040, 041 in place, the closed-system accounting will hold.
- `CLAUDE.md` — update WindfallEvent line under "What's implemented" to note pool-sourcing.
- Calibration: in a pool-exhausted world, windfall fires zero output. This is the intended dynamic — pool exhaustion ends the "lucky finds" pathway and the personal economy must rely on welfare + stockpiles alone. Expect the post-pool-exhaustion phase to look meaningfully grimmer than current runs.
- Cross-references: supersedes [ARD 028](./028-windfall-event.md); paired with [ARD 039](./039-gather-productivity-model.md) and [ARD 041](./041-jail-from-community-pool.md) as the resource-conservation triad.
