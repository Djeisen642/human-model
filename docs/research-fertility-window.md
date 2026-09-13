# Research: Fertility Window Width and the Age-38 Cliff

**Recorded:** 2026-09-13 | **Commit:** 6dc793a | **Base config:** all Variables at defaults unless noted
**Commands:** `npm run sweep -- --seeds {16,32} --ticks {300,800} [--sweep KEY=v1,v2,… | --set KEY=VAL]`
**Key context vars:** `CHILDBIRTH_PEAK_AGE=26`, `CHILDBIRTH_AGE_SCALE=12`, `CHILDBIRTH_AGE_FLOOR=0.02`, `BASE_CHILDBIRTH_RATE=0.6`, `SEED_AGE_DISTRIBUTION_EXPONENT=1.8`, `SEED_AGE_MAX=80`

---

## Question

`research-crash-diagnosis.md` concluded the collapse is demographic: crash survivors are too old to rebuild. Is the fertility age curve itself the bottleneck, and can widening it produce sustained cycles where every other single-lever sweep has failed?

## The cliff

`ageModifier` is `max(floor, 1 − ((age − peak)/scale)²)`, so it reaches its floor at `peak ± scale`. At peak 26 and scale 12 that is **age 38**: every couple whose older partner is 38+ is pinned at 2% of peak fertility for life. Real female fertility declines steeply through the thirties but runs to roughly 45–50, so the model ends fertility about eight years early.

## Widening the window (16 seeds)

| `CHILDBIRTH_AGE_SCALE` | cliff age | 300t extinct | 800t extinct | 800t `stable` |
|---|---|---|---|---|
| 12 (current) | 38 | 9/16 | 16/16 | 0/16 |
| 18 | 46 | 6/16 | 14/16 | **2/16** |
| 25 | 56 | 12/16 | 16/16 | 0/16 |
| 35 | 71 | 12/16 | 14/16 | 2/16 |

| `CHILDBIRTH_AGE_FLOOR` | 300t extinct | 800t extinct | 800t `stable` |
|---|---|---|---|
| 0.02 (current) | 9/16 | 16/16 | 0/16 |
| 0.05 | 6/16 | 13/16 | **3/16** |
| 0.1 | 10/16 | 15/16 | 1/16 |
| 0.2 | 11/16 | 16/16 | 0/16 |

Both levers are non-monotonic: a moderate widening helps, a large one is no better than doing nothing and is worse at 300 ticks. Every large value raises peak population (608–650 against baseline 564) — bigger boom, deeper crash, the signature `research-tuning-defaults.md` identified.

## 2×2 factorial (32 seeds, 800 ticks)

| scale | floor | extinct | `stable` |
|---|---|---|---|
| 12 | 0.02 | 32/32 | 0/32 |
| 18 | 0.02 | 29/32 | 3/32 |
| 12 | 0.05 | 29/32 | 3/32 |
| 18 | 0.05 | 31/32 | 1/32 |

**The levers do not stack — they cancel.** Both widen the same window, so applying both overshoots the optimum. Each alone reaches 3/32 sustained cycles by a different route, which is the main reason to believe the direction.

**The effect is not statistically significant.** 3/32 against 0/32 is Fisher p ≈ 0.24; so is 29/32 against 32/32. The direction replicated at 16 and 32 seeds and through two independent parameters, but ~90% of worlds still go extinct. Effect size is the same order as the partial mitigators in `research-tuning-defaults.md` (high invention 4–6/16, anti-Allee probe 3/16), which that study judged insufficient alone. Confirming this properly needs 100+ seeds.

## Negative result: lowering the founding age

Tested because the crash-diagnosis story implies a younger start should buy more fertile years.

| seed config | mean start age | 18–35 share | 300t extinct | 300t end pop | 800t extinct |
|---|---|---|---|---|---|
| default (exp 1.8) | 28.0 | 20% | 9/16 | 0 | 16/16 |
| exp 2.5 / 3.5 / 5 | 23.1 / 18.0 / 13.4 | 18% / 14% / 12% | 10 / 11 / 9 | 0 | 15 / 16 / 16 |
| exp 0.7, `SEED_AGE_MAX=40` | 23.4 | **55%** | **6/16** | **136.5** | 15/16 |

Note the power taper concentrates mass at ages 1–3, so raising the exponent adds *infants* and shrinks the fertile-age share. The young-adult-rich variant (exponent 0.7 with the elder tail truncated) is the fair test, and it is a textbook short-horizon mirage: the best 300-tick result in the study, almost entirely gone by 800.

**Initial age structure is spent once.** The synchronised cohort regenerates endogenously, reproducing the pyramid-seeding probe's negative result in `research-tuning-defaults.md`. This is why the fertility *rule* is the right intervention point: it applies to every cohort, including post-crash survivors, rather than giving the founding cohort a one-time head start.

## Conclusion

The age-38 cliff is real, is biologically wrong, and is the mechanism behind `research-crash-diagnosis.md`'s finding. Correcting it to a realistic mid-forties cliff is worth doing on realism grounds (ARD 059) and moves `stable` off zero, but the improvement is small and statistically unproven. It is a correction, not the structural crash-recovery fix that `docs/future-ideas.md` still lists as the top priority.

Method note: the 300-tick column inverted relative to 800 ticks in three separate places here (scale 18, floor 0.05, young-adult seeding). Two intermediate conclusions in this study were drawn from 8-seed runs and dissolved under 16 and 32 seeds. Both hazards are exactly what `research-tuning-defaults.md` warns about; this study is an independent confirmation that its horizon rule and its `stable`-over-outcome-tally rule are load-bearing.
