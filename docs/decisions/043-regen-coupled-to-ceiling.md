# ARD 043: Natural Resource Regeneration Coupled To Ceiling

**Status:** Accepted
**Date:** 2026-05-18

## Context

`NATURAL_RESOURCE_REGEN_RATE` is a flat constant (currently 50). At the model's calibration population (~100 persons) this is already a structural deficit — typical per-person demand at productivity 1.0 is ~2.25/tick (`experience × (BASE_GATHER_AMOUNT + intelligence × INTELLIGENCE_GATHER_SCALAR)`), so 100 persons demand ~225/tick against 50 regen. The model survives because the initial stockpile cushions the run for ~50 ticks and `extractionProductivity` then drifts toward the floor via invention's bias. At 1000 persons that cushion vanishes in ~5 ticks and the simulation enters perpetual scarcity regardless of how the population is composed.

A second problem compounds it: `InventionEvent`'s `CEILING_GROWTH` branch raises `naturalResourceCeiling` but the flat regen ignores the ceiling, so unlocking new carrying capacity is a no-op for the steady-state economy. Two of three invention outcomes (productivity faster/slower) modulate gathering; the third has no observable downstream effect after ARD 039's conservation fix.

The project owner's intended narrative (see conversation 2026-05-18): at ~100 persons the world should comfortably support life; population growth, productivity shifts, or environmental constraint should bite; *invention is the unlock mechanism* that lets a civilization escape the cap. None of that is reachable with the current formula.

## Decision

**Replace flat regen with a fraction of the current ceiling.**

```typescript
regenerate(): void {
  const regen = this.naturalResourceCeiling * Variables.NATURAL_RESOURCE_REGEN_FRACTION;
  this.naturalResources = Math.min(this.naturalResources + regen, this.naturalResourceCeiling);
}
```

`NATURAL_RESOURCE_REGEN_RATE` (flat) is removed; `NATURAL_RESOURCE_REGEN_FRACTION` replaces it. Calibration intent: at the default initial ceiling and ~100 persons the regen should comfortably exceed steady-state demand, leaving the pool stable or rising in the early game. Scarcity scenarios are now engineered by lowering the ceiling (which drops regen proportionally), not by a separate dial.

**Rebalance invention outcomes so ceiling growth is meaningfully frequent.**

`INVENTION_CEILING_GROWTH_WEIGHT` is bumped from 1 (one-third of outcomes) to 2 (half of outcomes). Productivity-faster and productivity-slower remain at weight 1 each (a quarter each). Calibration intent: ceiling growth is the population-cap unlock; under the previous 1:1:1 weighting it was the rarest meaningful outcome, which contradicts its narrative role.

**No flat floor on regen.** When the ceiling is small, regen is small — that's the point of the coupling. A floor would defeat scarcity scenarios.

## Reasoning

**Fraction of ceiling over fraction of remaining capacity.** A formula like `regen = (ceiling - current) × fraction` would slow regen as the pool fills (logistic growth, closer to ecological reality). Rejected because it overcomplicates the calibration story for marginal benefit: at the dynamics the model exercises (pool repeatedly approaches zero, then partially refills), the linear and logistic forms behave nearly identically. The simpler form is `regen = ceiling × fraction`, clamped at ceiling — the existing clamp prevents overshoot.

**Coupled regen over a separate `REGEN_CEILING_COUPLING` toggle.** Keeping both formulas as alternatives doubles the calibration surface and adds a config knob that nobody needs once the new formula is calibrated. The old flat regen was an undocumented artifact of the model's 100-person calibration; preserving it as an option would just preserve the bug.

**Weight rebalance bundled here rather than its own ARD.** The two changes are tightly coupled: ceiling growth has no economic effect under flat regen, so revisiting one without the other would leave the model in an inconsistent state. Per the supersession test in `docs/decisions/README.md`, revising the regen formula later would force a restatement of the invention weight rationale; bundling avoids that. (Splitting the *initial-pool* knob into its own ARD — 044 — is correct because that decision is genuinely independent.)

**Rejected: scaling regen with population.** A `regen = population × per-capita-trickle` form would make the pool self-balance perfectly and erase resource pressure as a research signal. The Malthusian story the model is built to study requires that the environment's carrying capacity be exogenous to the population.

## Consequences

- `src/Helpers/Variables.ts` — remove `NATURAL_RESOURCE_REGEN_RATE`, add `NATURAL_RESOURCE_REGEN_FRACTION`. Bump `INVENTION_CEILING_GROWTH_WEIGHT` from 1 to 2.
- `src/App/Simulation.ts` — `regenerate()` uses the new formula.
- `src/tests/App/Simulation.test.ts` — update regen tests: regen scales with ceiling; clamps at ceiling; produces zero at ceiling=0.
- `src/tests/Events/InventionEvent.test.ts` — outcome distribution at default weights changes; existing branch-specific tests pin one of three outcomes via mocked `rng()` and should remain valid, but any test that asserts the *frequency* of branches needs updating.
- `CLAUDE.md` — update the "Global natural resource pool" key-design bullet and the `LooperSingleton` / `Simulation` lines under "What's implemented" to reflect the new regen formula and invention weighting.
- `docs/odd-protocol.md` — update the "Natural resource regeneration" section and the `extractionProductivity` / state-variables area.
- `docs/future-ideas.md` — remove the "Long-term environmental drift" item's overlap with ceiling-coupled regen if any; the "InventionEvent: unbounded ceiling growth (thrive-lock)" item should remain (this ARD makes ceiling matter, but doesn't cap it).
- Calibration cascade: existing default `NATURAL_RESOURCE_CEILING_INITIAL = 10_000` combined with a fraction around 0.03 yields ~300/tick regen — a comfortable surplus at 100 persons. The fraction is a single calibration handle; tune it once and any ceiling value scales naturally.
- Scarcity scenarios: low initial ceiling now produces both a low stockpile *and* low regen, giving a coherent "harsh environment" condition that population mixes can be tested against.
- Cross-references: pairs with [ARD 044](./044-initial-natural-resources-constant.md) (decouples initial pool from ceiling for scenario design); modifies invention weighting from [ARD 007](./007-resource-cap-and-invention.md); relies on the conservation guarantees of [ARD 039](./039-gather-productivity-model.md) and [ARD 040](./040-windfall-from-pool.md) (without conservation, coupled regen would mask the leak rather than expose it).
