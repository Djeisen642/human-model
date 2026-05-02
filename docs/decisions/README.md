# Architecture Decision Records

This directory contains Architecture Decision Records (ARDs) for the human-model project.

## What is an ARD?

An ARD documents a significant architectural decision: the context that prompted it, the options considered, the choice made, and the consequences. It is written at the time the decision is made, not retroactively.

ARDs are not design documents or specifications — they are a record of *why* things are the way they are. A future developer (or agent) reading the codebase should be able to understand not just what was built, but what was rejected and why.

## When to write an ARD

Write one whenever you are about to encode a non-obvious design choice. The trigger test (also in `CLAUDE.md`):

> If a future agent would have to guess *why* you made a choice, write an ARD first. If the choice is forced by the existing architecture with no real alternative, a comment in code may suffice.

Concretely, this includes new stats or computed properties, event mechanics (probabilities, magnitudes, outcomes), changes to how existing fields are used, and any parameter whose value could reasonably be different.

It does **not** include: bug fixes that restore documented behavior, refactors that preserve behavior, formatting changes, or choices forced by the existing architecture with no real alternative. Those go straight to code.

The ARD is written *before* the code, not retroactively. If you're already writing the implementation and realize the choice is non-obvious, stop and write the ARD first.

## Immutability

**ARDs are immutable once merged to the main branch.**

An ARD is a historical record. Editing it after the fact would falsify the decision history. If a decision is revisited and reversed:

1. Write a new ARD documenting the new decision and why the old one no longer holds
2. Update the old ARD's **Status** field to `Superseded by ARD XXX` — nothing else

This way the full decision history is preserved, including decisions that turned out to be wrong.

## Scope

**Each ARD should cover one decision, narrowly enough that supersession is a clean replacement.**

The supersession rule above is binary: an ARD is either current or fully superseded. There is no "Amended by" or "Partially superseded by" status — those would erode the property that the index tells you, at a glance, what is currently decided. The cost of this simplicity is paid at write time: ARDs that bundle several decisions force a comprehensive rewrite when only one branch needs revising.

Guidelines:

1. **Default to one decision per ARD.** If you find yourself writing "the event also handles X and Y" with independent reasoning for each, those are usually separate ARDs.
2. **Tightly coupled decisions can share an ARD.** If two choices only make sense together (e.g., a formula and the constant it introduces), one ARD is fine.
3. **The supersession test.** Before merging, ask: "if one branch of this needs revising in a year, can I write a clean replacement ARD without restating the unchanged branches?" If not, split.
4. **When in doubt, split.** A small ARD that ends up grouped together later by a reader is fine; a large one that needs partial supersession is painful.

This guideline was added after ARD 013 (`MisfortuneEvent`) bundled illness death, suicide, and ordering decisions, then ARD 019 had to comprehensively restate the unchanged branches just to revise one formula. ARD 019 is preserved as the comprehensive document; the pattern is to be avoided going forward.

## Template

```markdown
# ARD NNN: Title

**Status:** Proposed | Accepted | Superseded by ARD XXX
**Date:** YYYY-MM-DD

## Context
Why is this decision needed? What problem or constraint prompted it?
Ground it in the actual code state — what does the current code do (or fail
to do) that creates the need for a decision? Avoid generic "we need a
mechanism for X" framing; cite the file or field that's incomplete.

## Decision
What was chosen? Include code examples where the shape of the solution is
non-obvious. If new constants are introduced, list them with initial values
and a one-line rationale per constant. Mark numeric values that need
empirical calibration as placeholders.

## Reasoning
**At least one named alternative, and why it was rejected.** This is where
the ARD earns its keep — without rejected alternatives, the document is just
a specification. Each alternative gets a name (e.g., "purely additive
formula", "constant base rate") and a short paragraph explaining why it
loses to the chosen option. Two or three alternatives is typical; one is
the floor.

## Consequences
What does this decision make easier, harder, or impossible? What must be
true for it to hold? List the files that change, the tests that must be
written, and any side effects on other parts of the model. If known
weaknesses exist, name them in a sub-section so they aren't a surprise to
the next reader.
```

## Quality bar

A good ARD passes all of these:

1. **Context grounds the decision in code state.** A reader who hasn't seen the codebase in months can tell from Context alone why this decision is being made now.
2. **Reasoning names at least one rejected alternative.** "We chose X because it works" is not Reasoning. "We chose X over Y (which would have done Z) because..." is.
3. **Constants have rationale, not just values.** If the ARD introduces `FOO = 0.05`, the document says why 0.05 — even if the rationale is "placeholder pending calibration."
4. **Cross-references are explicit.** If this ARD depends on, modifies, or interacts with another ARD, name it. If it defers a related concern to `docs/future-ideas.md`, link the entry.
5. **Consequences are testable.** "Tests must cover X, Y, Z" is better than "should be tested." A reader implementing the ARD shouldn't have to guess what coverage looks like.

## Exemplars

When in doubt about the right level of detail or rigor, look at:

- **[ARD 011](./011-gather-resources-event.md)** — formula introduction with explicit calibration intent and three rejected alternatives. Good pattern for any event with a numeric formula.
- **[ARD 014](./014-happiness-model-revision.md)** — supersession of ARD 009. Good pattern for revising a previous decision: states what changed and why the prior model fell short.
- **[ARD 008](./008-age-modifiers.md)** — establishes a reusable helper (`ageModifier`) with a profile table. Good pattern for cross-cutting infrastructure.

## After writing an ARD

Before the implementation commit:

1. **Add the ARD to the Index** below — title and status.
2. **Reference it in `CLAUDE.md`** — under "Key design decisions" if it changes a project-level invariant, and under "What's implemented" once the code lands.
3. **Cross-reference `docs/future-ideas.md`** if any item there is now subsumed (move it to the Discarded section) or made obsolete (delete it with a note in the ARD).
4. **Include the ARD in the same commit as the implementation it covers** when possible. Splitting the ARD and implementation across commits is acceptable for ARDs that need review before code, but the link should be obvious in the commit messages.

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
| [009](./009-happiness-model.md) | Happiness Model | Superseded by ARD 014 |
| [010](./010-eventfactory-routing.md) | EventFactory Routing | Accepted |
| [011](./011-gather-resources-event.md) | GatherResourcesEvent | Accepted |
| [012](./012-disaster-event.md) | Disaster | Accepted |
| [013](./013-misfortune-event.md) | MisfortuneEvent | Superseded by ARD 019 |
| [014](./014-happiness-model-revision.md) | Happiness Model Revision | Accepted |
| [015](./015-progress-reporting.md) | Progress Reporting and Ten-Year Summary | Accepted |
| [016](./016-end-of-simulation-report.md) | End-of-Simulation Report | Accepted |
| [017](./017-experience-growth-and-decay.md) | Experience Growth and Decay | Proposed |
| [018](./018-illness-live-state.md) | Illness as Live State | Proposed |
| [019](./019-misfortune-illness-death-revision.md) | MisfortuneEvent Revision | Proposed |
