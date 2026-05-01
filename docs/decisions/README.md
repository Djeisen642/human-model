# Architecture Decision Records

This directory contains Architecture Decision Records (ARDs) for the human-model project.

## What is an ARD?

An ARD documents a significant architectural decision: the context that prompted it, the options considered, the choice made, and the consequences. It is written at the time the decision is made, not retroactively.

ARDs are not design documents or specifications — they are a record of *why* things are the way they are. A future developer (or agent) reading the codebase should be able to understand not just what was built, but what was rejected and why.

## Immutability

**ARDs are immutable once merged to the main branch.**

An ARD is a historical record. Editing it after the fact would falsify the decision history. If a decision is revisited and reversed:

1. Write a new ARD documenting the new decision and why the old one no longer holds
2. Update the old ARD's **Status** field to `Superseded by ARD XXX` — nothing else

This way the full decision history is preserved, including decisions that turned out to be wrong.

## Template

```markdown
# ARD NNN: Title

**Status:** Proposed | Accepted | Superseded by ARD XXX
**Date:** YYYY-MM-DD

## Context
Why is this decision needed? What problem or constraint prompted it?

## Decision
What was chosen? Include code examples where the shape of the solution is non-obvious.

## Reasoning
Why this option over the alternatives? Name and briefly dismiss the rejected options.

## Consequences
What does this decision make easier, harder, or impossible? What must be true for it to hold?
```

## Statuses

- **Proposed** — under discussion, not yet accepted
- **Accepted** — the decision is in effect
- **Superseded by ARD XXX** — this decision was reversed; see the referenced ARD

## Index

| # | Title | Status |
|---|-------|--------|
| [001](./001-object-references-vs-entity-ids.md) | Object References vs. Entity IDs | Accepted |
| [002](./002-person-mutability.md) | Person Mutability | Accepted |
| [003](./003-event-architecture.md) | Event Architecture | Accepted |
| [004](./004-population-data-structure.md) | Population Data Structure | Accepted |
| [005](./005-randomness-and-testability.md) | Randomness and Testability | Accepted |
| [006](./006-dead-person-handling.md) | Dead Person Handling | Accepted |
| [007](./007-resource-cap-and-invention.md) | Resource Cap and Invention | Accepted |
| [008](./008-age-modifiers.md) | Age-Based Modifiers | Accepted |
| [009](./009-happiness-model.md) | Happiness Model | Accepted |
| [010](./010-eventfactory-routing.md) | EventFactory Routing | Proposed |
| [011](./011-gather-resources-event.md) | GatherResourcesEvent | Proposed |
| [012](./012-disaster-event.md) | Disaster | Proposed |
