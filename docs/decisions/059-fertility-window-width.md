# ARD 059: Fertility Window Width

**Status:** Accepted
**Date:** 2026-09-13

## Context

`ChildbirthEvent` gates birth probability on `ageModifier(coupleAge, CHILDBIRTH_PEAK_AGE, CHILDBIRTH_AGE_SCALE, CHILDBIRTH_AGE_FLOOR)` (ARD 029). `ageModifier` (ARD 008) is a parabola that reaches its floor at `peak ± scale`. With the peak at 26 and the scale currently in `Variables.ts`, the modifier bottoms out at age 38 — every couple whose older partner has reached 38 is pinned to the floor, 2% of peak fertility, permanently.

That encodes a false claim about human biology. Female fertility declines steeply through the thirties but does not effectively end until the mid-forties; the model ends it at 38.

The defect surfaced while verifying `research-crash-diagnosis.md` against current code. That study found collapse is demographic rather than resource-driven: births fall as the founding cohort ages past peak fertility while the commons is still recovering, and crash survivors in their forties cannot rebuild. The age-38 cliff is the mechanism behind that finding, set several years earlier than biology warrants.

## Decision

Widen the childbirth age window so the modifier reaches its floor near the empirical end of human fertility (mid-forties) rather than at 38. This recalibrates the existing `CHILDBIRTH_AGE_SCALE`; `CHILDBIRTH_PEAK_AGE` and `CHILDBIRTH_AGE_FLOOR` are unchanged. The value lives in `Variables.ts`.

The justification is the biological anchor, not the simulation outcome. The sweep evidence (`docs/research-fertility-window.md`) is a secondary check that the correction does not destabilise the model. It is deliberately not the argument, because it is statistically weak and would not survive recalibration of neighbouring constants.

## Reasoning

**Rejected: raise `CHILDBIRTH_AGE_FLOOR` instead.** It performs identically on the sweep — both changes reach 3/32 sustained cycles and 29/32 extinction at 800 ticks — so outcome data cannot separate them. It loses on meaning. The floor is the residual fertility of a couple arbitrarily far outside the window; raising it makes a couple in their seventies several times more fertile, which is worse biology rather than better. The scale change puts the correction where the biology actually is, and leaves the "negligible but non-zero far from peak" role of the floor intact.

**Rejected: do both.** A 32-seed 2×2 factorial showed the combination worse than either change alone (31/32 extinct and 1/32 sustained cycles, against 29/32 and 3/32 for each single change). Both levers widen the same window, so applying both overshoots it, producing a larger boom and a deeper crash — the "bigger inputs buy a bigger boom, not stability" signature documented in `research-tuning-defaults.md`.

**Rejected: widen much further,** pushing the cliff past 50. Worse than the status quo at 300 ticks (12/16 extinct against 9/16) and no better at 800. Past the biological range the change stops correcting an error and starts inflating the overshoot.

**Rejected: lower the founding age structure instead.** Tested across several taper exponents plus a young-adult-heavy variant placing 55% of the seed population in the 18–35 band. It produced the best 300-tick result in the study (6/16 extinct, median end population 137) and decayed to 15/16 extinct by 800 ticks. Initial age structure is spent once and the endogenous dynamics regenerate the synchronised cohort, reproducing the pyramid-seeding probe's negative result in `research-tuning-defaults.md`. This is the core reason the fix belongs in the fertility rule, which applies to every cohort including post-crash survivors, rather than in the seed.

**Rejected: raise `BASE_CHILDBIRTH_RATE`.** Already settled by `research-fertility.md` and `research-tuning-defaults.md`: sweeping it across a 3× range never moves `stable` off zero. It scales fertility uniformly, enlarging the boom without extending the window that post-crash survivors fall outside of.

## Consequences

**Files.** `src/Helpers/Variables.ts` only. `ChildbirthEvent` and `Simulation.snapshot` read the constant and need no change. The Childbirth row of the age-profile table in `CLAUDE.md` needs the new scale. ARD 008 is not superseded — it established the helper and an initial profile table, and per `docs/decisions/README.md` those values are calibration placeholders owned by `Variables.ts`.

**Reporting side effect.** `Simulation.snapshot` derives `fertileCoupleCount` from the same modifier with a `>= 0.5` threshold, so this silently redefines that metric. The count rises for reasons unrelated to population change, and `fertileCoupleCount` series from runs before and after are not comparable. Anyone reading historical HTML reports against new ones needs to know the definition moved.

**Tests.** No test references the constant, and every `ChildbirthEvent` test fixes both partners at age 26 where the modifier is 1.0 regardless of scale — so the suite passes unchanged, and does not currently pin the window's edges at all. Add tests asserting that a couple just inside the new window is fertile above the floor and a couple past it sits at the floor. Without them the next change to this constant is unobservable.

**Known weakness.** The supporting evidence is not statistically significant. At 32 seeds and 800 ticks the change moves sustained cycles from 0/32 to 3/32 and extinction from 32/32 to 29/32 — Fisher p ≈ 0.24 either way. The direction replicated at two seed counts and through two independent parameters, but the effect is small and roughly 90% of worlds still go extinct. This is not a fix for the terminal overshoot.

**Does not subsume** the crash-recovery item in `docs/future-ideas.md`, which remains the top structural priority. The measured benefit here is the same order as the partial mitigators already catalogued there (high invention rate, the anti-Allee probe), all of which `research-tuning-defaults.md` concluded are insufficient alone.
