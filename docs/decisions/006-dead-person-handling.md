# ARD 006: Dead Person Handling

**Status:** Accepted  
**Date:** 2026-04-24

## Context

When a person dies — from killing, illness, disaster, suicide, or old age — they need to be removed from the active simulation. The design must also preserve the cause and history of death, since `KillingRecord` and `DeathRecord` hold direct `Person` references (ARD 001), and the research goal requires knowing *when* and *why* people died as a civilizational health signal.

## Decision

`Simulation.kill(person, cause, killer?)` moves a person from `living` to `deceased`, sets their `causeOfDeath`, and records the death in the current tick's aggregate stats.

Dead persons are never deleted — they remain in `deceased` and are reachable via records. The `living` array is the source of truth for who participates in each tick; no liveness flag is needed on `Person`.

```typescript
kill(person: Person, cause: number, killer?: Person): void {
  person.causeOfDeath = new DeathRecord(cause, killer);
  this.living = this.living.filter(p => p !== person);
  this.deceased.push(person);
}
```

## Reasoning

**No liveness flag on `Person`.** "Is this person alive?" is answered by which array they're in. Adding a boolean `isAlive` to `Person` would create redundant state that can drift out of sync and requires every caller to check it.

**`deceased` preserves references.** `KillingRecord` on the murderer and `DeathRecord` on the victim both hold `Person` references. Moving to `deceased` rather than deleting keeps those references valid (ARD 001).

**Death is a research signal.** The cause of death distribution across ticks — how many killed vs. illness vs. disaster vs. suicide — directly informs the collapse/thrive analysis. `TickSnapshot` (ARD 004) should include a breakdown of deaths by cause each tick. `Simulation.kill()` is the single place to record this, keeping cause-of-death accounting centralized.

**Killers get a `KillingRecord` inside `Simulation.kill()`.** When `cause === MURDER`, the killer receives a `KillingRecord` for the victim before the victim moves to `deceased`. This happens inside `Simulation.kill()`, not in the calling event. Centralizing it means no killing path — misfortune, murder event, future causes — can skip the bookkeeping.

## Consequences

- `Simulation.kill()` is the only place a person moves from living to deceased
- `Person.causeOfDeath` is set inside `kill()`, not by the calling event
- Events that cause death call `simulation.kill(person, cause, killer?)` — they do not set `causeOfDeath` or add `KillingRecord` themselves
- `TickSnapshot` includes death counts by cause
- Population decline rate and cause-of-death mix are primary signals for detecting civilizational collapse
