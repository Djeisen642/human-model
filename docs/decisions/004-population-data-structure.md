# ARD 004: Population Data Structure

**Status:** Accepted  
**Date:** 2026-04-24

## Context

The simulation needs a place to own the living population, handle death and birth, support target selection for two-person events (stealing, killing, relationships), and — given the project's research goal of observing civilizational collapse vs. thriving — track aggregate metrics over time so outcomes can be analyzed.

`LooperSingleton` is the existing entry point but currently owns nothing. The question is whether to add population ownership there or introduce a dedicated class.

## Decision

Introduce a `Simulation` class that owns the population and aggregate state. `LooperSingleton.start()` creates a `Simulation`, seeds it, then drives the tick loop by delegating to it.

```typescript
class Simulation {
  private living: Person[] = [];
  private deceased: Person[] = [];
  readonly history: TickSnapshot[] = [];

  getLiving(): Person[] { ... }
  getRandomOther(exclude: Person, rng: RNG): Person | null { ... }
  kill(person: Person): void { ... }   // moves living → deceased
  add(person: Person): void { ... }    // births, initial seed
  snapshot(): TickSnapshot { ... }     // aggregate stats for this tick
}
```

`TickSnapshot` captures per-tick aggregate state:

```typescript
interface TickSnapshot {
  tick: number;
  population: number;
  deaths: number;
  averageResources: number;
  resourceGini: number;           // inequality coefficient
  averageHappiness: number;
  aggregateKillingIntent: number;
  aggregateStealingIntent: number;
}
```

Events receive the full `Simulation` instance:

```typescript
interface IEvent {
  execute(person: Person, simulation: Simulation): void;
}
```

## Reasoning

**`Simulation` has a real job beyond being a container.** The research question — what causes collapse vs. thriving — can only be answered by observing how aggregate state evolves over time. `Simulation` is the natural owner of that observation. A plain array in `LooperSingleton` has no place to put `history` or `snapshot()` without turning `LooperSingleton` into a god object.

**The HANDY model finding directly informs what to track.** HANDY (Motesharrei et al., 2014) showed that civilizational collapse is driven by overexploitation combined with inequality — scarcity alone is insufficient. This means resource inequality (Gini coefficient) across the population is a more meaningful collapse signal than average resources alone. `TickSnapshot` captures both.

**Events need `Simulation`, not just `living`.** Killing an agent requires moving them to `deceased`; childbirth requires adding a new agent. Passing `living: Person[]` directly would require events to manage array mutation themselves. Passing `Simulation` gives events a clean API and keeps mutation logic in one place.

**Observer pattern deferred but designed for.** `history: TickSnapshot[]` accumulates snapshots each tick. Downstream analysis (printing collapse curves, detecting thrive/collapse outcomes) reads from `history` after the simulation ends. A pub/sub observer layer can be added later without changing `Simulation`'s interface.

## Consequences

- `src/App/Simulation.ts` owns living population, deceased list, and tick history
- `LooperSingleton` responsibility narrows to: create `Simulation`, seed it, run the tick loop, stop
- `IEvent.execute()` signature is `(person: Person, simulation: Simulation): void`
- Dead persons are never garbage collected — `deceased` retains references, keeping `KillingRecord`/`DeathRecord` valid (see ARD 001)
- `TickSnapshot` history is the primary output for analyzing collapse vs. thriving outcomes; future work can visualize or export it
