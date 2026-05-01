# ARD 010: Phase 1 Event Mechanics

**Status:** Proposed  
**Date:** 2026-05-01

## Context

ARD 008 established the pattern for intent-gated events:

```typescript
if (rng() < person.stealingIntent * ageModifier(age, STEALING_PEAK_AGE, ...))
  events.push(new StealEvent());
```

Two gaps remain before the first meaningful simulation phase can be implemented:

**Event categorization.** Not all events have an associated intent. Gathering resources and facing misfortune are universal behaviors — every person attempts to gather each tick, and every person faces background mortality risk. The current `EventFactory` skeleton returns `[AgeEvent]` with no categorization discipline. There is no established answer to the question: which events always fire vs. fire only when intent is high enough?

**Undefined mechanics.** ARD 007 described `GatherResourcesEvent` as:

> person gains `extracted = min(f(experience, intelligence), pool / extractionEfficiency)`

The function `f` was left undefined. Similarly, CLAUDE.md describes `MisfortuneEvent` as handling "disaster and suicide" beyond illness death, but no mechanics were specified.

Without resolving these, implementation requires guessing — exactly what the ARD requirement exists to prevent.

## Decision

### 1. Event categorization: unconditional vs. intent-gated

Two categories:

**Unconditional** — fire every tick for every living person, regardless of intent. Probability gates are internal to the event's `execute()` method.

| Event | Rationale |
|---|---|
| `AgeEvent` | Time always passes |
| `GatherResourcesEvent` | Survival gathering is not a choice |
| `MisfortuneEvent` | Background risk faces everyone |

**Intent-gated** — `EventFactory` decides whether to include the event based on `rng() < intent * ageModifier(...)`. The event is not constructed if the gate fails.

All remaining events (exercise, learn, steal, kill, relationship, job, graduation, childbirth, lying, invention) are intent-gated.

In `EventFactory.getEventsFor()`, unconditional events always appear in the returned array; intent-gated events are appended conditionally.

### 2. GatherResourcesEvent extraction formula

The amount a person extracts per tick:

```typescript
const potential = Variables.BASE_GATHER_AMOUNT
  + person.intelligence * Variables.INTELLIGENCE_GATHER_SCALAR
  + person.experience * Variables.EXPERIENCE_GATHER_SCALAR;

const available = simulation.naturalResources / simulation.extractionEfficiency;
const extracted = Math.min(potential, available);

person.resources += extracted;
simulation.naturalResources -= extracted * simulation.extractionEfficiency;
```

**New constants in `Variables.ts`:**

```typescript
static BASE_GATHER_AMOUNT = 2;
static INTELLIGENCE_GATHER_SCALAR = 0.5;
static EXPERIENCE_GATHER_SCALAR = 0.05;
```

These produce the following extraction range at initial stats:

| Profile | intelligence | experience | extracted/tick |
|---|---|---|---|
| Minimum | 1 | 0 | 2.5 |
| Typical seed | 5 | 20 | 5.5 |
| Maximum | 10 | 50 | 9.5 |

At 100 persons typical, ~550 units/tick total extraction. With `NATURAL_RESOURCE_REGEN_RATE = 50`, the pool depletes at roughly 500 units/tick — the pool of 10,000 approaches exhaustion after ~20 ticks. **This is intentional for a 100-tick default run**: the pool pressure creates Gini signal quickly. For longer runs or stability studies, `NATURAL_RESOURCE_REGEN_RATE` and `NATURAL_RESOURCE_CEILING_INITIAL` are the primary tuning levers. The formula shape is the decision; the constants are calibration.

### 3. MisfortuneEvent mechanics

`MisfortuneEvent.execute()` runs three independent checks per tick:

**Illness** (established, ARD 007 + ARD 008):

```typescript
if (rng() < Variables.ILLNESS * person.ageMortalityModifier)
  simulation.kill(person, Constants.CAUSE_OF_DEATH.ILLNESS);
```

**Disaster** — flat per-tick probability, independent of stats or age. Models unpredictable catastrophes (flood, fire, structural collapse):

```typescript
if (rng() < Variables.DISASTER_PROBABILITY)
  simulation.kill(person, Constants.CAUSE_OF_DEATH.DISASTER);
```

New constant:

```typescript
static DISASTER_PROBABILITY = 0.003; // ~0.3% per year
```

**Suicide** — probability scales inversely with happiness. A person at happiness=0 faces a meaningful per-tick risk; a person at any positive happiness faces a sharply reduced risk:

```typescript
if (rng() < Variables.SUICIDE_PROBABILITY_SCALE / (person.happiness + 1))
  simulation.kill(person, Constants.CAUSE_OF_DEATH.SUICIDE);
```

New constant:

```typescript
static SUICIDE_PROBABILITY_SCALE = 0.02;
```

Implied rates at representative happiness values:

| happiness | suicide probability/tick |
|---|---|
| 0 | 2.0% |
| 1 | 1.0% |
| 3 | 0.5% |
| 5 | 0.33% |
| 10+ | <0.2% |

All three checks run independently. A person can survive disaster but still die of illness in the same tick — `simulation.kill()` marks `causeOfDeath` and removes from the living set, so subsequent checks on a person already killed are moot only if `execute()` guards against acting on a dead person. **`MisfortuneEvent.execute()` must check that the person is still alive before each subsequent check.** (Alternatively, `simulation.kill()` is idempotent and `execute()` can rely on the simulation to no-op repeated kills on the same person — whichever the implementer prefers, the behavior must be documented in the event.)

## Reasoning

**Unconditional vs. intent-gated is a first-class distinction.** Collapsing all events into the intent-gated pattern would require inventing stub intents for gathering and misfortune, which would carry no meaning. Marking the split explicitly gives `EventFactory` a clear contract: unconditional events always appear; intent-gated events depend on the person.

**Additive extraction formula, not multiplicative.** A multiplicative formula (`intelligence * experience`) collapses to near-zero when either stat is small, which happens often at seed (experience starts at 0). An additive formula keeps extraction positive even at floor stats, meaning new persons and low-intelligence persons can still gather — just less. The additive structure also makes each term's contribution independently tunable.

**Gathering fires every tick, not probabilistically.** Gathering is survival behavior. Introducing probability would mean some persons gather nothing in a tick by chance alone, which is not a modeling choice we want — starvation should arise from pool depletion and inequality, not random non-participation.

**Disaster is flat probability, not age-scaled.** Illness is age-scaled (biology explains this). Disaster is not — a flood does not preferentially kill 25-year-olds. Age-modifier wrapping would add false precision. Flat probability is consistent with the "random catastrophe" framing.

**Disaster kills, not damages resources.** Resource-damage disasters (losing a fraction of accumulated wealth to a flood) would interact more richly with inequality — wealthy persons survive, poor persons are wiped out. This is noted in `docs/future-ideas.md`. The flat-kill version is simpler and avoids under-specifying a damage fraction; it can be revisited once the resource economy is observable.

**Suicide scales with happiness, not a flat rate.** A flat suicide rate ignores the happiness model entirely, making ARD 009 produce a stat with no behavioral consequence. The inverse-happiness formula ties suicide directly to civilizational conditions: high inequality drives poverty, poverty drives low happiness, low happiness drives suicide. This is the collapse feedback loop the model is designed to surface.

**`happiness + 1` in the denominator, not `happiness`.** Division by zero when happiness=0. Adding 1 also means zero-happiness produces finite, non-infinite probability — the floor is `SUICIDE_PROBABILITY_SCALE`, not unbounded.

**Three checks are independent.** A person at high illness risk and zero happiness can die from any of the three causes in the same tick. The first cause registered wins. This simplicity is preferable to a priority queue; the interaction is a known consequence, not a bug.

## Consequences

- `EventFactory` always includes `[AgeEvent, new GatherResourcesEvent(), new MisfortuneEvent(rng)]` before intent-gated events
- `GatherResourcesEvent` requires `rng` only if a noise term is later added; for now it takes no `rng` — its logic is deterministic given person stats and pool state
- `Variables.ts` gains five new constants: `BASE_GATHER_AMOUNT`, `INTELLIGENCE_GATHER_SCALAR`, `EXPERIENCE_GATHER_SCALAR`, `DISASTER_PROBABILITY`, `SUICIDE_PROBABILITY_SCALE`
- `MisfortuneEvent` must guard against acting on a person killed by an earlier check in the same `execute()` call
- The pool depletion rate at default settings (~500 units/tick net for 100 persons) means Gini signal will emerge within the first 20 ticks — this is the intended behavior for studying early-phase inequality dynamics
- Resource-damage disasters (as an alternative to kill-only) are recorded in `docs/future-ideas.md` for later discussion
- Tests must cover: extraction at min/typical/max stats, pool-limited extraction (available < potential), all three misfortune checks firing, and the already-dead guard
