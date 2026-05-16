# ARD 025: RelationshipEvent

**Status:** Accepted
**Date:** 2026-05-16

## Context

`Person` has an `isInRelationshipWith: Person|null` field (currently always `null` after `seed()`) and `happiness` already grants +3 when the field is non-null (ARD 014). No event sets or clears that field. Until an event exists, all persons live and die single, the +3 happiness bonus is permanently inaccessible, and childbirth (which requires two live partnered parents) cannot be implemented.

The age profile constants (`RELATIONSHIP_PEAK_AGE`, `RELATIONSHIP_AGE_SCALE`, `RELATIONSHIP_AGE_FLOOR`) are already defined in `Variables.ts` (ARD 008). See `docs/research-relationships.md` for the demographic data that grounds the calibration targets below.

## Decision

Add `RelationshipEvent` (implements `IEvent`). The event handles the full relationship lifecycle — formation and dissolution — in two exclusive branches. `simulation.kill()` handles the third lifecycle transition (partner death).

**Formation branch** — fires when `person.isInRelationshipWith === null`:

```typescript
const formProb = Variables.BASE_RELATIONSHIP_RATE
  * (1 + person.charisma * Variables.RELATIONSHIP_CHARISMA_SCALAR)
  * ageModifier(person.age, Variables.RELATIONSHIP_PEAK_AGE,
                Variables.RELATIONSHIP_AGE_SCALE, Variables.RELATIONSHIP_AGE_FLOOR);
if (rng() < formProb) {
  const other = simulation.getRandomOther(person);
  if (other && other.isInRelationshipWith === null) {
    person.isInRelationshipWith = other;
    other.isInRelationshipWith = person;
  }
}
```

`getRandomOther()` may return a partnered person; the inner eligibility check is the gate. No consent roll — the dual unpartnered gate is sufficient (standard ABM practice; see research doc).

**Dissolution branch** — fires when `person.isInRelationshipWith !== null`:

```typescript
if (rng() < Variables.BASE_BREAKUP_RATE) {
  const partner = person.isInRelationshipWith;
  person.isInRelationshipWith = null;
  partner.isInRelationshipWith = null;
}
```

**Death cleanup** — in `Simulation.kill()`, before pushing to `deceased`:

```typescript
if (person.isInRelationshipWith !== null) {
  person.isInRelationshipWith.isInRelationshipWith = null;
  person.isInRelationshipWith = null;
}
```

The surviving partner loses the +3 happiness bonus immediately; MisfortuneEvent's suicide check (`SUICIDE_PROBABILITY_SCALE / (happiness + 1)`) then captures elevated post-bereavement mortality without a dedicated widowhood mechanic.

New constants in `Variables.ts`:

| Constant | Rationale |
|---|---|
| `BASE_RELATIONSHIP_RATE` | Per-tick formation probability ceiling; scaled by charisma and ageModifier to land near 7–10% at peak age for a median-charisma person |
| `RELATIONSHIP_CHARISMA_SCALAR` | Controls how much charisma amplifies formation probability above base; charisma ranges 1–10, so this should be small enough that even low-charisma persons can form relationships |
| `BASE_BREAKUP_RATE` | Flat per-tick dissolution probability; calibrated to ~3% to match empirical ~40% lifetime dissolution over ~8-year average partnership duration |

## Reasoning

**Flat dissolution rate over stress-weighted.** Economic stress and inequality predict real-world dissolution, which is directly relevant to the collapse signal. However, there is no calibration anchor for what weight to apply — we know the output (3% per year) but not the input partition (how much is base vs. stress). Stress-weighting would require us to choose a formula and two scalars with no empirical grounding for either. Flat rate matches the demographic output; stress-weighting can be added once we have simulation data showing whether partnership rates diverge meaningfully under high-Gini conditions.

**Charisma modifier over charisma-only or no stat modifier.** Using charisma alone (e.g., `rng() < person.charisma * scalar * ageModifier`) would make formation impossible at charisma = 0, which is unrealistic — even low-charisma persons form partnerships. A `(1 + charisma * scalar)` multiplier preserves a non-zero floor while letting charisma create meaningful spread across the distribution. Omitting any stat modifier entirely was rejected because relationship formation is the primary output of charisma in the sim; without it, charisma has no channel to affect collapse dynamics except indirectly through job gain.

**Mutual assignment at formation over single-sided.** If only the initiating person's field were set, the partner's happiness wouldn't change and childbirth (which requires both parents to be partnered) would be broken. Mutual assignment in the same `execute()` call also prevents a second agent from forming a new relationship with the same partner in the same tick — by the time `other` is drawn, the partner check runs against the already-updated field.

**Clear partner reference on death over retain.** Retaining the reference would require `happiness` and all downstream consumers to handle dead partners as a distinct state (non-null but deceased), or risk stale-reference bugs. The existing `happiness` getter already returns +3 for any non-null reference regardless of the partner's living status — so retaining would incorrectly preserve the bonus after bereavement. Clearing on death removes the need for any new state; the -3 happiness drop and subsequent MisfortuneEvent exposure are a proportionate proxy for the widowhood effect documented in the research.

**Single event (formation + dissolution) over two separate events.** Formation and dissolution are exclusive branches on the same field and their calibration is interdependent — a higher formation rate without a matching dissolution rate would saturate the population near 100% partnered quickly. Keeping them in one event class makes the lifecycle readable in one place. Supersession is clean: if dissolution mechanics need revision (e.g., stress-weighting), a new ARD replaces this one in full.

## Consequences

- `src/Events/RelationshipEvent.ts` — new file implementing `IEvent`
- `src/App/Simulation.ts` — extend `kill()` with partner-field cleanup before pushing to `deceased`
- `src/Events/EventFactory.ts` — add `RelationshipEvent` to the unconditional list (it self-gates internally on `isInRelationshipWith`)
- `src/Helpers/Variables.ts` — three new constants: `BASE_RELATIONSHIP_RATE`, `RELATIONSHIP_CHARISMA_SCALAR`, `BASE_BREAKUP_RATE`
- `src/tests/Events/RelationshipEvent.test.ts` — tests must cover: unpartnered person forms relationship with unpartnered other (both fields set); unpartnered person draws a partnered other (no change); dissolution clears both partners' fields; person with no other available (sole living person) does not throw; death cleanup via `Simulation.kill()` clears surviving partner's field
- `src/tests/App/Simulation.test.ts` — add test for partner-field cleanup in `kill()`
- Resource pooling (noted in `docs/future-ideas.md`) is explicitly out of scope for this ARD
