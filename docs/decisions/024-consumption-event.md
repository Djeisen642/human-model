# ARD 024: Resource Consumption

**Status:** Proposed
**Date:** 2026-05-16

## Context

`GatherResourcesEvent` adds resources each tick; nothing removes them except disasters and (eventually) theft. A non-worker stays at 0 permanently but faces no consequence; a high earner accumulates without bound. Without a subsistence drain, the Gini coefficient only reflects gathering advantage, not survival pressure — and starvation-driven collapse (Tainter, Diamond) cannot be modeled. `StealEvent` is next on the roadmap and its dynamics are much weaker without a resource floor that makes theft survival-threatening.

## Decision

Add `ConsumptionEvent` as an unconditional event, inserted between `GatherResourcesEvent` and `JobEvent` in the `EventFactory` unconditional list.

**Adult and elderly formula:**

```
cost = CONSUMPTION_BASE * ageConsumptionMultiplier(age)
resources = max(0, resources - cost)
```

`ageConsumptionMultiplier` is a piecewise scalar:
- `age >= CONSUMPTION_ELDER_MIN_AGE` → `CONSUMPTION_ELDER_MULTIPLIER`
- otherwise → `1.0`

**Children (age < CONSUMPTION_CHILD_MAX_AGE):**

A child with at least one living parent consumes a small percentage of their own resources:

```
cost = resources * CONSUMPTION_CHILD_RESOURCE_RATE
resources = max(0, resources - cost)
```

Parental support is implicit: parents are assumed to keep the child fed, so the child's own account is treated as savings rather than the primary subsistence source. At zero resources the cost is zero and starvation does not fire — the living parent is covering subsistence. This is a simplification that will be superseded when the Childbirth ARD defines explicit parent→child resource transfers.

An orphaned child (age < `CONSUMPTION_CHILD_MAX_AGE`, `person.livingParents.length === 0`, `person.childOf.length > 0`) has no parental support and falls through to the adult flat-rate formula at `CONSUMPTION_BASE * 1.0`. When resources reach 0, starvation fires normally.

**Starvation mechanism:**

When `resources` reaches 0 after deduction, add `STARVATION_ILLNESS_RATE` to `person.illness`, clamped to `[0, 1]`. No separate starvation death path — this funnels into the existing illness→mortality chain in `MisfortuneEvent`. Recovery happens naturally via `IllnessEvent` once resources recover.

**Event ordering:**

```
AgeEvent → ExperienceEvent → IllnessEvent → GatherResourcesEvent
  → ConsumptionEvent → JobEvent → MisfortuneEvent
```

`IllnessEvent` recovery can fire before starvation illness is added in the same tick; the net effect is still a positive illness increment during a starvation tick. Starvation illness is visible to `MisfortuneEvent` within the same tick.

**Constants introduced:**

- `CONSUMPTION_BASE` — adult baseline resources consumed per tick. Calibrated so a median adult (mid-range experience and intelligence, working age) can sustain themselves without long-term depletion, while a low-stat non-worker depletes within a handful of ticks.
- `CONSUMPTION_CHILD_MAX_AGE` — age below which a person is treated as a child (exclusive).
- `CONSUMPTION_CHILD_RESOURCE_RATE` — fraction of own resources consumed per tick by a child with living parents. Calibration intent: slow drawdown — a child with moderate resources should last many ticks without hitting zero.
- `CONSUMPTION_ELDER_MIN_AGE` — age at or above which the elder multiplier applies. Aligns with the retirement / health-cost threshold already used in `happiness`.
- `CONSUMPTION_ELDER_MULTIPLIER` — upward scalar on cost for elderly. Calibration intent: modest increase over adult baseline, not survival-threatening for a person with accumulated resources.
- `STARVATION_ILLNESS_RATE` — illness severity added per tick at zero resources. Calibration intent: 3–4 consecutive ticks at zero resources should bring a healthy person to illness ≈ 0.5, meaningfully raising mortality risk without guaranteeing immediate death.

## Reasoning

**Percentage rate for children with living parents:** In reality, children's subsistence is covered by parents, not drawn from the child's own account. The simulation has no parent→child transfer mechanism yet (deferred to the Childbirth ARD). A percentage of own resources is the closest proxy: consumption scales with what the child actually holds, and at zero it collapses to zero — matching the assumption that a living parent prevents starvation. A flat child rate would force starvation even when parents are alive, which overstates child mortality before parent–child economics are properly modeled.

**Orphan flat rate:** A child with no living parents has lost the implicit subsidy. They face adult survival conditions — the flat rate applies and starvation fires at zero. This is the mechanism by which orphanhood is dangerous in the model.

**Flat rate for adults and elderly rejected in favour of piecewise multiplier:** A single flat rate ignores the empirically meaningful cost difference at the extremes of the age curve. The child/elder distinction is the right cut: it captures healthcare costs in old age and dependency in youth without introducing continuous functions that would be harder to calibrate.

**Welfare and tax pool deferred:** A redistribution mechanism (funded by taxation or death estates) is the natural complement to consumption and would dampen Gini. It is recorded in `future-ideas.md` for design after the baseline consumption + theft dynamics are observable. This ARD establishes the floor; redistribution is a separate decision.

**Starvation-death hard cut rejected:** Instant death at zero resources produces an unrealistic cliff — one unlucky gather tick kills a person who would have recovered. The illness system already handles probabilistic mortality under physiological stress; routing starvation through it keeps the death-rate distribution realistic and avoids a second mortality mechanism requiring independent calibration.

**Hunger stat rejected:** A new per-person accumulator for cumulative deprivation is redundant with `illness`, which already represents physiological deterioration over time. Calibrating two mortality paths against each other adds complexity with no clear payoff.

**Consumption before gathering rejected:** Deducting costs before `GatherResourcesEvent` fires would penalise persons with positive resources before they have a chance to cover the cost this period. Post-gather consumption matches "earn then spend" and avoids starving a person whose gather would have kept them solvent.

## Consequences

- New file: `src/Events/ConsumptionEvent.ts`
- `EventFactory` unconditional list gains `ConsumptionEvent` after `GatherResourcesEvent`; JSDoc comment on `getEventsFor` must be updated to reflect new ordering
- `Variables.ts` gains six constants
- Tests must cover:
  - Adult pays `CONSUMPTION_BASE`; resources reduced correctly
  - Elder (age >= `CONSUMPTION_ELDER_MIN_AGE`) pays `CONSUMPTION_BASE * CONSUMPTION_ELDER_MULTIPLIER`
  - Child with living parents pays `resources * CONSUMPTION_CHILD_RESOURCE_RATE`
  - Child with living parents at zero resources pays nothing and starvation does not fire
  - Orphaned child (childOf non-empty, no living parents) pays adult flat rate and starvation fires at zero
  - Seeded adult (childOf empty, age >= CONSUMPTION_CHILD_MAX_AGE) pays adult flat rate regardless of living parents
  - Resources never go below 0 (floor enforced for all cases)
  - Starvation illness increment fires when resources hit 0 after deduction (adult and orphan cases)
  - No starvation illness increment when resources remain > 0 after deduction
  - Starvation does not add illness when the person is already dead (`causeOfDeath !== null` guard, consistent with other events)
- `EventFactory` test should verify `ConsumptionEvent` appears between `GatherResourcesEvent` and `JobEvent` in the returned list
