# ARD 019: MisfortuneEvent Illness Death Formula Revision

**Status:** Proposed
**Date:** 2026-05-02

## Context

ARD 013 specified that `MisfortuneEvent`'s illness death roll uses a constant base rate, with the formula `ILLNESS * ageMortalityModifier`. At the time, `person.illness` was dead state — there was no live severity to feed into the formula, so a constant was the only available option.

ARD 018 makes `person.illness` live state, with onset and recovery dynamics applied each tick by a new `IllnessEvent`. The constant-based death roll is now incoherent with the rest of the model: a person at `illness = 0` has the same chance of dying from illness in any given tick as a person at `illness = 1`. The new severity field exists but doesn't gate the mortality outcome it should naturally drive.

This ARD revises one specific decision from ARD 013 — the illness death formula. ARD 013's other decisions (suicide roll, unconditional firing, illness-then-suicide ordering) are unchanged and still hold. ARD 013's status is left as **Accepted** rather than Superseded, because the supersession would overstate the scope of this revision; readers landing on 013 see a still-correct document, with cross-references from this ARD's Context for the one branch that has moved.

## Decision

`MisfortuneEvent`'s illness death roll consumes `person.illness` directly:

```typescript
// Before (ARD 013):
const illnessDeathProb = Variables.ILLNESS * person.ageMortalityModifier;

// After (this ARD):
const illnessDeathProb = person.illness * Variables.ILLNESS_DEATH_SCALAR * person.ageMortalityModifier;
```

`Variables.ILLNESS` is **renamed** to `Variables.ILLNESS_DEATH_SCALAR` to reflect its new meaning — it is no longer a base rate, it is a multiplier on severity. The numeric value is re-tuned as part of this change; the previous value was calibrated against an implicit illness-of-1 assumption and won't produce the same aggregate mortality once severity is bounded in `[0, 1]` and typically below 1.

| Constant | Old name | New name | Initial value |
|---|---|---|---|
| Illness death scalar | `ILLNESS` | `ILLNESS_DEATH_SCALAR` | re-tuned during implementation; expected to be moderately *higher* than the old `ILLNESS` to compensate for typical severity being below 1 |

The suicide roll and the illness-before-suicide ordering inside `MisfortuneEvent` are unchanged.

**Tick-level interaction with `IllnessEvent`:** Per ARD 018's wiring, `IllnessEvent` runs before `MisfortuneEvent` within a tick. So a person who acquires acute illness this tick has their elevated severity reflected in this tick's death roll — preserving the "sudden critical illness can kill in the same year" pattern that the old constant-based formula expressed implicitly.

## Reasoning

**Severity-gated rather than additive.** Two formulations were considered:

1. **Severity-only** (chosen): `illness * SCALAR * ageMortalityModifier`. Healthy person at `illness = 0` has zero illness death probability this tick. Sudden death is captured by the onset roll firing before the death roll.
2. **Base + severity boost**: `(BASE + illness * SCALAR) * ageMortalityModifier`. Preserves a baseline illness death risk independent of severity, modeling unmonitored or asymptomatic conditions.

The severity-only form is chosen because it makes the meaning of `person.illness` unambiguous — it *is* the illness death gate. Mixing in a constant base rate splits the meaning between "live severity field" and "background illness risk," and over time would invite confusion about which lever to turn during calibration. The asymptomatic-illness pattern can be added later with a small change if simulation results show it is needed.

**Constant rename rather than retain.** Keeping the old name `Variables.ILLNESS` after the formula change would create a semantic landmine — anyone tuning it would think they were adjusting a base rate, when in fact they are scaling severity. Renaming forces every reference to be revisited at the time of change.

**Why a separate ARD instead of bundling into ARD 018.** ARD 018 introduces machinery (live state, onset, recovery). This ARD changes a downstream consumer of that machinery. Two ARDs separate the "what state exists" question from the "how does this event use that state" question — cleaner scope, cleaner reading order. It also means ARD 018 can be implemented and observed alone (illness alive but mortality unchanged) before this ARD's mortality shift lands, which is useful for isolating calibration effects.

## Consequences

- **`MisfortuneEvent.ts`** changes one line — the illness death probability formula.
- **`Variables.ts`** — rename `ILLNESS` to `ILLNESS_DEATH_SCALAR`, re-tune value.
- **All callers and test references to `Variables.ILLNESS` must be updated** to the new name. ESLint will catch them as unresolved.
- **Aggregate illness mortality drops, then is re-tuned.** With typical severity averaging well below 1, the same constant value would produce far fewer illness deaths than before. The retuning brings the rate back into the calibration target band; the *distribution* of illness deaths shifts toward sicker individuals, which is the desired qualitative change.
- **Suicide rate side effects from ARD 018 still apply.** That ARD's introduction of the happiness penalty raises suicide probability through the existing ARD 013 formula. ARD 019 doesn't compound that — the suicide formula is unchanged here.
- **CLAUDE.md updates** in the implementation commit: "Key design decisions" `MisfortuneEvent` bullet updated to reference both ARD 013 and ARD 019; "What's implemented" entry for `MisfortuneEvent` updated; `Variables.ts` listing reflects the rename.
- **Tests must cover:** healthy person never dies of illness in any tick (`illness = 0` → death prob = 0); very sick old person high illness death rate; severity scaling; rename doesn't break existing MisfortuneEvent suicide tests.

### Known weakness inherited from ARD 013

ARD 013 noted that illness death and suicide are checked sequentially with first-cause-wins. That behavior is unchanged. With severity-gated illness death, the "first cause wins" effect now shifts: at low severity, illness rarely wins, so suicide becomes the more likely cause of death for unhappy-but-healthy persons. This is an intended consequence of the model becoming more selective about illness deaths.

### Open follow-ups

- **Asymptomatic illness baseline** (the rejected option above) — flag for future-ideas if simulation shows healthy persons never dying from illness produces unrealistic mortality patterns.
- **Calibration:** the new `ILLNESS_DEATH_SCALAR` value is a guess and should be observed.
