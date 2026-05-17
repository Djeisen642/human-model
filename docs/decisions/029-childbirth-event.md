# ARD 029: ChildbirthEvent

**Status:** Accepted
**Date:** 2026-05-17

## Context

`Person` has `hasChildren: Array<Person>` and `childOf: Array<Person>`, and the constructor accepts a two-parent array (`new Person([p1, p2])`). `Simulation.add()` admits new persons mid-run. `RelationshipEvent` (ARD 025) manages partnering and dissolution, so a birth mechanic has a stable relationship field to gate on. Without `ChildbirthEvent`, population grows only by initial seeding; births cannot offset mortality, so all long-run trajectories trend toward collapse regardless of resource dynamics.

Calibration data is in `docs/research-childbirth.md`. The Hutterite natural fertility dataset (no contraception, all births wanted) provides the biological ceiling (~40–55% annual probability at peak age); modern US ASFR data is lower because it includes non-partnered and voluntarily childless women — not appropriate for this simulation where all partnerships are treated as willing couples.

## Decision

Add `ChildbirthEvent` (implements `IEvent`). Added to the unconditional event list in `EventFactory` between `RelationshipEvent` and `KillEvent`; probability gating is inside `execute()` because the gate depends on multiple person stats (illness, resources, happiness) not available at factory level.

**Deduplication.** Both partners will have `ChildbirthEvent` in their event list each tick. To prevent double-creation, only the partner with the lower index in the living array fires. `Simulation.indexOfLiving(person)` reads the internal array directly (no per-call allocation):

```typescript
const partner = person.isInRelationshipWith;
if (!partner) return;
if (simulation.indexOfLiving(person) > simulation.indexOfLiving(partner)) return;
```

**Probability formula.** All factors aggregate both partners' stats so the dedup choice doesn't shift fertility — `max` for illness (worst-case blocker), `min` for resources (poorer partner binds), `max` for age (older partner constrains biological fecundity), `avg` for happiness (soft signal):

```typescript
const coupleIllness = Math.max(person.illness, partner.illness);
const coupleResources = Math.min(person.resources, partner.resources);
const coupleHappiness = (person.happiness + partner.happiness) / 2;
const coupleAge = Math.max(person.age, partner.age);

const illnessFactor = Math.max(0, 1 - coupleIllness * CHILDBIRTH_ILLNESS_SCALAR);
const resourceRange = CHILDBIRTH_RESOURCE_SCALE - CHILDBIRTH_RESOURCE_MIN;
const resourceFactor = Math.min(1, Math.max(0,
  (coupleResources - CHILDBIRTH_RESOURCE_MIN) / resourceRange
));
const happinessFactor = 1 + coupleHappiness * CHILDBIRTH_HAPPINESS_SCALAR;
const p = BASE_CHILDBIRTH_RATE
  * ageModifier(coupleAge, CHILDBIRTH_PEAK_AGE,
                CHILDBIRTH_AGE_SCALE, CHILDBIRTH_AGE_FLOOR)
  * illnessFactor * resourceFactor * happinessFactor;
if (this.rng() >= p) return;
```

**On birth:**
1. Deduct `CHILDBIRTH_BIRTH_COST` from each parent's resources, floored at 0.
2. `const child = new Person([person, partner])`.
3. Push `child` to both `person.hasChildren` and `partner.hasChildren`.
4. `simulation.add(child)`.

**New constants in `Variables.ts`:**

| Constant | Controls |
|---|---|
| `BASE_CHILDBIRTH_RATE` | Per-tick ceiling probability at peak age for a fully-healthy, well-resourced, peak-happiness couple. Calibrated to the Hutterite natural fertility rate (~40–55% at ages 20–30 for willing couples). |
| `CHILDBIRTH_ILLNESS_SCALAR` | How severely illness suppresses fertility. At 0.8, full illness eliminates fertility; at 0.5 illness, fertility is halved. Consistent with hormonal disruption data for moderate-to-severe chronic illness. |
| `CHILDBIRTH_RESOURCE_MIN` | Resource level at or below which fertility is zero (famine threshold). Dutch Hunger Winter data: birth rate fell ~50% at 400–800 cal/day; fertility resumes rapidly once resources recover. |
| `CHILDBIRTH_RESOURCE_SCALE` | Resource level at which full fertility is restored; linear ramp between MIN and SCALE. |
| `CHILDBIRTH_HAPPINESS_SCALAR` | Modest multiplier; higher happiness increases birth probability. Real but small signal — operates more on intention than biological fecundability. |
| `CHILDBIRTH_BIRTH_COST` | One-time resource deduction from each parent at birth. Calibrated proportionately to first-year child-rearing costs relative to median resources (~25% hit at median). |

Age profile constants (`CHILDBIRTH_PEAK_AGE`, `CHILDBIRTH_AGE_SCALE`, `CHILDBIRTH_AGE_FLOOR`) already exist in `Variables.ts` from ARD 008.

## Reasoning

**Deduplication by index over a new Person field.** Adding a `lastChildbirthTick` field to `Person` would work but introduces a stat whose sole purpose is bookkeeping — it would load into agent context without informational value. Comparing living-array indices is O(n) but n is ~100, called only when a couple's probability roll passes (~3% of partnered persons at peak age), and requires no changes to `Person`. A single-sided approach (e.g., only fire for persons whose partner reference is "less than" theirs by some property) is O(1) but breaks if two persons share all compared properties; index comparison is unambiguous.

**Three separate factors over a single composite health factor.** Illness, resources, and happiness are empirically distinct mechanisms with different magnitudes and time courses (illness is fast-cycling, resources respond to gathering, happiness is computed from many sources). A composite would either require a new derived stat or obscure which mechanism is active when debugging collapse trajectories. Treating them as multiplicative factors is both compositionally simple and empirically defensible. Illness and resource factors are true suppressors in `[0, 1]` and can independently zero the probability; happiness is a small booster in `[1, ~1.5+]` reflecting that high mood lifts birth intention but never blocks it on its own.

**Couple aggregation: max illness, min resources, max age, avg happiness.** The dedup rule fires only the lower-index partner, but the lower-index choice is arbitrary — using only `person`'s stats would mean two otherwise-identical couples could have different fertility based on insertion order. Couple-level aggregates fix this:

- **`max(illness)`** — the unhealthier partner constrains fertility (one partner's chronic illness disrupts the couple's reproduction).
- **`min(resources)`** — the poorer partner binds the resource floor; we don't model resource pooling between partners (ARD 025 deferred it), so the Dutch Hunger Winter threshold should fire when either partner is below it.
- **`max(age)`** — biological fecundity falls off with age; the older partner is the binding constraint (Hutterite age-fertility curves are by mother's age, which is implicitly the older-curve constraint in mostly age-paired pairings).
- **`avg(happiness)`** — happiness is a soft, intention-level signal; either partner being a bit unhappy shouldn't fully cancel a happy partner's contribution, so averaging is the right shape.

**Resource threshold ramp over linear scale from 0.** A linear scale from `resources = 0` would give non-zero fertility even at near-starvation conditions, contradicting the Dutch Hunger Winter evidence of a hard biological threshold. The ramp (zero below `RESOURCE_MIN`, full above `RESOURCE_SCALE`) captures the threshold behavior while avoiding a hard cliff.

**Gini is not a direct modulator.** The resource threshold already captures the mechanism: in high-Gini populations, more persons fall below `CHILDBIRTH_RESOURCE_MIN`, suppressing births naturally. A Gini term would double-count the same causal path and make it harder to attribute fertility changes in simulation output. See `docs/research-childbirth.md`.

**`BASE_CHILDBIRTH_RATE = 0.40` (Hutterite ceiling), not the modern US ASFR.** Modern US rates (~9–10% at peak) reflect contraceptive use and deliberate family planning — not the right anchor for a simulation where partnered couples represent willing reproductive dyads. Hutterite data (no contraception, well-nourished) gives the biological ceiling at ~40–55% at peak ages; the suppressors (illness, resources, happiness, ageModifier) then bring the effective rate down to realistic values for non-ideal conditions.

**No interbirth interval cooldown.** `BASE_CHILDBIRTH_RATE ≈ 0.40` at peak age produces a geometric inter-birth distribution with mean ~2.5 years, matching the global average of 32 months. A separate cooldown mechanic would add complexity without changing the distributional outcome. See `docs/research-childbirth.md`.

## Consequences

- `src/Events/ChildbirthEvent.ts` — new file; constructor takes `rng`; `execute()` implements deduplication check, couple-aggregate probability roll, and birth mechanics.
- `src/App/Simulation.ts` — adds `indexOfLiving(person)` to expose insertion-order index without allocating a fresh copy of the living array (`getLiving()`'s copy was wasteful for hot-path index lookups).
- `src/Events/EventFactory.ts` — `ChildbirthEvent` in the unconditional list between `RelationshipEvent` and `KillEvent`.
- `src/Helpers/Variables.ts` — `BASE_CHILDBIRTH_RATE`, `CHILDBIRTH_ILLNESS_SCALAR`, `CHILDBIRTH_RESOURCE_MIN`, `CHILDBIRTH_RESOURCE_SCALE`, `CHILDBIRTH_HAPPINESS_SCALAR`, `CHILDBIRTH_BIRTH_COST`.
- `src/tests/Events/ChildbirthEvent.test.ts` — covers: no-op when unpartnered, rng fails, couple resources ≤ RESOURCE_MIN, couple illness saturated; deduplication trio (lower fires, higher no-ops alone, both together = one child); birth wiring (child.childOf, hasChildren on both, cost deduction, cost floored at 0 still births); couple aggregation (partner illness blocks healthy person, poorer partner binds resourceFactor, older partner drives ageModifier into floor).
- Cross-references: ARD 008 (ageModifier, age profile constants), ARD 010 (EventFactory routing), ARD 025 (RelationshipEvent — isInRelationshipWith lifecycle, deferred resource pooling).

**Feedback into existing chains.** `ChildbirthEvent` runs after `ConsumptionEvent`, so its `CHILDBIRTH_BIRTH_COST` deduction is additive to the same tick's consumption. A couple at the resource floor can drop to 0 post-birth and trigger the existing starvation chain (`STARVATION_ILLNESS_RATE` → `MisfortuneEvent` illness mortality) over the next ticks. This is the intended "high cost of parenthood" feedback, not a bug — births during scarcity should carry survival risk.
