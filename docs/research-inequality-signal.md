# Research: Does Inequality Predict Collapse in This Model?

**Recorded:** 2026-09-18 | **Commit:** bdb1a5c | **Latest ARD:** 063 | **Base config:** all Variables at defaults unless noted
**Commands:** a one-off probe (reproduced below) reporting per-seed adult Gini at the population peak, its maximum while the population was still at least half its peak, and its value in the last decade anyone was alive; paired tests via `src/Helpers/Statistics.ts`
**Key context vars:** `COLLAPSE_GINI_THRESHOLD=0.60`, `STRUGGLING_GINI_THRESHOLD=0.43`, `EXTRACTION_PRODUCTIVITY_FLOOR=0.01`, `MAX_EXTRACTION_PRODUCTIVITY=10`, `NATURAL_RESOURCES_INITIAL=10000`

**Headline: a configuration where every run dies and a configuration where no run dies reach the same
peak inequality, so inequality does not separate survival from collapse here.** CLAUDE.md's opening
states the Gini coefficient of `resources` is the primary collapse signal, and that inequality matters
more than scarcity. Measured across 48 runs in three configurations, that does not hold in this model
as currently built.

The decisive pair: the default configuration (16 of 16 runs extinct) and the narrow productivity band
`[0.5, 2]` with a scaled commons (0 of 16 extinct) reach median peak adult Gini of **0.600 and 0.590**.
Paired on the same seeds, that difference is **not distinguishable from zero** (typical change −0.015,
plausible range −0.040 to +0.040, p = 0.76). Survival goes from 0% to 100% with inequality held level.

## Measure and why the obvious one is wrong

Scoring a dying run on its *final* decade measures a corpse. As a population falls to single digits,
Gini collapses toward zero because there is nothing left to be unequally distributed — four of eight
dying runs in a first pass read 0.00 to 0.10 at the end. An earlier draft of
`docs/research-productivity-band.md` drew the conclusion "these populations died equal, so inequality
is not the driver" from exactly that artefact. That reasoning was wrong and is retracted here.

The measure used instead is **the highest adult Gini reached while the population was still at least
half its peak** — inequality at full strength, before the crash compresses it. If inequality drives
collapse, this is where it should show.

## Results

Three configurations, 16 seeds each, 3000 ticks, 300 founders. Paired by seed, so seed *N* is the same
starting population and random stream in every arm.

| Configuration | Extinct | Median peak-health Gini | Median Gini at the population peak | Median Gini, last living decade |
|---|---|---|---|---|
| default band, default pool | **16/16** | 0.600 | 0.29 | 0.16 |
| wide band `[0.1, 10]`, scaled pool | 10/16 | 0.645 | 0.25 | 0.17 |
| narrow band `[0.5, 2]`, scaled pool | **0/16** | 0.590 | 0.26 | 0.33 |

**Default versus narrow — the one that settles it.** 100% lethal against 0% lethal, peak inequality
0.600 against 0.590, p = 0.76, plausible range straddling zero. Two configurations at opposite
extremes of survival are indistinguishable on the project's primary collapse signal.

**Wide versus narrow — a real difference that does not rescue the claim.** 0.645 against 0.590 is real
(typical change −0.050, plausible range −0.070 to −0.030, p = 0.021). But a wider productivity band
mechanically widens the spread of what people extract, so higher Gini is downstream of the band, not
an independent cause. The default-versus-narrow pair is the control that shows this: hold inequality
level and survival still swings from none to all.

**Inequality is also not what gates the survivors.** Of eight surviving `[0.5, 2]` seeds classified by
`classifyOutcome`, one is held at STRUGGLING by Gini; the rest are gated by happiness below 3.0 or by
the commons being emptied. The runs labelled CYCLICAL sit at Gini 0.32–0.40, comfortably under the
0.43 threshold.

## What this does not claim

**Not that inequality is irrelevant to the model.** These 48 runs test whether peak inequality
discriminates *these* configurations. A mechanism that drives inequality independently of extraction
variance — the elite-extraction differential in `docs/future-ideas.md` is the obvious candidate — has
never been built, and HANDY's central result is precisely that elite consumption collapses a society
at a healthy resource level. The honest statement is that the model has no such mechanism, so
inequality here is a *consequence* of the resource economy rather than a driver of it, and the primary
signal is measuring an output.

**Not a verdict on the real world.** It is a verdict on the instrument.

**16 seeds per arm, one measure, one horizon.** The p = 0.76 null is a null with real power behind it
(the plausible range is ±0.04 Gini, narrower than the 0.17 gap between the STRUGGLING and COLLAPSE
thresholds), but the peak-health window is one defensible choice among several, and a different
window could give a different answer.

## Consequence for the project

CLAUDE.md's framing sentence should be revisited. Either the model needs a mechanism that makes
inequality causal — which is an ARD-level decision and the reason the elite-extraction entry exists —
or the project's primary collapse signal should be one that actually separates the configurations it
is used to judge. Trough depth is the current candidate: `docs/research-productivity-band.md` found
the lowest population a run reaches tracks extinction across every band step tested, including one
where extinction counts themselves could not be resolved.

No ARD is proposed here. This is a measurement about an existing claim, not a design change.

## Re-running this

The probe is small enough to re-create: for each seed, run 3000 ticks at 300 founders, then from
`sim.decadeHistory` take `avgResourceGini` at the decade whose `endPopulation` is the run's maximum,
the maximum `avgResourceGini` over decades with `endPopulation >= 0.5 × peak`, and the value at the
last decade with `endPopulation > 0`. Feed the paired arrays to `pairedPermutationTest` and
`bootstrapPairedDifference` in `src/Helpers/Statistics.ts`. Roughly 20 minutes for 48 runs
single-threaded.
