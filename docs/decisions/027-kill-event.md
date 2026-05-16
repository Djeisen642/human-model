# ARD 027: KillEvent

**Status:** Accepted
**Date:** 2026-05-16

## Context

`KillingRecord`, `DeathRecord`, and `Constants.CAUSE_OF_DEATH.MURDER` are all defined; `Person.killed` (a `Map<Person, KillingRecord>`) and `Person.killingIntent` (seeded in [0, 0.1)) are in place. The killing age profile constants (`KILLING_PEAK_AGE`, `KILLING_AGE_SCALE`, `KILLING_AGE_FLOOR`) exist in `Variables.ts`. `simulation.kill()` already accepts a `killer` argument and populates `KillingRecord` on the killer when cause is MURDER. But no event populates these structures — interpersonal violence is wired in the data model but absent from the tick loop.

The simulation's core thesis is that inequality is the primary collapse signal. The empirical literature (UNODC 2023; Kelly 2000; `docs/research-killing.md`) is unambiguous: Gini explains ~50% of cross-national homicide variance — more than poverty, unemployment, or any other single variable. Without a Gini-modulated kill event, that feedback loop is entirely absent from the model.

## Decision

Add `KillEvent` (implements `IEvent`). Intent-gated in `EventFactory`.

**EventFactory gate:**

```typescript
const killProb = person.killingIntent
  * ageModifier(person.age, Variables.KILLING_PEAK_AGE,
                Variables.KILLING_AGE_SCALE, Variables.KILLING_AGE_FLOOR)
  * (1 + currentGini * Variables.KILL_GINI_SCALAR);
if (rng() < killProb) {
  events.push(new KillEvent(this.rng));
}
```

`currentGini` is computed inside `KillEvent.execute()` using `simulation.getLiving()` — the same population slice that `snapshot()` uses for `resourceGini`.

**KillEvent.execute():**

```typescript
const victim = simulation.getRandomOther(person, this.rng);
if (!victim) return;

const living = simulation.getLiving();
const resources = living.map(p => p.resources);
const currentGini = gini(resources);

const attemptProb = person.killingIntent
  * ageModifier(person.age, KILLING_PEAK_AGE, KILLING_AGE_SCALE, KILLING_AGE_FLOOR)
  * (1 + currentGini * KILL_GINI_SCALAR);
if (this.rng() >= attemptProb) return;

const successProb = Variables.KILL_SUCCESS_BASE / Math.max(1, victim.constitution);
if (this.rng() < successProb) {
  simulation.kill(victim, Constants.CAUSE_OF_DEATH.MURDER, person);
}
```

`simulation.kill()` already creates the `DeathRecord` and `KillingRecord`; `KillEvent` does not duplicate that logic.

**New constants in `Variables.ts`:**

| Constant | Rationale |
|---|---|
| `KILL_GINI_SCALAR` | Controls how much the current Gini amplifies attempt probability. Calibrated so `1 + Gini × scalar` roughly doubles attempt rate at the COLLAPSE_GINI_THRESHOLD (0.6). |
| `KILL_SUCCESS_BASE` | Probability of a fatal outcome when victim has constitution=1. Divided by `victim.constitution` — higher constitution is more protective. |

**Calibration intent:** At `killingIntent=0.1` (max seed value), peak age, and Gini=0 (baseline), attempt probability is `0.1 × 1.0 × 1.0 = 0.10` — 10% per tick. At Gini=0.6 (collapse threshold) with `KILL_GINI_SCALAR=1.5`, that becomes `0.1 × 1.0 × 1.9 = 0.19`. At median intent (~0.01), peak age, average Gini (~0.35): `0.01 × 1.0 × 1.525 ≈ 0.015` — roughly 1–2% per tick. These match the empirical targets in `docs/research-killing.md` (5–10% for max intent + bad conditions; 0.5–1% for median intent). `KILL_SUCCESS_BASE=0.5` gives ~50% lethality against constitution=1, ~10% against constitution=5 (midpoint), ~5% against constitution=10 (max) — consistent with research-file guidance.

## Reasoning

**Gini in the attempt formula, not implicit.** Gini already drives the simulation's collapse verdict. Wiring it into kill-attempt probability creates the direct feedback loop the model is designed to study: inequality → more violence → more deaths → population loss → further inequality shifts. Leaving Gini out would mean high-inequality runs don't produce elevated homicide rates — contradicting both the empirical literature and the simulation's thesis. A simpler alternative (flat `killingIntent`-only gate, matching `StealEvent`) would miss the entire mechanism that motivates having this event at all.

**Attempt and success are separate rolls.** A single combined probability cannot independently represent "person decided to attack" and "attack was fatal." Separating them means `constitution` becomes meaningfully protective against killing — not just a Gather/Illness modifier. It also lets future mechanics target either step independently (e.g., a deterrence mechanic could raise the threshold for an attempt without changing lethality; armor or medical care could raise the success threshold without changing intent). The rejected alternative — a single `killingIntent * ageModifier * (1 + gini * scalar) * KILL_FACTOR / constitution` formula — conflates motivation and outcome and gives constitution an unconventional role (lower probability rather than conditional on attempt).

**Random victim via `getRandomOther()` over targeted selection.** FBI UCR data (`docs/research-killing.md`) shows ~28% known non-family, ~13% family, ~10% stranger, ~49% unknown — the dominant pattern is "known person," which `getRandomOther()` approximates via shared population membership. A targeted selection formula (prefer low-constitution or low-resource victims, matching BJS victimization data) would be more empirically precise, but introduces a second design decision (the weight formula) and makes victim selection opaque during analysis. Random selection is the conservative baseline; vulnerability-weighted selection is noted in `docs/future-ideas.md` for revisitation if simulation data shows target distribution matters to the collapse/thrive signal.

**`simulation.kill()` handles record creation.** `Simulation.kill()` already creates `DeathRecord` and `KillingRecord` when cause is MURDER. `KillEvent` delegates entirely to that method rather than constructing records itself, avoiding a second code path that could drift from the simulation's record-keeping contract.

## Consequences

- `src/Events/KillEvent.ts` — new file implementing `IEvent`; takes `rng` in constructor; computes Gini from `simulation.getLiving()` inline
- `src/Events/EventFactory.ts` — add intent gate for `KillEvent` using `killingIntent`, Gini modulator, and killing age profile
- `src/Helpers/Variables.ts` — add `KILL_GINI_SCALAR`, `KILL_SUCCESS_BASE`
- `src/tests/Events/KillEvent.test.ts` — tests must cover: no-op when sole person (no victim); attempt fires at high intent + high Gini, not at zero intent; success fires when constitution is low, skipped when constitution is high; on success: victim in deceased, `KillingRecord` on killer, `DeathRecord.cause === MURDER`; on failed success roll: victim still alive, no record pushed
- `src/tests/Events/EventFactory.test.ts` — add: `killingIntent=0` never receives `KillEvent`; high `killingIntent` at peak age receives it
- Cross-references: ARD 007 (resource pool — natural resources context), ARD 008 (ageModifier helper), ARD 010 (EventFactory routing), ARD 012 (DisasterEvent — existing death-cause tracking)
