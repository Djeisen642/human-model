# ARD 052: Realistic Initial Population Seeding

**Status:** Proposed
**Date:** 2026-06-06

## Context

`Simulation.seed()` currently creates all persons with a minimum age of 15 and `isInRelationshipWith = null`
(entirely unpartnered). The pairing prevalence measurement (`scripts/measure-pairing.ts`, see
`docs/research-pairing-prevalence.md`) showed ~42% overall pairing and ~21% during crashes — well below
the empirical ~60–70% of adults in a romantic or sexual relationship at any given time. Two structural
root causes:

1. **The simulation starts at zero pairing.** It takes dozens of ticks to approach equilibrium; crashes
   reset it before it arrives.
2. **No children in the initial population.** Real populations have an age pyramid; every seeded person
   is working-age, concentrating the founding cohort and producing a synchronized boom-bust wave.

Together these produce an unrealistic founding population that worsens crash recovery: survivors are
older, mostly unpartnered, and face a mate-finding Allee effect that drives extinction rather than a
recoverable trough.

## Decision

### 1. Age floor lowered to `SEED_AGE_FLOOR`

Lower the seeded age floor from its current value to `SEED_AGE_FLOOR`, allowing children to be present
in the initial population. Children are created with an empty parents array; the post-seed
parent-assignment step in point 2 then backfills `childOf` and `hasChildren`. Education seeding already
branches on age thresholds and applies only above those thresholds; no change needed there.

### 2. Post-seed parent assignment

After all persons are created, assign parents to every seeded child (age below the relationship minimum
age defined in ARD 053). The algorithm:

1. Eligible adults for a given child: any person at least `SEED_MIN_PARENT_AGE_GAP` years older.
2. Maintain a running list of open family units (each: one or two parents, any number of children).
3. For each child in random order:
   - With probability `SEED_SIBLING_REUSE_PROBABILITY`, join an existing eligible family unit → siblings.
   - Otherwise create a new family unit.
4. For each new family unit:
   - With probability `SEED_TWO_PARENT_FRACTION`, draw two eligible unpartnered adults → two-parent
     household; set `isInRelationshipWith` on both if neither is already partnered.
   - Otherwise draw one eligible adult → single-parent household.
5. Push the child into the parent(s)' `hasChildren`; push the parent(s) into the child's `childOf`.

`SEED_TWO_PARENT_FRACTION` is calibrated to the empirical two-parent / single-parent household
distribution (US Census / OECD). `SEED_SIBLING_REUSE_PROBABILITY` is calibrated to produce realistic
average sibling counts. If no eligible adults remain for a new family unit the child stays orphaned;
ARD 034 welfare covers orphaned children.

### 3. Post-seed adult pairing

After parent assignment, pair remaining unpartnered adults until the adult paired fraction reaches
`SEED_PAIRING_FRACTION`. Draw random unpartnered pairs and assign `isInRelationshipWith` symmetrically.
This initialises the simulation near its empirical steady-state rather than at zero, eliminating the
long transient and reducing artificial extinction from under-pairing in early ticks.

`SEED_PAIRING_FRACTION` is calibrated to the empirical fraction of adults in a romantic or sexual
relationship at any given time — not the marriage rate. The algorithm stops when the target is reached
or the unpartnered adult pool is exhausted.

### 4. Constructor relaxed to accept zero, one, or two parents

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
Simpler, but misrepresents the starting population: most children below adolescence have at least one
living parent. More concretely, `ConsumptionEvent` uses `livingParents.length > 0` to switch children
from full consumption to a small resource fraction — orphaned seeded children pay full consumption and
would die rapidly before welfare flows from the empty starting community pool.

**Alternative: split adult pairing into its own ARD**
Adult pairing (`SEED_PAIRING_FRACTION`) is the third step of the same "initialise to a realistic
population state" pass and is mechanically downstream of parent assignment (which already pairs some
adults as a side-effect). Separating it would require restating the seeding context in a second ARD for
a decision that has no meaningful existence without the prior two steps.

## Consequences

**Files that change:**
- `src/App/Person.ts` — constructor accepts zero, one, or two parents
- `src/App/Simulation.ts` — `seed()`: age floor lowered to `SEED_AGE_FLOOR`; post-seed
  parent-assignment loop; post-seed adult-pairing loop
- `src/Helpers/Variables.ts` — add `SEED_AGE_FLOOR`, `SEED_TWO_PARENT_FRACTION`,
  `SEED_SIBLING_REUSE_PROBABILITY`, `SEED_MIN_PARENT_AGE_GAP`, `SEED_PAIRING_FRACTION`

**Tests that must be written / updated:**
- `Person.test.ts`: constructor accepts one parent; zero- and two-parent paths still pass; error still
  thrown for three or more parents
- `Simulation.test.ts`: after `seed()`, paired adult fraction approximates `SEED_PAIRING_FRACTION`;
  seeded children have `childOf.length >= 1` (unless no eligible parent existed); seeded children have
  `isInRelationshipWith === null`

**Side effects and known weaknesses:**
- The RNG sequence for a given seed changes because the seeding loop consumes additional RNG calls.
  Prior sweep results are not comparable across this change.
- Children seeded at very young ages have high `ageMortalityModifier` (U-curve). Infant mortality is
  realistic but will modestly reduce early-tick population.
- Single-parent children whose parent dies early become orphaned; ARD 034 welfare covers them, but the
  community pool is thin in early ticks.
- If the seeded population contains many more children than adults, `SEED_PAIRING_FRACTION` may not be
  reachable — the algorithm terminates early without error.
