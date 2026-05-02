# ARD 018: Illness as Live State

**Status:** Proposed
**Date:** 2026-05-02

## Context

`Person.illness` is documented as a `[0, 1]` severity (Person.ts:100) and consumed by `happiness` (`-= Math.round(illness * 5)`). No event ever writes it — dead state.

Separately, `MisfortuneEvent` (ARD 013) does an illness death roll using the constant `Variables.ILLNESS * ageMortalityModifier`, independent of `person.illness`. Two illness concepts on separate tracks: a continuous severity nothing updates, and an acute death roll with a fixed rate. This ARD makes the severity live; ARD 019 will revise the death roll to consume it.

## Decision

`person.illness` is live continuous severity in `[0, 1]`. New event `IllnessEvent` fires unconditionally per tick:

```typescript
const ageRisk = 1 + person.age / Variables.ILLNESS_AGE_RISK_DIVISOR;

const onsetProb = Variables.BASE_ILLNESS_ONSET * ageRisk / person.constitution;
if (rng() < onsetProb) {
  person.illness += Variables.ILLNESS_ONSET_AMOUNT;
}

const recoveryProb = Variables.BASE_ILLNESS_RECOVERY * person.constitution / ageRisk;
if (rng() < recoveryProb) {
  person.illness -= Variables.ILLNESS_RECOVERY_AMOUNT;
}

person.illness = Math.max(0, Math.min(1, person.illness));
```

Both rolls fire each tick — severity can drift up and down quickly.

**Constants (placeholders pending calibration):**

| Constant | Initial | Rationale |
|---|---|---|
| `BASE_ILLNESS_ONSET` | `0.05` | Onset probability at `ageRisk=1, constitution=1`. |
| `BASE_ILLNESS_RECOVERY` | `0.4` | Most minor illnesses heal in a year. |
| `ILLNESS_ONSET_AMOUNT` | `0.2` | Severity jump per onset. Five onsets = fully ill. |
| `ILLNESS_RECOVERY_AMOUNT` | `0.3` | Severity drop per recovery. |
| `ILLNESS_AGE_RISK_DIVISOR` | `30` | `ageRisk` doubles by 30, triples by 60. |

**Wiring:** `EventFactory` returns `IllnessEvent` unconditionally between `ExperienceEvent` (ARD 017) and `GatherResourcesEvent`. Final order: AgeEvent → ExperienceEvent → IllnessEvent → GatherResourcesEvent → MisfortuneEvent. State update precedes the death roll so acute illness in this tick can kill in the same tick (relevant once ARD 019 lands).

**MisfortuneEvent unchanged in this ARD.** Until ARD 019 lands, illness affects happiness (and thus suicide via ARD 013) but not illness mortality. Safe intermediate state — only `happiness` reads `person.illness`.

## Reasoning

**Keep illness as live state.** Deleting the field would simplify the model but break the chronic-illness → low-happiness → suicide cascade — the only chronic-state feedback path the model currently has.

**Discrete probabilistic events over continuous drift.** Two alternatives rejected:

1. *Continuous Markov drift* (`illness += rate * rng()`): smoother but obscures the mechanism.
2. *Single equilibrium drift toward an age/constitution target*: elegant but hides the mechanism.

Discrete onset/recovery rolls match MisfortuneEvent and DisasterEvent's idiom and are what future ARDs (gather penalty, contagion) will build on.

**Onset rises with age, falls with constitution; recovery the inverse.** Empirically grounded (immune senescence, recovery scaling with health). Linear age scaler (`1 + age/30`) rather than `ageModifier()` because onset is monotonically increasing, not bell-shaped.

**Independent rolls within a tick** rather than mutually exclusive — lets severity drift in either direction; reflects acute illness with partial recovery.

**Separate event rather than folding into MisfortuneEvent.** Chronic state update vs. acute death roll — different jobs, ARD 003 says one job per event. Also makes the ordering constraint (state before death roll) explicit at the factory.

**Out of scope:** illness-reduces-gathering, contagion, MisfortuneEvent death roll revision. All in `docs/future-ideas.md` or ARD 019.

## Consequences

- New file `src/Events/IllnessEvent.ts` and mirror test.
- `Variables.ts` gains the 5 constants above.
- `EventFactory.getEventsFor()` adds `IllnessEvent` between `ExperienceEvent` and `GatherResourcesEvent`.
- Existing tests that assert illness stays 0 will break; update to expect drift.
- Happiness becomes more volatile (the `illness * 5` penalty is now active); suicide rates rise as a side effect — calibration concern.
- No mortality change until ARD 019 — sicker people are unhappier, not more likely to die of illness.
- CLAUDE.md updates ("What's implemented", "Key design decisions") in the implementation commit.
- Tests must cover: typical adult onset/recovery; age scaling; constitution scaling; clamp at 0 and 1; multi-tick trajectory; happiness reflects updated illness.

### Known weakness: divide-by-zero at constitution=0

Onset/recovery divide by `person.constitution`. Safe today (seed range `[1, 10]`) but breaks when childbirth lands and newborns default to 0. Fix lives in the "Newborn initial stat seeding" item in `docs/future-ideas.md`, not here — failure is loud and will surface at the right time.

### Open follow-ups

- ARD 019 revises MisfortuneEvent to consume `person.illness`.
- Calibration: `BASE_ILLNESS_RECOVERY = 0.4` may be too forgiving; observe empirically.
