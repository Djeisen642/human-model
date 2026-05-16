# ARD 024: Resource Consumption

**Status:** Proposed
**Date:** 2026-05-16

## Context

`GatherResourcesEvent` adds resources each tick; nothing removes them except disasters and (eventually) theft. A non-worker stays at 0 permanently but faces no consequence; a high earner accumulates without bound. Without a subsistence drain, the Gini coefficient only reflects gathering advantage, not survival pressure — and starvation-driven collapse (Tainter, Diamond) cannot be modeled. `StealEvent` is next on the roadmap and its dynamics are much weaker without a resource floor that makes theft survival-threatening.

## Decision

Add `ConsumptionEvent` as an unconditional event, inserted between `GatherResourcesEvent` and `JobEvent` in the `EventFactory` unconditional list.

**Consumption formula:**

```
cost = CONSUMPTION_BASE * ageConsumptionMultiplier(age)
resources = max(0, resources - cost)
```

`ageConsumptionMultiplier` is a piecewise scalar:
- `age < CONSUMPTION_CHILD_MAX_AGE` → `CONSUMPTION_CHILD_MULTIPLIER`
- `age >= CONSUMPTION_ELDER_MIN_AGE` → `CONSUMPTION_ELDER_MULTIPLIER`
- otherwise → `1.0`

**Starvation mechanism:**

When `resources` reaches 0 after deduction, add `STARVATION_ILLNESS_RATE` to `person.illness`, clamped to `[0, 1]`. No separate starvation death path — this funnels into the existing illness→mortality chain in `MisfortuneEvent`. Recovery happens naturally via `IllnessEvent` once resources recover.

**Event ordering:**

```
AgeEvent → ExperienceEvent → IllnessEvent → GatherResourcesEvent
  → ConsumptionEvent → JobEvent → MisfortuneEvent
```

`IllnessEvent` recovery can fire before starvation illness is added; the net effect is still a positive illness increment in a starvation tick. Starvation illness is visible to `MisfortuneEvent` within the same tick.

**Constants introduced:**

- `CONSUMPTION_BASE` — adult baseline resources consumed per tick. Calibrated so a median adult (mid-range experience and intelligence, working age) can sustain themselves without long-term depletion, while a low-stat non-worker depletes within a handful of ticks.
- `CONSUMPTION_CHILD_MAX_AGE` — age below which the child multiplier applies (exclusive). Children cannot gather at scale; higher costs model dependency.
- `CONSUMPTION_CHILD_MULTIPLIER` — upward scalar on cost for children. Calibration intent: a newborn with no resources should begin starving immediately.
- `CONSUMPTION_ELDER_MIN_AGE` — age at or above which the elder multiplier applies. Aligns with the retirement / health-cost threshold already used in `happiness`.
- `CONSUMPTION_ELDER_MULTIPLIER` — upward scalar on cost for elderly. Calibration intent: modest increase over adult baseline, not survival-threatening for a person with accumulated resources.
- `STARVATION_ILLNESS_RATE` — illness severity added per tick at zero resources. Calibration intent: 3–4 consecutive ticks at zero resources should bring a healthy person to illness ≈ 0.5, meaningfully raising mortality risk without guaranteeing immediate death.

## Reasoning

**Flat rate rejected:** A uniform cost treats a 5-year-old identically to a 45-year-old. Age already modifies every other event probability; excluding it from consumption would be the exception. The child/elder distinction captures the two empirically meaningful deviations — children cannot work, elderly face healthcare costs — without introducing new math infrastructure.

**Dependents and welfare deferred:** Scaling cost to number of dependent children requires knowing which children are economically dependent on which adults, a question the Childbirth ARD must answer when it defines parent–child resource flows. Welfare redistribution is a future-ideas candidate; this ARD establishes the floor, not redistribution mechanisms.

**Starvation-death hard cut rejected:** Instant death at zero resources produces an unrealistic cliff — one unlucky gather tick kills a person who would have recovered. The illness system already handles probabilistic mortality under physiological stress; routing starvation through it keeps the death-rate distribution realistic and avoids a second mortality mechanism requiring independent calibration.

**Hunger stat rejected:** A new per-person accumulator for cumulative deprivation is redundant with `illness`, which already represents physiological deterioration over time. Calibrating two mortality paths against each other adds complexity with no clear payoff.

**Consumption before gathering rejected:** Deducting costs before `GatherResourcesEvent` fires would penalise persons with positive resources before they have a chance to cover the cost this period. Post-gather consumption matches "earn then spend" and avoids starving a person whose gather would have kept them solvent.

## Consequences

- New file: `src/Events/ConsumptionEvent.ts`
- `EventFactory` unconditional list gains `ConsumptionEvent` after `GatherResourcesEvent`; JSDoc comment on `getEventsFor` must be updated to reflect new ordering
- `Variables.ts` gains six constants
- Tests must cover:
  - Adult pays `CONSUMPTION_BASE`; resources reduced correctly
  - Child (age < `CONSUMPTION_CHILD_MAX_AGE`) pays `CONSUMPTION_BASE * CONSUMPTION_CHILD_MULTIPLIER`
  - Elder (age >= `CONSUMPTION_ELDER_MIN_AGE`) pays `CONSUMPTION_BASE * CONSUMPTION_ELDER_MULTIPLIER`
  - Resources never go below 0 (floor enforced)
  - Starvation illness increment fires when resources hit 0 after deduction
  - No starvation illness increment when resources remain > 0 after deduction
  - Starvation does not add illness when the person is already dead (`causeOfDeath !== null` guard, consistent with other events)
- `EventFactory` test should verify `ConsumptionEvent` appears between `GatherResourcesEvent` and `JobEvent` in the returned list
