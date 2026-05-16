# ARD 026: StealEvent

**Status:** Proposed
**Date:** 2026-05-16

## Context

`StealingRecord` exists in `src/Records/StealingRecord.ts` and `Person.amountStolen` is typed to receive it, but no event populates it. `Person.stealingIntent` (seeded in [0, 0.3)) and the three age profile constants (`STEALING_PEAK_AGE`, `STEALING_AGE_SCALE`, `STEALING_AGE_FLOOR`) are already defined in `Variables.ts` (ARD 008) but unused. The simulation has no resource transfer between persons — only gathering from the pool (ARD 011) and disaster-driven loss (ARD 012). Without theft, high-`stealingIntent` persons exert no pressure on Gini; the inequality signal is incomplete.

## Decision

Add `StealEvent` (implements `IEvent`). Intent-gated in `EventFactory` — stealing is a deliberate act, not a background survival behavior.

**EventFactory gate:**

```typescript
const stealProb = person.stealingIntent
  * (1 + person.charisma * Variables.STEAL_CHARISMA_SCALAR)
  * ageModifier(person.age, Variables.STEALING_PEAK_AGE,
                Variables.STEALING_AGE_SCALE, Variables.STEALING_AGE_FLOOR);
if (rng() < stealProb) {
  events.push(new StealEvent(this.rng));
}
```

**StealEvent.execute():**

```typescript
const victim = simulation.getRandomOther(person, this.rng);
if (!victim || victim.resources <= 0) return;

const amount = Math.min(
  victim.resources * Variables.STEAL_FRACTION,
  Variables.STEAL_MAX_AMOUNT
);

victim.resources -= amount;
person.resources += amount;
person.amountStolen.push(new StealingRecord(victim, amount, person.age));
```

No detection or retaliation roll. `StealingRecord` is the hook for future mechanics (altruistic punishment, generalized trust) — those are not in scope here.

**New constants in `Variables.ts`:**

| Constant | Rationale |
|---|---|
| `STEAL_CHARISMA_SCALAR` | Controls how much charisma amplifies steal probability above intent alone; charisma ranges 1–10, so this should be small enough that a zero-charisma person can still steal |
| `STEAL_FRACTION` | Fraction of victim's current resources taken per theft; sets the per-event inequality impact |
| `STEAL_MAX_AMOUNT` | Hard ceiling on a single theft; prevents a very wealthy victim from losing a destabilizing share of resources in one tick |

**Calibration intent:** At median `stealingIntent` (~0.15) and median charisma (~5), gate probability at peak age should be low enough that a person steals roughly once in every five ticks — frequent enough to move Gini measurably, rare enough that most ticks are clean. `STEAL_FRACTION` and `STEAL_MAX_AMOUNT` should be calibrated against `GatherResourcesEvent` output: a single theft should recover roughly one tick of gathering disadvantage for the thief, not multiple.

## Reasoning

**Fraction of victim resources over a fixed amount.** A fixed `STEAL_FLAT_AMOUNT` either silently no-ops when the victim has less than the fixed value or requires a guard that re-introduces the same free parameter. A fraction gracefully returns zero when the victim has nothing and scales reward naturally — stealing from a wealthier person yields more without a separate clamping guard. `STEAL_MAX_AMOUNT` then prevents the fraction from becoming destabilizing when a victim holds a very large resource balance.

**Random victim selection over resource-weighted selection.** Rational-choice theory and primate research (Blurton Jones 1987; MIT Artificial Life 2024) both suggest thieves prefer intermediate-wealth targets — poor enough to be accessible, rich enough to be worth the attempt. Weighted selection would encode this preference but requires a second design decision (the weight formula) and makes victim selection opaque during analysis. Random selection is the conservative choice; the fraction formula already creates a natural reward gradient (nothing to steal from the poor; high amounts from the rich), so aggregate behavior trends toward resource-holding targets without encoding it explicitly. Weighted selection is noted in `docs/future-ideas.md` for revisitation once simulation data shows whether target distribution matters.

**Charisma in the gate, not the amount.** Charisma could instead scale `STEAL_FRACTION` — charming thieves take more per attempt. But charisma's established role across events (RelationshipEvent formation, JobEvent gain) is to raise access probability, not amplify outcomes. A socially skilled person is better at finding and exploiting opportunities; the amount taken from a given victim is a property of the opportunity, not the thief's charm. Keeping charisma on the probability side preserves consistent semantics.

**No detection roll.** A failed detection could plausibly trigger victim retaliation (`killingIntent` boost) or reduce trust. But neither mechanism exists — `TYPE_OF_HELP.POLICE` is a defined constant with no backing system, and no stat records whether a victim knows theft occurred. A detection roll with no consequence is dead code. The `StealingRecord` already provides the data hook that future retaliation and trust mechanics (noted in `docs/future-ideas.md` as "Altruistic punishment" and "Generalized trust") will consume.

## Consequences

- `src/Events/StealEvent.ts` — new file implementing `IEvent`; takes `rng` in constructor
- `src/Events/EventFactory.ts` — add intent gate for `StealEvent` using `stealingIntent`, charisma multiplier, and stealing age profile
- `src/Helpers/Variables.ts` — add `STEAL_CHARISMA_SCALAR`, `STEAL_FRACTION`, `STEAL_MAX_AMOUNT`
- `src/tests/Events/StealEvent.test.ts` — tests must cover: victim with zero resources (no-op, no record pushed); amount capped by `STEAL_MAX_AMOUNT`; amount equals fraction when below cap; resources transferred correctly (thief gains, victim loses by same amount); `StealingRecord` pushed to `person.amountStolen` with correct victim, amount, and thief age; null victim (sole living person) does not throw
- `src/tests/Events/EventFactory.test.ts` — add: person with `stealingIntent = 0` never receives `StealEvent`; person with high `stealingIntent` at peak age receives it at expected frequency
