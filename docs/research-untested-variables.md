# Research: Settings That Do Nothing Until the Resource Shortage Is Fixed

**Recorded:** 2026-09-14 | **Commit:** b23e106 | **Latest ARD:** 062 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/sweep.ts --seeds 48 --ticks 2000 --workers 4 [--sweep KEY=… | --set KEY=VAL]`; `npx ts-node scripts/throughput-probe.ts --sweep KEY=… --seeds 24`; `npx ts-node scripts/thrive-probe.ts --seeds 8 --ticks 300 --set KEY=VAL`
**Key context vars:** `HAPPINESS_BASELINE=0`, `EXPERIENCE_CAP=50`, `CONSUMPTION_ELDER_MULTIPLIER=1.5`, `INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=1`, `THRIVING_HAPPINESS_THRESHOLD=6.0`

**Terms used throughout.** *The commons* is the single shared resource pool everyone gathers from;
it *binds* when it has been stripped to near zero, which is the model's normal state. *The
productivity pin* is `INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=0`, which stops extraction
efficiency drifting downward over a long run (a defect documented in
`docs/research-thriving-reachability.md`); pinning it makes the economy roughly 3× richer, so the
pool stops being the bottleneck. *Extinct* means a run ended with nobody alive.

**Headline: settings that raise the birth rate change nothing at all while the pool is empty, and
become the strongest levers in the model once it isn't.** The cleanest case is the birth rate itself.
Raising `BASE_CHILDBIRTH_RATE` from 0.6 to 1.0 at default settings moves the peak population by
**−0.8%** (685.5 → 680) and leaves all 48 runs extinct. The same change with the productivity pin
applied takes extinction **from 23 of 48 runs to 1 of 48**, and at 8000 ticks from 43 of 48 to 6 of
48 (Fisher exact, p = 7×10⁻¹⁵). The extinction rate among survivors falls from about 24% to about 2%
per 1000 ticks, a 12× reduction and much the largest effect any lever in this project has produced.

Two other settings show the same flat-then-decisive shape. `HAPPINESS_BASELINE` (happier couples have
more children) produces **34% more births and a population exactly the same size** at defaults, all 48
runs extinct either way, and takes extinction from 23 of 48 to 7 of 48 under the pin (p = 0.0008).
`EXPERIENCE_CAP`, which limits how much any one person can ever extract, is flat at defaults and goes
23 of 48 to 11 of 48 under the pin (p = 0.018).

**None of this escapes the model's fate**, and the strongest lever makes that clearest: run to 16,000
ticks, the fertility config's hazard is a flat 1.5–2.9% per 1000 ticks with no downward trend, so it
delays extinction by roughly 12× rather than preventing it. `BASE_CHILDBIRTH_RATE=1.0` is also
biologically indefensible (the constant's own comment puts natural fertility at 40–55%, and the
default 0.6 already exceeds it). Read these as probes of the model's dynamics, not as calibration
proposals.

**What that means for the project's conclusions.** `docs/research-tuning-defaults.md` holds that no
single constant fixes overshoot→extinction. That is still true, but nearly every constant was tested
in the one regime where constants about *individual people* cannot matter: the pool caps the
population regardless of how many are born or how much each can extract. A "this does nothing" result
measured at defaults is evidence about the test conditions as much as about the setting. Nothing here
makes the model survive — populations still die off at a steady rate in every arm, and none reaches
equilibrium — but it argues for fixing the resource economy before any further individual-level
calibration, and for re-running the archived nulls afterwards.

All figures are 48 seeds unless stated. Two re-measured controls, not quoted:

| Control (48 seeds, 2000 ticks) | Outcome | Median peak pop | `bound%` | `stable` |
|---|---|---|---|---|
| Default | `EXTINCTION×48` | 685.5 | 4% | 0/48 |
| Productivity pin (`INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=0`) | `EXTINCTION×23 COLLAPSE×21 STRUGGLING×4` | 1220 | 38% | 18/48 |

## Part 1 — In the default regime, every per-capita lever is absorbed

### The happiness subsystem: twelve never-swept constants, zero outcome leverage

Twelve `HAPPINESS_*` constants had never appeared in any research doc. Happiness is not decorative —
it feeds fertility (`CHILDBIRTH_HAPPINESS_SCALAR`), suicide, kill attempts, and it is one of the four
ARD-051 THRIVING gates.

| Config (48 seeds, 2000 ticks) | Median peak pop | Extinct |
|---|---|---|
| **Default control** | **685.5** | 48/48 |
| `HAPPINESS_BASELINE=5` | 696.5 | 48/48 |
| `HAPPINESS_BASELINE=10` | 685 | 48/48 |
| Comfort made cheap (`COMFORTABLE=30`, `LOW=15`, `CRITICAL=5`) | 670.5 | 48/48 |
| Comfort made harsh (`COMFORTABLE=150`, `LOW=60`, `CRITICAL=25`) | 677.5 | 48/48 |
| Bonuses tripled (`JOB=10`, `RELATIONSHIP=6`, `COMFORTABLE_BONUS=6`) | 692 | 48/48 |
| All five misery penalties set to 0 | 718.5 | 48/48 |

Every row is inside noise. **This is a null about outcomes, not about the mechanism**, and the sweep
table cannot tell those apart — it reports peak population but not births, so "the lever is inert"
and "the lever works and the commons eats it" render identically. `scripts/throughput-probe.ts`
(added by this study) reports both:

```
npx ts-node scripts/throughput-probe.ts --sweep HAPPINESS_BASELINE=0,5,10,20 --seeds 24
HAPPINESS_BASELINE=0    medBirths= 757  medPeakPop=684    medHappiness(t<60)= 4.74  extinct=14/24
HAPPINESS_BASELINE=5    medBirths= 788  medPeakPop=692    medHappiness(t<60)= 9.11  extinct=12/24
HAPPINESS_BASELINE=10   medBirths= 830  medPeakPop=705.5  medHappiness(t<60)=14.20  extinct=12/24
HAPPINESS_BASELINE=20   medBirths=1019  medPeakPop=691.5  medHappiness(t<60)=24.00  extinct=12/24
```

Mean happiness tracks the constant linearly and the fertility channel is live and uncapped
(`happinessFactor = 1 + coupleHappiness × CHILDBIRTH_HAPPINESS_SCALAR`, no ceiling): births rise
**34%**. Peak population moves 2%, non-monotonically. A third more children are born and the
population is the same size, because the extra births die against the same pool.

### Production capacity saturates exactly at the default

`EXPERIENCE_CAP` bounds lifetime extraction potential, and experience is the primary term in
`GatherResourcesEvent`.

| `EXPERIENCE_CAP` | Median peak pop (48 seeds, 2000t) | medBirths (24 seeds, 300t) |
|---|---|---|
| 10 | **333** | 416 |
| 25 | 701 | 618 |
| **50 (default)** | **685.5** | 757 |
| 100 | 669.5 | 1048 |
| 200 | — | 774 |

Below 50 the cap binds hard — at 10 the population halves. Above 50 it does not: doubling it to 100
raises births 38% and *lowers* median peak population at 2000 ticks. The default sits almost exactly
at the knee, which as far as this study can tell is an accident rather than a choice.

Note the horizon trap: at 300 ticks `EXPERIENCE_CAP=100` looks like a clear improvement (peak 706 vs
684, extinct 9/24 vs 14/24); at 2000 ticks it is slightly worse. Another instance of
`docs/research-tuning-defaults.md`'s rule, reproduced without being looked for.

`ELDERLY_IDLENESS_DECAY` is a flat null across `0, 0.2, 1.0, 3.0` — median peak population 692.5,
685.5, 702.5, 705.5. Turning elder experience erosion off entirely changes nothing.

### The one default-regime lever that moves, moves by subtraction

| `CONSUMPTION_ELDER_MULTIPLIER` | Median peak pop | Extinct |
|---|---|---|
| 0.5 | **778.5** | 48/48 |
| 1.0 | 719 | 48/48 |
| **1.5 (default)** | 685.5 | 48/48 |
| 3.0 | **633** | 48/48 |

Monotone: a 6× swing moves peak population 23%. It is the only lever in this section that acts by
*reducing draw on the commons* rather than adding capacity to a person, which is the headline in
miniature. Extinction is 48/48 throughout — it sets scale, not fate.

> **The `peakGini` column in this sweep (0.73 → 0.89, monotone) is an artifact.** It moves inversely
> with peak population, exactly as `docs/research-gini-metric.md` predicts if `peakGini` is attained
> during the terminal crash at small N. That study already found this variable's apparent `peakGini`
> trend fails to reproduce on a mature-phase median; this run reproduces the artifact at 48 seeds.
> No claim in this document rests on `peakGini`.

## Part 2 — Under the productivity pin, the same levers decide survival

Every Part 1 null was re-run with `INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=0`, the configuration
from `docs/research-sweep-session-2026-09-14.md` that removes productivity drift and takes `bound%`
from 4% to 38%.

| Config (48 seeds, 2000 ticks, pin applied) | Extinct | `stable` | Median peak pop | Fisher p vs pin control |
|---|---|---|---|---|
| **Pin control** | 23/48 | 18/48 | 1220 | — |
| Pin + `HAPPINESS_BASELINE=5` | 11/48 | 30/48 | 1181 | 0.013 |
| Pin + `HAPPINESS_BASELINE=10` | **7/48** | 30/48 | 1119 | **0.0008** |
| Pin + `EXPERIENCE_CAP=100` | 15/48 | 29/48 | 1309 | 0.13 |
| Pin + `EXPERIENCE_CAP=200` | 11/48 | 33/48 | 1205 | 0.018 |

The same `HAPPINESS_BASELINE=10` that was worth exactly nothing at default (48/48 either way,
p = 1.0) removes two thirds of extinctions here. **Peak population goes *down*** (1220 → 1119) while
survival improves sharply — so this is not "a bigger boom," the failure mode of every resource lever
tried in this project. It is a smaller, more frequent oscillation: `cyc` rises 6 → 8 at 2000 ticks
and 6 → 33 by 8000.

### It is a slower death, not an escape — but the hazard really is lower

Per the project's own horizon rule, a 2000-tick rescue is presumed to be a delay until shown
otherwise. Ladder, against the pin control measured at the same four horizons:

| Ticks | Pin control extinct | Pin + `HAPPINESS_BASELINE=10` extinct | Control survival /1000t | Happiness survival /1000t |
|---|---|---|---|---|
| 2000 | 23/48 | 7/48 | — | — |
| 3500 | 30/48 | 12/48 | 0.80 | 0.92 |
| 5000 | 37/48 | 18/48 | 0.72 | 0.89 |
| 8000 | **43/48** | **24/48** | 0.77 | 0.93 |

At 8000 ticks: 5 survivors vs 24 (Fisher p = 4×10⁻⁵). Both arms have a **constant** per-1000-tick
hazard with no flattening, so neither is an equilibrium and every seed dies eventually in both. But
the hazard itself differs by ~2.6× (≈24%/1000t vs ≈9%/1000t), and that is a different thing from the
delay-masquerading-as-rescue pattern `docs/calibration-guide.md` warns about: there, the curves
converge to 48/48 (`BASE_INVENTION_RATE=0.03` does exactly this). Here the absolute gap in survivors
*widens* with horizon, 18 → 19, because the rates differ rather than the offsets. Extrapolating both
constant hazards, the pin control's last seed dies near tick 16,000 and the happiness arm's near tick
42,000. Those two numbers are extrapolations and should be read as such.

### Mechanism: it is fertility volume, not targeting

> **Correction.** The first version of this document (and of PR #109) claimed the happiness constant
> worked by *targeting* the distressed: happiness is floored at zero, so the baseline lifts the
> fertility multiplier mostly for people at the bottom of a cycle, making it a crude anti-Allee
> mechanism. **Two follow-up experiments killed that explanation.** The channel claim survives; the
> targeting claim does not. The original reasoning and the trough table are kept below because the
> trough effect is real — only its interpretation was wrong.

**The channel is fertility, and nothing else.** `CHILDBIRTH_HAPPINESS_SCALAR=0` severs the only link
from happiness to births. With it cut, raising the baseline does nothing at all:

| Pin, 48 seeds, 2000 ticks | Extinct |
|---|---|
| `CHILDBIRTH_HAPPINESS_SCALAR=0`, `HAPPINESS_BASELINE=0` | 25/48 |
| `CHILDBIRTH_HAPPINESS_SCALAR=0`, `HAPPINESS_BASELINE=10` | 30/48 (Fisher p = 0.41) |

So happiness reaches the population only through births. The suicide and violence channels contribute
nothing measurable, consistent with `docs/research-sweep-session-2026-09-14.md` H5/H8.

**But targeting is not what does the work.** `HAPPINESS_BASELINE=10` is worth roughly a 38% uniform
fertility rise on average (mean happiness 4.7 → 14.2 moves `happinessFactor` 1.24 → 1.71). Applying
that rise *uniformly* instead, via `BASE_CHILDBIRTH_RATE`, does at least as well and probably better:

| Pin, 48 seeds, 2000 ticks | Extinct | `stable` | Median peak pop |
|---|---|---|---|
| Control | 23/48 | 18/48 | 1220 |
| `HAPPINESS_BASELINE=10` (targeted at the distressed) | 7/48 | 30/48 | 1119 |
| `BASE_CHILDBIRTH_RATE=0.83` (uniform, matched +38%) | **2/48** | 41/48 | 1112 |
| `BASE_CHILDBIRTH_RATE=1.0` (uniform, larger) | **1/48** | 41/48 | 1033 |

2/48 versus 7/48 is not a significant difference on its own (p = 0.16), but the direction is wrong for
the targeting hypothesis, which predicted the targeted version should win. **The honest reading is
that fertility volume is the lever and where the extra births land is not the point.**

The trough effect is still real, it just is not evidence for targeting — any fertility increase
raises troughs:

| Pin, 5000 ticks, surviving seeds only | Survivors | Trough p25 | Trough median | Trough mean | Trough max |
|---|---|---|---|---|---|
| Control | 11/48 | 5 | 7 | 7.5 | 12 |
| `HAPPINESS_BASELINE=10` | 30/48 | 7 | **9** | 9.5 | 19 |

Survivorship bias runs against that comparison (the control's 11 survivors are the lucky tail of 48,
selected for shallow troughs), so the gap is a lower bound.

### Fertility under the pin is the strongest lever found in this project, and still does not escape

`BASE_CHILDBIRTH_RATE=1.0` under the pin, run out to 16,000 ticks — eight times the horizon this
project normally uses:

| Ticks | Extinct | Survivors | `stable` | Hazard per 1000 ticks |
|---|---|---|---|---|
| 2000 | 1/48 | 47 | 41/48 | — |
| 3500 | 3/48 | 45 | 39/48 | 2.9% |
| 5000 | 4/48 | 44 | 38/48 | 1.5% |
| 8000 | 6/48 | 42 | 35/48 | 1.5% |
| 12000 | 9/48 | 39 | 35/48 | 1.8% |
| 16000 | **13/48** | **35** | 28/48 | 2.7% |

Against the pin control's 43/48 extinct at 8000 ticks, this is 6/48 (Fisher p = 7×10⁻¹⁵). The
extinction hazard falls from ~24% to **~2% per 1000 ticks, a 12× reduction** — much the largest effect
any lever in this project has produced.

**It still does not flatten.** The 3500–8000 window looked like flattening (2.9% → 1.5% → 1.5%) and an
earlier read of this table called it the first genuinely non-terminal config. Extending to 12,000 and
16,000 removes that: the hazard sits at 1.5–2.9% throughout with no downward trend, which is a
*constant* hazard, not a decaying one. By `docs/calibration-guide.md`'s own test — a real config's
curve flattens, a delaying one keeps climbing — this is still a delaying config. Extrapolated at
~2%/1000 ticks, the last of the 35 survivors is gone near tick 190,000. Every population in this
model still dies; this one takes about twelve times longer.

**Two reasons not to read this as a calibration proposal.** `BASE_CHILDBIRTH_RATE=1.0` means every
healthy, partnered, peak-age couple has a child every single year; the constant's own comment puts
Hutterite natural fertility at 40–55%, and the default of 0.6 is already above the empirical ceiling.
And the outcomes are bad even where they are not extinct: at 16,000 ticks the split is 23 COLLAPSE,
10 STRUGGLING, 2 STABLE, with `bound%` at 49% — the commons is exhausted half of all ticks. This is a
probe of the model's dynamics, not a configuration anyone should adopt.

### The regime claim, tested with the strongest lever available

If the commons is what makes per-capita levers inert at defaults, then the single most powerful lever
found above should also be inert at defaults. It is:

| 48 seeds, 2000 ticks, no pin | Extinct | Median peak pop |
|---|---|---|
| `BASE_CHILDBIRTH_RATE=0.6` (default) | 48/48 | 685.5 |
| `BASE_CHILDBIRTH_RATE=1.0` | 48/48 | **680** |

A 67% fertility increase changes the peak population by −0.8% and the outcome not at all. The same
change under the pin takes extinction from 23/48 to 1/48. That is the cleanest statement of this
study's headline available in one table.

## Part 3 — The THRIVING happiness gate is satisfiable by an unchosen constant

`HAPPINESS_BASELINE = 0` — "raise if too many persons floor at 0", per its own comment — has never
been calibrated against anything, and happiness has a hard floor at zero and no ceiling.
`THRIVING_HAPPINESS_THRESHOLD = 6.0` is compared against the mean of that quantity. The threshold and
the origin of the scale were set independently, by different ARDs, with no shared referent.

`scripts/thrive-probe.ts`, 8 seeds, 300 ticks:

| `HAPPINESS_BASELINE` | Seeds where HAP is a failing gate | Seeds reaching `ANY-DECADE-THRIVE` |
|---|---|---|
| 0 (default) | **8 of 8** | **0 of 8** |
| 3 | 6 of 8 (all four non-extinct seeds ≥ 5.58) | 8 of 8 |
| 5 | 4 of 8 (every seed that survives passes) | 8 of 8 |

At baseline 5, seed 8 classifies **STABLE** with happiness 8.66, failing only the commons gate; at
baseline 0 the same configuration fails on happiness. And at 48 seeds / 2000 ticks,
`HAPPINESS_BASELINE=5` is `EXTINCTION×48` — identical to default. **The constant moves the label and
not the fate**, which is what a gate measuring its own calibration looks like.

Same defect class as ARD 059's age-38 fertility window: a pessimistic result resting on a number
nobody chose. Weaker, because a happiness scale has no natural zero to be wrong about — but that is
exactly why an absolute threshold of 6.0 on it cannot mean anything by itself. Either the gate should
be relative (a quantile, or a fraction of the maximum attainable given the bonus constants) or the
baseline and threshold should be derived together. **Raising `HAPPINESS_BASELINE` is not the
recommendation** — it would manufacture THRIVING labels without preventing a single death in the
default regime. Logged in `docs/future-ideas.md`.

## Part 4 — Gathering has an age profile that is wired to nothing

`GATHERING_PEAK_AGE = 28`, `GATHERING_AGE_SCALE = 35` and `GATHERING_AGE_FLOOR = 0.1` exist in
`Variables.ts` and are **referenced nowhere in `src/` or `scripts/`**. `GatherResourcesEvent` is
unconditional and age-blind; the ODD formula (§7) records it that way, so code and spec agree and
only the constants are orphaned. It is the **only** age-profile group in the file that is unwired:
`WINDFALL_`, `ENROLLMENT_`, `GRADUATION_`, `HELP_`, `EXERCISE_` and the rest all resolve to a call in
`EventFactory`. `docs/model-reference.md` describes the file as holding "per-event age profile
constants for all planned events", which reads as though this one is live too.

The substantive consequence: **production is age-blind while consumption is explicitly age-scaled.**
A 90-year-old draws `CONSUMPTION_BASE × 1.5` and extracts at the same rate as a 30-year-old of equal
experience — and experience is capped, accumulates for life, and (per Part 1) barely decays when idle.
The model has no dependency ratio on the production side at all. Given that the default collapse is
visibly an age-structure event — `thrive-probe` shows median age climbing 18 → 51 → 91 as births stop
and the population ages into its own crash — that is a gap rather than a cosmetic issue. Logged in
`docs/future-ideas.md` as a candidate mechanism; not implemented, per the ARD rule.

## Part 5 — The pin's long-horizon hazard is constant, confirming a prior extrapolation

`docs/research-sweep-session-2026-09-14.md` concluded of the pin config that "extrapolated naively, a
constant per-cycle hazard takes essentially every seed eventually," from two horizons. At 48 seeds
across four:

| Ticks | Extinct | Survivors | `stable` | Survival vs previous, per 1000 ticks |
|---|---|---|---|---|
| 2000 | 23/48 | 25 | 18/48 | — |
| 3500 | 30/48 | 18 | 16/48 | 0.80 |
| 5000 | 37/48 | 11 | 8/48 | 0.72 |
| 8000 | **43/48** | **5** | **4/48** | 0.77 |

**The extrapolation was right.** Survival is flat at 0.72–0.80 across three independent intervals —
~24% chance of dying per 1000 ticks, no decay. Median peak population is identical at every horizon
(1220–1232), so survivors are not growing into safety; they cycle at the same amplitude and roll the
same die.

**`stable` decays with horizon: 18 → 4.** Sustained cycling is itself transient, which changes how
that column reads: `stable=18/48` at 2000 ticks is not "18 seeds found equilibrium" but "18 seeds
have not yet rolled badly." This adds a horizon warning to the power warning already in
`docs/calibration-guide.md` — two `stable` figures are comparable only at equal ticks.

## Part 6 — Founding population re-checked at 48 seeds, and pushed past where it was tested

`docs/research-population-scaling.md` (16 seeds) found "10× the founding population buys 1.9× the
peak on a fixed commons." **That reproduces exactly at 48 seeds**: 685.5 → 1313 from 100 → 1000
founders, a ratio of 1.92 against a recorded 1.9. Extending past the largest cell anyone had run
changes the interpretation:

| Founding persons (fixed 10k commons) | Median peak pop | Peak ÷ founders | `welf%` | Extinct |
|---|---|---|---|---|
| 100 | 685.5 | **6.9×** | 54% | 48/48 |
| 250 | 682.5 | 2.7× | 55% | 48/48 |
| 500 | 813 | 1.6× | 62% | 48/48 |
| 1000 | 1313 | 1.3× | 68% | 48/48 |
| 2000 | 2420.5 | 1.2× | 67% | 48/48 |
| 5000 | 5832 | **1.17×** | 72% | 48/48 |

The growth multiple collapses from 6.9× to 1.17×. At 5000 founders the population barely grows before
it dies — it starts at the commons' capacity and goes straight to the crash, skipping the boom. So
"founding population is a ratio knob, not a scale knob" is confirmed and sharpened: past roughly 1000
founders on a 10k pool **the founding number is the peak**, and the 1.9× figure was measured in the
one regime where the pool still had headroom. `welf%` rises monotonically 54% → 72%, the per-capita
scarcity signature.

Scaling the commons with the founders (all four pool constants × `persons ÷ 100`), 24 seeds — 12 for
the largest cell:

| Founding persons | Commons | Median peak pop | Prior 16-seed figure | Extinct |
|---|---|---|---|---|
| 250 | 25k | 1451.5 | 1439 | 24/24 |
| 500 | 50k | 4280.5 | 4760 | 24/24 |
| 1000 | 100k | 11016 | 10975 | 12/12 |

All three reproduce the prior study within noise, including the largest, which reaches a median peak
of **11,016 people and still goes 12/12 extinct**. Extinction is universal in every cell of both
tables. **Nothing about scale rescues the model**; it only changes how many people die.

## Caveats

- 48 seeds at 2000 ticks for the sweep tables; 24 seeds (12 at 1000 founders) for the scaled-commons
  rows and `throughput-probe`; 8 seeds at 300 ticks for the `thrive-probe` gate counts.
- The gate table in Part 3 is the weakest evidence here — a small-n illustration of arithmetic. The
  claim it supports (the gate moves while extinction does not) rests on the 48-seed `EXTINCTION×48`
  figure, not on those 8 seeds. Its rows are also at 300 ticks, where the horizon rule applies in
  full; they are reported as evidence about per-decade gate arithmetic, not about outcomes.
- Part 2's trough-depth table conditions on survival, and the two arms have very different survival
  rates (11/48 vs 30/48). The bias runs against the reported effect, so the gap is a lower bound, but
  it is not a clean unconditional comparison.
- The two extrapolated extinction ticks (≈16,000 and ≈42,000) are extrapolations from a measured
  constant hazard over 6000 ticks, not measurements. Nothing was run past 8000 ticks.
- Part 2 tested `HAPPINESS_BASELINE`, `EXPERIENCE_CAP` and `BASE_CHILDBIRTH_RATE` under the pin. The
  other Part 1 nulls (comfort thresholds, misery penalties, `ELDERLY_IDLENESS_DECAY`,
  `CONSUMPTION_ELDER_MULTIPLIER`) were not re-run there and should not be assumed inert in that
  regime.
- The targeted-vs-uniform comparison (7/48 vs 2/48, p = 0.16) is underpowered to call a winner. It is
  sufficient to reject the *targeting* hypothesis, which predicted the opposite ordering, but it does
  not establish that uniform fertility is genuinely better than the happiness route.
- Everything under the pin sits at 38–53% `bound%`: the commons is exhausted for roughly half of all
  ticks, and the surviving populations are cycling hard against it. None of these are abundance
  regimes, and nothing here speaks to what produces abundance.
- `peakGini` is unreliable throughout (see the boxed note in Part 1); no claim here rests on it.
