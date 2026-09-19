# Research: What Sets the Size of the Crash Is How Much More People Extract Than They Need

**Recorded:** 2026-09-19 | **Commit:** ed26c8e | **Latest ARD:** 063 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/sweep.ts --seeds {8,12,16} --ticks {2000,8000} --persons 300 --workers 4 --verbose --set …`; `npx ts-node scripts/compare.ts --seeds 24 --ticks {2000,8000} --persons 300 --workers 4 --both … --b …`
**Key context vars:** `BASE_GATHER_AMOUNT=0.05`, `INTELLIGENCE_GATHER_SCALAR=0.005`, `CONSUMPTION_BASE=1.0`, `NATURAL_RESOURCE_REGEN_FRACTION=0.03`, `EXPERIENCE_CAP=50`

**Headline (read the dated note above first): cutting how much each person extracts — without touching the pool, the birth rate or
anything else — turns the model's 90-fold boom-bust into an 8-fold one, and makes the society far
healthier on every measure except the one that matters most. It does not improve survival, and may
make it slightly worse.** In the best-known regime, the commons goes from stripped 41% of ticks to
15%, inequality from 0.62 to 0.35, people below the welfare line from 49% to 33%, and the population
swings between about 2,100 and 200 instead of 3,900 and 40. Over 8,000 ticks each run completes
roughly 24 boom-bust cycles with a population trend of +0.01 per 1,000 ticks — flat. But it loses seeds the baseline
does not: **3 of 24 extinct at 8,000 ticks against 0 of 24**, on paired seeds.

So this is the healthiest configuration this project has measured and it is **not** the safest one.
That is the pattern `docs/research-escape-velocity.md` already warned about, now reproduced from the
other direction: there, the runs that looked healthiest were the ones that died; here, the
configuration that looks healthiest does not buy survival either.

## Why extraction was the thing to test

`GatherResourcesEvent` is unconditional and uncapped by need. A person extracts

```
experience × (BASE_GATHER_AMOUNT + intelligence × INTELLIGENCE_GATHER_SCALAR) × extractionProductivity
```

every tick whether or not they need it. At defaults, with experience at its cap of 50 and mean
intelligence about 5.5, that is **3.9 per tick against a `CONSUMPTION_BASE` of 1.0** — people extract
about four times what they consume and bank the rest. The commons regenerates a fixed
`NATURAL_RESOURCE_REGEN_FRACTION × ceiling` = 900 per tick.

Those three numbers predict the overshoot. Consumption alone would support about 900 people; the pool
empties at about 230 extractors. So a population can grow past its sustainable size by roughly
four-fold before extraction is rationed at all, and the only brake that ever engages is starvation
after the pool is already gone. **The extraction-to-need ratio is the overshoot ratio.**

Neither `BASE_GATHER_AMOUNT` nor `INTELLIGENCE_GATHER_SCALAR` appeared in any research doc before
this one.

## The dose-response, and the cliff

All rows: 300 founders, 2000 ticks, the scaled commons and narrow productivity band that
`docs/research-productivity-band.md` established as the only regime that does not go extinct on its
own (`NATURAL_RESOURCES_INITIAL=30000`, `NATURAL_RESOURCE_CEILING_INITIAL=30000`,
`MAX_NATURAL_RESOURCE_CEILING=60000`, `NATURAL_RESOURCE_CEILING_FLOOR=6000`,
`EXTRACTION_PRODUCTIVITY_FLOOR=0.5`, `MAX_EXTRACTION_PRODUCTIVITY=2`). Both gather constants scaled
together, keeping their 10:1 ratio. "Mean extraction" is per capita per tick at the experience cap.

| `BASE`/`INTEL` | Mean extraction | Outcomes | Peak pop | `bound%` | `welf%` | `good%` | Extinct |
|---|---|---|---|---|---|---|---|
| 0.05 / 0.005 (default) | 3.88 | CYC×2 STR×9 COL×1 | 3868 | 42% | 49% | 40% | 0/12 |
| 0.035 / 0.0035 | 2.71 | CYC×6 STR×2 | 3479 | 32% | 48% | — | 0/8 |
| 0.030 / 0.0030 | 2.33 | CYC×7 STR×5 | 2950 | 30% | 45% | 61% | 0/12 |
| 0.025 / 0.0025 | 1.94 | CYC×6 STR×6 | 2588 | 26% | 41% | 65% | 0/12 |
| 0.020 / 0.0020 | 1.55 | CYC×6 STR×5 COL×1 | 2234 | 23% | 35% | 69% | 0/12 |
| 0.015 / 0.0015 | 1.16 | **EXTINCTION×8** | 672 | 0% | 40% | 0% | 8/8 |
| 0.0125 / 0.00125 | 0.97 | **EXTINCTION×8** | 396 | — | — | 0% | 8/8 |

Monotone improvement all the way down to a **cliff between 1.55 and 1.16**. Below roughly 1.35, an
average person can no longer cover their own consumption plus birth costs plus tax, and every seed
dies. The usable window is narrow: mean extraction between about 1.4 and 2.7, best at the bottom of
it.

The paired test on the best proportional cut (0.020/0.0020), 24 seeds, 2000 ticks, with trough depth
and commons strain named as the measures beforehand:

| Measure | Baseline | Treatment | Verdict |
|---|---|---|---|
| Lowest population reached | 43 | 134 | **REAL**, +99 per seed (40 to 190), under 1 in 10,001 |
| Share of ticks with pool stripped | 42% | 22% | **REAL**, −20 points (−25 to −17), under 1 in 10,001 |
| Peak population | 3862 | 2246 | REAL, −1600 — the cost: a smaller civilization |
| Runs ending extinct | 0/24 | 0/24 | cannot separate; nothing dies in either arm at 2000 ticks |

## The better lever is the spread, not the mean

The cliff is not about the average person — it is about the people below average. Extraction scales
with intelligence, so at a low mean the low-intelligence tail starves while the top still banks a
surplus. Holding mean extraction fixed at 1.54 and moving weight off the intelligence term onto the
flat term tests that directly.

`INTELLIGENCE_GATHER_SCALAR=0.0005`, sweeping `BASE_GATHER_AMOUNT` (12 seeds, 2000 ticks):

| `BASE` | Mean extraction | Outcomes | Peak pop | `bound%` | `welf%` | `good%` | Extinct |
|---|---|---|---|---|---|---|---|
| 0.024 | 1.34 | **EXTINCTION×12** | 564 | 0% | 39% | 0% | 12/12 |
| **0.028** | **1.54** | **CYC×9 STR×2 COL×1** | **2048** | **11%** | **33%** | **68%** | **0/12** |
| 0.032 | 1.74 | STR×4 CYC×4 COL×4 | 2287 | 25% | 36% | 18% | 0/12 |
| 0.036 | 1.94 | STR×4 CYC×5 COL×3 | 2538 | 26% | 39% | 61% | 0/12 |

At the **same mean extraction** (1.54), flattening the profile takes the commons from stripped 23% of
ticks to 11% and the non-failing labels from 6 of 12 to 9 of 12. The spread in who can extract, not
the average, is what drives the remaining strain. The cliff moves with it but does not disappear —
1.34 still kills every seed.

Read the 0.032 row with suspicion: its `good%` of 18 against 61 at 0.036 is not monotone and rests on
12 seeds. The two ends bracket the claim; the middle is noise.

## What the good configuration actually looks like

Call it **C1**: the regime above plus `BASE_GATHER_AMOUNT=0.028`, `INTELLIGENCE_GATHER_SCALAR=0.0005`.

```bash
npx ts-node scripts/sweep.ts --seeds 16 --ticks 8000 --persons 300 --workers 4 --verbose \
  --set NATURAL_RESOURCES_INITIAL=30000 --set NATURAL_RESOURCE_CEILING_INITIAL=30000 \
  --set MAX_NATURAL_RESOURCE_CEILING=60000 --set NATURAL_RESOURCE_CEILING_FLOOR=6000 \
  --set EXTRACTION_PRODUCTIVITY_FLOOR=0.5 --set MAX_EXTRACTION_PRODUCTIVITY=2 \
  --set BASE_GATHER_AMOUNT=0.028 --set INTELLIGENCE_GATHER_SCALAR=0.0005
```

16 seeds at 8000 ticks, against the same regime untouched:

| | Baseline | C1 |
|---|---|---|
| Outcomes | STR×8 CYC×8 | EXT×2 CYC×11 STR×2 COL×1 |
| **Extinct** | **0/16** | **2/16** (ticks 6823, 7227); 0/24 vs 3/24 on the paired run below |
| `good%` (share of stopping points reading CYCLICAL or STABLE) | 56% | 71% |
| Peak population | 3930 | 2180 |
| Typical trough | ~40 | ~170 |
| `bound%` (commons stripped) | 41% | 15% |
| `welf%` (person-ticks below the welfare line) | 49% | 33% |
| `peakGini` | 0.62 | 0.35 |
| Boom-bust cycles completed | 29 | 24 |
| Population trend per 1000 ticks | −0.00 | +0.01 |
| Runaway (`rnwy`) | 0/16 | 0/16 |

Per-seed at 2000 ticks the classifier's own rationale reads `Gini 0.16–0.26, happiness 3.4–3.8,
commons 29–97% full — not declining, oscillating`. Inequality is far below the 0.43 STRUGGLING gate;
happiness clears the 3.0 gate but only just, and is now the binding constraint on the label.

### The paired test at 8,000 ticks

24 seeds, both arms on the same seeds, with trough depth and commons strain named as the measures
before running (`npx ts-node scripts/compare.ts --seeds 24 --ticks 8000 --persons 300 --workers 4
--both … --b BASE_GATHER_AMOUNT=0.028 --b INTELLIGENCE_GATHER_SCALAR=0.0005`):

| Measure | Baseline | C1 | Verdict |
|---|---|---|---|
| **Lowest population reached** *(predicted)* | 33 | 119 | **REAL**, +84 per seed (65 to 133), about 1 in 3,334 |
| **Share of ticks with pool stripped** *(predicted)* | 41% | 15% | **REAL**, −25 points (−27 to −25), under 1 in 10,001 |
| Peak population | 3941 | 2185 | REAL, −1742 — the cost |
| Boom-bust cycles completed | 73 | 489 | REAL, under 1 in 10,001 |
| Population at the end | 1055 | 1074 | unsettled; range spans zero |
| **Runs ending extinct** | **0/24** | **3/24** | **not established** — 3 discordant seeds, all one way, about 1 in 4 by chance; needs ~55 seeds per arm |

Both predicted measures hold at the long horizon. The extinction row is the one to be careful with:
three seeds lost against none is **not** a measured regression — the tool asks for 55 seeds per arm
to resolve a gap that size — but the direction is consistent across two independent runs (2 of 16
in the sweep above, 3 of 24 here, baseline zero in both), so it should not be reported as a null
either. The honest reading is that C1 buys a much healthier society and has **not** been shown to buy
survival, with a hint it may cost some. Resolving that is the obvious next 55-seed run.

**The two things this does not fix.** It does not stop extinction, per the row above; the seeds that
died did so late and with a falling trough envelope (`trTrend` 0.79 and 0.07) rather than from one
bad roll, so they were ratcheting down rather than unlucky. And
`welf%` at 33% is not comparable to the baseline's 49% as a hardship measure — cutting extraction
lowers everyone's steady-state holdings to about 27 against a `WELFARE_THRESHOLD` of 20, so a third
of the population sits just under a line that has not moved. That is a units artifact of the
intervention, not a third of people in distress, and `welf%` should not be used to compare
configurations that change the resource scale.

## It holds at 3.3× the founding population

`docs/research-scale-robustness.md` found that two of four "helps once the commons is fixed" results
were conditional on the founding population, so this one was re-run at 1000 founders with the commons
scaled to match (100k/100k/200k/20k), 12 paired seeds, 3000 ticks:

| Measure | Baseline | C1 | Verdict |
|---|---|---|---|
| **Lowest population reached** *(predicted)* | 186 | 1046 | **REAL**, +858 per seed (847 to 878), about 1 in 2,000 |
| **Share of ticks with pool stripped** *(predicted)* | 41% | 24% | **REAL**, −17 points (−20 to −4), about 1 in 123 |
| Peak population | 13042 | 6502 | REAL, −6436 — the same halving as at 300 founders |
| Boom-bust cycles completed | 17 | 176 | REAL, about 1 in 2,000 |
| Population at the end | 8551 | 4386 | unsettled — the verdict reads "probably real" but the range spans zero, and the range wins |
| Runs ending extinct | 0/12 | 0/12 | nothing dies in either arm at 3000 ticks at this scale |

Both predicted measures survive the crowding test that broke `EXPERIENCE_CAP` and
`HAPPINESS_BASELINE`. The worst moment of a C1 run at this scale is a population of about 1,000 —
against 186 for the same world untouched. Two caveats worth stating: the commons is stripped 24% of
ticks here against 15% at 300 founders, so the strain benefit shrinks as the world gets bigger; and
3000 ticks is short enough that the extinction question this study could not settle at 300 founders
is simply not asked at 1000.

> **Re-examined 2026-09-19 (commit af5de99) — the stability claim below is partly the ceiling, not the intervention.**
> Regeneration is `ceiling × NATURAL_RESOURCE_REGEN_FRACTION`, and the ceiling reaches
> `MAX_NATURAL_RESOURCE_CEILING` by tick ~50 and stays there for **98% of a 2,000-tick run**. So
> inflow is a constant for essentially the whole run, and
> `MAX_NATURAL_RESOURCE_CEILING × REGEN_FRACTION ÷ CONSUMPTION_BASE` is a hard cap on sustainable
> population: ~2,100 here and ~7,100 at the 1,000-founder scale. **Measured peak population under C1
> is 2,185 and 6,502 — sitting on those caps.** So cutting extraction plausibly did not create a
> self-regulating population; it removed the 4× overshoot corridor so the population can sit *at* a
> hard-coded limit instead of oscillating around it. The measured improvements to trough depth and
> commons strain stand — those are paired tests. What is now unsupported is reading them as an
> emergent equilibrium. The test that separates the two is sweeping the cap and checking whether the
> peak-to-trough ratio holds as it rises; that has **not** been run.
>
> Two further defects found the same day bear on everything below, and are detailed in
> `docs/future-ideas.md`: newborn intents regress toward zero rather than toward a population mean,
> so learning, exercise, stealing and killing dispositions collapse ~35× within three generations and
> the population is behaviourally inert for almost every tick measured here; and `helpingIntent` is
> never inherited at all. Every run in this study was made on that population.
>
> **Resolved 2026-09-19 (commit 5c62765) — the damping does not survive raising the cap. It was the
> ceiling.** Ran the separating test above: sweep `NATURAL_RESOURCE_REGEN_FRACTION` (0.015/0.03/0.06/0.12,
> 16 seeds, 2000 ticks) and, more directly, sweep `MAX_NATURAL_RESOURCE_CEILING` itself
> (60000/120000/240000, same 16 seeds) holding everything else at C1. Both move the same way.
>
> Peak population scales almost exactly with the cap: median 2078 → 3865 → 7196 as
> `MAX_NATURAL_RESOURCE_CEILING` doubles then doubles again (each step ≈1.86×, i.e. essentially
> proportional, not the flat line an independent equilibrium would show). Confirmed with
> `scripts/compare.ts` on the 60000→120000 step, 24 paired seeds: peak population 2064 → 3881, **REAL
> DIFFERENCE**, +1812 per seed (1735 to 1961), under 1 in 10,001 — almost exactly a doubling to match
> the cap's doubling. "Lowest population reached" on the same run is unsettled (typical change reported
> as 0, range spans zero) — the trough barely moves while the peak doubles, which is exactly what widens
> the ratio.
>
> And the peak-to-trough ratio itself does **not** hold near 8×: it climbs to 13.3× at 120000 and 25.0×
> at 240000 (computed from the same sweep's per-seed `peak=`/`min=`), heading back toward the untouched
> baseline's ~90–98×. The regen-fraction sweep shows the same shape from a different angle: 30.6× at
> 0.015, 8.9× at 0.03 (this study's own C1 value — reproduces the headline number), 11.8× at 0.06, 20.8×
> at 0.12.
>
> **So the "90-fold to 8-fold" headline is real only at the one cap value tested, and is not a property
> of cutting extraction — it is the population sitting at
> `MAX_NATURAL_RESOURCE_CEILING × NATURAL_RESOURCE_REGEN_FRACTION ÷ CONSUMPTION_BASE`.** Raise the cap
> and the same C1 config produces a bigger population with a wider swing, moving back toward the
> baseline's shape rather than staying damped. Every trough-depth and commons-strain number reported
> above is still a real, correctly paired measurement — that part of this study is not in question — but
> reading them as evidence of a self-regulating equilibrium is now contradicted, not just unsupported.
> Extraction cuts still help (less commons stripping, a shallower crash) — they just do it by handing the
> population a smaller hard ceiling to sit under, not by producing a qualitatively different dynamic.

## What the distributions show: the two configs trade which scarcity you get

*(Added 2026-09-19 with `scripts/flow-probe.ts`, which prints the per-person distribution of
resource flow per decade — the model records only means and sums, so `resourceGini` had been the
only spread statistic anywhere.)*

Seed 2, both arms, share of the living population whose extraction capacity is below their own
per-tick living cost:

| Decade sample | Default extraction | C1 (cut extraction) |
|---|---|---|
| Commons fill | **0%** for most decades | **60–99%** |
| Share below their own living cost | **0–6%** | **36–83%** |
| Population | swings 83 → 3,384 | holds 685 → 1,658 |

**These are not more and less of the same thing.** At default extraction individuals carry enormous
capacity and the commons is destroyed: the scarcity is ecological. Under C1 the commons stays healthy
and the population sits permanently at its own break-even line: the scarcity is distributive. C1
does not remove the shortage, it moves it from the pool into the people.

That is the most plausible mechanism yet for the result this study could not otherwise explain — why
the healthier configuration is the one that loses seeds. A population living at break-even is one bad
roll from a cohort going under; a population with four times the capacity it needs is not, however
stripped its commons. It also predicts where to look next: the fix is not more extraction (that
rebuilds the overshoot) but a narrower *spread* around the break-even line, which is the same lever
Finding 3 already identified, pushed further.

**Read the numbers with the caveat, because it favours the baseline.** `extract` here is potential,
not realised — `GatherResourcesEvent` takes `min(output, naturalResources)` and discards what each
person actually got. The baseline's 0–6% is measured while its pool reads 0%, so almost nobody is
short on paper and almost everybody is short in fact; C1's much worse-looking figure is close to the
truth because its pool is full. The comparison is therefore a lower bound on how bad the baseline is,
not an overstatement of C1. Realised per-person extraction needs the gather event instrumented, which
is a model change and is logged in `docs/future-ideas.md` as ARD-level.

## Three lanes that did not work, and why each is useful

**More regeneration buys a bigger boom, not stability.** Sweeping
`NATURAL_RESOURCE_REGEN_FRACTION` (8 seeds, 2000 ticks) over 0.03 / 0.06 / 0.12 takes peak population
from 3920 to 6963 to 12209 — almost exactly proportional — while the share of ticks with the commons
stripped stays at 45% / 44% / 47% and the end population does not move at all (875 / 882 / 873). At
0.12 the outcome labels get *worse* (COLLAPSE×8, no seed holding a sustained cycle). This is
`docs/research-tuning-defaults.md`'s "bigger inputs buy a bigger boom" reproduced on the flow rather
than the stock, and it is the cleanest demonstration yet that the pool size is not the constraint.

**The fertility brake cannot be moved, because welfare clamps its own input.** Births scale from zero
at `CHILDBIRTH_RESOURCE_MIN` (10) to full at `CHILDBIRTH_RESOURCE_SCALE` (30) on the *parents' personal
resources*. Direct instrumentation of couple resources through a full cycle found the median couple
sitting at about 20 for most of the run in both boom and recovery — because `WELFARE_THRESHOLD=20`
tops everyone up to exactly that. The brake's input is pinned by the welfare system, not by the state
of the commons, so it reads a near-constant value regardless of how depleted the pool is. Moving the
brake later makes it a kill switch rather than a brake: `CHILDBIRTH_RESOURCE_SCALE` at 90, 150 and 300
gives 8/8 extinct at every step, because the median couple's fertility factor collapses toward zero
while their resources stay clamped at 20. **This is an unintended interaction between two subsystems
and it is the most consequential thing in this study after the headline** — any future work on
density-dependent fertility has to deal with it first.

**Heavy redistribution raises the trough and wrecks the commons.** `TAX_RATE=0.2` (24 seeds, 2000
ticks, paired) takes the lowest population reached from 43 to 315 — the largest trough improvement
measured anywhere in this project, under 1 in 10,001 — and simultaneously takes the share of ticks
with the commons stripped from 42% to **84%**, also real and also under 1 in 10,001. Peak population
falls from 3862 to 1191. `good%` is 11% against the baseline's 40%. Everyone is levelled to just
above the welfare line, everyone keeps extracting because extraction does not depend on wealth, and
the population parks permanently at the pool's extraction limit. It converts boom-bust into permanent
stagnation at the resource floor. A single measure looking excellent while the configuration is much
worse is exactly what `good%` was added to catch.

There is an interior optimum in tax, not a monotone one: `TAX_RATE=0` gives `bound%` 51 and one seed
in eight holding a sustained cycle, 0.02 (the default) gives 45 and 8/8, 0.05 gives `good%` 53
against the default's 40. The 0.05 result is 8 seeds and untested; it is the obvious next paired
comparison.

## What this does not settle

- **Survival.** 0 of 24 against 3 of 24 on paired seeds is not a measured regression at 24 seeds,
  and is certainly not an improvement. ~55 seeds per arm would settle it; that run has not been
  done.
- **Whether the 10:1 ratio between the two gather constants is a calibration choice or a modelling
  claim.** Moving weight from the intelligence term to the flat term says production is mostly effort
  and experience rather than ability. That is a statement about the world, not a magnitude tweak, and
  it should be an owner decision before it becomes a default. **No ARD is proposed here**, and no
  default was changed.
- ~~**Whether C1 holds at a different founding population.**~~ Settled above: both predicted
  measures hold at 1000 founders with the commons scaled to match. Not settled at that scale is
  extinction, since nothing dies in either arm within 3000 ticks.
- **Happiness at 3.4–3.8 is close to the 3.0 STRUGGLING gate**, so a small recalibration of the
  happiness subsystem could move C1's labels either way without changing its dynamics at all.
