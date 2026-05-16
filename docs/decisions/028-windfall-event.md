# ARD 028: WindfallEvent

**Status:** Accepted
**Date:** 2026-05-16

## Context

The simulation has two strong inequality-widening mechanisms: `KillEvent` (Gini modulates killing → population loss → further inequality) and `StealEvent` (direct resource transfer from low- to high-intent persons). Under adverse seeding, these can drive Gini upward without any counter-force, making stable and thriving outcomes almost unreachable. Real economies also include windfall events — inheritances, gifts, insurance payouts — that redistribute resources and create recovery pathways. `Person` has no windfall-related field; no such event exists in `EventFactory`.

## Decision

Add `WindfallEvent` (implements `IEvent`). Gated at the factory level with a base-rate × age-modifier check; no intent field on `Person` (windfalls are external, not deliberate). `execute()` adds a flat random draw to `person.resources`.

**Amount formula:**

```typescript
person.resources += Variables.WINDFALL_BASE_AMOUNT + this.rng() * Variables.WINDFALL_VARIANCE;
```

Produces a uniform draw in `[WINDFALL_BASE_AMOUNT, WINDFALL_BASE_AMOUNT + WINDFALL_VARIANCE]`.

**Factory gate:**

```typescript
if (this.rng() < Variables.BASE_WINDFALL_RATE
    * ageModifier(person.age, Variables.WINDFALL_PEAK_AGE,
                  Variables.WINDFALL_AGE_SCALE, Variables.WINDFALL_AGE_FLOOR)) {
  events.push(new WindfallEvent(this.rng));
}
```

**New constants in `Variables.ts`:**

| Constant | Controls |
|---|---|
| `BASE_WINDFALL_RATE` | Per-tick base probability of a windfall at peak age; calibrated to ~3% annually, matching SCF/HRS inheritance prevalence data (`docs/research-windfall.md`). |
| `WINDFALL_BASE_AMOUNT` | Minimum resources added per windfall; floor of the uniform draw. |
| `WINDFALL_VARIANCE` | Width of the uniform draw above the base; controls the spread of windfall sizes. |
| `WINDFALL_PEAK_AGE` | Age of highest windfall probability; empirically 58 (parental death timing). |
| `WINDFALL_AGE_SCALE` | Controls width of the age bell curve; 20 yields a ~30-year window of meaningful receipt. |
| `WINDFALL_AGE_FLOOR` | Minimum modifier at non-peak ages; non-zero to allow gifts and other non-inheritance windfalls. |

**No record class.** Windfalls have no victim and no perpetrator — nothing to track for future mechanics. The effect is observable via `averageResources` and `resourceGini` in `TickSnapshot`.

## Reasoning

**Flat amount over proportional.** A proportional formula (`base × (1 + resources × scalar)`) would mechanically widen the Gini coefficient: high-resource persons get larger windfalls, compounding the concentration already driven by `GatherResourcesEvent`, `KillEvent`, and `StealEvent`. The simulation would have three inequality-widening forces and no counter-force, collapsing the stable/thriving outcome space. A flat draw gives low-resource persons an equal or relatively larger boost, providing a genuine recovery pathway — the mechanism that distinguishes "struggling but recoverable" from "inevitable collapse." The empirical case for proportional is real (large inheritances do favour the wealthy), but this mechanism is already indirectly captured: high-resource persons gather more each tick and survive longer, so resource concentration compounds without needing windfall to double-count it.

**Uniform draw over lognormal.** The empirical distribution of inheritance amounts is lognormal with a fat upper tail (`docs/research-windfall.md`: mean/median ratio ~3.5–4×). A lognormal draw would introduce a second design decision (the parameters) and occasional extreme outliers that distort `resourceGini` in single-tick snapshots. The uniform draw in `[BASE, BASE + VARIANCE]` produces consistent, legible resource bumps. If outlier-driven redistribution dynamics become a research question, a skewed draw is a candidate for a future revision.

**Age-gated at factory level, no intent field.** Windfalls require no deliberate action; adding an intent field to `Person` would imply the person can influence their probability, which contradicts the event's role as external luck. Factory-level gating follows the existing pattern for non-intent events (cf. `EnrollmentEvent`, `GraduationEvent`), keeps `execute()` free of the probability check, and makes the gate visible alongside all other event routing in one place.

## Consequences

- `src/Events/WindfallEvent.ts` — new file; constructor takes `rng`; `execute()` adds flat random draw to `person.resources`.
- `src/Events/EventFactory.ts` — add factory-level probability gate using `BASE_WINDFALL_RATE` and windfall age profile.
- `src/Helpers/Variables.ts` — add `BASE_WINDFALL_RATE`, `WINDFALL_BASE_AMOUNT`, `WINDFALL_VARIANCE`, `WINDFALL_PEAK_AGE`, `WINDFALL_AGE_SCALE`, `WINDFALL_AGE_FLOOR`.
- `src/tests/Events/WindfallEvent.test.ts` — tests must cover: resources increase by a value in `[BASE_AMOUNT, BASE_AMOUNT + VARIANCE]`; resources increase is independent of starting resources (flat, not proportional); multiple calls accumulate correctly.
- `src/tests/Events/EventFactory.test.ts` — add: `WindfallEvent` appears when rng is below threshold at peak age; does not appear when rng exceeds threshold.
- Cross-references: ARD 010 (EventFactory routing), ARD 011 (GatherResourcesEvent — the primary resource-acquisition path), ARD 027 (KillEvent — the inequality-widening force this event counterbalances).
