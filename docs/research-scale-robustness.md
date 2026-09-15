# Research: Which Findings Survive More Ticks and More People

**Recorded:** 2026-09-15 | **Commit:** a805635 | **Latest ARD:** 062 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/compare.ts --seeds 48 --ticks 4000 --persons {100,300} [--both KEY=VAL …] [--b KEY=VAL]`; scaled-commons arm at `--seeds 24 --ticks 3000 --persons 300 --both NATURAL_RESOURCES_INITIAL=30000 --both NATURAL_RESOURCE_CEILING_INITIAL=30000 --both MAX_NATURAL_RESOURCE_CEILING=60000 --both NATURAL_RESOURCE_CEILING_FLOOR=6000`
**Key context vars:** `INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=1`, `BASE_CHILDBIRTH_RATE=0.6`, `HAPPINESS_BASELINE=0`, `EXPERIENCE_CAP=50`, `NATURAL_RESOURCES_INITIAL=10000`, `MAX_NATURAL_RESOURCE_CEILING=20000`

**Two of the project's four "helps once the commons is fixed" findings survive being run twice as long
with three times as many founders, and two do not.** Freezing extraction productivity (the pin) and
raising the birth rate under it hold in every condition tested, by wide margins. Raising the happiness
baseline holds at a longer horizon but vanishes when the founding population triples. Raising
`EXPERIENCE_CAP` — the cap on how much any one person can ever extract — fades at 4000 ticks and is
exactly zero at 300 founders: it bought delay, and the 2000-tick horizon read that delay as a rescue.

**Separately, the first configuration that does not go extinct.** Scaling the commons with the
population and pinning productivity together gives 0 of 24 seeds extinct at 3000 ticks *and* at 8000,
across 687 completed boom-bust cycles. Every prior candidate's extinction count climbed with the
horizon; this one's does not. It is still not thriving — `classifyOutcome` reads COLLAPSE on 21 of
those 24 seeds — but "does not die" is new.

Both corrected results were re-run at the original settings first, and both reproduce the earlier pass
to the run (23 → 11 and 23 → 7 of 48 extinct). So what moved is the test conditions, not the code.

## What was run

The four survival claims from the 2026-09-15 verification pass in
`docs/research-untested-variables.md` and its fertility null, plus three older headline claims that
had never been through a paired test, re-run with `scripts/compare.ts` in three conditions:

| Condition | Founders | Ticks | Commons | Seeds | What it stresses |
|---|---|---|---|---|---|
| **A** | 100 | 4000 | default | 48 | horizon — twice the 2000-tick judging standard |
| **B** | 300 | 4000 | default | 48 | crowding — a third of the resources per founder |
| **C** | 300 | 3000 | ×3 (30k/30k/60k/6k) | 24 | a genuinely bigger world at the same people-to-pool ratio |

Condition B is not a bigger world. `docs/research-population-scaling.md` established that founding
population on a fixed commons is a scarcity dial, so B is the same world with three times the
competition for it. C is the bigger world; it is expensive to run, so it got 24 seeds and the two
flagship claims only.

The measure that tests each claim was named before running. Extinction count for anything claimed to
change survival; peak population for the default-regime claims, where every run dies in both arms and
extinction cannot separate anything. `compare.ts` reports six measures, so about one run in four
throws a false alarm somewhere — a row that was not predicted in advance is not evidence.

## Results

Extinct runs, baseline → treatment, with the odds of a gap that size arising by chance:

| Claim | Arms | Original (100/2000) | A: 100/4000 | B: 300/4000 |
|---|---|---|---|---|
| Freezing productivity cuts extinction | default vs pin | 48 → 23 | **48 → 31**, about 1 in 65,000 | **48 → 21**, <1 in a million |
| Fertility is decisive once the pool is not binding | pin vs pin + `BASE_CHILDBIRTH_RATE=1.0` | 23 → 1 | **31 → 4**, <1 in a million | **21 → 6**, 1 in 385 |
| Happiness helps once the pool is not binding | pin vs pin + `HAPPINESS_BASELINE=10` | 23 → 7 | **31 → 14**, 1 in 4,500 | **21 → 18**, chance (needs 966 seeds) |
| Production capacity helps once the pool is not binding | pin vs pin + `EXPERIENCE_CAP=200` | 23 → 11 | **31 → 21**, 1 in 16 (needs 86 seeds) | **21 → 21**, chance (needs infinitely many) |

Peak population, for the claims where extinction is saturated at 48 of 48 in both arms:

| Claim | Arms | A: 100/4000 | B: 300/4000 |
|---|---|---|---|
| Fertility does nothing at default | default vs `BASE_CHILDBIRTH_RATE=1.0` | +17 (−43 to +88), unsettled | +9 (−19 to +63), unsettled |
| Widening the productivity band is not freezing it | default vs `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` | +43 (+2 to +163), real but small | +31 (−18 to +280), unsettled |
| 15× invention builds more but saves no one | default vs `BASE_INVENTION_RATE=0.03` | +472 (+225 to +658), real | +272 (+74 to +395), real |

## The two that broke, and why they broke differently

**`EXPERIENCE_CAP` is a delay, not a rescue.** It is the cleanest example this project has produced of
the horizon trap the sweep skill warns about. At 2000 ticks with 100 founders it takes extinction from
23 of 48 runs to 11 — odds of about 1 in 133 against chance, and it reproduced exactly when re-run
here. Hold the population at 100 and run to 4000 ticks and the gap narrows to 31 versus 21, which at
48 seeds is no longer distinguishable from chance. Triple the founders and it is 21 versus 21, with
the arms disagreeing on 28 seeds split 14 against 14 — as flat as a result gets. The horizon result
alone would be weak evidence, since 1 in 133 to 1 in 16 is a slide rather than a reversal; the dead
null at 300 founders is what settles it.

**Happiness is scarcity-sensitive, not horizon-sensitive** — the opposite diagnosis from the same kind
of failure. Run to 4000 ticks at the original 100 founders, raising `HAPPINESS_BASELINE` from 0 to 10
still takes extinction from 31 of 48 to 14 (odds about 1 in 4,500), so the longer horizon does not
touch it. At 300 founders on the same commons it is 21 versus 18, and the tool asks for 966 seeds per
arm to resolve a gap that size. Happier couples have more children; with three times the competition
for the same pool, the extra children do not survive to change the outcome. Both results are honest
descriptions of their own conditions — the finding is that the claim is conditional on a
people-to-resources ratio nobody thought to state.

## The two that held

**The pin is still the strongest lever in the model, and still not a fix.** Freezing extraction
productivity beats the default on extinction in every condition, and the effect grows rather than
shrinks with scale: 48 → 31 of 48 at 100 founders, 48 → 21 at 300, and in the scaled-commons world
24 of 24 runs die at default against **0 of 24** under the pin. It also roughly doubles peak
population (686 → 1233 at 100 founders; 706 → 1295 at 300) and multiplies completed boom-bust cycles
several-fold. But read the commons alongside it: the share of ticks with the pool stripped to near
nothing goes from 2% to 20% at 100 founders and 3% to 39% at 300. This is sustained Malthusian
cycling against an exhausted pool, not abundance, exactly as
`docs/research-sweep-session-2026-09-14.md` warned. And at 4000 ticks roughly two-thirds of the
pinned runs at 100 founders are dead anyway.

**Fertility under the pin holds, with a visible cost.** Raising `BASE_CHILDBIRTH_RATE` to 1.0 under
the pin is still the largest survival effect measured: 31 → 4 of 48 at a 4000-tick horizon, 21 → 6
with 300 founders. The gap narrows as conditions get harsher (1 of 48 at the original settings, 6 of
48 at 300 founders), which is what a lever that works by outrunning a constant hazard should look
like. Note that in both conditions it *lowers* peak population — by 170 and 165 people respectively,
both well outside noise. More births against the same pool means more, smaller lives, not a bigger
civilization.

## The one cell where nothing died — and it holds at 8000 ticks

Scaling the commons to the population *and* pinning productivity is the first configuration this
project has run that loses nobody, and the first whose extinction-vs-horizon curve is flat rather
than climbing: **0 of 24 seeds extinct at 3000 ticks and still 0 of 24 at 8000**, against 24 of 24
for the same world at default productivity. Every previous candidate failed exactly this test — the
best-looking cell before this went from zero extinctions at 800 ticks to 3 of 16 by 1500.

The 8000-tick run (`npx ts-node scripts/sweep.ts --seeds 24 --ticks 8000 --persons 300 --verbose`
with the scaled commons and the pin) makes the mechanism legible. The 24 seeds complete **687
boom-bust cycles between them and lose nobody**, with 23 of 24 carrying the `stableCycle` flag. What
changed is trough depth: these cycles bottom out at a median of **32 people** (range 16–48) against
the median of **10** in the 100-founder pinned regime, where roughly 7% of troughs took the
population to zero. Zero deaths in 687 troughs puts the per-trough hazard below 0.44%, so this is at
least a 16× reduction — a different regime, not a slower one. That also confirms the prediction
`docs/future-ideas.md` recorded for crash recovery: what matters is whether the mechanism holds the
trough above roughly 5–20 people.

No control arm was run at 8000 ticks because it cannot change anything: the control is already 24 of
24 extinct by 3000, and a run that has ended cannot un-end at a longer horizon. The paired test at
3000 ticks (24 → 0, odds below 1 in a million) is the comparison; this run extends the treatment arm.

**It is still not abundance, and the outcome label says so.** `classifyOutcome` reads COLLAPSE on 21
of 24 seeds and STRUGGLING on the other 3. The commons is stripped for 39% of ticks, 48% of
person-ticks are below the welfare threshold, adult `resourceGini` sits at 0.57–0.59, and every seed
touches a tick where all living children are orphaned. A society that swings between 3800 people and
32, thirty times over, is not thriving — it is surviving a permanent Malthusian cycle at larger
scale. The honest summary is that the model now has a configuration that does not die, and none that
does well.

## Why those seeds read COLLAPSE, and what it says about the classifier

The COLLAPSE×21 label above is mostly an artifact of when the clock stops, and the part that is not
an artifact is a real statement about the model rather than about `classifyOutcome`. Probed by
running seeds 12 and 16 to 8000 ticks and re-classifying the same run at every decade boundary across
one full cycle (~270 ticks, 27 stopping points):

| Seed | Label at tick 8000 | Why | Across 27 stopping points |
|---|---|---|---|
| 12 | COLLAPSE | population 98% below peak | COLLAPSE×20, STRUGGLING×7 |
| 16 | STRUGGLING | final-decade happiness 2.85, below the 3.0 gate | COLLAPSE×19, STRUGGLING×8 |

**Problem one: peak-relative decline is phase-dependent.** `COLLAPSE_PEAK_DECLINE_FRACTION=0.5` fires
whenever the final decade sits more than halfway below the all-time peak, and a population cycling
between 3800 and 32 is below that line for roughly three-quarters of every cycle. The same run is
COLLAPSE or STRUGGLING depending on which decade you stop in. The peak it is measured against is an
overshoot peak the society never sustained, so the comparison is to a state that was never viable.
This is the `classifyOutcome` weakness `docs/research-sweep-session-2026-09-14.md` predicted, now
measured: it is a defect for any oscillating regime, and worth an ARD.

**Problem two is not the classifier's fault.** THRIVING requires population within 15% of peak *and*
a commons at 40% of ceiling or better, simultaneously. In this model the population peak is precisely
what empties the commons — seed 12's trough decade has the pool at **98% full** with 79 people alive,
while seed 16's peak decade has it at **0.0%** with 3180 alive. Those two gates are close to mutually
exclusive in any overshoot regime, so no cycling population can trip THRIVING however the decline term
is fixed. That is the model saying something true about itself.

**Inequality is not what blocks it.** Final-decade adult Gini across those 27 stopping points runs
0.156 to 0.540 with a median of **0.35** — below the 0.43 STRUGGLING gate about half the time and
never near the 0.60 COLLAPSE gate. The 0.57–0.59 in the sweep table is `peakGini`, the max-of-noise
statistic `docs/research-gini-metric.md` flagged; the number the classifier actually uses is far
lower. Any reading of this cell as "a brutally unequal society" rests on the wrong column.

## The commons is still what sets the size of a civilization

Holding the founding population at 300 and tripling only the four commons constants takes median peak
population from 708 to 2556 — a 3.6× civilization from a 3× pool, with the share of ticks at an
exhausted pool unchanged at 3-4%. Extinction stays at 24 of 24 either way. That is
`docs/research-population-scaling.md`'s central claim reproduced on a paired test at a longer horizon:
the pool sets how big you get, and making it bigger buys nobody's survival.

## What this changes

The three default-regime nulls hold, so nothing in `docs/research-untested-variables.md`'s Part 1
needs revisiting. The affected rows in that document's verification table are annotated in place.

The wider lesson is about that document's own framing. It argued that per-capita levers are absorbed
by a binding commons and become decisive once the commons is fixed. That is still the right shape, but
"fixed" turns out to be relative: the productivity pin fixes the commons *for 100 founders*, and two
of the four levers tested under it are measuring headroom that 300 founders consume. A finding under
the pin should now state the founding population it was measured at.

## Caveats

- 48 seeds for conditions A and B, 24 for C. The `EXPERIENCE_CAP` and happiness corrections rest on
  non-detections; both are reported with the seed count that would have been needed, and neither is
  claimed as a measured zero.
- Condition C's paired comparisons ran to 3000 ticks, not 4000, because the surviving populations are
  large enough to make it expensive. The zero-extinction cell was separately re-run to 8000 ticks as a
  single arm; that run reports outcome labels and trough depths but is not a paired comparison.
- `compare.ts` compares configurations, not interactions. "The lever works here and not there" is
  still an inference across two comparisons rather than a tested interaction, the same limit the
  previous pass recorded.
- Condition B changes two things at once relative to the original studies — three times the founders
  *and* a third of the resources per founder — because the commons constants are absolute. C separates
  them for the pin claim only.
