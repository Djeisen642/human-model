# ARD 045: HelpEvent — Voluntary Resource Transfer

**Status:** Proposed
**Date:** 2026-05-19

## Context

Every person-to-person resource flow in the model is extractive or destructive — `StealEvent` (ARD 026) and `KillEvent` (ARD 027) both widen Gini. The tax/welfare system (ARD 034) and estate inheritance (ARD 042) are structural redistributors, but no event encodes voluntary individual generosity. `Person.helpsPeople` exists but nothing writes or reads it beyond the default `TYPE_OF_HELP.NONE`. Without a positive-sum social interaction, the model can produce varying degrees of collapse but not genuine thriving: high Gini persists because there is no voluntary downward resource flow between persons. This is the primary gap identified in `docs/future-ideas.md` under "Required for completion."

## Decision

Add `HelpEvent` (implements `IEvent`), intent-gated in `EventFactory`. The helper transfers a fraction of their own resources directly to a lower-resource target, reducing Gini tick by tick.

**New field on `Person`:**

```typescript
helpingIntent = 0; // seeded to [0, 0.5) in Simulation.seed()
```

`helpsPeople` (`TYPE_OF_HELP` enum) is left unchanged — it encodes a future *type* of help specialisation (medical, educational, etc.) that is out of scope here.

**EventFactory gate:**

```typescript
const helpProb = person.helpingIntent
  * (1 + person.charisma * Variables.HELP_CHARISMA_SCALAR)
  * ageModifier(person.age, Variables.HELP_PEAK_AGE,
                Variables.HELP_AGE_SCALE, Variables.HELP_AGE_FLOOR);
if (rng() < helpProb) {
  events.push(new HelpEvent(this.rng));
}
```

**HelpEvent.execute():**

```typescript
const target = simulation.getRandomOther(person, this.rng);
if (!target || target.resources >= person.resources || person.resources <= 0) return;

const amount = Math.min(
  person.resources * Variables.HELP_FRACTION,
  Variables.HELP_MAX_AMOUNT
);
person.resources -= amount;
target.resources += amount;
```

Target is drawn by `getRandomOther` (existing method). If the drawn target holds resources equal to or greater than the helper, or if the helper has nothing, the event is a no-op. No record is written — the effect is the resource movement itself.

**New constants in `Variables.ts`:**

| Constant | Rationale |
|---|---|
| `HELP_CHARISMA_SCALAR` | Charisma amplifies help probability above intent alone, consistent with its role in `StealEvent` and `RelationshipEvent`; should be small so low-charisma persons still help |
| `HELP_FRACTION` | Fraction of helper's resources given per event; sets the per-event Gini impact — too large and helpers self-impoverish, too small and the signal is invisible |
| `HELP_MAX_AMOUNT` | Hard ceiling per transfer; prevents a single event from destabilising a very wealthy helper |
| `HELP_PEAK_AGE` | Peak age for generosity; middle-aged persons tend to have the most resources to spare |
| `HELP_AGE_SCALE` | Controls how steeply helping falls off from peak age |
| `HELP_AGE_FLOOR` | Minimum age modifier; elderly persons still help, just less often |

**Calibration intent:** At median `helpingIntent` (~0.25) and median charisma (~5), gate probability at peak age should produce a help event roughly every three to five ticks — frequent enough that `helpingIntent` is a meaningful counter-force to `stealingIntent`, infrequent enough that a helper is not systematically drained. `HELP_FRACTION` and `HELP_MAX_AMOUNT` should be calibrated so a typical transfer offsets roughly one tick of gathering disadvantage for the recipient, symmetric with `StealEvent`'s calibration intent (ARD 026).

**Seeding range:** `helpingIntent` seeded to `[0, 0.5)` — higher ceiling than `stealingIntent` `[0, 0.3)` and `killingIntent` `[0, 0.1)` to reflect that generosity is more common in real populations than theft or violence.

## Reasoning

**Helper pays from own resources (Model A) over coordination bonus (Model B).** A coordination bonus raises total resources without moving Gini directly — the collapse/thrive signal stays opaque. Direct transfer reduces the helper's balance and raises the target's; the Gini effect is immediate and traceable. The cost of generosity also creates a natural tension: high `helpingIntent` persons may self-impoverish, which feeds back into their own starvation chain — an intentional feedback.

**Random target with resource filter over relationship-gated targeting.** Limiting help to partners or children would make the event nearly inert — many persons are unpartnered for long stretches, and children leave the household. A random draw with a resource check (target must have less than the helper) preserves simplicity, guarantees downward transfer, and lets the effect operate across the full population. It also avoids requiring a new `Simulation` method. On average roughly half of random draws will fail the resource check and no-op; the effective help rate is half the gate probability, which is acceptable and predictable.

**`helpingIntent` as a new continuous field over reusing `helpsPeople`.** `helpsPeople` is a categorical enum (NONE, POLICE, MEDICAL, EDUCATION, RESEARCH). A categorical field does not map cleanly to a probability gate — all non-NONE values would be treated identically, losing the gradient that continuous intent fields provide. The existing intent fields (`stealingIntent`, `killingIntent`, `learningIntent`, etc.) are all continuous scalars; `helpingIntent` follows that pattern. `helpsPeople` is preserved for future use cases where the *type* of help matters (e.g., a medical helper reducing illness in their target rather than transferring resources).

**No record written.** `StealEvent` writes a `StealingRecord` as a data hook for future retaliation and trust mechanics (ARD 026). Helping has no equivalent downstream mechanic planned — a `HelpRecord` would be dead data. If a trust stat or bereavement system is added later (noted in `docs/future-ideas.md`), that ARD can introduce the record.

## Consequences

- `src/App/Person.ts` — add `helpingIntent = 0` field
- `src/App/Simulation.ts` — seed `helpingIntent` to `[0, 0.5)` in `seed()`, alongside other intents
- `src/Events/HelpEvent.ts` — new file implementing `IEvent`; takes `rng` in constructor
- `src/Events/EventFactory.ts` — add intent gate for `HelpEvent` using `helpingIntent`, charisma multiplier, and help age profile; wire unconditionally (like `StealEvent`, fired when gate passes)
- `src/Helpers/Variables.ts` — add `HELP_CHARISMA_SCALAR`, `HELP_FRACTION`, `HELP_MAX_AMOUNT`, `HELP_PEAK_AGE`, `HELP_AGE_SCALE`, `HELP_AGE_FLOOR`
- `src/tests/Events/HelpEvent.test.ts` — tests must cover: helper with zero resources (no-op); target with equal or greater resources than helper (no-op); sole living person (no target, no-op); amount capped by `HELP_MAX_AMOUNT`; amount equals fraction when below cap; resources transferred correctly (helper loses, target gains by same amount); `helpingIntent = 0` never fires in `EventFactory`
- `docs/future-ideas.md` — move "Voluntary cooperation / helping event" from Required to Discarded, noting it is implemented here
- `CLAUDE.md` — add to "What's implemented" and "Key design decisions"; add `HELP_PEAK_AGE / HELP_AGE_SCALE / HELP_AGE_FLOOR` to the age profile reference table
