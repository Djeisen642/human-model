# Architecture Decision Records

This directory contains Architecture Decision Records (ARDs) for the human-model project.

## What is an ARD?

An ARD documents a significant architectural decision: the context that prompted it, the options considered, the choice made, and the consequences. It is written at the time the decision is made, not retroactively.

ARDs are not design documents or specifications — they are a record of *why* things are the way they are. A future developer (or agent) reading the codebase should be able to understand not just what was built, but what was rejected and why.

## When to write an ARD

Write one before encoding a non-obvious design choice. The trigger test (also in `CLAUDE.md`):

> If a future agent would have to guess *why* you made a choice, write an ARD first. If the choice is forced by the existing architecture with no real alternative, a comment in code may suffice.

Includes: new stats, event mechanics (probabilities, magnitudes, outcomes), changes to how existing fields are used, parameters whose value could reasonably be different.

Skip for: bug fixes that restore documented behavior, behavior-preserving refactors, formatting, choices with no real alternative.

If you're mid-implementation and realize the choice is non-obvious, stop and write the ARD first.

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

1. **One decision per ARD by default.** "The event also handles X and Y" with independent reasoning per branch usually means split.
2. **Tightly coupled decisions can share.** A formula and its introduced constant — fine together.
3. **Supersession test.** Before merging, ask: "if one branch needs revising later, can I write a clean replacement without restating the unchanged branches?" If not, split.
4. **When in doubt, split.** A small ARD a reader groups together later is fine; a large one needing partial supersession is painful.

Added after ARD 013 bundled illness death, suicide, and ordering, forcing ARD 019 to restate unchanged branches just to revise one formula.

## Template

```markdown
# ARD NNN: Title

**Status:** Proposed | Accepted | Superseded by ARD XXX
**Date:** YYYY-MM-DD

## Context
Why is this decision needed now? Ground it in code state — name the
file or field that's incomplete. Skip generic framing.

## Decision
What was chosen. Code example if non-obvious. New constants listed with
initial value and one-line rationale; mark calibration placeholders.

## Reasoning
At least one named rejected alternative with one paragraph on why it
loses. Without alternatives, the document is just a spec.

## Consequences
Files that change, tests that must be written, side effects, known
weaknesses. Make it concrete enough that an implementer doesn't guess.
```

## Quality bar

1. **Context grounds in code state.** A reader returning months later can tell from Context why the decision is needed.
2. **Reasoning names a rejected alternative.** "We chose X over Y because Y would have done Z" — not "X works."
3. **Constants have rationale.** Why 0.05? Even "placeholder pending calibration" counts.
4. **Cross-references are explicit.** Name the ARDs you depend on, modify, or defer to.
5. **Consequences are testable.** "Tests must cover X, Y, Z" — not "should be tested."

## Exemplars

When in doubt:

- **[ARD 011](./011-gather-resources-event.md)** — formula with calibration intent and rejected alternatives. Pattern for numeric formulas.
- **[ARD 014](./014-happiness-model-revision.md)** — supersedes ARD 009. Pattern for revising a previous decision.
- **[ARD 008](./008-age-modifiers.md)** — reusable helper (`ageModifier`) with a profile table. Pattern for cross-cutting infrastructure.

## After writing

1. Add to the Index below.
2. Reference in `CLAUDE.md` under "Key design decisions" (if it changes a project-level invariant) and "What's implemented" (when the code lands).
3. Update `docs/future-ideas.md` — move subsumed items to Discarded; delete obsolete ones with a note in the ARD.
4. Same commit as implementation when possible; otherwise cross-reference in commit messages.

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
| [017](./017-experience-growth-and-decay.md) | Experience Growth and Decay | Accepted |
| [018](./018-illness-live-state.md) | Illness as Live State | Proposed |
| [019](./019-misfortune-illness-death-revision.md) | MisfortuneEvent Revision | Proposed |
