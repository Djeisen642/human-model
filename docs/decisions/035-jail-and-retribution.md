# ARD 035: Jail and Retribution

**Status:** Accepted
**Date:** 2026-05-17

## Context

`StealingRecord` and `KillingRecord` accumulate evidence of antisocial behavior via `person.amountStolen` and `person.killed`, but neither has any consequence on the perpetrator. The community cannot self-correct robbers or killers; antisocial behavior is constrained only by the perpetrator's own mortality. Without a retribution mechanism, the collapse feedback loop (inequality → crime → more inequality) has no counter-pressure.

## Decision

`Person` gains a `jailedTicksRemaining` field (number, default 0).

**Detection — checked inside `StealEvent` and `KillEvent` after a crime is committed:**

```typescript
const priorCrimes = person.amountStolen.length + person.killed.size;
const detectProb = BASE_DETECT_RATE_[STEAL|KILL]
  * (1 + priorCrimes * DETECTION_CRIME_COUNT_SCALAR);
```

`BASE_DETECT_RATE_STEAL` and `BASE_DETECT_RATE_KILL` differ to reflect that murder is harder to conceal than theft. `DETECTION_CRIME_COUNT_SCALAR` encodes accumulating visibility: a known repeat offender draws more scrutiny.

**Sentencing — on detection:**

`person.jailedTicksRemaining = JAIL_TICKS_[STEAL|KILL]`. Successive sentences are additive (a person caught for both in the same tick accumulates both sentences, though in practice the event order makes this rare). `JAIL_RESOURCE_FORFEIT_FRACTION` of resources is transferred to `communityPool` (ARD 034) before the sentence begins.

**Tick loop — in `LooperSingleton` before `EventFactory`:**

`if (person.jailedTicksRemaining > 0) person.jailedTicksRemaining--`.

**EventFactory — while `jailedTicksRemaining > 0`:**

Only `[AgeEvent, IllnessEvent, JailEvent]` run. All other events are skipped, including `GatherResourcesEvent`, `ConsumptionEvent`, `JobEvent`, `StealEvent`, and `KillEvent`. Mortality events (illness, disaster) still fire — jail does not confer immunity.

**JailEvent (new file, implements `IEvent`):**

Replaces the normal gather/consume cycle while incarcerated. Adds `JAIL_GATHER_AMOUNT` flat to `person.resources` and deducts `JAIL_CONSUMPTION_AMOUNT` flat. Neither amount is stat-scaled. Resources floor at 0. If jail consumption exceeds gather, illness accumulates via the starvation path in `ConsumptionEvent` (same mechanic, already in place).

**New constants in `Variables.ts`:**

| Constant | Rationale |
|---|---|
| `BASE_DETECT_RATE_STEAL` | Baseline per-theft detection probability before crime-count scaling |
| `BASE_DETECT_RATE_KILL` | Baseline per-kill detection probability; higher than steal to reflect lower concealability |
| `DETECTION_CRIME_COUNT_SCALAR` | Linear boost to detection per prior crime committed; encodes the "known repeat offender" effect |
| `JAIL_TICKS_STEAL` | Sentence length in ticks for theft conviction |
| `JAIL_TICKS_KILL` | Sentence length in ticks for murder conviction; longer than theft |
| `JAIL_GATHER_AMOUNT` | Flat resources added per tick while jailed; below typical free gather to make jail economically costly |
| `JAIL_CONSUMPTION_AMOUNT` | Flat resources consumed per tick while jailed |

`JAIL_RESOURCE_FORFEIT_FRACTION` is defined in ARD 034 because the pool is the recipient.

## Reasoning

**Rejected: a separate `JailSystem` class or per-tick sweep.** Detection belongs inside the offending event — it is a direct consequence of that crime, not a background process. Moving it to a sweep introduces ordering ambiguity (does detection fire before or after the same tick's other events?) and requires a separate data structure to track "crimes committed this tick." Inline detection is simpler and keeps causality clear.

**Rejected: `jailedUntilTick` (absolute tick) over `jailedTicksRemaining` (countdown).** Setting `jailedUntilTick` requires the current tick number inside `StealEvent` / `KillEvent`. The `IEvent.execute()` signature is `(person, simulation): void` — `Simulation` does not currently expose a current-tick field, and adding one just for this would be a wider change than warranted. A countdown field is decremented by `LooperSingleton` each tick at zero cost and requires no signature change.

**Rejected: no resource forfeiture on jailing.** Incarceration without economic cost is nearly cost-free for wealthy criminals. Forfeiture creates a direct feedback: antisocial behavior funds the safety net (ARD 034) that counters the inequality it generates.

**Jail still exposes person to mortality.** Illness and disaster continue to fire while jailed. Jail removes social and economic activity, not biological risk. Without this, long sentences would make convicted persons near-immortal, which contradicts both realism and the model's mortality mechanics.

## Consequences

- `Person.ts`: add `jailedTicksRemaining` (number, default 0) mutable field.
- `src/Events/JailEvent.ts`: new file implementing `IEvent`; flat gather and consume, resources floored at 0; starvation illness via the same path as `ConsumptionEvent`.
- `StealEvent.ts`: add detection roll after theft; on detection, set sentence and forfeit resources to `simulation.communityPool`.
- `KillEvent.ts`: add detection roll after a successful kill; on detection, set sentence and forfeit resources.
- `EventFactory.ts`: gate all non-mortality events behind `person.jailedTicksRemaining === 0`; inject `JailEvent` when jailed.
- `LooperSingleton.ts`: decrement `jailedTicksRemaining` for each living person before running `EventFactory`.
- `Variables.ts`: add all seven constants above.
- Tests must cover: detection probability scales with prior crime count and differs by crime type; sentence set correctly on detection; `jailedTicksRemaining` decrements each tick and clears at 0; jailed person does not receive gather/consume/job/steal/kill events; jailed person can still die of illness; resource forfeiture transfers to `communityPool`; JailEvent: flat gather/consume, floor at 0, starvation fires when net negative.
- Cross-references: ARD 026 (StealEvent), ARD 027 (KillEvent), ARD 034 (community pool forfeiture target), ARD 018 (illness), ARD 024 (starvation path).
