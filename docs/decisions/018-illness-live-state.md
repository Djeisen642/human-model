# ARD 018: Illness as Live State

**Status:** Proposed
**Date:** 2026-05-02

## Context

`Person.illness` is declared as a number with the documented range `[0, 1]` (0 = healthy, 1 = very ill, per the comment at Person.ts:100) and consumed by the `happiness` getter as `happiness -= Math.round(this.illness * 5)`. No event ever writes to it. The field is dead state — it always reads 0, which means the happiness penalty never fires and the field's documented role as a continuous severity signal is unused.

Separately, `MisfortuneEvent` (ARD 013) performs an illness *death* roll using a constant `Variables.ILLNESS * ageMortalityModifier`. That roll is completely independent of `person.illness` — a healthy person and a very-ill person have the same chance of dying from illness in any given tick.

Two illness concepts are running on separate tracks: a continuous severity that nothing updates, and an acute death roll with a fixed base rate. This ARD reconciles the first by making illness live state. A separate forthcoming ARD (019) will revise MisfortuneEvent's death formula to consume the live state; that change is intentionally not bundled here so the scope of each decision stays clear.

## Decision

`person.illness` is a live continuous severity in `[0, 1]`. A new event, `IllnessEvent`, fires unconditionally once per living person per tick and applies probabilistic onset and recovery rolls.

```typescript
// Per-tick illness update for one person.
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

Both rolls fire every tick — a person can simultaneously get sicker and partially recover in the same tick. Order within the function (onset before recovery, both before clamp) is internal; the externally visible behavior is "after this event, illness has been updated."

**Constants (placeholders pending calibration):**

| Constant | Initial | Rationale |
|---|---|---|
| `BASE_ILLNESS_ONSET` | `0.05` | Baseline probability of an illness onset event per tick at `ageRisk=1, constitution=1`. |
| `BASE_ILLNESS_RECOVERY` | `0.4` | Baseline recovery probability — most minor illnesses heal in a year. |
| `ILLNESS_ONSET_AMOUNT` | `0.2` | Severity jump on each onset event. Five onsets in a row push someone from 0 to fully ill. |
| `ILLNESS_RECOVERY_AMOUNT` | `0.3` | Severity drop per recovery event. |
| `ILLNESS_AGE_RISK_DIVISOR` | `30` | `ageRisk` doubles every 30 years lived: 1 at birth, 2 at age 30, 3 at age 60. |

**Wiring:** `EventFactory.getEventsFor()` returns `IllnessEvent` unconditionally between `ExperienceEvent` (proposed in ARD 017) and `GatherResourcesEvent`. Final unconditional order:

```
AgeEvent → ExperienceEvent → IllnessEvent → GatherResourcesEvent → MisfortuneEvent
```

This places illness state update *before* MisfortuneEvent's death rolls — important once ARD 019 lands and the death roll consumes `person.illness`. Acute new infection in this tick should be visible to this tick's death check, so a sudden critical illness can kill in the same year.

**No change to `MisfortuneEvent` in this ARD.** The death formula in ARD 013 (`ILLNESS * ageMortalityModifier`, independent of `person.illness`) remains in effect until ARD 019 revises it. During the gap between landing this ARD and landing 019, illness is live state that affects happiness but not mortality. This is a deliberately accepted intermediate state — it's safe to ship 018 alone because nothing else reads `person.illness` aside from `happiness`.

## Reasoning

**Keep illness as live state, don't delete the field.** Removing `person.illness` and the happiness term simplifies the model but discards a meaningful collapse-feedback path: chronic illness drags happiness down, low happiness raises suicide probability (per ARD 013's suicide roll), suicide kills the person. Without live illness state, that cascade is broken. The model is supposed to demonstrate cascades; deleting the only existing chronic-state field undercuts the framing.

**Discrete probabilistic events over continuous Markov drift.** Onset and recovery as discrete probabilistic jumps (chosen) match the existing model's idiom — MisfortuneEvent and DisasterEvent both work this way — and are easier to reason about ("what's the chance of getting sick this year?"). A continuous Markov-style update (`illness += onsetRate * rng()` each tick) is smoother but obscures what's happening; a single equilibrium-drift formulation is elegant but hides the mechanism. The discrete version is also what subsequent ARDs (gather penalty, contagion) will build on, since contagion is naturally discrete (you got sick because someone nearby is sick).

**Onset rises with age and falls with constitution; recovery is the inverse.** Both directions are well-established empirically (immune senescence, recovery time scaling with health). The shape is a linear age scaler (`1 + age/30`) rather than `ageModifier()` because illness onset is monotonically increasing with age, not bell-shaped. Constitution divides onset and multiplies recovery, with seeded constitution range `[1, 10]` providing a 10× spread between robust and frail individuals.

**Onset and recovery rolls are independent within a tick.** Could have made them mutually exclusive (only one happens per tick), but allowing both lets severity drift up and down quickly when rolls are close — which actually reflects how acute illness with partial recovery behaves. The clamp at the end handles overlap into [0,1].

**Separate event rather than folding into MisfortuneEvent.** MisfortuneEvent (ARD 013) handles acute outcomes — death rolls. Illness *state* update is chronic, structurally different. Keeping them separate matches the ARD 003 event architecture: each event has one job. It also makes the ordering constraint (state update before death roll) explicit at the EventFactory layer rather than buried inside one event's implementation.

**Out-of-scope items deferred:**
- **Illness reduces gathering capacity** — already in `docs/future-ideas.md`. Will be a small ARD building on this one.
- **Contagious illness spread** — already in `docs/future-ideas.md`; depends on a proximity model.
- **MisfortuneEvent death roll consuming `person.illness`** — ARD 019, intentionally separate to keep scope honest.

## Consequences

- **New file:** `src/Events/IllnessEvent.ts` implementing `IEvent`. Mirror test in `src/tests/Events/IllnessEvent.test.ts`.
- **`Variables.ts` gains 5 constants** as listed above. All marked as calibration placeholders.
- **`EventFactory.getEventsFor()` gains `IllnessEvent`** in the unconditional block, ordered between `ExperienceEvent` (ARD 017) and `GatherResourcesEvent`.
- **Person.illness is no longer dead state.** Existing tests asserting illness = 0 throughout a simulation run will break. Tests must be updated to expect illness drift.
- **Happiness becomes more volatile.** The `Math.round(illness * 5)` term, previously always 0, now contributes a per-tick penalty up to 5. Suicide rates (which depend on happiness via ARD 013's `SUICIDE_PROBABILITY_SCALE / (happiness + 1)` formula) will rise as a side effect. This is intentional but the magnitude is a calibration concern.
- **No mortality change yet.** Until ARD 019 lands, MisfortuneEvent's illness death roll is unchanged. Sicker people don't die more often from illness — they're just unhappier and more suicide-prone.
- **CLAUDE.md updates** in the implementation commit: "What's implemented" gains `IllnessEvent`. "Key design decisions" gains a bullet referencing ARD 018. Variables.ts entry expands.
- **Tests must cover:** typical adult onset and recovery rates; age scaling (older = sicker on average over many ticks); constitution scaling (frail = sicker); clamp at 0 (recovery doesn't go negative); clamp at 1 (onset doesn't exceed maximum); multi-tick illness trajectory; happiness reflects illness post-update.

### Known weakness: divide-by-zero at constitution=0

The onset and recovery formulas divide by `person.constitution`. Currently safe — `Simulation.seed()` seeds constitution in `[1, 10]`. Becomes unsafe once childbirth produces newborns with default `constitution = 0`. This is the same divide-by-zero issue flagged for `DisasterEvent` in `docs/future-ideas.md` under "Newborn initial stat seeding" — the fix lives there (childbirth must seed initial stats), not here. No defensive code added in `IllnessEvent`; failure mode is loud and will surface as soon as childbirth is wired in, which is the right time to address it.

### Open follow-ups

- **ARD 019** will revise MisfortuneEvent's illness death formula to consume `person.illness`.
- **Calibration:** initial constants are guesses. Specifically, `BASE_ILLNESS_RECOVERY = 0.4` is high enough that healthy adults rarely accumulate severity; this should be observed empirically.
