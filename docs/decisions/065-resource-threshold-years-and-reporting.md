# ARD 065: Resource Thresholds Documented as Years of Consumption, With a Mandatory Cross-Config Reporting Convention

**Status:** Proposed
**Date:** 2026-09-19

## Context

Six constants in `Variables.ts` assert a quantity of personal `resources` in bare numeric units, each independently chosen, against `CONSUMPTION_BASE = 1.0` (one adult-year of living cost — `AgeEvent` does `age++` per tick, so one tick is one year):

| Constant | Value | Implied years of adult consumption |
|---|---|---|
| `HAPPINESS_RESOURCE_CRITICAL_THRESHOLD` | 10 | 10 |
| `WELFARE_THRESHOLD` | 20 | 20 |
| `CHILDBIRTH_RESOURCE_MIN` | 10 | 10 |
| `CHILDBIRTH_RESOURCE_SCALE` | 30 | 30 |
| `HAPPINESS_RESOURCE_LOW_THRESHOLD` | 30 | 30 |
| `SEED_ADULT_RESOURCES_MEAN` | 50 | 50 |
| `HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD` | 70 | 70 |
| `HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD_ELDERLY` | 100 | ~67 (÷ `CONSUMPTION_ELDER_MULTIPLIER` = 1.5) |
| `CHILDBIRTH_BIRTH_COST` | 12 | 12 |

Nothing in the code ties these to `CONSUMPTION_BASE`; the "years" reading above is a coincidence of `CONSUMPTION_BASE` currently equaling 1.0, recovered by hand. `distributeWelfare` (`Simulation.ts:595`) tops every eligible person up toward `WELFARE_THRESHOLD`, which measurably pins median personal holdings near 20 for most of a run regardless of the surrounding economy (`scripts/flow-probe.ts`, cited in the handoff audit this ARD responds to).

Equilibrium personal wealth, by contrast, is not consumption-denominated at all — at steady state, tax paid equals net income: `resources ≈ (extraction − consumption) / TAX_RATE`. The default economy settles near 144; the cut-extraction config studied in `docs/research-extraction-need-ratio.md` settles near 27, wedged between `WELFARE_THRESHOLD` (20) and `HAPPINESS_RESOURCE_LOW_THRESHOLD` (30). That collision was read as evidence the cut-extraction arm was more stressed, when a large part of what moved was arithmetic: extraction fell, nothing tied to consumption moved, so a fixed threshold ladder now sits somewhere different relative to typical wealth than it did in the default arm.

## Decision

**This ARD does not adopt the handoff task's literal proposal** — expressing each threshold as `X_YEARS * CONSUMPTION_BASE`, computed at use — **because it would not fix the problem that motivated it.** `CONSUMPTION_BASE` did not change between the two studied configs; extraction did. A consumption-relative formula leaves every one of the nine values above numerically unchanged in that comparison, since `CONSUMPTION_BASE` stays 1.0 in both arms. The actual mismatch is between a **cost-side** quantity (thresholds, denominated in consumption) and an **income-side** quantity (equilibrium wealth, denominated in extraction minus consumption, divided by the tax rate) — two different economic quantities that the task's framing treated as one. No static formula in `Variables.ts` can track equilibrium wealth, because extraction is dynamic within a run (`InventionEvent`, ARD 047) and is exactly the variable that sweeps and comparisons change on purpose.

What this ARD does instead, in two parts:

**1. Make the "years of consumption" reading explicit and checked, without auto-deriving.** Each of the nine constants above gets a comment stating its implied years (`value / CONSUMPTION_BASE`, or `/ (CONSUMPTION_BASE * CONSUMPTION_ELDER_MULTIPLIER)` for the elderly threshold) and `Variables.validate()` gains an ordering check: `HAPPINESS_RESOURCE_CRITICAL_THRESHOLD < WELFARE_THRESHOLD ≤ HAPPINESS_RESOURCE_LOW_THRESHOLD ≤ CHILDBIRTH_RESOURCE_SCALE < HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD`, and the equivalent for the elderly triple scaled by `CONSUMPTION_ELDER_MULTIPLIER`. The nine values are **not changed** — this preserves every existing calibration bitwise (verifiable with `scripts/parity-check.ts`) and only makes an already-true relationship explicit and future-proofed against a change that breaks it silently.

**2. Require a wealth-normalized companion metric whenever a `docs/research-*.md` compares configs with different extraction, gather, or productivity settings.** Any such study must report each arm's steady-state (or measured median) personal `resources`, expressed in the same "years of consumption" unit as the thresholds (`medianResources / CONSUMPTION_BASE`), alongside the raw happiness/welfare/Gini numbers. This turns "arm B's happiness cratered" into a legible comparison — "arm B's typical holdings sit at 27 years, below the 30-year `LOW` band, versus arm A's 144, comfortably clear of every band" — so a reader can see how much of an observed stress signal is the fixed threshold ladder registering a poorer equilibrium versus a genuinely different dynamic. No new `Variables` constant; this is a documentation and calibration-guide requirement, enforced by review, the same way the sweep-results skill already gates other conclusions.

**Out of scope, flagged for `docs/future-ideas.md`:** the fertility brake (`CHILDBIRTH_RESOURCE_MIN`/`CHILDBIRTH_RESOURCE_SCALE`) reads personal resources, which welfare actively holds near a near-constant value (~20) for most of a run — so the brake is structurally close to reading a constant, not a scarcity signal, independent of this ARD's fix. Resolving that needs the brake to key on something welfare does not set (commons fill, local density) or the two constants to be calibrated as a deliberately interacting pair. That is a mechanism change, not a units change, and belongs in its own ARD.

## Reasoning

**Why not a getter or computed field.** `HarnessOverrides.applyOverrides` (relied on by every sweep, `compare.ts` run, and calibration claim in this project) reads `typeof Variables[key] === 'number'` and assigns `Variables[key] = value` directly; a getter-only computed property cannot be assigned this way, and turning these nine fields into getters would silently break every existing `--set WELFARE_THRESHOLD=X` invocation across scripts and past research docs. Preserving direct overridability of each threshold matters more than automatic derivation.

**Why not have `validate()` recompute a threshold from a `*_YEARS` sibling constant.** Considered, and rejected on the codebase's own precedent: the existing estate-share comment in `Variables.ts` explicitly rejects this pattern — "normalising would silently rescale a share the operator set deliberately... worth a hard failure" — for exactly this kind of cross-constant relationship. An ordering check that throws is consistent with that precedent; a recompute-on-validate step that can silently overwrite a deliberate direct override is not.

**Why not actually change the nine values to a new set of multiples.** Considered. The handoff task's framing implied recalibrating them. Rejected for this ARD: with no evidence pointing at which multiples are wrong (only that they're asserted, and that they collided with one specific arm's equilibrium), changing nine interacting values at once would recalibrate collapse dynamics across every existing study without a stated hypothesis for what the new values should be, which is a bigger and less falsifiable move than fixing the actual comparability gap. If a future study finds a specific threshold miscalibrated on its own terms (not just "collided with one config"), that is a narrower, separately justified change.

**Why a reporting convention instead of redefining "comfortable"/"struggling" relative to each run's own equilibrium.** A self-normalizing band (e.g., "comfortable = 1.4× this run's median") would remove the fixed backdrop that makes the *absolute* wealth level a legible signal at all — a population that is uniformly poor in real terms should register as stressed, not read as "normal for itself." The reporting fix preserves that signal while giving a reader the context to separate "this arm is poorer" from "this arm's people behave differently at a given wealth level."

## Consequences

- `Variables.ts`: nine comments updated to state implied years; `validate()` gains the two ordering checks (adult triple with welfare/childbirth-scale interleaved, elderly triple). No constant values change.
- `docs/calibration-guide.md`: gains the reporting requirement — any config comparison varying extraction/gather/productivity must include each arm's median personal resources in years-of-consumption terms.
- Tests: `Variables.test.ts` (or wherever `validate()` is tested) gains cases for the new ordering invariant — passes at current defaults, throws when a threshold is set out of order via `applyOverrides`.
- `docs/research-extraction-need-ratio.md`: the existing dated caveat about incomparable welfare/happiness numbers across arms should get a follow-up note once this lands, adding the years-of-consumption figures for both arms (144 and 27) so the comparison in that doc becomes self-documenting rather than requiring the reader to redo the arithmetic.
- `docs/future-ideas.md`: gains an entry for the fertility-brake/welfare-interaction problem described above, pointing back to this ARD's Context for the numbers.
- Known limitation: the ordering check only catches inversions between the nine thresholds, not a threshold that is internally coherent but poorly calibrated against a specific study's economy — that failure mode (this ARD's whole motivating example) is caught by the reporting convention, not by code, and depends on researchers actually including the required column.
