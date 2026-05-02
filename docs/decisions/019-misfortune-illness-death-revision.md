# ARD 019: MisfortuneEvent Revision

**Status:** Proposed
**Date:** 2026-05-02
**Supersedes:** ARD 013

## Context

ARD 013 specified that `MisfortuneEvent` runs an illness death roll and a suicide roll each tick, with disaster handled separately at the population level. The illness roll used a constant base rate (`ILLNESS * ageMortalityModifier`) because, at the time, `person.illness` was dead state — there was no live severity to feed in.

ARD 018 makes `person.illness` live state, with onset and recovery dynamics applied each tick by a new `IllnessEvent`. The constant-based death roll is now incoherent with the rest of the model: a person at `illness = 0` has the same chance of dying from illness in any given tick as a person at `illness = 1`. The new severity field exists but doesn't gate the mortality outcome it should naturally drive.

This ARD fully supersedes ARD 013. The illness death formula is the only branch that changes; the suicide roll, the unconditional firing, the illness-then-suicide ordering, and the separation of disaster from `MisfortuneEvent` are all preserved verbatim. The supersession is full rather than partial because the project's ARD policy doesn't admit partial supersession — the cleanest path is one comprehensive document that captures the entire current state of `MisfortuneEvent`.

## Decision

`MisfortuneEvent` is unconditional — it fires every tick for every living person (per ARD 010). It runs illness and suicide checks in sequence; if a person dies from illness, the suicide check is skipped. Disaster remains a population-level event handled in `LooperSingleton` (per ARD 012), not inside `MisfortuneEvent`.

```typescript
execute(person: Person, simulation: Simulation): void {
  // 1. Illness death — severity-gated
  const illnessDeathProb =
    person.illness * Variables.ILLNESS_DEATH_SCALAR * person.ageMortalityModifier;
  if (rng() < illnessDeathProb) {
    simulation.kill(person, Constants.CAUSE_OF_DEATH.ILLNESS);
    return;
  }

  // 2. Suicide — happiness-driven (unchanged from ARD 013)
  const suicideProb = Variables.SUICIDE_PROBABILITY_SCALE / (person.happiness + 1);
  if (rng() < suicideProb) {
    simulation.kill(person, Constants.CAUSE_OF_DEATH.SUICIDE);
  }
}
```

**The change from ARD 013:** the illness death probability is now `person.illness * ILLNESS_DEATH_SCALAR * ageMortalityModifier` rather than `ILLNESS * ageMortalityModifier`. A person at `illness = 0` has zero illness-death probability this tick. A person at `illness = 1` has the maximum.

**Constant rename:** `Variables.ILLNESS` is renamed to `Variables.ILLNESS_DEATH_SCALAR`. The semantic shift — from "base illness mortality rate" to "scalar applied to live severity" — is meaningful enough that retaining the old name would be misleading during calibration.

The numeric value is re-tuned during implementation. Previously, `ILLNESS` was calibrated against an implicit `illness = 1` assumption; with severity bounded in `[0, 1]` and typically below 1 across the living population, the same value would produce far fewer illness deaths. Expect the new `ILLNESS_DEATH_SCALAR` to be moderately higher than the old `ILLNESS` to bring aggregate illness mortality back into the calibration target band.

**Tick-level interaction with `IllnessEvent`:** Per ARD 018's wiring, `IllnessEvent` runs before `MisfortuneEvent` within a tick. So a person who acquires acute illness this tick has their elevated severity reflected in this tick's death roll — preserving the "sudden critical illness can kill in the same year" pattern that the old constant-based formula expressed implicitly.

**Suicide formula (preserved from ARD 013):**

```typescript
suicideProb = Variables.SUICIDE_PROBABILITY_SCALE / (person.happiness + 1);
```

Implied rates with `SUICIDE_PROBABILITY_SCALE = 0.03`:

| happiness | probability/tick |
|---|---|
| 0 | 3.0% |
| 1 | 1.5% |
| 3 | 0.75% |
| 5 | 0.5% |
| 10 | 0.27% |

Suicide applies to all ages; children are not excluded (per ARD 014's happiness model, children with living resourced parents naturally achieve positive happiness, so only genuinely desperate cases approach the danger threshold).

## Reasoning

**Severity-gated illness death rather than additive base + severity.** Two formulations were considered:

1. **Severity-only** (chosen): `illness * SCALAR * ageMortalityModifier`. Healthy person at `illness = 0` has zero illness death probability this tick. The "sudden death from previously-undetected illness" pattern is captured by `IllnessEvent`'s onset roll firing before this event in the same tick.
2. **Base + severity boost**: `(BASE + illness * SCALAR) * ageMortalityModifier`. Preserves a baseline illness death risk independent of severity, modeling unmonitored or asymptomatic conditions.

The severity-only form is chosen because it makes `person.illness` unambiguously *the* illness death gate. Mixing in a constant base rate splits the meaning between "live severity field" and "background illness risk," and over time would invite confusion about which lever to turn during calibration. The asymptomatic-illness pattern can be added later with a small change if simulation results show it is needed; it is currently noted in `docs/future-ideas.md`.

**Constant rename rather than retain.** Keeping the old name `Variables.ILLNESS` after the formula change would create a semantic landmine — anyone tuning it would think they were adjusting a base rate, when in fact they are scaling severity. Renaming forces every reference to be revisited at the time of change.

**Suicide formula unchanged.** ARD 013's analysis of suicide — `SUICIDE_PROBABILITY_SCALE / (happiness + 1)`, the 3% peak rate at `happiness = 0`, the inclusion of children, the `+1` denominator to avoid division by zero — remains correct under the new illness model. ARD 018's introduction of live illness will raise suicide rates indirectly (sicker → unhappier → more suicide), which is intentional, but the *formula* doesn't need to change to express that.

**Why one comprehensive ARD rather than a narrow delta.** A narrow ARD that only restated the formula change would leave readers needing to read both 013 and the delta to know what `MisfortuneEvent` does. A single document captures the entire current state; ARD 013 is preserved as historical record (status: Superseded by ARD 019) but readers seeking the current behavior land on this document and find everything in one place.

**Disaster placement (preserved from ARD 013).** Disaster is a population-level event with co-occurring victims. Running per-person disaster rolls inside `MisfortuneEvent` would produce ~100 independent rolls per tick, converting rare catastrophes into constant background noise. Disaster lives in `LooperSingleton` per ARD 012; this ARD does not change that.

## Consequences

- **`MisfortuneEvent.ts`** changes one line — the illness death probability formula.
- **`Variables.ts`** — rename `ILLNESS` to `ILLNESS_DEATH_SCALAR`, re-tune value.
- **All callers and test references to `Variables.ILLNESS` must be updated** to the new name. ESLint will catch them as unresolved.
- **Aggregate illness mortality drops, then is re-tuned.** With typical severity averaging well below 1, the same constant value would produce far fewer illness deaths than before. The retuning brings the rate back into the calibration target band; the *distribution* of illness deaths shifts toward sicker individuals, which is the desired qualitative change.
- **Suicide rate side effects from ARD 018 still apply.** That ARD's introduction of live illness raises suicide probability through ARD 013's (and now this ARD's) `happiness`-based formula. ARD 019 doesn't compound that — the suicide formula is unchanged here.
- **ARD 013 is marked Superseded by ARD 019** in `docs/decisions/README.md` index. The body of ARD 013 is unchanged per the project's ARD immutability rule.
- **CLAUDE.md updates** in the implementation commit: "Key design decisions" `MisfortuneEvent` bullet updated to reference ARD 019 as the current source of truth (with ARD 013 noted as the prior decision). "What's implemented" entry for `MisfortuneEvent` updated. `Variables.ts` listing reflects the rename.
- **Tests must cover:** healthy person never dies of illness in any tick (`illness = 0` → death prob = 0); very sick old person high illness death rate; severity scaling; suicide check still fires when illness is skipped; suicide at happiness=0; rename doesn't break existing MisfortuneEvent suicide tests.

### Known weakness inherited from ARD 013

ARD 013 noted that illness death and suicide are checked sequentially with first-cause-wins. That behavior is unchanged. With severity-gated illness death, the "first cause wins" effect now shifts: at low severity, illness rarely wins, so suicide becomes the more likely cause of death for unhappy-but-healthy persons. This is an intended consequence of the model becoming more selective about illness deaths.

### Open follow-ups

- **Asymptomatic illness baseline** (the rejected option above) — if simulation shows healthy persons never dying from illness produces unrealistic mortality patterns, revisit. Tracked in `docs/future-ideas.md`.
- **Calibration:** the new `ILLNESS_DEATH_SCALAR` value is a guess and should be observed.
