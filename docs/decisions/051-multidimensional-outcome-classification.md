# ARD 051: Multi-Dimensional Outcome Classification

**Status:** Accepted
**Date:** 2026-06-05

## Context

`classifyOutcome` (ARD 016) renders the run's verdict from a single decade: it checks final-decade
average Gini and happiness, plus end population as a fraction of the *starting* population. Since
ARD 050 made the commons bind and the fertility work (research-fertility.md) confirmed the
population is an intrinsic boom-bust oscillator, that logic has two documented blind spots:

1. **Population is measured against the start, not the peak.** A run that booms from 100 to 600
   and is crashing back through 400 shows population at 4× its start — no collapse signal — while
   it is plainly disintegrating. The start is an arbitrary reference in a model that overshoots.
2. **The commons is ignored.** A population sitting at its peak with the resource pool exhausted is
   overexploiting its carrying capacity and headed for a Malthusian crash, yet with acceptable Gini
   and happiness it reads STABLE. Ecological strain — a central collapse driver (Diamond; HANDY's
   resource-exhaustion collapse) — is invisible to the verdict.

Because the sweep harness reuses `classifyOutcome`, its outcome column inherits both blind spots,
which undermines calibration-by-outcome — the next thing we want to do across the variables.

## Decision

Classify on **four dimensions** drawn from the broad collapse/thrive literature — Tainter's
loss-of-complexity and the ~75–90% population decline seen archaeologically, Turchin's
structural-demographic disintegrative phase (immiseration + inequality + instability + population
decline), Diamond's ecological strain, and standard demographic sustained-decline criteria. The
four are deliberately model-agnostic (not HANDY's Type-L/Type-N taxonomy) and each maps onto a
quantity the model already records:

- **Population trajectory, measured from the peak** (not the start). Decline from the highest
  population the run reached is the one collapse marker common to every framework.
- **Inequality** — final-decade average Gini (unchanged).
- **Wellbeing** — final-decade average happiness, Turchin's immiseration axis (unchanged).
- **Ecological strain** — the commons pool relative to its current ceiling, so an exhausted pool
  registers even while population and Gini still look acceptable.

The labels become consistent across all four: **COLLAPSE** when population has fallen severely from
its peak or inequality is extreme; **THRIVING** only when inequality is low, wellbeing high, the
population is near its peak (not in decline), *and* the commons is healthy (so an overshoot can no
longer read as thriving); **STRUGGLING** on any single stress signal — high inequality, low
wellbeing, a meaningful drop from peak, or a depleted commons; **STABLE** otherwise. **EXTINCTION**
(ARD 031) is unchanged and still checked first.

To see trajectory and peak, the classifier takes the whole **decade history** rather than only the
final decade; the starting population is included as a candidate peak so a run that only ever
declines is measured against its true high-water mark.

**New constants** (in `Variables.ts`): peak-decline fractions that trigger COLLAPSE and (a smaller
one) STRUGGLING; a maximum peak-decline still compatible with THRIVING; commons-health fractions
that THRIVING requires and below which STRUGGLING fires. The old start-relative
`COLLAPSE_POPULATION_FRACTION` is dropped, superseded by peak-relative decline. The four
Gini/happiness thresholds are retained.

## Reasoning

**Rejected: keep the start-relative population check.** In a boom-bust model the initial count is
an arbitrary baseline. A run that booms and then crashes back *through* its starting level shows
zero decline against the start at the moment of crisis, so the signal fires late or never.
Peak-relative decline is what the historical and demographic literature actually means by
population collapse, and it fires whenever the population is well below what the run demonstrably
could sustain.

**Rejected: judge from the final decade alone.** A single decade cannot tell a population sitting
at its peak from one halfway through a crash — both can show the same instantaneous Gini and
happiness. Trajectory requires history, so the classifier now reads the decade series and derives
the peak.

**Rejected: adopt HANDY's Type-L / Type-N collapse taxonomy.** It is tied to that model's
Elite/Commoner/Nature/Wealth equations, which this simulation does not represent. A four-dimensional
state read (population path, inequality, wellbeing, ecology) generalizes across Tainter, Turchin,
and Diamond and uses fields the model already produces.

**Considered, deferred: political-violence share.** Turchin treats rising political violence as a
hallmark of the disintegrative phase, and the model records killings by cause — a high murder share
of deaths is a genuine social-breakdown signal. It is left out of this first version because at
~100-person scale the share is noisy and it adds another threshold; the four core dimensions fix the
documented blind spots first. Recorded as a natural extension.

## Consequences

- `TenYearSummary` gains an average natural-resource-ceiling field, populated by
  `buildTenYearSummary` from the same snapshots it already averages, so commons health (pool ÷
  ceiling) is computable in the verdict.
- `classifyOutcome` and `explainOutcome` take the decade history; `formatEndReport`, `ReportWriter`,
  and `scripts/sweep.ts` are updated to pass it. The report's "Reason:" line names whichever
  dimension drove the label.
- `Variables.ts` adds the peak-decline and commons-health thresholds and drops
  `COLLAPSE_POPULATION_FRACTION`.
- Tests must cover, per dimension: severe peak-decline → COLLAPSE even when end ≥ start; extreme
  Gini → COLLAPSE; THRIVING requires all four (low Gini, high happiness, near-peak population,
  healthy commons) and is denied when the commons is exhausted or the population is in decline;
  each single stress signal (Gini, happiness, peak-decline, depleted commons) → STRUGGLING;
  EXTINCTION still wins at population 0; STABLE is the residual.
- Calibration is observational via the harness: the four labels must remain reachable across seeds,
  and the canonical base-0.6 overshoot run (which currently mislabels as STABLE) should resolve to
  STRUGGLING/COLLAPSE as its commons exhausts and population turns down.
- Refines [ARD 016](./016-end-of-simulation-report.md) (the classifier it defined) and builds on
  [ARD 031](./031-survivor-composition-and-extinction.md) (EXTINCTION and survivor sections
  unchanged); reads the binding commons established by [ARD 050](./050-carrying-capacity-degradation.md).
  Research basis: Tainter, Turchin (structural-demographic theory), Diamond; see
  `docs/research-collapse-classification.md`.
