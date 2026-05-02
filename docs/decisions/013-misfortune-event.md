# ARD 013: MisfortuneEvent

**Status:** Superseded by ARD 019  
**Date:** 2026-05-01

## Context

CLAUDE.md specifies that `MisfortuneEvent` handles illness death, disaster, and suicide. The illness death mechanic was established in ARD 007 and ARD 008. ARD 012 defined disaster mechanics. This ARD defines suicide mechanics and specifies how the three checks compose into a single event.

## Decision

`MisfortuneEvent` is unconditional — it fires every tick for every living person (see ARD 010). It runs three independent checks in sequence. If a person dies from an earlier check, subsequent checks are skipped.

**1. Illness death** (established in ARD 007 + ARD 008):

```typescript
if (rng() < Variables.ILLNESS * person.ageMortalityModifier)
  simulation.kill(person, Constants.CAUSE_OF_DEATH.ILLNESS);
```

**2. Disaster** (mechanics defined in ARD 012):

Disaster is a population-level event — it does not trigger per-person inside `MisfortuneEvent`. Instead, `LooperSingleton` (or a dedicated `DisasterEvent`) runs the disaster check once per tick, selects affected persons, and applies kills and resource damage before individual person events fire. `MisfortuneEvent` does not own disaster logic.

**3. Suicide:**

```typescript
if (rng() < Variables.SUICIDE_PROBABILITY_SCALE / (person.happiness + 1))
  simulation.kill(person, Constants.CAUSE_OF_DEATH.SUICIDE);
```

Suicide probability scales inversely with happiness. At happiness=0, the probability equals `SUICIDE_PROBABILITY_SCALE`. It drops sharply as happiness rises.

**New constant in `Variables.ts`:**

```typescript
static SUICIDE_PROBABILITY_SCALE = 0.03; // 3% at happiness=0
```

Implied rates:

| happiness | probability/tick |
|---|---|
| 0 | 3.0% |
| 1 | 1.5% |
| 3 | 0.75% |
| 5 | 0.5% |
| 10 | 0.27% |

Suicide applies to all ages. Children are not excluded — a destitute orphan at happiness=0 faces genuine risk. The revised happiness model (ARD 014) ensures children with living, resourced parents naturally achieve positive happiness; only children in genuinely desperate circumstances approach the danger threshold.

**Check ordering and early exit:**

```typescript
execute(person: Person, simulation: Simulation): void {
  if (rng() < Variables.ILLNESS * person.ageMortalityModifier) {
    simulation.kill(person, Constants.CAUSE_OF_DEATH.ILLNESS);
    return;
  }
  if (rng() < Variables.SUICIDE_PROBABILITY_SCALE / (person.happiness + 1)) {
    simulation.kill(person, Constants.CAUSE_OF_DEATH.SUICIDE);
  }
}
```

## Reasoning

**Disaster is not per-person inside MisfortuneEvent.** Disaster (ARD 012) affects a randomly selected group of people simultaneously — it is a population-level event, not an individual background risk. Running a disaster check inside each person's `MisfortuneEvent` would create 100 independent disaster rolls per tick, producing near-constant disasters rather than rare catastrophic events. Separating disaster into a tick-level check preserves its intended population-level character.

**Suicide scales with happiness, not individual factors.** Happiness (ARD 009, ARD 014) already aggregates job, resources, relationships, age, and illness. Using happiness as the single input avoids double-counting those factors and lets the suicide signal respond naturally to the whole life situation. When everything is bad simultaneously, happiness floors at 0 and suicide risk peaks.

**3% at happiness=0 is grounded in real data.** General population annual suicide rates are ~0.01%. High-risk groups (severe depression, previous attempts, extreme poverty) reach 3–5% annually. Happiness=0 in this model requires a simultaneous confluence of bad conditions — no job, critical resources, no relationship, serious illness — placing it firmly in the high-risk range.

**Children are not excluded.** Excluding children entirely would be a false protection that obscures real dynamics. The revised happiness model (ARD 014) means children with living, resourced parents will not approach happiness=0; the ones who do — destitute orphans — face genuine risk that the simulation should reflect.

**`happiness + 1` in denominator.** Prevents division by zero at happiness=0 and naturally bounds the maximum probability to `SUICIDE_PROBABILITY_SCALE` rather than infinity.

**Early exit after illness.** A person killed by illness does not face a suicide check. The first cause of death wins. Illness check runs first as it is age-driven and independent of life circumstances; suicide runs second as it requires the happiness computation.

## Consequences

- `MisfortuneEvent` runs illness and suicide checks; disaster is handled at the tick level separately
- `Variables.ts` gains `SUICIDE_PROBABILITY_SCALE = 0.03`
- `Person.happiness` must be computed before suicide check — no additional cost since it is a getter
- Disaster logic placement (in `LooperSingleton` or a dedicated `DisasterEvent`) is a decision for implementation; this ARD establishes only that it does not belong inside `MisfortuneEvent`
- Tests must cover: illness death (skips suicide check), suicide at happiness=0, suicide at positive happiness, both checks pass but only first cause registered
- ARD 013 index entry should be added before ARD 014 in README
