# ARD 046: Transient Happiness Boosts from Helping and Killing

**Status:** Proposed
**Date:** 2026-05-19

## Context

Two events produce no happiness signal for the actor despite strong empirical and design-level reasons that they should:

**HelpEvent (ARD 045):** The "warm glow" / helper's high effect (Andreoni 1990; Dunn et al. 2008) is among the most replicated findings in wellbeing research — giving reliably raises the giver's happiness. Without a boost, `helpingIntent` has no self-reinforcing feedback; a generous person derives no personal benefit from generosity, which decouples the cooperative pathway from the thriving signal.

**KillEvent (ARD 027):** ARD 042 made the victim's estate cause-blind (killer receives no resources from a murder), explicitly leaving the killer with no reward signal beyond avoiding detection. A successful kill should yield a transient happiness gain — frustration release, dominance, or antagonism depending on the character — that decays over several ticks. This was flagged in `docs/future-ideas.md` during the ARD 042 discussion.

`happiness` is a computed getter on `Person` (ARD 014). A transient event-driven boost cannot live in the getter formula without a stored field to carry the state between ticks.

## Decision

Add two stored fields to `Person`:

```typescript
helpHappinessBoost = 0;  // set by HelpEvent; decays each tick
killHappinessBoost = 0;  // set by KillEvent on success; decays each tick
```

**HelpEvent sets the boost** (inside `execute()`, after the resource transfer succeeds — no-ops leave the boost unchanged):

```typescript
person.helpHappinessBoost = Math.min(
  person.helpHappinessBoost + Variables.HELP_HAPPINESS_BOOST,
  Variables.HELP_HAPPINESS_MAX
);
```

**KillEvent sets the boost** (inside `execute()`, after a confirmed kill, before the detection roll):

```typescript
person.killHappinessBoost = Math.min(
  person.killHappinessBoost + Variables.KILL_HAPPINESS_BOOST,
  Variables.KILL_HAPPINESS_MAX
);
```

**`LooperSingleton` decays both fields each tick**, before EventFactory, alongside the existing `jailedTicksRemaining` decrement:

```typescript
person.helpHappinessBoost = Math.max(0, person.helpHappinessBoost - Variables.HELP_HAPPINESS_DECAY);
person.killHappinessBoost = Math.max(0, person.killHappinessBoost - Variables.KILL_HAPPINESS_DECAY);
```

**`Person.happiness` getter adds both fields** (after the existing illness term, before the floor):

```typescript
happiness += this.helpHappinessBoost + this.killHappinessBoost;
return Math.max(0, happiness);
```

**New constants in `Variables.ts`:**

| Constant | Rationale |
|---|---|
| `HELP_HAPPINESS_BOOST` | Happiness added per successful help; controls how rewarding a single act of generosity is |
| `HELP_HAPPINESS_MAX` | Cap on accumulated help boost; prevents prolific helpers from permanently maxing happiness |
| `HELP_HAPPINESS_DECAY` | Amount subtracted per tick; controls how long the warm-glow effect lasts — boost / decay = duration in ticks |
| `KILL_HAPPINESS_BOOST` | Happiness added per successful kill; controls the immediate gratification signal |
| `KILL_HAPPINESS_MAX` | Cap on accumulated kill boost; prevents serial killers from achieving permanent happiness regardless of circumstances |
| `KILL_HAPPINESS_DECAY` | Amount subtracted per tick; controls how quickly the post-kill boost fades |

**Calibration intent:** Both boosts should be meaningful but not dominant — a single event should shift happiness by a noticeable fraction of the baseline range without swamping the structural factors (job, resources, relationship). Duration (`boost / decay`) should be a few ticks at most: the warm glow of a single help and the high from a single kill should both be transient, not a lasting re-rating of circumstances. The kill boost may reasonably decay faster and cap lower than the help boost — pathological satisfaction is brief; genuine generosity compounds more slowly but lingers.

## Reasoning

**Stored field with per-tick decay over a permanent boost.** A permanent additive to happiness on every kill or help would let repeat actors drift toward maximum happiness and stay there indefinitely, decoupling the signal from current life circumstances. The stored field encodes recency: the effect of an act diminishes as time passes, which is behaviorally accurate for both warmth from giving and arousal from violence.

**Additive to the getter over a multiplier.** A multiplier on the happiness total (`happiness *= (1 + boost)`) would amplify all existing factors — a wealthy person who just helped would gain much more than a poor one who just helped, which conflates the two signals. An additive term treats the boost as an independent mood contribution, orthogonal to circumstance.

**Stacking with cap over non-stacking.** Non-stacking (new boost replaces old) would make it impossible for a person who helps frequently to maintain elevated happiness across ticks — the boost would reset rather than reflect sustained generosity. A cap-bounded stack lets the boost accumulate to a ceiling, after which additional acts don't add more, preserving the stochastic character of the gate. This is consistent with how `stealingIntent` is capped in ARD 036.

**Both boosts in one ARD.** They share the same stored-field-with-decay mechanism, both modify the happiness getter in the same commit, and both were decided together. Splitting them would require each ARD to describe the same implementation pattern. The supersession risk is low: revising one boost's magnitude does not require restating the other.

**No HelpRecord to record the boost trigger.** ARD 045 already chose not to write a record for help events. The boost does not change that — its source is implicit in the field name.

## Consequences

- `src/App/Person.ts` — add `helpHappinessBoost = 0` and `killHappinessBoost = 0` fields; fold both into the `happiness` getter after the illness term
- `src/App/LooperSingleton.ts` — decay both fields per tick (floored at 0), alongside the existing `jailedTicksRemaining` decrement
- `src/Events/HelpEvent.ts` — set `helpHappinessBoost` after a successful transfer (no-ops do not set it)
- `src/Events/KillEvent.ts` — set `killHappinessBoost` after a confirmed kill, before the detection roll
- `src/Helpers/Variables.ts` — add `HELP_HAPPINESS_BOOST`, `HELP_HAPPINESS_MAX`, `HELP_HAPPINESS_DECAY`, `KILL_HAPPINESS_BOOST`, `KILL_HAPPINESS_MAX`, `KILL_HAPPINESS_DECAY`
- `src/tests/App/Person.test.ts` — tests must cover: `helpHappinessBoost` adds to happiness getter; `killHappinessBoost` adds to happiness getter; floor still applies when both boosts are present; zero boosts leave getter unchanged
- `src/tests/Events/HelpEvent.test.ts` — tests must cover: successful transfer increments `helpHappinessBoost` up to cap; no-op (zero resources or no eligible target) does not touch `helpHappinessBoost`; boost clamps at `HELP_HAPPINESS_MAX` when stacked
- `src/tests/Events/KillEvent.test.ts` — tests must cover: confirmed kill increments `killHappinessBoost` up to cap; failed attempt does not touch `killHappinessBoost`; boost clamps at `KILL_HAPPINESS_MAX` when stacked
- `src/tests/App/LooperSingleton.test.ts` — tests must cover: both fields decay by their respective rates each tick; neither field goes below 0
- `docs/future-ideas.md` — move "Killer happiness boost on successful kill" from Very useful to Discarded, noting it is implemented here
- `CLAUDE.md` — update `happiness` getter description in Key design decisions to include both boost fields; update "What's implemented" when code lands
