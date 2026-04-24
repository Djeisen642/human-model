# ARD 005: Randomness and Testability

**Status:** Accepted  
**Date:** 2026-04-24

## Context

Events involving probability (misfortune, stealing, killing, relationships, invention) need a random number source. `Math.random()` is not injectable or seedable, which makes tests non-deterministic and simulation runs non-reproducible — both problems for a project whose purpose is studying variability in outcomes.

The project has zero production dependencies, ruling out seeded PRNG libraries.

## Decision

Define an `RNG` type alias and use `Math.random` as the default. Pass `rng` as a constructor argument to `EventFactory`; individual event classes that need randomness receive it at construction from the factory.

```typescript
// src/Helpers/Types.ts
export type RNG = () => number;
```

```typescript
// Usage
const factory = new EventFactory(Math.random);

// In tests
const seededRng = (() => {
  let i = 0;
  const values = [0.1, 0.9, 0.4];
  return () => values[i++ % values.length];
})();
const factory = new EventFactory(seededRng);
```

## Reasoning

An injectable `RNG` type costs five lines and no dependencies. It solves two distinct problems:

**Testability**: tests pass a deterministic function, eliminating flakiness. Combined with intents as 0–1 probabilities (ARD 003), setting `rng = () => 0` makes all probabilistic events fire; `rng = () => 1` suppresses them all. This gives full control over event selection in tests without mocking.

**Reproducibility**: a seeded PRNG passed to `EventFactory` makes a simulation run fully reproducible given the same seed. This is essential for the research goal — comparing runs requires being able to re-run a specific scenario exactly.

The type alias rather than an interface or abstract class keeps the pattern lightweight. Any `() => number` function satisfies `RNG`, including `Math.random`, custom seedable functions, or test fixtures.

## Consequences

- `src/Helpers/Types.ts` exports `RNG` type alias (and any other shared types)
- `EventFactory` constructor accepts `rng: RNG`
- Event classes that need randomness receive `rng` at construction via the factory
- Simulation runs are reproducible by passing a seeded RNG to `EventFactory`
- Tests are deterministic by passing controlled values
