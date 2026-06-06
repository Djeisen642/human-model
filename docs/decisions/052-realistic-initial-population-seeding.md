# ARD 052: Realistic Initial Population Seeding

**Status:** Proposed
**Date:** 2026-06-06

## Context

`Simulation.seed()` currently creates all persons with a minimum age of 15 and `isInRelationshipWith = null`
(entirely unpartnered). The pairing prevalence measurement (`scripts/measure-pairing.ts`, 16 seeds, 500
ticks) showed the model operates at ~42% overall pairing and ~21% during crashes — well below the
empirical fraction of adults in a romantic/sexual relationship at any given time (~60–70%). Two structural
root causes:

1. **The simulation starts at zero pairing.** It takes dozens of ticks to approach equilibrium; crashes
   reset it. The model never reaches steady-state pairing because crashes are frequent and deep.
2. **No children in the initial population.** Real populations have an age pyramid; every seeded person
   is working-age, concentrating the founding cohort and producing a synchronized boom-bust wave. Children
   of seeded adults exist in the real world — they simply aren't present at simulation start.

Together these produce an unrealistic founding population that worsens crash recovery: survivors are older,
mostly unpartnered, and face a mate-finding Allee effect that drives extinction rather than a recoverable
trough. This ARD corrects both structural problems and adds the minimum-age gate that children in the
seed make necessary.

## Decision

### 1. Age floor lowered to `SEED_AGE_FLOOR`

Lower the seeded age floor from its current value to `SEED_AGE_FLOOR`, allowing children to be present
in the initial population. Children are created with no parents (empty constructor); the post-seed
parent-assignment step in point 2 then backfills `childOf` and `hasChildren`. Education seeding already
branches on age thresholds and applies only above those thresholds; no change needed there. Children
below `RELATIONSHIP_MIN_AGE` will not form relationships due to the gate added in point 4.

### 2. Post-seed parent assignment

After all persons are created, assign parents to every seeded child (age < `RELATIONSHIP_MIN_AGE`).
The algorithm:

1. Eligible adults for a given child: any person at least `SEED_MIN_PARENT_AGE_GAP` years older than
   the child.
2. Maintain a running list of open family units (each unit: one or two parents, any number of children).
3. For each child in random order:
   - With probability `SEED_SIBLING_REUSE_PROBABILITY`, try to join an existing eligible family unit
     (same parents still alive and age-eligible) — producing siblings.
   - Otherwise create a new family unit.
4. For each new family unit:
   - With probability `SEED_TWO_PARENT_FRACTION`, draw two eligible unpartnered adults → two-parent
     household. Set `isInRelationshipWith` on both parents if neither is already partnered.
   - Otherwise draw one eligible adult → single-parent household.
5. Push the child into the parent(s)' `hasChildren` and push the parent(s) into the child's `childOf`.

`SEED_TWO_PARENT_FRACTION` is calibrated to the empirical two-parent / single-parent household
distribution (US Census / OECD). `SEED_SIBLING_REUSE_PROBABILITY` is calibrated to produce realistic
average sibling counts. If no eligible adults remain for a new family unit, the child stays orphaned
(welfare covers them per ARD 034).

### 3. Post-seed adult pairing

After parent assignment, pair remaining unpartnered adults (age >= `RELATIONSHIP_MIN_AGE`) until the
adult paired fraction reaches `SEED_PAIRING_FRACTION`. Draw random unpartnered pairs and assign
`isInRelationshipWith` symmetrically. This initializes the simulation near its empirical steady-state
rather than at zero, eliminating the long transient and reducing artificial extinction from under-pairing
in early ticks.

`SEED_PAIRING_FRACTION` is calibrated to the empirical adult pairing prevalence — the fraction of adults
in a romantic or sexual relationship at any given time — not the marriage rate. The algorithm stops when
the target fraction is reached or the unpartnered adult pool is exhausted.

### 4. Relationship minimum age: `RELATIONSHIP_MIN_AGE`

Add a hard age gate in `RelationshipEvent`: persons younger than `RELATIONSHIP_MIN_AGE` skip both the
formation and dissolution branches. This prevents seeded children from forming relationships as they age
through early ticks, and removes the implausibly low-but-nonzero `ageModifier` floor from allowing
pre-adolescent partnerships. The threshold is set to the commonly recognised lower bound for consensual
adult relationships.

### 5. `BASE_RELATIONSHIP_RATE` recalibrated upward

Raise `BASE_RELATIONSHIP_RATE`. The existing value produces adequate steady-state pairing mathematically
but post-crash recovery is too slow: at low population the random-other draw rarely returns an unpartnered
person, collapsing the effective formation rate. A higher value makes crash recovery faster without
changing steady-state behaviour materially, and partially compensates for the mate-finding Allee effect
at low density. Calibrate so the steady-state pairing fraction sits within the empirical target range.

### 6. Constructor relaxed to accept zero, one, or two parents

The `Person` constructor currently throws when given exactly one parent. Single-parent seeding requires
relaxing this to accept zero, one, or two. `ChildbirthEvent` always passes two parents (unchanged).
Single-parent entries arise only from `Simulation.seed()`.

## Reasoning

**Alternative: only lower the breakup rate, don't reseed**
Lowering `BASE_BREAKUP_RATE` helps prevent dissolution during normal operation but does nothing for the
zero-to-equilibrium transient and does not help when a crash kills one partner (`Simulation.kill()`
clears the survivor's field regardless of breakup rate). Reseeding at equilibrium addresses both the
transient and the founding cohort structure; it is a complement to breakup-rate tuning, not a substitute.

**Alternative: seed orphaned children without parent assignment**
Simpler, but misrepresents the starting population: most children under fifteen have at least one living
parent. More concretely, `ConsumptionEvent` uses `livingParents.length > 0` to switch children from
paying full consumption to paying a small resource fraction — orphaned seeded children pay full
consumption and would die rapidly in early ticks before welfare flows from the empty starting community
pool.

**Alternative: anti-Allee fertility multiplier at low N**
A per-tick fertility multiplier that increases as population density falls below a reference threshold
was discussed. Rejected as the primary fix because it imposes an external forcing rather than correcting
the structural under-pairing that causes the problem. Fixing initial conditions and the pairing rate is
the more conservative, more interpretable intervention. The anti-Allee idea remains in
`docs/future-ideas.md` as a potential secondary lever.

## Consequences

**Files that change:**
- `src/App/Person.ts` — constructor accepts zero, one, or two parents (validation updated)
- `src/App/Simulation.ts` — `seed()`: age floor lowered to `SEED_AGE_FLOOR`; post-seed
  parent-assignment loop added; post-seed adult-pairing loop added
- `src/Events/RelationshipEvent.ts` — `RELATIONSHIP_MIN_AGE` guard at top of `execute()`
- `src/Helpers/Variables.ts` — add `SEED_AGE_FLOOR`, `SEED_TWO_PARENT_FRACTION`,
  `SEED_SIBLING_REUSE_PROBABILITY`, `SEED_MIN_PARENT_AGE_GAP`, `SEED_PAIRING_FRACTION`,
  `RELATIONSHIP_MIN_AGE`; raise `BASE_RELATIONSHIP_RATE`

**Tests that must be written / updated:**
- `Person.test.ts`: constructor accepts one parent; existing zero- and two-parent paths still pass;
  error still thrown for three or more parents
- `Simulation.test.ts`: after `seed()`, paired adult fraction approximates `SEED_PAIRING_FRACTION`;
  children below `RELATIONSHIP_MIN_AGE` have `childOf.length >= 1` (unless no eligible parent existed);
  children below `RELATIONSHIP_MIN_AGE` have `isInRelationshipWith === null`
- `RelationshipEvent.test.ts`: persons under `RELATIONSHIP_MIN_AGE` are skipped in both branches

**Side effects and known weaknesses:**
- The RNG sequence for a given seed changes because the seeding loop consumes additional RNG calls for
  parent assignment and pairing. Prior sweep results are not comparable across this change.
- Children seeded at very young ages have high `ageMortalityModifier` (U-curve). Infant mortality is
  realistic but will modestly reduce early-tick population.
- Single-parent children whose parent dies early become orphaned; ARD 034 welfare covers them, but the
  community pool is thin in early ticks.
- If the seeded population contains many more children than adults, `SEED_PAIRING_FRACTION` may not be
  reachable — the algorithm terminates early without error.
