# ARD 007: Resource Cap and Invention

**Status:** Accepted  
**Date:** 2026-04-26

## Context

Resources currently accumulate without bound. The HANDY model's central finding — that civilizational collapse is driven by overexploitation combined with inequality, not scarcity alone — requires a natural resource ceiling that the population can deplete faster than it regenerates. Without a finite environmental pool, extraction-driven collapse cannot be modeled.

The simulation also needs a mechanism for civilizational thriving, not just decline. A pure depletion model can only show collapse. Invention is the historical mechanism by which societies have pushed back resource limits — sometimes by reducing waste, sometimes by opening new frontiers — but invention also sometimes accelerates depletion (e.g. industrial extraction). Its net effect should be an emergent property of the simulation, not assumed.

## Decision

Introduce a global natural resource pool owned by `Simulation` with three properties:

- `naturalResources: number` — current available pool; depleted by gathering, replenished by regeneration
- `naturalResourceCeiling: number` — maximum accessible resources; grows via invention
- `extractionEfficiency: number` — ratio of pool cost per unit gathered; starts at `1.0`, modified by invention

Each tick, `naturalResources` regenerates by a fixed rate up to `naturalResourceCeiling`:

```typescript
this.naturalResources = Math.min(
  this.naturalResources + NATURAL_RESOURCE_REGEN_RATE,
  this.naturalResourceCeiling
);
```

`GatherResourcesEvent` pulls from the pool. The pool loses `amount * extractionEfficiency`; the person gains `amount`. This decouples environmental cost from personal gain — the ratio between them is what invention changes:

```typescript
const available = simulation.naturalResources / simulation.extractionEfficiency;
const extracted = Math.min(computedExtraction, available);
person.resources += extracted;
simulation.naturalResources -= extracted * simulation.extractionEfficiency;
```

`InventionEvent` randomly produces one of three outcomes, weighted by configurable variables:

| Outcome | Effect | Real-world analogue |
|---|---|---|
| Depletion faster | `extractionEfficiency *= (1 + delta)` | Industrial machinery; wasteful extraction |
| Depletion slower | `extractionEfficiency *= (1 - delta)` | Conservation tech; sustainable farming |
| Accessible resources greater | `naturalResourceCeiling += delta * ceiling` | New deposits; geographic discovery; substitution |

`delta` is scaled by the inventor's `intelligence`: `delta = inventor.intelligence * INVENTION_MAGNITUDE_SCALAR`.

All weights and scalars live in `Variables.ts` and are the primary experimental variables for studying invention's role in collapse vs. thriving:

```typescript
export const NATURAL_RESOURCE_CEILING_INITIAL = 10_000;
export const NATURAL_RESOURCE_REGEN_RATE = 50;
export const INVENTION_DEPLETION_FASTER_WEIGHT = 1;
export const INVENTION_DEPLETION_SLOWER_WEIGHT = 1;
export const INVENTION_CEILING_GROWTH_WEIGHT = 1;
export const INVENTION_MAGNITUDE_SCALAR = 0.05;
```

`extractionEfficiency` has a floor of `0.01` — gathering cannot become environmentally free.

## Reasoning

**Global pool, not per-person cap.** The HANDY collapse dynamic requires the population to collectively deplete a shared environment. A per-person cap prevents unlimited individual accumulation but does not model environmental degradation — the pool remains infinite and overexploitation is impossible.

**`extractionEfficiency` decouples environmental cost from personal gain.** If invention simply scaled how much a person gains per gather, it would be indistinguishable from a stat boost. The ratio framing captures something real: efficient technologies can provide the same human benefit at lower environmental cost (efficiency < 1), or wasteful ones can extract more than they deliver net (efficiency > 1). This is the mechanism through which inequality and collapse interact — a high-efficiency population extracts more per person while depleting the pool faster.

**Invention is not uniformly beneficial.** Making the three outcomes equally weighted by default (and configurable) means the net effect of invention on civilizational health is emergent. A research run can test: what if invention tends toward efficiency gains? what if it tends toward new frontiers? what if it tends toward acceleration? The weights are the independent variable.

**Magnitude scales with `intelligence`.** Invention is the one event that requires high intelligence and charisma (noted in future-ideas). Scaling delta by intelligence means smarter inventors produce larger effects — a high-intelligence population's inventions are more consequential in either direction.

**Permanent changes.** Invention outcomes persist indefinitely — you cannot uninvent the steam engine. Decay mechanics are deferred; if compounding produces degenerate extremes in practice, a decay rate can be added as a `Variables.ts` constant without changing this decision's structure.

**Regeneration is passive and independent of invention.** The environment recovers on its own up to the current ceiling. Invention affects the ceiling and efficiency; regeneration fills toward it. This means even a population with no inventors can survive if they extract below the regeneration rate — and a high-invention population can still collapse if their inventions accelerate depletion faster than the ceiling grows.

**`naturalResources` added to `TickSnapshot`.** Depletion trajectory is a primary collapse signal alongside Gini. Without it, the pool could hit zero invisibly.

## Consequences

- `Simulation` gains `naturalResources`, `naturalResourceCeiling`, and `extractionEfficiency` fields
- `Simulation.snapshot()` includes `naturalResources` in `TickSnapshot`
- `GatherResourcesEvent` subtracts `extracted * extractionEfficiency` from `simulation.naturalResources`; person gains `extracted`; if pool is insufficient, person gains proportionally less
- `InventionEvent` selects one of three outcomes via weighted random draw, computes `delta = inventor.intelligence * INVENTION_MAGNITUDE_SCALAR`, applies the effect permanently
- `Variables.ts` gains six new constants: initial ceiling, regen rate, three invention weights, magnitude scalar
- `NATURAL_RESOURCE_CEILING_INITIAL` and `NATURAL_RESOURCE_REGEN_RATE` are passed into `Simulation` constructor (or `LooperSingleton.start()`); exact threading TBD when implemented
- The interaction between `extractionEfficiency` and Gini is the primary signal for HANDY-style collapse: a high-efficiency population that also has high inequality depletes the pool while the bottom of the distribution starves — scarcity is distributed unequally even when total extraction is moderate
