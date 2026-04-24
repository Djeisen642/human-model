# ARD 001: Object References vs. Entity IDs

**Status:** Accepted  
**Date:** 2026-04-24

## Context

`Person` objects are referenced directly from multiple places: `KillingRecord`, `StealingRecord`, and `DeathRecord` all hold `Person` instances, and `Person` itself holds `Person` references in `isInRelationshipWith`, `childOf`, `hasChildren`, and the `killed` Map.

During early design, an entity pattern with explicit string IDs was considered — storing `personId: string` in records instead of direct `Person` references. This was motivated by a desire to keep `Person` immutable (producing new instances each tick rather than mutating in place), which would make the direct references stale.

## Decision

Use direct object references for all inter-`Person` relationships and record associations. Do not add an explicit ID field to `Person`.

## Reasoning

JavaScript/TypeScript object references already provide stable entity identity within a single process. `personA === personB` is unambiguous. An explicit string ID solves a cross-boundary identity problem (serialization, persistence, network) that this project does not have.

The entity-with-IDs approach would require a global registry (`Map<string, Person>`) threaded through every event function and every place that needs to resolve a reference. All of `Person`'s relational properties (`isInRelationshipWith`, `childOf`, etc.) would become string or string-array fields, making graph traversal indirect everywhere.

The stale-reference problem that motivated the ID approach is better resolved by allowing `Person` state to mutate in place (see ARD 002), which eliminates the need for reference re-resolution entirely.

## Consequences

- No `id` field on `Person`; equality and identity use reference equality (`===`)
- All record types (`KillingRecord`, `StealingRecord`, `DeathRecord`) hold direct `Person` references — these remain valid as long as `Person` objects are mutated rather than replaced
- If save/load or cross-process simulation is ever needed, this decision should be revisited and an ID field added at that point
