# ARD 003: Event Architecture

**Status:** Accepted  
**Date:** 2026-04-24

## Context

Events (stealing, killing, learning, etc.) need to be executed against each person once per tick. The design needs to answer two questions:

1. How is event logic structured and where does it live?
2. How do a person's intent values (`killingIntent`, `stealingIntent`, etc.) determine which events they participate in each tick?

These two questions have a shared answer.

## Decision

Events are classes implementing a common `IEvent` interface. An `EventFactory` owns the intent-to-event mapping and produces the list of events a given person participates in each tick.

```typescript
interface IEvent {
  execute(person: Person, simulation: Simulation): void;
}

class EventFactory {
  constructor(private rng: RNG) {}

  getEventsFor(person: Person): IEvent[] {
    const events: IEvent[] = [new AgeEvent(), new GatherResourcesEvent(this.rng)];
    if (this.rng() < person.exerciseIntent) events.push(new ExerciseEvent());
    if (this.rng() < person.stealingIntent) events.push(new StealEvent(this.rng));
    // ...
    return events;
  }
}
```

The simulation loop becomes:

```typescript
for (const person of livingPeople) {
  for (const event of factory.getEventsFor(person)) {
    event.execute(person, simulation);
  }
}
```

## Reasoning

The intent system was always meant to drive behavior. That mapping logic — "does this person's `killingIntent` cause a kill attempt this tick?" — has to live somewhere. Centralizing it in `EventFactory` gives it a single, testable home. Without the intent system, a factory would be forced; with it, the factory has a concrete job.

The class-per-event approach pairs naturally with a factory (factories produce objects, not function references). It also gives each event a clear test target and a consistent call signature regardless of complexity. Standalone functions were the alternative, but factory + functions is an awkward pairing, and it would scatter the intent-to-action logic back across the codebase.

`rng` is injected into `EventFactory` at construction and threaded into individual event classes that need it. This avoids passing `rng` as a parameter on every `execute()` call and keeps the `IEvent` interface minimal.

For events involving two people (stealing, killing, relationships), the factory creates an event for the actor; the event itself selects a target via `simulation.getRandomOther()` inside `execute()`. This is a minor seam — some "should this happen?" logic leaks into the event class — but it is preferable to making the factory responsible for population traversal.

This decision also resolves what would have been ARD 004 (intent-to-action mechanism): intents are treated as 0–1 probabilities, and `EventFactory.getEventsFor()` is the mechanism that evaluates them.

## Consequences

- `src/Events/` contains one file per event class plus `IEvent.ts` and `EventFactory.ts`
- `EventFactory` is the single place to change which events exist and when they fire
- Events that always fire (e.g. `AgeEvent`) are included unconditionally by the factory; the loop has no special cases
- Testing an event in isolation requires only instantiating the event class directly — no simulation setup needed
- Testing intent-to-event mapping requires only instantiating `EventFactory` with a controlled `rng`
