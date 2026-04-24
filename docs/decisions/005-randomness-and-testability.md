# ARD 005: Randomness and Testability

**Status:** Accepted  
**Date:** 2026-04-24

## Context

Events involving probability (misfortune, stealing, killing, relationships, invention) need a random number source. `Math.random()` is not injectable or seedable, which makes tests non-deterministic and simulation runs non-reproducible — both problems for a project whose purpose is studying variability in outcomes.

The project has zero production dependencies, ruling out seeded PRNG libraries.

## Decision

Implement a lightweight `SeededRandom` class in-project (~8 lines, no dependencies) and define an `RNG` type alias. `EventFactory` accepts `rng: RNG`, defaulting to a `SeededRandom` instance. The seed is recorded so any run can be replayed exactly.

```typescript
// src/Helpers/Types.ts
export type RNG = () => number;
```

```typescript
// src/Helpers/SeededRandom.ts
export default class SeededRandom {
  constructor(private seed: number) {}

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }

  asRNG(): RNG {
    return () => this.next();
  }
}
```

```typescript
// Production use — seed recorded for reproducibility
const rng = new SeededRandom(Date.now()).asRNG();
const factory = new EventFactory(rng);

// Tests — controlled values
const factory = new EventFactory(() => 0);   // all probabilistic events fire
const factory = new EventFactory(() => 1);   // all probabilistic events suppressed
```

## Reasoning

A pure type alias (Option B) is minimal but puts reproducibility burden on the caller — they have to wire up their own seeded function. The tiny in-project PRNG makes reproducibility a first-class feature: every run has a seed, every run can be replayed.

The `RNG` type alias is still the right contract — any `() => number` satisfies it, including `Math.random`, test fixtures, or `SeededRandom.asRNG()`. The two complement each other: `SeededRandom` is the production default, the type alias keeps everything injectable and testable.

Jest spying on `Math.random` was rejected — it mutates global state and doesn't solve reproducibility for actual runs. A full strategy pattern with `fork()` and branching was deferred — valuable for counterfactual analysis but premature before the simulation loop exists.

A future improvement worth noting: multiple independent RNG streams (one per event category) would prevent event additions from shifting subsequent random values across categories, improving reproducibility stability as the event set grows.

## Consequences

- `src/Helpers/Types.ts` exports `RNG` type alias
- `src/Helpers/SeededRandom.ts` implements the PRNG (~8 lines)
- `EventFactory` constructor accepts `rng: RNG`; defaults to `new SeededRandom(Date.now()).asRNG()`
- Every simulation run should record its seed so it can be reproduced
- Tests are fully deterministic: pass `() => 0` or `() => 1` or a fixed sequence
- Multiple RNG streams deferred; consider if event set grows complex
