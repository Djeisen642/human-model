# ARD 064: Newborn Intent Heritability Revision

**Status:** Proposed
**Date:** 2026-09-19

## Context

ARD 037 gave newborn intents (`learningIntent`, `exerciseIntent`, `stealingIntent`, `killingIntent` — `helpingIntent` did not exist yet) a heritability draw that regresses toward zero:

```
raw = parentMean * HERITABILITY_INTENT_COEFFICIENT + noise   // HERITABILITY_INTENT_COEFFICIENT = 0.25
child.intent = clamp(raw, 0, 1)
```

against stats' draw (`ChildbirthEvent.ts:90-95`, unchanged by this ARD), which regresses toward a nonzero population mean:

```
raw = NEWBORN_STAT_POPULATION_MEAN + (parentMean - NEWBORN_STAT_POPULATION_MEAN) * HERITABILITY_STAT_COEFFICIENT + noise
```

ARD 037's reasoning was that antisocial-behavior transmission has a natural baseline of zero ("most people are not stealing or killing") and elevated parental intent should decay toward that baseline, unlike stats which regress toward the species mean. That reasoning targeted `stealingIntent`/`killingIntent` specifically but was applied uniformly to all four intents, including `learningIntent` and `exerciseIntent`, which are not antisocial traits and have no "most people don't do this" baseline — `Simulation.seed()` (`Simulation.ts:425-426`) seeds founders' `learningIntent` and `exerciseIntent` from `[0, 1)`, mean 0.5, the same shape as a stat.

Simulating `drawIntent` verbatim against the current constants (`HERITABILITY_INTENT_COEFFICIENT = 0.25`, `HERITABILITY_INTENT_NOISE_RANGE = 0.05`) over successive generations, random-mating a 20,000-person population seeded the way `Simulation.seed()` seeds founders, gives:

| Generation | 0 (founders) | 1 | 2 | 3 | 4 | 5–8 |
|---|---|---|---|---|---|---|
| Mean `learningIntent` | 0.501 | 0.126 | 0.034 | 0.017 | 0.0147 | settles 0.0142–0.0145 |

This is the expected closed form: the unclamped expectation decays as `0.25ⁿ`; clamping at 0 with symmetric ±0.05 noise creates a floor equilibrium around 0.0125–0.015, regardless of the founder distribution's mean. All four fields that go through `drawIntent` converge the same way. `EventFactory.ts:84-87` gates `EnrollmentEvent`/`LearnEvent` on `BASE_ENROLLMENT_RATE * learningIntent * ageModifier(...)`; with `learningIntent` at 0.5 vs. ≈0.014, per-tick enrollment probability at peak age falls roughly 35×, from about a 40% lifetime chance of ever enrolling (founders) to about 1.4% (fourth generation onward). Every population more than a handful of generations deep is therefore behaviorally near-inert on all four intent-gated events.

`docs/research-untested-variables.md` (48 seeds, 2000 ticks, ≈77 generations of headroom) does not measure anything intent-gated — its three headline "inert" levers (`BASE_CHILDBIRTH_RATE`, `HAPPINESS_BASELINE`, `EXPERIENCE_CAP`) don't route through `learningIntent`/`exerciseIntent`/etc. — so this defect does not explain that doc's specific findings. It would explain low education/learning throughput in any future study that measures it, since every run in that doc's regime spent nearly its entire duration past the four-generation convergence point.

`Person.helpingIntent`'s missing inheritance (defaults to 0, never assigned in `ChildbirthEvent.seedNewborn`) is a related but separate defect, scoped to its own ARD per project-owner decision.

## Decision

Newborn intents regress toward a per-intent population-mean anchor, using the same functional form `drawStat` already uses — generalized so each intent gets its own anchor instead of stats' single shared one:

```
raw = anchor_i + (parentMean - anchor_i) * HERITABILITY_INTENT_COEFFICIENT + noise
child.intent = clamp(raw, 0, 1)
```

Four new anchor constants, one per intent, each set to that intent's own founder-seeding mean (`Simulation.seed()`'s draw range, halved):

- `NEWBORN_LEARNING_INTENT_MEAN` — anchor for `learningIntent`, matching its `[0, 1)` founder range
- `NEWBORN_EXERCISE_INTENT_MEAN` — anchor for `exerciseIntent`, matching its `[0, 1)` founder range
- `NEWBORN_STEALING_INTENT_MEAN` — anchor for `stealingIntent`, matching its `[0, 0.3)` founder range
- `NEWBORN_KILLING_INTENT_MEAN` — anchor for `killingIntent`, matching its `[0, 0.1)` founder range

`HERITABILITY_INTENT_COEFFICIENT` and `HERITABILITY_INTENT_NOISE_RANGE` are unchanged in meaning and value — this revision changes the anchor, not the strength of regression or the noise.

`drawIntent` gains an `anchor` parameter (the counterpart to `drawStat` reading `NEWBORN_STAT_POPULATION_MEAN` directly); `seedNewborn` passes the matching constant per field.

Stat heritability (`drawStat`, `NEWBORN_STAT_POPULATION_MEAN`, `HERITABILITY_STAT_COEFFICIENT`, `HERITABILITY_STAT_NOISE_RANGE`) is unchanged and restated here only because this ARD supersedes ARD 037 in full (see Scope note below).

**Scope note:** ARD 037 bundled stat and intent heritability as one decision. This ARD revises only the intent branch, but per this project's supersession rule (`docs/decisions/README.md` — no "partially superseded" status), superseding part of an ARD means writing a full replacement. ARD 037's stat-heritability decision and reasoning are unchanged and carry over verbatim in effect; only its intent-heritability decision and reasoning are replaced below.

## Reasoning

**Why a per-intent anchor, not a literal-zero anchor (ARD 037's choice).** ARD 037's stated intuition — "a strong killer does not beget another strong killer, but someone more likely to kill" — is about regression toward a low baseline, not regression toward exactly zero. The model already has a defined low baseline for each antisocial intent: the founder seeding mean (0.15 for `stealingIntent`, 0.05 for `killingIntent`). Anchoring there preserves ARD 037's "most people don't steal or kill much" framing without asserting the stronger, unsupported claim that antisocial disposition should vanish entirely absent reinforcement. For `learningIntent`/`exerciseIntent`, which were never antisocial traits and never had a "natural baseline of zero" argument behind them in the first place, the population-mean anchor removes an asymmetry that was really a scope error in ARD 037 — those two fields were swept along with `stealingIntent`/`killingIntent` under reasoning that never applied to them.

**Why per-intent constants instead of one shared anchor (mirroring `NEWBORN_STAT_POPULATION_MEAN`'s single value).** Stats share one anchor because all three (`intelligence`, `constitution`, `charisma`) share one founder range (`[1, 11)`). Intents do not share a range — ARD 045 deliberately seeded antisocial intents lower than prosocial ones (`stealingIntent [0, 0.3)`, `killingIntent [0, 0.1)`, `helpingIntent [0, 0.5)`) specifically to encode that distinction. A single shared intent anchor (e.g., 0.5, mirroring the stat pattern) would pull `killingIntent` up toward the same center as `learningIntent` over generations, erasing exactly the asymmetry ARD 045 built. Per-intent anchors are the only option that both fixes the collapse-to-zero defect and preserves that asymmetry.

**Why not anchor to the parent only, with no population pull (heritability = 1 in effect).** Considered and rejected: this would mean an intent, once elevated in a lineage, never regresses at all except via noise — closer to clonal inheritance than to the regression-to-the-mean model quantitative genetics predicts for any trait with heritability under 1 (which `HERITABILITY_INTENT_COEFFICIENT = 0.25` explicitly asserts). It would also remove the "few people are highly antisocial" pull ARD 037 was reaching for, replacing decay-to-zero with no decay at all — trading one extreme for the other rather than fixing the anchor.

**Why not leave decay-to-zero as intended behavior.** Considered and rejected by the project owner: a trait that provably converges to the same ~0.014 floor regardless of the founding population's composition or in-simulation events carries no signal past the fourth generation, which contradicts the project's stated interest in generational and behavioral dynamics as a study object (CLAUDE.md). There is no biological or social-learning process that drives *all* behavioral disposition to near-zero within four generations independent of environment; ARD 037's own reasoning argued for a low baseline, not an evaporating one.

## Consequences

- `ChildbirthEvent.ts`: `drawIntent` takes an `anchor: number` parameter; `seedNewborn` passes `Variables.NEWBORN_LEARNING_INTENT_MEAN` / `NEWBORN_EXERCISE_INTENT_MEAN` / `NEWBORN_STEALING_INTENT_MEAN` / `NEWBORN_KILLING_INTENT_MEAN` per field.
- `Variables.ts`: four new constants (Decision section); values are the founder seed range midpoints, placed alongside the existing `HERITABILITY_*` constants.
- Existing test `'child intents regress toward zero (target = 0, not population mean)'` (`ChildbirthEvent.test.ts:341`) asserts behavior this ARD reverses and must be rewritten to assert regression toward each intent's own anchor. The clamp test at line 358 stays valid in shape but should be re-checked against the new anchors (a clamp-to-0 test needs parent values below the anchor with noise that can still push negative, e.g. near `killingIntent`'s low anchor).
- New tests must cover: (1) each intent's generation-mean sequence converges toward its own anchor, not zero, over many simulated generations (the fixed-point test this defect lacked); (2) `learningIntent`/`exercise Intent` and `stealingIntent`/`killingIntent` anchors remain distinct after convergence, i.e., the ARD 045 asymmetry survives generations; (3) children of parents above the anchor regress downward, children of parents below regress upward (same shape `drawStat` is already tested for).
- **This changes every long-horizon result in `docs/research-*.md`.** Any study running more than ~4 generations (most do; childbirth peaks at age 26, so 2000 ticks is roughly 77 generations of headroom) measured a population whose `learningIntent`/`exerciseIntent`/`stealingIntent`/`killingIntent` had already collapsed to a ~0.014 floor for nearly the entire run. Post-fix populations will have meaningfully different enrollment, exercise, theft, and killing rates at any horizon past a handful of generations. Re-running the headline studies (`docs/research-extraction-need-ratio.md`, `docs/research-productivity-band.md`, `docs/research-scale-robustness.md`, `docs/research-untested-variables.md`, priority in that order) is required follow-up, not optional cleanup — tracked as a separate task, not part of this ARD's implementation.
- `docs/model-reference.md`'s "Newborn stat seeding via parental heritability" bullet says "Intents (all five) regress toward `0`" — wrong on two counts even before this ARD (only four fields go through `drawIntent`; `helpingIntent` isn't seeded at all) and needs updating regardless once this lands, to describe per-intent anchors instead of a shared zero target.
- `docs/decisions/README.md` index: ARD 037's Status changes to `Superseded by ARD 064`.
- Known weakness carried over from ARD 037: noise is uniform, not Gaussian, so newborn intent distributions are flatter than a realistic trait distribution. Unchanged by this ARD; still a candidate for future revision if generational variance becomes a direct study target.
- Known new weakness: `killingIntent`'s anchor (0.05) is close to the clamp floor (0) relative to the noise half-width (0.05 unchanged) — convergence will show more asymmetric clamping (upward bias) near that anchor than `learningIntent`'s (0.5), sitting far from either bound. Worth checking empirically once implemented; not expected to be large enough to block acceptance, but should be reported in the post-implementation research doc rather than assumed away.
