# Research: Emergent Patterns to Classify

A catalog of emergent patterns this simulation can produce that the current tooling does **not**
capture, with the literature grounding, the metric that would measure each, and whether the data
already exists. Nothing here is built — it is a menu for future work. Companion to
`docs/research-collapse-classification.md` (which grounded the four-dimensional outcome verdict).

What we already have, for contrast:
- `classifyOutcome` (ARD 051) — a *verdict* on four dimensions (population decline from peak,
  inequality, wellbeing, ecological strain).
- `CycleDetector` (`detectCycles`) — measures *oscillation* (stable cycle vs single boom-bust vs
  ratchet to extinction).

Both read the *end state* or the *whole series* but say nothing about the patterns below.

## Two kinds of pattern (this determines where each lives)

- **Verdict labels** — change the outcome taxonomy itself (a new `classifyOutcome` return value).
  These need an ARD because they redefine what the model reports as the answer. Candidates:
  `OSCILLATING` (already noted in future-ideas), a polarization/social-breakdown variant.
- **Leading indicators / descriptors** — annotate a run without changing the verdict. Lower-stakes,
  like the cycle detector: pure measurement functions that can go straight into the sweep harness.
  Candidates: critical slowing down, overshoot ratio, inequality trajectory, demographic shape.

## Temporal / dynamical (how the run moves, not where it ends)

- **★ Critical slowing down (early-warning signals).** Rising lag-1 autocorrelation and variance in
  the population (or Gini) series *before* a crash — the gold-standard, empirically validated leading
  indicator of regime shifts in ecological and social systems (Scheffer et al., *Nature* 2009;
  Dakos et al.). Categorically different from everything we have: it is *predictive*, flagging an
  approaching tipping point while the population still looks healthy — including runs that read
  STABLE at tick 100 but are doomed by tick 300. Computed from `history`, no model change. A
  rolling-window autocorrelation/variance trend is the metric. **Top pick.**
- **Overshoot vs soft landing.** Did the population approach carrying capacity smoothly or overshoot
  and crash? HANDY's central taxonomy distinction. Metric: overshoot ratio = `peakPop ÷ sustainable
  level` (the latter approximated from the ceiling and regen). The cycle detector sees oscillation
  but not overshoot *magnitude*. Data exists (`peakPop`, `naturalResourceCeiling`).
- **Collapse speed.** Fast vs gradual decline — Tainter contrasts rapid collapse with slow erosion.
  We log `extinctTick` but not the slope of the crash. Metric: max sustained negative population
  slope, or ticks from peak to a fraction of peak.

## Distributional (on the project's central thesis — inequality is the primary signal)

- **★ Two-class polarization / bimodality.** A sharp elite/commoner split vs a smooth gradient *at
  the same Gini*. Gini is a scalar and cannot distinguish these, yet they are very different
  societies — Turchin's elite–commoner division, HANDY's Type-L (inequality-driven) collapse. Metric:
  a bimodality coefficient or Hartigan dip test on the resource distribution per tick. Cheap,
  dead-on the thesis, and a real blind spot. **Strong pick.**
- **Inequality trajectory.** Gini climbing monotonically (runaway wealth concentration) vs
  stable-high vs falling. The final-decade snapshot hides direction; a slope over the run separates
  a society sliding into oligarchy from one in a steady (if unequal) state.

## Social / structural

- **Violence cascade / social breakdown.** The emboldening mechanic (ARD 036) lets theft and killing
  escalate population-wide; a runaway is Turchin's disintegrative-phase political violence. Metric:
  murder share of deaths together with aggregate antisocial intent, both trending up. This is exactly
  the violence signal **deferred** from the classifier in ARD 051 — its natural home is here, as a
  standalone pattern rather than a verdict dimension. Data exists (`deathsByMurder`,
  `aggregateKillingIntent`, `aggregateStealingIntent`).
- **Demographic structure (youth bulge vs aging).** A youth bulge is linked to instability and
  violence (Turchin); an aging, top-heavy pyramid with few births is a demographic-winter signature.
  Same population size, very different character. Metric: age-pyramid shape / dependency ratio
  (non-working ÷ working-age). Every age is available.
- **Cohort / trait drift.** Heritability (ARD 037) sorts traits across generations, so a population
  can drift toward predatory, cooperative, or high-intelligence composition. The `COHORT SURVIVAL`
  report *shows* the composition but nobody classifies the *drift direction* — did raiders or
  engineers win the run? Metric: trend in per-type share, or in population-mean intents/stats.

## Recommended first three

1. **Critical slowing down** — predictive, methodologically rigorous, genuinely novel, and free of
   model changes.
2. **Two-class polarization** — cheap and directly on the inequality thesis.
3. **Violence cascade** — gives the ARD-051-deferred violence signal a proper home.
