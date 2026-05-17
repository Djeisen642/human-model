# ARD 036: Dynamic Intent Multipliers and Theft Emboldening

**Status:** Proposed
**Date:** 2026-05-17

## Context

`stealingIntent` and `killingIntent` are seeded once and never change. Behavior is static regardless of circumstance — a person facing starvation steals at the same rate as a comfortable one; a miserable person kills at the same rate as a happy one. Two empirically documented effects are absent: (1) emboldening — repeated undetected theft reinforces the behavior (Akers 1985; Piquero & Tibbetts 1996); (2) situational pressure — resource scarcity increases theft motivation (Agnew's General Strain Theory), and low happiness increases violence risk (frustration-aggression hypothesis). Neither has a mechanism in the current model.

## Decision

**Emboldening (permanent, in `StealEvent`):**

When detection does not fire, `stealingIntent` receives a small permanent bump:

```typescript
person.stealingIntent = Math.min(
  person.stealingIntent + Variables.STEALING_EMBOLDEN_INCREMENT,
  Variables.STEALING_INTENT_CAP
);
```

This encodes reinforcement learning: each undetected theft lowers the perceived risk and raises willingness. The cap prevents a career thief from reaching near-certainty, preserving the stochastic character of the event.

**Situational steal multiplier (in-event, no stored state change):**

Inside the `EventFactory` gate for `StealEvent`, the resource-pressure term is applied:

```typescript
const resourcePressure = Math.max(
  0,
  1 - person.resources / Variables.SITUATIONAL_STEAL_RESOURCE_THRESHOLD
);
const stealProb = person.stealingIntent
  * (1 + person.charisma * Variables.STEAL_CHARISMA_SCALAR)
  * ageModifier(...)
  * (1 + resourcePressure * Variables.SITUATIONAL_STEAL_SCALAR);
```

Full multiplier when `resources = 0`; no effect at or above `SITUATIONAL_STEAL_RESOURCE_THRESHOLD`. This does not change `stealingIntent` — it is a transient response to current circumstances.

**Situational kill multiplier (in-event, no stored state change):**

Inside `KillEvent.execute()`, the happiness-pressure term is applied to the attempt probability:

```typescript
const happinessPressure = Math.max(
  0,
  1 - person.happiness / Variables.SITUATIONAL_KILL_HAPPINESS_THRESHOLD
);
const attemptProb = person.killingIntent
  * ageModifier(...)
  * (1 + currentGini * Variables.KILL_GINI_SCALAR)
  * (1 + happinessPressure * Variables.SITUATIONAL_KILL_SCALAR);
```

Full multiplier when `happiness = 0`; no effect at or above threshold.

**New constants in `Variables.ts`:**

| Constant | Rationale |
|---|---|
| `STEALING_EMBOLDEN_INCREMENT` | Permanent additive bump to `stealingIntent` per undetected theft; small enough that many thefts are needed to approach the cap |
| `STEALING_INTENT_CAP` | Maximum value `stealingIntent` can reach through emboldening; prevents near-certain stealing regardless of history |
| `SITUATIONAL_STEAL_RESOURCE_THRESHOLD` | Resource level below which resource pressure begins; calibrate against the consumption rate so pressure emerges when a person is genuinely struggling |
| `SITUATIONAL_STEAL_SCALAR` | Maximum multiplier on steal probability at zero resources; controls how much desperation amplifies theft above base intent |
| `SITUATIONAL_KILL_HAPPINESS_THRESHOLD` | Happiness level below which killing pressure begins |
| `SITUATIONAL_KILL_SCALAR` | Maximum multiplier on kill attempt probability at zero happiness |

## Reasoning

**Emboldening is permanent; situational effects are transient.** These are distinct phenomena. Emboldening is behavioral conditioning — a learned reduction in perceived cost from repeated unpunished crime. Situational pressure is a response to current circumstances that should lift when circumstances improve. Conflating them (making all effects permanent, or all transient) would either prevent recovery from hardship or fail to model how criminal careers actually develop. The two-mechanism design keeps them separable in output data.

**Rejected: permanent intent change for situational effects.** A person who steals once during a famine would carry elevated `stealingIntent` forever even if resources recover and they never steal again. This contradicts both strain theory (Agnew) and the empirical desistance literature, which shows behavioral moderation when stressors are removed. Permanent changes should reflect learning, not circumstance.

**Rejected: purely situational model for emboldening.** Gottfredson and Hirschi's General Theory of Crime holds that criminal propensity (low self-control) is a stable trait. Under this view, a situational multiplier for undetected theft would be equally valid. However, the criminal career literature (Blumstein; Farrington) documents measurable escalation in frequency and seriousness over early career stages — a pattern inconsistent with a perfectly stable trait. A small permanent increment with a cap captures escalation while respecting that propensity is not unbounded.

**No desistance mechanic here.** Criminal careers have both escalation and desistance phases. Employment, partnership, and aging all correlate empirically with desistance (Sampson & Laub). This ARD adds escalation only; desistance (intent decay from stable employment, relationship, or age) is noted in `docs/future-ideas.md` for a future ARD once the emboldening dynamics are observable.

**Calibration intent for situational multipliers:** `SITUATIONAL_STEAL_SCALAR` should be calibrated so that at zero resources the steal probability roughly doubles relative to the same person's base intent — a meaningful but not dominant amplification. `SITUATIONAL_KILL_SCALAR` should produce a similar doubling at zero happiness. Both scalars should be small enough that a person with average intent in moderate distress sees only a modest uptick, not near-certainty.

## Consequences

- `StealEvent.ts`: add emboldening on non-detection (`stealingIntent` bump, capped). Detection check is defined in ARD 035 and fires first — emboldening only fires on the non-detection branch.
- `EventFactory.ts`: add resource-pressure multiplier to the `StealEvent` gate.
- `KillEvent.ts`: add happiness-pressure multiplier to attempt probability inside `execute()`.
- `Variables.ts`: add all six constants above.
- Tests must cover: emboldening increments `stealingIntent` on non-detection; emboldening does not fire when detected; `stealingIntent` cannot exceed `STEALING_INTENT_CAP`; situational steal multiplier is 0 at or above threshold, positive below; situational kill multiplier is 0 at or above threshold, positive below; neither situational multiplier mutates the stored intent field.
- Cross-references: ARD 026 (StealEvent base), ARD 027 (KillEvent base), ARD 035 (detection precedes emboldening check).
