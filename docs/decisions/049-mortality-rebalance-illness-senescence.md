# ARD 049: Mortality Rebalance — Illness Senescence Carries Old-Age Death; Suicide Recalibrated

**Status:** Accepted
**Date:** 2026-06-04

## Context

The death model is dominated by a single miscalibrated mechanic. Running the current build
(`src/Events/MisfortuneEvent.ts`, `src/Events/IllnessEvent.ts`) across seeds, **suicide is
~80–90% of all deaths** (seed 42: 70 of 80), illness is a rounding error (2 of 80), and there is
no old-age death at all — `CAUSE_OF_DEATH` has only MURDER/ILLNESS/DISASTER/SUICIDE. Full
audit and empirical anchors are in `docs/research-mortality.md`.

Two coupled defects produce this:

1. **Suicide is ~30–330× real rates.** `SUICIDE_PROBABILITY_SCALE / (happiness + 1)` with scale
   `0.03` puts even the happiest person at ~0.27%/yr (~30× the global ~0.009%/yr) and a typical
   (happiness ≈ 6) person at ~0.4%/yr — the rate of recently-hospitalized depression patients.
   ARD 019 flagged this constant as "a guess."

2. **Illness never accumulates, so the age-mortality channel never fires.** `IllnessEvent`
   recovery probability (`BASE_ILLNESS_RECOVERY = 0.4`) dominates onset
   (`BASE_ILLNESS_ONSET = 0.05`) ~8×; even with ARD 048 constitution decay (too weak to move
   constitution more than ~1–2 points by age 80) the per-tick illness drift is negative for
   essentially everyone, so `illness` sits at 0. `MisfortuneEvent`'s illness death
   (`illness * ILLNESS_DEATH_SCALAR * ageMortalityModifier`) is severity-gated, so at `illness ≈ 0`
   it is ~0 regardless of age. The U-shaped `ageMortalityModifier` (ARD 008) exists but only
   multiplies a number that is always zero.

Net effect: the elderly cannot die of disease, so they die of suicide instead (happiness drifts
down with age and resources), and population dynamics track the happiness→suicide curve rather
than inequality/resource health — corrupting the primary collapse/thrive signal.

## Decision

Rebalance mortality so that **age-related death is disease-mediated through the existing illness
channel** (no separate "natural"/"old age" cause — that is not a real distinct mechanism; aging
raises disease incidence and severity), and **suicide returns to a realistic rate**.

### 1. Illness recovery decays with age (senescence)

`IllnessEvent` recovery probability gains a senescence multiplier so the elderly heal less and
chronic illness accumulates:

```typescript
const senescence = Math.max(
  Variables.ILLNESS_RECOVERY_SENESCENCE_FLOOR,
  1 - Variables.ILLNESS_RECOVERY_SENESCENCE_DECAY
        * Math.max(0, person.age - Variables.ILLNESS_RECOVERY_SENESCENCE_START_AGE)
);

const recoveryProb =
  Variables.BASE_ILLNESS_RECOVERY * person.constitution / ageRisk * senescence;
```

Onset is unchanged in form. Combined with the recalibrated bases below, illness drift is
negative (illness → 0) for healthy working-age persons and turns positive in old age (graded by
constitution), so the elderly become chronically ill and then die through the already
age-modified illness-death roll in `MisfortuneEvent`.

### 2. Recalibrate illness bases so disease can accumulate

`BASE_ILLNESS_ONSET` is raised and `BASE_ILLNESS_RECOVERY` lowered so the onset/recovery balance
can flip in old age (the current 8× recovery dominance cannot be overcome by age-scaling alone).
`ILLNESS_DEATH_SCALAR` is re-tuned so the resulting illness-death probability at ages 65/80/90
lands near SSA period-life-table `q(x)` (~1.5% / ~5% / ~16%). Values live in `Variables.ts`.

### 3. Recalibrate suicide

`SUICIDE_PROBABILITY_SCALE` is cut ~1–2 orders of magnitude (target: typical-happiness rate in
the ~0.01–0.05%/yr band, happiness-0 rate ≤ ~1%/yr — the highest-risk clinical ceiling). The
`SUICIDE_PROBABILITY_SCALE / (happiness + 1)` form is unchanged; only the constant moves.

### New constants in `Variables.ts`

| Constant | Rationale |
|---|---|
| `ILLNESS_RECOVERY_SENESCENCE_START_AGE` | Age past which recovery capacity begins to decline; before it, recovery is unimpaired (acute illness in the young still heals). |
| `ILLNESS_RECOVERY_SENESCENCE_DECAY` | Per-year linear reduction in the recovery multiplier past the start age; controls how fast healing fails with age. |
| `ILLNESS_RECOVERY_SENESCENCE_FLOOR` | Minimum recovery multiplier; non-zero so the very old can still occasionally recover (recovery weakens, never vanishes). |

Recalibrated existing constants (values only, in `Variables.ts`): `BASE_ILLNESS_ONSET`,
`BASE_ILLNESS_RECOVERY`, `ILLNESS_DEATH_SCALAR`, `SUICIDE_PROBABILITY_SCALE`.

## Reasoning

**Rejected: a separate `CAUSE_OF_DEATH.NATURAL` / `BASE_NATURAL_MORTALITY` path.** This was the
first draft of the recommendation. It was dropped because "old age" / "natural causes" is not a
real distinct cause — WHO ICD guidance discourages it, and age-related death is overwhelmingly
disease-mediated. A parallel age-driven death formula would also need calibrating against the
illness path to avoid double-counting. Routing old-age mortality through illness keeps one
mortality channel, matches the biology, and reuses the age-shaped `ageMortalityModifier` that
already exists.

**Rejected: pure recalibration of the existing onset/recovery constants (no senescence term).**
Onset already rises with age (`× ageRisk`) and recovery already falls (`÷ ageRisk`), but
`ageRisk = 1 + age/30` only reaches ~4 at age 90 — far too shallow to overcome the recovery
dominance, and raising the bases enough to flip it by age-scaling alone would also make young
low-constitution persons chronically ill. A dedicated senescence decay on recovery concentrates
the effect in old age (the empirically correct location: healing capacity, not just illness
incidence, declines with age) and is the lever the research doc explicitly licensed ("make
`BASE_ILLNESS_RECOVERY` decay with age").

**Rejected: an age term added directly to `illnessDeathProb` in `MisfortuneEvent`.** Putting the
age-disease contribution in the death roll (rather than in accumulated severity) would be the
easiest to calibrate to `q(x)`, but it bypasses `person.illness` entirely — the elderly would
die at rising rates while showing `illness = 0`, breaking the link between the visible severity
state, happiness (illness lowers happiness), and the SURVIVORS health report. Accumulating real
severity via senescence keeps the state coherent across all consumers of `illness`.

**Suicide form unchanged.** A happiness *threshold* shape was considered (risk only below some
floor) but deferred — the `1/(happiness + 1)` curve is acceptable once the scale is realistic;
changing both shape and magnitude at once would make the recalibration harder to reason about.

## Consequences

- `src/Events/IllnessEvent.ts` — recovery probability multiplied by the senescence factor;
  JSDoc updated; ARD 049 reference added alongside ARD 018.
- `src/Helpers/Variables.ts` — add the three senescence constants; re-tune
  `BASE_ILLNESS_ONSET`, `BASE_ILLNESS_RECOVERY`, `ILLNESS_DEATH_SCALAR`,
  `SUICIDE_PROBABILITY_SCALE`.
- `src/tests/Events/IllnessEvent.test.ts` — must cover: senescence multiplier is 1 below the
  start age; recovery probability declines past the start age; multiplier floors at
  `ILLNESS_RECOVERY_SENESCENCE_FLOOR`; with senescence applied, an old low-constitution person
  has positive illness drift (onset can exceed recovery) while a healthy working-age person does
  not. Existing onset/recovery/clamp tests re-tuned for new base values.
- `src/tests/Events/MisfortuneEvent.test.ts` — illness-death tests re-tuned for new
  `ILLNESS_DEATH_SCALAR`; suicide tests re-tuned for new `SUICIDE_PROBABILITY_SCALE`; the
  `illness = 0 → no illness death` severity-gate property still holds.
- Calibration is empirical: after the change, a healthy run should show **illness ≫ suicide**,
  suicide ~1–3% of deaths, and the elderly dying of illness rather than suicide. Validation =
  re-run the seed sweep in `docs/research-mortality.md` and confirm suicide share drops from
  ~80% to single digits and the population still turns over in old age (no immortality).
- `CLAUDE.md` — update the `IllnessEvent` and `MisfortuneEvent` bullets and the Variables list.
- `docs/odd-protocol.md` — update the IllnessEvent recovery sub-model (senescence) and the
  illness/suicide mortality description.
- Cross-references: refines [ARD 018](./018-illness-live-state.md) (recovery formula gains a
  senescence factor; live-state and independent-roll decisions unchanged) and recalibrates the
  suicide constant from [ARD 019](./019-misfortune-illness-death-revision.md) (formula and
  severity-gating unchanged); relies on [ARD 008](./008-age-modifiers.md) `ageMortalityModifier`
  and interacts with [ARD 048](./048-stat-caps-and-age-decay.md) constitution decay. Research:
  `docs/research-mortality.md`.
