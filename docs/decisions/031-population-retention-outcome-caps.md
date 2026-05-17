# ARD 031: Population Retention Caps on Outcome Classification

**Status:** Accepted
**Date:** 2026-05-17

## Context

`classifyOutcome` in `src/Helpers/Reporters.ts` currently uses two signals: final-decade Gini and final-decade average happiness. Population appears in only one place — a floor below which the outcome is immediately COLLAPSE (ARD 016). Between that floor and 100% retention, population loss has no effect on the verdict.

This produces outcomes like a run where the population falls to 61% of start — through suicide, illness, and killing concentrated in high-inequality early decades — being classified THRIVING because per-survivor Gini and happiness recovered. The per-survivor welfare metrics are correct, but they measure a different thing than civilizational thriving. A civilization that shed 39% of its people, even if the survivors are comfortable, has not thrived.

## Decision

Population retention (end population / start population) acts as a ceiling on the possible outcome tier, in addition to the existing COLLAPSE floor. The ceiling degrades in two steps:

- Retention below `THRIVING_MIN_POPULATION_FRACTION` — cannot be THRIVING; capped at STABLE
- Retention below `STRUGGLING_MAX_POPULATION_FRACTION` — cannot be STABLE or THRIVING; forced to at least STRUGGLING

The existing `COLLAPSE_POPULATION_FRACTION` floor (ARD 016) is unchanged.

`classifyOutcome` evaluation order becomes:
1. COLLAPSE: Gini ≥ threshold, or retention < `COLLAPSE_POPULATION_FRACTION`
2. Apply population caps before evaluating upper tiers
3. THRIVING: Gini < threshold, happiness ≥ threshold, and retention ≥ `THRIVING_MIN_POPULATION_FRACTION`
4. STRUGGLING: Gini ≥ threshold, happiness < threshold, or retention < `STRUGGLING_MAX_POPULATION_FRACTION`
5. STABLE: otherwise

New constants in `Variables.ts`:

- `THRIVING_MIN_POPULATION_FRACTION` — minimum retention required to qualify for THRIVING. Calibration intent: a civilization that lost a meaningful fraction of its people should not be called thriving regardless of per-survivor metrics; set this to where loss starts to feel like demographic failure rather than natural churn.
- `STRUGGLING_MAX_POPULATION_FRACTION` — retention below this forces at least STRUGGLING. Calibration intent: severe population decline is itself evidence of structural failure even if the surviving population looks adequate on Gini/happiness alone; set this between the THRIVING floor and the COLLAPSE floor.

## Reasoning

**Rejected: flat THRIVING floor only.** Adding a single population requirement to THRIVING (no cap on STABLE) leaves STABLE as a valid outcome for heavy population loss. A run that loses half its population should not be STABLE; there should be a gradient that downgrades it toward STRUGGLING. The two-threshold design produces that gradient without complicating COLLAPSE.

**Rejected: separate demographic verdict.** Surfacing a second label ("THRIVING / DECLINING") avoids conflating two signals, but contradictory compound labels would confuse the collapse/thrive framing the project is built around. The outcome label is the primary summary artifact; it should integrate all signals into one verdict. Researchers who want the raw population trend already have the decade summary table and the population chart.

**Rejected: use final-decade population trend instead of retention over the full run.** A trend-based signal (is population growing or shrinking in the last decade?) would reward late-run stabilization even after catastrophic early loss. Full-run retention reflects the total civilizational cost of that loss and is consistent with how Gini is evaluated — as a final-state signal, not a trend.

**Relationship to existing COLLAPSE floor.** The existing `COLLAPSE_POPULATION_FRACTION` is a hard floor: lose enough people and you collapse regardless of welfare metrics. The new caps extend that logic upward — retention is now a continuous constraint on the verdict, not a single trip-wire. The existing constant is not changed.

## Consequences

- `src/Helpers/Reporters.ts`: `classifyOutcome` gains two additional `popFraction` comparisons and the two new constants
- `src/Helpers/Variables.ts`: two new named constants added with calibration comments
- `src/tests/Helpers/Reporters.test.ts`: tests must cover (a) run with good Gini/happiness but retention below `THRIVING_MIN_POPULATION_FRACTION` → STABLE, (b) retention below `STRUGGLING_MAX_POPULATION_FRACTION` → STRUGGLING regardless of Gini/happiness, (c) the existing COLLAPSE population test is unchanged, (d) a full-retention run that would have been THRIVING still is
- ARD 016's outcome classification table in its Decision section is superseded by this ARD for the population dimension only; Gini and happiness conditions are unchanged
