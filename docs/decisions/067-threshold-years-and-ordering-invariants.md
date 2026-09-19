# ARD 067: Stock Thresholds Documented in Years of Consumption; `validate()` Guards Only the Orderings That Can Fail Silently

**Status:** Proposed
**Date:** 2026-09-19

## Context

**Supersedes ARD 065**, which bundled two decisions: this units-and-invariants one, and a convention requiring any cross-config study to report typical wealth in years of consumption. `decisions/README.md`'s scope rule calls for splitting those, since revising either would force restating the other. The split is clean rather than partial: everything ARD 065 decided is either re-decided here or explicitly declined here. The reporting convention is declined because its premise did not survive measurement — see the last entry in the Reasoning — and is logged in `docs/future-ideas.md` as a question needing a properly powered study before any convention is written.

Eleven constants in `Variables.ts` assert a quantity of personal `resources` as a bare number. `AgeEvent` does `age++` per tick, so one tick is one year, and `CONSUMPTION_BASE` is one adult-year of living cost. Each of the eleven therefore asserts a span of years, and each was chosen independently:

| Constant | Implied years |
|---|---|
| `HAPPINESS_RESOURCE_CRITICAL_THRESHOLD` | 10 |
| `HAPPINESS_RESOURCE_LOW_THRESHOLD` | 30 |
| `HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD` | 70 |
| `HAPPINESS_RESOURCE_CRITICAL_THRESHOLD_ELDERLY` | 13.3 (÷ `CONSUMPTION_ELDER_MULTIPLIER`) |
| `HAPPINESS_RESOURCE_LOW_THRESHOLD_ELDERLY` | 33.3 (÷ `CONSUMPTION_ELDER_MULTIPLIER`) |
| `HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD_ELDERLY` | 66.7 (÷ `CONSUMPTION_ELDER_MULTIPLIER`) |
| `WELFARE_THRESHOLD` | 20 |
| `CHILDBIRTH_RESOURCE_MIN` | 10 |
| `CHILDBIRTH_RESOURCE_SCALE` | 30 |
| `CHILDBIRTH_BIRTH_COST` | 12 per parent |
| `SEED_ADULT_RESOURCES_MEAN` | 50 |

Nothing in the code ties any of them to `CONSUMPTION_BASE`; the years column is recovered by hand and holds only while `CONSUMPTION_BASE` is 1.0. The reading has one real exception: a child with a living parent pays `resources × CONSUMPTION_CHILD_RESOURCE_RATE` rather than a flat cost (ARD 024), so "years" is undefined for a subsidised child, and `Person.ts` correspondingly scores such a child's happiness against the parental mean rather than their own balance.

Two of the orderings among these constants are load-bearing, and both fail silently today when a sweep sets them through `--set`:

**The happiness ladders.** `Person.ts` evaluates critical / low / comfortable as a single `if / else if / else if` chain. Inverting `low` below `critical` makes the low band unreachable; putting `comfortable` below `low` makes a person who should earn the comfort bonus take the low penalty instead. No error either way, and every run afterwards is quietly scored on a ladder with a missing rung.

**The fertility ramp.** `ChildbirthEvent` computes `resourceRange = CHILDBIRTH_RESOURCE_SCALE − CHILDBIRTH_RESOURCE_MIN` and divides by it. Inverted (`MIN` above `SCALE`), the ramp changes sign: measured directly, `MIN=30, SCALE=20` makes a couple holding 15 fully fertile and a couple holding 35 sterile, turning the famine brake into a famine accelerator. Equal (`MIN === SCALE`), a couple holding exactly that value divides `0/0`, so the birth probability is `NaN`, `rng() >= NaN` is false, and the event never takes its early return: birth becomes certain. That case is reachable rather than theoretical, because `distributeWelfare` tops short persons up to exactly `WELFARE_THRESHOLD`, so a sweep setting both childbirth constants to the welfare line lands a whole cohort on it.

Neither failure is caught by anything. `Variables.validate()` currently checks only the ARD 042 estate shares.

## Decision

Two changes, no constant values altered.

**Document the years.** Each of the eleven constants gets a comment stating the span of adult-years it asserts, and how that figure is derived (divided by `CONSUMPTION_BASE`, and additionally by `CONSUMPTION_ELDER_MULTIPLIER` for the elderly triple). This is a comment, not a computed value: the number stays directly settable, and the comment tells the next reader what they are setting.

**Guard the two orderings above, and nothing else.** `validate()` gains a strict-ordering check on the adult happiness triple, the same check on the elderly happiness triple, and a strict `CHILDBIRTH_RESOURCE_MIN < CHILDBIRTH_RESOURCE_SCALE`. The two happiness ladders are checked independently of each other, with no cross-ladder relation: they are not multiples of one another and were never intended to be. In years, the elderly ladder is in fact non-monotonic against the adult one, sitting higher at critical and low (13.3 against 10, 33.3 against 30) but *lower* at comfortable (66.7 against 70), which contradicts the elderly critical threshold's own code comment ("higher because fixed costs rise"). This ARD documents that and changes nothing; whether the elderly ladder should be a consistent multiple is a calibration question for `docs/future-ideas.md`.

**`WELFARE_THRESHOLD` is deliberately left unconstrained**, against every other threshold. So are `CHILDBIRTH_BIRTH_COST` and `SEED_ADULT_RESOURCES_MEAN`. They are commented and not checked.

## Reasoning

**Rejected: an interleaved ladder spanning welfare, happiness and fertility.** The obvious generalisation is to order all the thresholds together, on the reasoning that the check is free because it passes at current defaults. It is not free. `HarnessOverrides.applyOverrides` calls `Variables.validate()`, so any such invariant is enforced on every `--set`, and an ordering that pins `WELFARE_THRESHOLD` between the critical and low happiness thresholds rejects four configurations already published in this repo: `WELFARE_THRESHOLD=1e9`, the universal-dividend arm `research-thriving-reachability.md` calls load-bearing in the only configuration that ever sustained THRIVING; `WELFARE_THRESHOLD=60` in `research-gini-metric.md`'s comparison table; `WELFARE_THRESHOLD=60` again in the "welfare concentrates when few qualify" finding; and `WELFARE_THRESHOLD=0`, the no-welfare control in `research-zero-variability-followup.md`. All four stop running. The general lesson is the rule this ARD follows: an invariant earns a hard failure by naming the silent breakage it prevents, not by observing that the constants currently happen to be in order. Welfare generosity relative to a happiness band is a policy setting this project sweeps on purpose; a ladder inversion is a bug with no error message. Only the second deserves a throw.

Worth recording because it is easy to repeat: `scripts/parity-check.ts` cannot detect this class of mistake. It runs the default configuration, which passes any such check by construction, so a change that breaks every non-default sweep verifies clean.

**Rejected: deriving each threshold at use as `X_YEARS * CONSUMPTION_BASE`.** This was the original framing in `docs/future-ideas.md`, and it does not fix what motivated it. The comparison that exposed the problem varied extraction, not `CONSUMPTION_BASE`, which stayed 1.0 in both arms; a consumption-relative formula leaves all eleven values numerically identical in exactly that comparison. The framing conflated a cost-side quantity (what a person spends) with an income-side one (what a person accumulates), which is governed by extraction and the tax rate. That argument is taken from ARD 065, which this ARD supersedes, and is the reason ARD 065 was right to refuse its own brief.

**Rejected: getters or computed properties.** `applyOverrides` assigns `Variables[key] = value` directly. A getter-only property cannot be assigned, so converting these fields would break every existing `--set` against them, and with it the reproducibility of the research docs that use them.

**Rejected: having `validate()` recompute a threshold from a `*_YEARS` sibling constant.** The estate-share comment already in `Variables.ts` rejects this pattern for the same class of relationship, on the grounds that normalising silently rescales a value the operator set deliberately and is "worth a hard failure" instead. A check that throws is consistent with that precedent; a recompute that overwrites is not.

**Rejected: ARD 065's reporting convention, on measurement.** ARD 065 required every study comparing arms that differ in extraction, gather or productivity to report each arm's typical personal wealth in years of consumption, so a reader could tell how much of an observed stress signal was the fixed threshold ladder registering a poorer equilibrium. The intent is right; the statistic does not deliver it. The convention rested on equilibrium holdings of about 144 in the default economy against about 27 in the cut-extraction arm, from `(extraction − consumption) / TAX_RATE`. That is the steady state of an economy whose commons never binds. This one's does, for much of every run, and `GatherResourcesEvent` takes `min(output, naturalResources)`, so the per-person extraction figure that formula uses is a ceiling rather than a realised flow. Measured at 2000 ticks with 300 founders, typical holdings are about 20 against about 15, and the happiness bands the ladder actually reads separate the arms barely or not at all, because welfare clamps the distribution from below at `WELFARE_THRESHOLD` and the binding commons clamps it from above. A convention mandating a statistic that does not discriminate would impose a cost on every future study and answer nothing. The underlying question is real and stays open in `docs/future-ideas.md`: `welf%` does move across those arms while holdings barely do, and that wants a paired `scripts/compare.ts` study rather than the four-seed probe reported here.

**Rejected: recalibrating the eleven values.** Nothing here establishes which multiples are wrong, only that they were asserted independently. Changing eleven interacting values at once would move collapse dynamics across every existing study with no stated hypothesis about what the new values should be. A threshold shown to be miscalibrated on its own terms is a narrower, separately justified change.

## Consequences

- `Variables.ts`: eleven comments gain their implied-years figure; `validate()` gains three ordering checks (adult happiness triple, elderly happiness triple, childbirth ramp). No values change, so the default configuration is bitwise unchanged and `scripts/parity-check.ts` passes.
- Tests: `Variables.validate()` gains cases for each new invariant, passing at defaults and throwing when set out of order through `applyOverrides`. The childbirth case needs both failure modes covered separately, inverted and equal, since they fail differently (sign flip versus `NaN`).
- Every configuration in the existing `docs/research-*.md` set still runs. This is the explicit acceptance criterion, not a side effect: the four welfare configurations named in the Reasoning are the regression test for the invariant's scope.
- `docs/future-ideas.md`: gains an entry for the non-monotonic elderly ladder described in the Decision.
- Known limitation: the checks catch inversions among these constants, not a threshold that is internally consistent but poorly calibrated against a given economy. That failure mode is not addressable in `validate()`, and the measurement intended to address it did not survive contact with data — see the reporting entry in `docs/future-ideas.md`.
