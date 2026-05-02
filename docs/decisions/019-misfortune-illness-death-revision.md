# ARD 019: MisfortuneEvent Revision

**Status:** Proposed
**Date:** 2026-05-02
**Supersedes:** ARD 013

## Context

ARD 013 specified `MisfortuneEvent` runs an illness death roll and a suicide roll each tick, with disaster handled at the population level. The illness roll used a constant base rate (`ILLNESS * ageMortalityModifier`) because `person.illness` was dead state.

ARD 018 makes `person.illness` live. The constant-based death roll is now incoherent — a person at `illness = 0` has the same chance of dying from illness as one at `illness = 1`. This ARD fully supersedes ARD 013; the illness death formula is the only branch that changes, but project policy doesn't admit partial supersession, so the entire MisfortuneEvent contract is restated here.

## Decision

`MisfortuneEvent` is unconditional, fires every tick per living person (per ARD 010). Illness check first; if not dead, suicide check. Disaster stays in `LooperSingleton` (per ARD 012).

```typescript
execute(person: Person, simulation: Simulation): void {
  const illnessDeathProb =
    person.illness * Variables.ILLNESS_DEATH_SCALAR * person.ageMortalityModifier;
  if (rng() < illnessDeathProb) {
    simulation.kill(person, Constants.CAUSE_OF_DEATH.ILLNESS);
    return;
  }

  const suicideProb = Variables.SUICIDE_PROBABILITY_SCALE / (person.happiness + 1);
  if (rng() < suicideProb) {
    simulation.kill(person, Constants.CAUSE_OF_DEATH.SUICIDE);
  }
}
```

**Change from ARD 013:** illness death is now `person.illness * ILLNESS_DEATH_SCALAR * ageMortalityModifier`. Severity-gated — `illness = 0` → zero probability.

**Constant rename:** `Variables.ILLNESS` → `Variables.ILLNESS_DEATH_SCALAR`. The semantic shift (base rate → severity scalar) is large enough that retaining the name would mislead during calibration. Numeric value re-tuned: previously calibrated against implicit `illness = 1`, now needs to be moderately higher to compensate for typical severity below 1.

**IllnessEvent ordering:** Per ARD 018, `IllnessEvent` runs before `MisfortuneEvent`, so acute illness this tick is reflected in this tick's death roll.

**Suicide formula (preserved from ARD 013):** `SUICIDE_PROBABILITY_SCALE / (happiness + 1)`, with `SUICIDE_PROBABILITY_SCALE = 0.03`. Implied rates:

| happiness | probability/tick |
|---|---|
| 0 | 3.0% |
| 1 | 1.5% |
| 3 | 0.75% |
| 5 | 0.5% |
| 10 | 0.27% |

Applies to all ages; children not excluded (per ARD 014, well-cared-for children naturally float above the danger threshold).

## Reasoning

**Severity-gated illness death rather than base + severity.** Alternative rejected:

- *Base + severity boost* (`(BASE + illness * SCALAR) * ageMortalityModifier`): preserves baseline illness mortality for asymptomatic / unmonitored conditions, but splits the meaning of `person.illness` between "the gate" and "a modifier on a separate gate" — calibration confusion. The asymptomatic-illness pattern is in `docs/future-ideas.md` if simulations need it.

**Constant rename.** Keeping `ILLNESS` after the formula change would be a semantic landmine — anyone tuning it would think they were adjusting a base rate.

**Suicide formula unchanged.** ARD 018's live illness raises suicide rates indirectly via happiness; the formula doesn't need to change to express that.

**Comprehensive supersession rather than narrow delta.** A delta would force readers to consult both 013 and 019 for current behavior. One document captures the whole contract; 013 stays as historical record.

**Disaster placement preserved.** Per-person disaster rolls in `MisfortuneEvent` would produce ~100 rolls per tick, turning rare catastrophes into background noise. Stays in `LooperSingleton` per ARD 012.

## Consequences

- `MisfortuneEvent.ts` — one-line formula change.
- `Variables.ts` — rename `ILLNESS` → `ILLNESS_DEATH_SCALAR`, re-tune value.
- All references to `Variables.ILLNESS` updated; ESLint catches the rename.
- Aggregate illness mortality drops at the same numeric value, then is re-tuned. Distribution shifts toward sicker individuals — the intended qualitative change.
- Suicide side effects from ARD 018 still apply; not compounded here.
- ARD 013 marked Superseded by ARD 019 in the index.
- CLAUDE.md updates ("Key design decisions" MisfortuneEvent bullet, "What's implemented", Variables.ts listing) in the implementation commit.
- Tests must cover: `illness = 0` → never dies of illness; severity scaling; suicide still fires when illness check is skipped; suicide at `happiness = 0`; rename doesn't break existing tests.

### Known weakness inherited from ARD 013

Illness and suicide are sequential, first-cause-wins. With severity gating, illness rarely wins at low severity, so suicide becomes the more likely cause of death for unhappy-but-healthy persons. Intended consequence of the more selective illness mortality.

### Open follow-ups

- *Asymptomatic illness baseline* — if healthy-people-never-dying-of-illness produces unrealistic patterns, revisit. Tracked in `docs/future-ideas.md`.
- Calibration: `ILLNESS_DEATH_SCALAR` is a guess; observe.
