# ARD 002: Person Mutability

**Status:** Accepted  
**Date:** 2026-04-24

## Context

`Person` was designed with all properties marked `readonly`, reflecting an intent toward immutability — the idea being that events would produce new `Person` instances rather than modifying state in place. This is a functional/persistent-data-structure style.

In practice, nearly every simulated event needs to change something on a person: `age` increments every tick; `resources`, `experience`, `intelligence`, `constitution`, and `illness` shift from various events; the five intent fields are modified by lying and invention; `hasJob`, `education`, `isWorkingOnEd`, `isInRelationshipWith`, and `causeOfDeath` all change at various lifecycle points.

The immutable approach also has a concrete incompatibility with the existing design: `KillingRecord`, `StealingRecord`, `DeathRecord`, and `Person`'s own relational properties all hold direct `Person` references (see ARD 001). Replacing a `Person` with a new instance each tick invalidates every one of those references.

## Decision

Remove `readonly` from all primitive and nullable-reference fields on `Person`. Retain `readonly` on collection fields (`killed`, `amountStolen`, `peopleLiedTo`, `hasChildren`, `childOf`).

## Reasoning

`readonly` on a TypeScript collection (`Map`, `Array`, `Set`) only prevents reassigning the reference — it does not prevent mutation of the collection's contents. These fields are therefore already effectively mutable, and keeping `readonly` on them correctly signals "don't swap this collection out for a new one" without implying deep immutability.

The primitive fields (`age`, `resources`, `intelligence`, etc.) are the ones that genuinely need to change across ticks. Making them mutable is the minimal change required for the simulation to function, and it preserves the stable object references that the rest of the design depends on.

The original fully-`readonly` design was aspirational. A true immutable approach would require a global registry mapping identity to current state (see ARD 001), which adds pervasive complexity the rest of the design was not built for.

## Consequences

- Primitive and nullable-reference fields on `Person` become assignable; events modify them directly
- `childOf` stays `readonly` — biological parents are fixed at birth and should never be reassigned
- Collection fields stay `readonly` to prevent accidental collection replacement, while remaining mutable in content
- Object references in records and relational properties remain valid across ticks
- The existing test suite requires no structural changes; tests that assert initial values of `0` or `false` remain correct
