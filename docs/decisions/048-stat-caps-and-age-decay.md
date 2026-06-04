# ARD 048: Stat Caps and Age-Based Decay for Constitution and Intelligence

**Status:** Accepted
**Date:** 2026-06-04

## Context

`ExerciseEvent` increments `person.constitution` unconditionally on success; `LearnEvent` and `GraduationEvent` increment `person.intelligence`. Neither stat has an upper bound or any decay mechanism. A person who exercises every year for 60 years can accumulate a constitution of 70+. Two event formulas divide by `constitution`:

- `DisasterEvent`: kill check = `DISASTER_KILL_BASE * ageMortalityModifier / constitution`
- `IllnessEvent`: onset = `BASE_ILLNESS_ONSET * ageRisk / constitution`

At high constitution values both checks approach zero, making lifelong exercisers near-immortal regardless of age or illness severity. This is flagged in `docs/future-ideas.md` (High priority) as a known correctness issue that produces degenerate outcomes in long runs before the collapse/thrive signal can develop.

`intelligence` has the same unbounded growth problem via `LearnEvent` and `GraduationEvent`, with downstream effects on `GatherResourcesEvent` (output scales with intelligence), `JobEvent`, and `InventionEvent` probability gates.

Research grounding is in `docs/research-stat-decay.md`.

## Decision

**Add hard caps on both stats and a new unconditional `StatDecayEvent` that reduces them with age.**

### Hard caps

```typescript
// In ExerciseEvent
person.constitution = Math.min(Variables.CONSTITUTION_MAX, person.constitution + 1);

// In LearnEvent and GraduationEvent
person.intelligence = Math.min(Variables.INTELLIGENCE_MAX, person.intelligence + 1);
```

New constants:
- `CONSTITUTION_MAX` — upper bound on `constitution`. Calibration intent: high enough that a lifelong exerciser achieves a meaningfully elevated cap (not immediate); low enough that `DisasterEvent` and `IllnessEvent` retain meaningful mortality at any age.
- `INTELLIGENCE_MAX` — upper bound on `intelligence`. Same principle; also bounds the intelligence-scaled terms in `GatherResourcesEvent`, `InventionEvent`, and job probability.

### Per-tick probabilistic decay

`StatDecayEvent` (unconditional, `IEvent`) rolls a decay check for each stat independently on every tick:

```typescript
const constitutionDecayProb = Variables.CONSTITUTION_DECAY_BASE_RATE
  * Math.max(0, person.age - Variables.CONSTITUTION_DECAY_START_AGE);

if (rng() < constitutionDecayProb) {
  person.constitution = Math.max(1, person.constitution - 1);
}

const intelligenceDecayProb = Variables.INTELLIGENCE_DECAY_BASE_RATE
  * Math.max(0, person.age - Variables.INTELLIGENCE_DECAY_START_AGE);

if (rng() < intelligenceDecayProb) {
  person.intelligence = Math.max(1, person.intelligence - 1);
}
```

Both stats floor at 1 (never zero — `IllnessEvent` onset divides by constitution).

New constants:
- `CONSTITUTION_DECAY_START_AGE` — age before which decay probability is zero. Calibration intent: onset around 30–35 to match empirical physical decline onset (research shows measurable decline by 35 even in trained individuals).
- `CONSTITUTION_DECAY_BASE_RATE` — probability of −1 per year past start age. Calibration intent: targets ~1–2% annual probability at age 50, ~3–4% at age 70+, matching the 10–15%/decade and 25–40%/decade brackets in the research.
- `INTELLIGENCE_DECAY_START_AGE` — cognitive decay onset. Later than physical; calibration intent: ~40, matching fluid intelligence decline onset in midlife studies.
- `INTELLIGENCE_DECAY_BASE_RATE` — lighter than constitution rate. Calibration intent: ~0.5–1% annual at age 50, ~2% at age 70, matching the ~4.9% cognitive speed decline per decade and steeper post-65 trajectory.

### Event factory placement

`StatDecayEvent` is **unconditional** and runs for both free and jailed persons:

- **Free path:** appended after `ExerciseEvent` and `LearnEvent` in the returned array, before `MisfortuneEvent`. Increment and decay can both fire in the same tick; the net-zero case is statistically correct over many ticks.
- **Jail path:** added to `[AgeEvent, IllnessEvent, JailEvent, StatDecayEvent, MisfortuneEvent]`. Physical and cognitive aging do not pause in jail.

### Charisma

`charisma` is seeded [1, 10] and nothing in the current event set increments it. Adding decay without an increment counterforce would create a one-way ratchet (every person's charisma monotonically approaches 1). Deferred: if a social-skill-building event is added later, that ARD should address charisma decay at the same time.

## Reasoning

**Probabilistic per-tick decay over deterministic threshold.** A deterministic rule (e.g. `constitution--` every N ticks past age 65) is simpler but abrupt: it fires identically for an exercising 66-year-old and a sedentary one. Probabilistic decay with linear age scaling makes the rate smooth and gives the existing increment events (ExerciseEvent, LearnEvent) genuine counterforce value — an active person's net expected stat change per tick is lower-magnitude negative than a sedentary one's, matching the masters athlete finding that training slows but cannot arrest decline. The linear formula `rate × max(0, age − start)` is the simplest shape that captures onset and acceleration without additional parameters.

**Hard cap over diminishing returns on increment.** Diminishing returns (e.g., scaling ExerciseEvent's increment by `1 - constitution/MAX`) would slow accumulation before the cap but would not fix existing persons already above any soft limit, would require an additional shaping parameter per stat, and is inconsistent with the rest of the model, which uses `Math.min`/`Math.max` clamps everywhere (see `InventionEvent` productivity cap, ARD 047; regen clamp in `Simulation.regenerate()`; resource floor at 0). A hard cap is one number with an obvious meaning.

**Single `StatDecayEvent` over decay embedded in increment events.** Placing decay inside `ExerciseEvent` or `LearnEvent` would mean decay only fires when the intent gate fires — skipping ticks when the person doesn't exercise. Physical and cognitive aging are unconditional biological processes, not consequences of intent. A separate unconditional event is the architecturally correct home.

**Floored at 1, not 0.** `IllnessEvent` onset rolls `ageRisk / constitution`; at constitution 0 this is a division by zero. Flooring at 1 is the same guard used elsewhere (newborn stat seeding in ARD 037 prevents `constitution = 0` for the same reason).

## Consequences

- `src/Events/StatDecayEvent.ts` — new file; implements `IEvent`; rolls independent decay checks for `constitution` and `intelligence` per tick.
- `src/Events/ExerciseEvent.ts` — change `person.constitution++` to `Math.min(Variables.CONSTITUTION_MAX, person.constitution + 1)`.
- `src/Events/LearnEvent.ts` — same clamp for `intelligence`.
- `src/Events/GraduationEvent.ts` — same clamp for `intelligence`.
- `src/Events/EventFactory.ts` — add `StatDecayEvent` to the free path (after `LearnEvent`, before `MisfortuneEvent`) and to the jail path.
- `src/Helpers/Variables.ts` — add `CONSTITUTION_MAX`, `CONSTITUTION_DECAY_START_AGE`, `CONSTITUTION_DECAY_BASE_RATE`, `INTELLIGENCE_MAX`, `INTELLIGENCE_DECAY_START_AGE`, `INTELLIGENCE_DECAY_BASE_RATE` with JSDoc and ARD 048 reference.
- `src/tests/Events/StatDecayEvent.test.ts` — must cover: no decay fires before start age; decay probability scales linearly with age past start; constitution floors at 1 not 0; intelligence floors at 1 not 0; both stats decay independently (one fires without the other based on RNG); caps are respected by increment events (ExerciseEvent at CONSTITUTION_MAX stays at CONSTITUTION_MAX; LearnEvent and GraduationEvent at INTELLIGENCE_MAX stay there).
- `docs/future-ideas.md` — remove "Stat caps and age-based decay" from High priority (resolved here).
- `CLAUDE.md` — add `StatDecayEvent` to "What's implemented"; update `ExerciseEvent`, `LearnEvent`, `GraduationEvent` entries to note caps; update EventFactory entry for new jail path.
- `docs/odd-protocol.md` — update `constitution` and `intelligence` state-variable descriptions to note caps and decay; add `StatDecayEvent` to the per-person event sub-model.
- Cross-references: addresses the correctness gap noted by [ARD 047](./047-invention-bounds-and-symmetry.md)'s context framing (runaway constitution); the floor-at-1 guard mirrors the newborn protection in [ARD 037](./037-newborn-stat-seeding.md).
