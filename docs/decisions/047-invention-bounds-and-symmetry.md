# ARD 047: Bounded, Symmetric InventionEvent Dynamics

**Status:** Accepted
**Date:** 2026-06-04

## Context

`InventionEvent` (see `src/Events/InventionEvent.ts`) is the model's tech-unlock mechanism, but three of its branches are unbounded or asymmetric, and each can lock a run into a degenerate outcome before the collapse/thrive signal has time to develop. All three are flagged High priority in `docs/future-ideas.md`.

1. **Upper-unbounded productivity (collapse-lock).** The faster branch sets `extractionProductivity *= (1 + delta)` with no ceiling. `delta = intelligence × INVENTION_MAGNITUDE_SCALAR`; at `intelligence = 10`, `delta = 0.5`. A handful of sequential faster inventions push productivity high enough that `GatherResourcesEvent` (`output = experience × (BASE + intelligence × scalar) × extractionProductivity`, drained from the shared pool) empties `naturalResources` in a few ticks regardless of population composition. The existing `Math.max(EXTRACTION_PRODUCTIVITY_FLOOR, …)` only guards the *lower* end — the faster branch even carries a comment noting the floor is unreachable there.

2. **Upper-unbounded ceiling (thrive-lock).** The ceiling branch does `naturalResourceCeiling += delta × naturalResourceCeiling`, i.e. `ceiling *= (1 + delta)`. Since ARD 043 coupled regen to the ceiling (`regen = ceiling × NATURAL_RESOURCE_REGEN_FRACTION`), repeated ceiling-growth inventions compound into permanently unbounded regeneration — scarcity, the model's primary collapse pathway via depletion, is eliminated for good.

3. **Asymmetric faster/slower compounding (one-way ratchet to the floor).** Faster multiplies by `(1 + delta)`; slower multiplies by `(1 - delta)`. After N of each, `productivity × (1 + d)^N × (1 - d)^N = productivity × (1 - d²)^N` — paired outcomes do **not** cancel; productivity drifts monotonically toward `EXTRACTION_PRODUCTIVITY_FLOOR`. ARD 043's Context leaned on this incidental drift ("`extractionProductivity` then drifts toward the floor via invention's bias") as part of why the 100-person calibration survives. That makes the drift load-bearing by accident rather than by decision, and over a long run it is itself a degenerate outcome: productivity → floor → output → ~0 → collapse, independent of any other dynamic.

These are correctness bugs, not calibration knobs: each removes a pathway the model exists to study (depletion collapse) or manufactures one that shouldn't exist (productivity ratchet).

## Decision

**Bound the two one-directional growth branches with hard caps, and make the productivity branches exact inverses so the walk is genuinely bounded rather than drifting.**

```typescript
// faster: productivity is a bounded multiplicative random walk
simulation.extractionProductivity = Math.min(
  Variables.MAX_EXTRACTION_PRODUCTIVITY,
  simulation.extractionProductivity * (1 + delta),
);

// slower: exact inverse of faster, floored as before
simulation.extractionProductivity = Math.max(
  Variables.EXTRACTION_PRODUCTIVITY_FLOOR,
  simulation.extractionProductivity / (1 + delta),
);

// ceiling growth: capped
simulation.naturalResourceCeiling = Math.min(
  Variables.MAX_NATURAL_RESOURCE_CEILING,
  simulation.naturalResourceCeiling + delta * simulation.naturalResourceCeiling,
);
```

New constants:

- `MAX_EXTRACTION_PRODUCTIVITY` — upper clamp on the faster branch, mirroring the existing `EXTRACTION_PRODUCTIVITY_FLOOR`. Controls how far a tech boom can amplify per-capita extraction (and pool drain) before it saturates. Calibration intent: high enough that a productivity boom is a real event, low enough that a short streak cannot empty a full pool in a single decade.
- `MAX_NATURAL_RESOURCE_CEILING` — upper clamp on ceiling growth. Controls the maximum carrying capacity invention can unlock, and therefore (via ARD 043's coupled regen) the maximum sustainable population. Calibration intent: a large multiple of `NATURAL_RESOURCE_CEILING_INITIAL` so the unlock narrative still has room to run, but finite so depletion collapse remains reachable.

No new constant is needed for the symmetry fix: changing the slower branch from `× (1 - delta)` to `÷ (1 + delta)` makes faster and slower exact multiplicative inverses, so a faster–slower pair returns productivity to its prior value exactly and the floor/cap band becomes a true bounded random walk with no built-in drift.

The ceiling branch remains one-directional (there is no ceiling-shrink invention); a downward environmental drift is a separate, deferred idea (`docs/future-ideas.md`, "Long-term environmental drift"), not part of this decision.

## Reasoning

**Hard caps over diminishing returns.** A diminishing-returns form (e.g. scaling `delta` by remaining headroom toward a soft limit) is smoother and arguably more organic, but it loses on three counts. It adds a soft-limit parameter *and* a shaping function to calibrate per branch, where a hard cap adds one number with an obvious meaning. It obscures the headline research question — "what is the maximum population this world can sustain?" answers directly to `MAX_NATURAL_RESOURCE_CEILING`, not to a soft-limit-plus-curvature pair. And it is inconsistent with the rest of the resource model, which clamps everywhere with `Math.min`/`Math.max` (the `EXTRACTION_PRODUCTIVITY_FLOOR` floor, the regen clamp at ceiling in `Simulation.regenerate()`, the per-person resource floor at 0). A hard cap is the same idiom one level up. The cost of hard caps — productivity/ceiling can sit pinned at the cap, flattening the signal once reached — is acceptable because reaching either cap already means the relevant dynamic (boom or unlock) has run its course, which is exactly when we want it to stop.

**Symmetric `÷ (1 + delta)` over keeping `× (1 - delta)` and documenting the drift as intentional.** We could instead declare the toward-floor drift a deliberate conservation bias and leave the formula alone (the lighter-weight resolution the future-ideas note invites). Rejected: the drift is not a designed force, it is an artifact of multiplying by `(1 - d)` instead of dividing by `(1 + d)`, and ARD 043 only survives at 100 persons because of it. Leaving a load-bearing accident in place keeps the model's calibration resting on a bug. Making the branches exact inverses turns productivity into a clean bounded random walk whose long-run behavior is determined by the floor, the cap, and the faster/slower weights — all explicit dials — rather than by an emergent multiplicative bias nobody chose. If a conservation bias is later wanted, it should be expressed as an asymmetry in the *weights* (`INVENTION_DEPLETION_FASTER_WEIGHT` vs `INVENTION_DEPLETION_SLOWER_WEIGHT`), where it is visible and tunable, not buried in the step formula.

**Additive productivity steps rejected.** Replacing the multiplicative walk with additive steps (`productivity ± delta`) would make faster/slower trivially symmetric without the divide, but it changes the meaning of `delta` (currently a fractional change, which is scale-free) and interacts awkwardly with the floor near zero. Keeping the multiplicative form and fixing only the asymmetry is the smaller, more local change.

**Interaction with ARD 043 (not a supersession).** ARD 043's *decision* — coupling regen to the ceiling and weighting ceiling growth at 2 — is unaffected and stands. What this ARD changes is the incidental drift its Context paragraph relied on for 100-person survival. After the symmetry fix, productivity no longer self-drifts toward the floor, so the early-game economy must be balanced by regen and the floor/cap band, not by an invisible downward bias. This requires re-checking the existing calibration (below), but does not reverse ARD 043, so no status change there.

## Consequences

- `src/Events/InventionEvent.ts` — faster branch clamps at `MAX_EXTRACTION_PRODUCTIVITY`; slower branch becomes `÷ (1 + delta)` (still floored); ceiling branch clamps at `MAX_NATURAL_RESOURCE_CEILING`. Remove the now-stale comment on the faster branch about the floor being unreachable (an upper clamp is now the live guard).
- `src/Helpers/Variables.ts` — add `MAX_EXTRACTION_PRODUCTIVITY` and `MAX_NATURAL_RESOURCE_CEILING` with JSDoc and ARD 047 references.
- `src/tests/Events/InventionEvent.test.ts` — add: faster branch never exceeds `MAX_EXTRACTION_PRODUCTIVITY` (drive productivity to the cap and assert the clamp); ceiling branch never exceeds `MAX_NATURAL_RESOURCE_CEILING`; a faster invention immediately followed by a slower one with the same `delta` returns productivity to (within floating-point tolerance of) its starting value (symmetry). The existing "decreases extractionProductivity when roll in slower range" and "floors at EXTRACTION_PRODUCTIVITY_FLOOR" tests remain valid under `÷ (1 + delta)`.
- `CLAUDE.md` — update the "Global natural resource pool" key-design bullet and the `InventionEvent` line under "What's implemented" to state the productivity walk is bounded `[FLOOR, MAX_EXTRACTION_PRODUCTIVITY]` with symmetric faster/slower steps, and the ceiling is capped at `MAX_NATURAL_RESOURCE_CEILING`.
- `docs/odd-protocol.md` — update the `extractionProductivity` / `naturalResourceCeiling` state-variable descriptions and the invention sub-model to reflect the bounds and symmetry.
- `docs/future-ideas.md` — remove all three resolved High-priority invention items ("unbounded extractionProductivity upper end", "unbounded ceiling growth", "asymmetric faster/slower compounding"), noting in this ARD that they are subsumed here. The "Long-term environmental drift" item (ceiling decay) is **not** resolved and stays.
- **Calibration cascade (must verify before closing):** with the toward-floor drift removed, run the default scenario (100 persons, seed 42, 100 ticks) and confirm the pool no longer collapses purely because productivity stops self-decaying. If the early economy now runs too hot, the lever is `NATURAL_RESOURCE_REGEN_FRACTION` (ARD 043) or the floor/cap band — not a re-introduction of asymmetry. Pick initial values for the two caps as round multiples (productivity cap a small multiple of 1.0; ceiling cap a large multiple of `NATURAL_RESOURCE_CEILING_INITIAL`) and treat them as calibration handles.
- Cross-references: bounds the productivity model of [ARD 039](./039-gather-productivity-model.md) and the invention outcomes of [ARD 007](./007-resource-cap-and-invention.md); changes (but does not supersede) the incidental productivity-drift assumption in [ARD 043](./043-regen-coupled-to-ceiling.md)'s Context.
