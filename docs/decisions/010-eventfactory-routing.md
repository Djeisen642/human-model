# ARD 010: EventFactory Routing

**Status:** Accepted  
**Date:** 2026-05-01

## Context

`EventFactory.getEventsFor()` currently returns only `[AgeEvent]` for every person. As events are implemented, the factory needs a principled way to decide which events fire for a given person in a given tick.

ARD 008 established the pattern for intent-gated events (`rng() < intent * ageModifier(...)`), but left open the question of events that have no associated intent — gathering and misfortune are universal behaviors that don't belong to a choice.

## Decision

Two categories of events:

**Unconditional** — always included in the returned array, every tick, for every living person. Probability gates (if any) are internal to the event's `execute()` method.

| Event | Rationale |
|---|---|
| `AgeEvent` | Time always passes |
| `GatherResourcesEvent` | Survival gathering is not a choice |
| `MisfortuneEvent` | Background risk faces everyone |

**Intent-gated** — `EventFactory` appends these only when `rng() < intent * ageModifier(age, PEAK, SCALE, FLOOR)` passes. The event is not constructed if the gate fails.

All remaining events (exercise, learn, steal, kill, relationship, job, graduation, childbirth, lying, invention) are intent-gated.

`EventFactory.getEventsFor()` always starts with the three unconditional events, then appends whichever intent-gated events pass their gate.

## Reasoning

**The unconditional/intent-gated split reflects a real behavioral distinction.** Gathering and misfortune are not decisions — everyone attempts to gather each tick and everyone faces background risk. Treating them as intent-gated would require inventing meaningless stub intents or arbitrary base rates.

**Probability gates belong inside unconditional events, not in the factory.** `MisfortuneEvent` runs several independent probability checks internally. The factory's job is whether to include an event; the event's job is what happens when it runs.

## Consequences

- `EventFactory.getEventsFor()` always returns at least `[AgeEvent, GatherResourcesEvent, MisfortuneEvent]`
- Intent-gated events are appended after unconditional events
- Every new intent-gated event added to the factory must declare an age profile per the CLAUDE.md convention
