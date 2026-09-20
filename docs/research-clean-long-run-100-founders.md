# Research: A 30,000-Tick Run From 100 Founders, and Why It Still Isn't Clean

**Recorded:** 2026-09-20 | **Commit:** 331447b | **Latest ARD:** 067 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/sweep.ts --seeds 24 --ticks 30000 --persons 100 --workers 4 --verbose --set …`; `npx ts-node scripts/compare.ts --seeds 24 --ticks 30000 --persons 100 --workers 4 --both … --b …`; `npx ts-node scripts/trough-probe.ts --seeds 3 --ticks 6000 --persons 100 --set …`
**Key context vars:** `NATURAL_RESOURCES_INITIAL=10000`, `MAX_NATURAL_RESOURCE_CEILING=20000`, `EXTRACTION_PRODUCTIVITY_FLOOR=0.01`, `MAX_EXTRACTION_PRODUCTIVITY=10`, `BASE_GATHER_AMOUNT=0.05`, `INTELLIGENCE_GATHER_SCALAR=0.005`

**A configuration starting from 100 founders now survives 30,000 ticks on every one of 24 seeds,
completing about 125 boom-bust cycles with a flat population trend. It is the longest horizon this
project has run, by nearly 4x, and the first non-extinct result at 100 founders. It is also not a
good place to live: the commons sits stripped 82% of ticks, 58% of person-ticks draw welfare, and 19
of 24 seeds read STRUGGLING.** The recipe is the narrow productivity band `[0.5, 2]` plus a commons
scaled to 3x the 100-founder default — that is, more resources *per founder*, not merely more
founders sharing the same pool.

**Two things in the existing record need correcting, and one measurement column is misleading.**
The narrow band alone at 100 founders looks like a rescue at 3,000 ticks (0/24 extinct) and is a
delay: at 30,000 ticks it loses 7 of 24. The extraction calibration in
`docs/research-extraction-need-ratio.md` does not transfer from 300 founders to 100 — transplanted
unchanged it kills every seed. And `min=`/"lowest population reached" is floored by the founding
population, so it reports ~100 for all 24 seeds of the good configuration, whose real troughs sit
near 221.

**Three independent attempts to make the surviving regime healthier all traded survival for health,
monotonically.** That is now the same trade from three directions and is the main open question this
study leaves.

## The horizon result: the narrow band alone is a delay

`docs/research-scale-robustness.md` (commit a805635, ARD 062) had the pin at 100 founders losing 31
of 48 seeds by 4,000 ticks. It no longer does — the heritability fixes of ARD 064/066 landed after
that measurement, and survival at 100 founders is now much cheaper. At 3,000 ticks, 24 seeds, default
commons:

| Config | Extinct | Peak pop | `bound%` | `good%` | Cycles |
|---|---|---|---|---|---|
| default | 24/24 | 969 | 4% | 0% | 0 |
| pinned productivity | 0/24 | 1546 | 71% | 19% | 11 |
| band `[0.5, 2]` | 0/24 | 1470 | 76% | 13% | 11 |
| band `[0.2, 5]` | 4/24 | 1411 | 75% | 6% | 10 |

Read at 3,000 ticks that is a survival result. It is not. The same band config at **30,000 ticks
loses 7 of 24**, and the deaths are spread evenly across the run — ticks 7,660 / 8,679 / 9,946 /
11,529 / 13,533 / 21,118 / 22,353. Evenly spread means a *constant hazard*, not a cliff the runs
walk off at some age: two of the seven died after tick 21,000, well past any horizon previously used
here.

The survivors are not declining toward that death. All 17 carry `STABLE-CYCLE`, run 113–128 cycles,
and finish with a population trend of 0.00 per 1,000 ticks. What kills a run is that each of ~120
troughs is an independent draw against zero. Back the rate out: 7 deaths over roughly 2,350
cycle-exposures is about 0.3% per trough, which over 118 cycles predicts ~70% survival against 17/24
observed.

**So extinction count at a fixed horizon is the wrong instrument for an oscillating regime — it
measures the horizon as much as the configuration.** Trough depth is the direct measure, and the
project's own `docs/research-productivity-band.md` said so without anything reporting it.

## Trough depth is what the commons scale buys

Scaling the commons to 3x at the *same* 100 founders (`NATURAL_RESOURCES_INITIAL=30000`,
`NATURAL_RESOURCE_CEILING_INITIAL=30000`, `MAX_NATURAL_RESOURCE_CEILING=60000`,
`NATURAL_RESOURCE_CEILING_FLOOR=6000`), band held at `[0.5, 2]`, 24 seeds, 30,000 ticks:

| | Small world | Big world (3x commons) |
|---|---|---|
| **Extinct** | **7/24** | **0/24** |
| `STABLE-CYCLE` seeds | 17/24 | **24/24** |
| Peak population | 1,574 | 4,481 |
| Cycles completed | 118 | 125 |
| Population trend per 1000 ticks | 0.00 | 0.00 |
| `bound%` (commons stripped) | 80% | 82% |
| `welf%` | 58% | 58% |
| `good%` | 6% | 10% |
| Runaway (`rnwy`) | 0/24 | 0/24 |

Measured trough depths (`scripts/trough-probe.ts`, 3 seeds, 6,000 ticks, ~25 cycles each):

| | Small world | Big world |
|---|---|---|
| Median trough | 56–68 | **220–223** |
| **Deepest trough** | **19, 24, 33** | **157, 183, 222** |

The deepest trough is the number that matters, and it goes from ~20 people to ~160. A population of
20 in this model is one unlucky draw from zero; 160 is not. Peak population scaled 2.8x from a 3x
pool — and note how tightly, 4,251–4,551 across 24 seeds, a ±3% spread that barely moved between
3,000 and 30,000 ticks. Carrying capacity here is a hard constant, consistent with
`docs/research-ceiling-pins-carrying-capacity.md`.

**Paired test verdict (24 seeds, 30,000 ticks per arm, 6,338s).** Both measures named beforehand
came back in the predicted direction, but read the first one carefully:

| Measure | Baseline | Treatment | Verdict |
|---|---|---|---|
| **Runs ending extinct** *(predicted)* | 7/24 | 0/24 | **PROBABLY REAL**, ~1 in 64 |
| **Lowest population reached** *(predicted)* | 18 | 104 | REAL, +89 per seed (85 to 99), <1 in 10,001 |
| Peak population | 1,575 | 4,481 | REAL, +2,858 (2,793 to 2,956), <1 in 10,001 |
| Population at the end | 159 | 869 | REAL, +582 (340 to 1,964), ~1 in 2,500 |
| Share of ticks with pool stripped | 80% | 82% | REAL, +2 points (1 to 15), ~1 in 500 |

**The extinction result is weaker than the raw counts suggest, and that is the point of running the
test.** 7 versus 0 looks overwhelming, but the arms disagree on only 7 seeds, and an exact McNemar
test on 7 discordant pairs all pointing one way cannot do better than about 1 in 64 however lopsided
they are. That is suggestive, not decisive. A confident call needs more seeds. This corrects the
expectation stated in the pull request that opened this study — that the paired test would be a
formality.

**The trough measure is floor-limited and under-reports.** Treatment median 104 is the founding
population, not a trough (see the measurement trap below); the true trough depths are ~60 against
~221. So +89 is a lower bound on an effect that is roughly +160.

**The commons got very slightly worse, not better.** +2 points of stripped-pool time is real but
tiny, and its range runs to +15. Scaling the world buys survival and population, not relief on the
commons.

Nothing else improved. `bound%` went *up* slightly, `welf%` is unchanged, `good%` is 10%. This is the
same Malthusian grind with 2.8x more people in it — about 500,000 births and 500,000 deaths per run.

## The measurement trap: `min=` is floored by the founding population

`sweep.ts` computes `minPop` over the whole history including the startup ticks, and `compare.ts`
computes its "lowest population reached" measure the same way. When a configuration's cycles hold
*above* their starting size, both report the founding population for every seed and stop
discriminating entirely.

This is exactly what happened here. The big world's `min=` column reads 99–109 across all 24 seeds —
a ±5% spread that looks like an extraordinarily tight trough floor and is in fact the founding
population of 100 showing through. Real troughs there are near 221. The small world's `min=` of 7–25
is genuine, because those troughs really do fall below 100.

The measure is therefore only valid while troughs sit *below* the founding population, and it
saturates silently rather than erroring. The paired tests in
`docs/research-extraction-need-ratio.md` that use it (43 → 134 and 33 → 119, both at 300 founders)
are unaffected, since every value there is below its founding population — but they are closer to the
floor than is comfortable, and any future use of that measure in a healthy regime will be wrong.
`scripts/trough-probe.ts` was written to replace it and drops the leading pivot for this reason.

## A second measurement trap: `compare.ts` was counting jitter as cycles

`compare.ts`'s "Boom-bust cycles completed" counted **every local maximum in the raw, unsmoothed
tick series** (`p > 20` and higher than its neighbours two ticks out), described in the code as a
"simple, threshold-free cycle proxy". It counted jitter. Worse, the jitter count *falls* as the
population grows, because a larger population is relatively less noisy tick to tick — so the measure
anti-correlates with population size.

Measured on one seed at 6,000 ticks, same data through both counters:

| | local-max count | `detectCycles` | Peak pop |
|---|---|---|---|
| Small world | 83 | 23 | 1,684 |
| Big world | 53 | 24 | 4,230 |

Inflated 2–4x, and **the sign reverses**: the proxy says the small world cycles far more, the real
detector says the two are level. That is exactly what the paired run above reported — "cycles
completed, baseline 388 against treatment 246, REAL DIFFERENCE, about 1 in 526" — a significance
verdict on an artifact, produced by the tool this project mandates for deciding whether two configs
differ. Fixed here: `compare.ts` now calls `detectCycles` with the same `Variables` thresholds as
`sweep.ts` and `classifyOutcome`, so the three cannot disagree about what a cycle is. The same
comparison now reads 23 against 24, TOO CLOSE TO CALL.

Both traps in this study have the same shape: a measure that looks meaningful, reports something
else, and fails silently. Neither errors, and both produced confident-looking output.

## The outcome tally measures where the clock stopped

This study's sweep tables report labels like `STRUGGLING x19 CYCLICAL x1 COLLAPSE x4`. That tally is
24 statements about which decade each run happened to end in, not 24 statements about how those runs
were doing. Demonstrated directly: seed 4 of the surviving configuration classifies **COLLAPSE** when
truncated at 6,000 ticks and **CYCLICAL** at 30,000 — the same seed, the same configuration, the same
trajectory, differing only in where the clock stopped. `good%` is the phase-robust figure and is the
one to quote; it reads 10% for the surviving configuration, against 6% for the small world.

`docs/calibration-guide.md` already documented this effect and `good%` already existed to correct
for it. What is new is the worked demonstration on a single seed, which is more convincing than the
prose and came out of generating an HTML report rather than from an experiment designed to find it.

## Three attempts at a clean run, all trading survival for health

### 1. The 300-founder extraction calibration does not transfer

`docs/research-extraction-need-ratio.md` identified "C1" — `BASE_GATHER_AMOUNT=0.028`,
`INTELLIGENCE_GATHER_SCALAR=0.0005`, mean extraction 1.54 against a `CONSUMPTION_BASE` of 1.0 — as
the healthiest configuration the project had measured, at 300 founders. Transplanted to 100 founders
with the band held and the per-founder commons ratio unchanged, it kills **24 of 24 seeds**: seven
dead before tick 550, median death at ~2,200, only one seed past 8,000.

The cause is legible in the columns: `bound% = 1%`. These populations starve with a **full pool** —
the failure mode `docs/research-thriving-reachability.md` recorded at low productivity. Seed 1 never
completed a cycle and ran at `popTrd = −10.71` per 1,000 ticks from the start.

**So the extraction cliff moves with founding population.** That study placed it between mean
extraction 1.16 (all dead) and 1.55 (all alive) and named 1.54 as the best point; at 100 founders
1.54 is *below* the cliff. A thin per-person margin needs enough founders to survive the startup
phase, and 100 is not enough. The doc presents those constants as a configuration rather than a
regime-specific calibration, which is how this was missed.

### 2. No sweet spot exists in the extraction level at 100 founders

Sweeping `BASE_GATHER_AMOUNT` with the flattened profile held (`INTELLIGENCE_GATHER_SCALAR=0.0005`),
band `[0.5, 2]`, default commons, 12 seeds, 10,000 ticks:

| `BASE` | Mean extraction | Extinct | Peak pop | `bound%` | `good%` |
|---|---|---|---|---|---|
| 0.034 | 1.84 | **12/12** | 1107 | 11% | 0% |
| 0.040 | 2.14 | 11/12 | 1151 | 8% | 0% |
| 0.046 | 2.44 | 10/12 | 1239 | 23% | 0% |
| 0.055 | 2.89 | 7/12 | 1339 | 43% | 3% |
| 0.065 | 3.39 | 5/12 | 1398 | 50% | 32% |
| 0.0745 | 3.86 | 4/12 | 1440 | 55% | 35% |

Monotone across the whole range, with survival still improving at the top. There is no interior
optimum to find: at 100 founders the best extraction level for survival is the default one.

### 3. Flattening the profile is healthier and more fragile

The top row above is a controlled comparison worth separating out. At essentially the same mean
extraction as default (3.86 vs 3.88), moving weight off the intelligence term onto the flat term
gives a **healthier** society (`bound%` 55% vs 80%, `good%` 35% vs 6%) and a **more fragile** one
(4/12 dead by tick 10,000 against 3/24 for the default profile at the same horizon). Small samples on
both sides, and this was not taken to `compare.ts`, so treat the direction as suggestive rather than
established — but it is the third instance of the same trade and the only one where the mean is held
fixed.

## What the pattern suggests

Every lever that spared the commons did so by shrinking the population, and a smaller population in
this model sits closer to its own noise floor. Health and survival traded against each other in
both world sizes, at fixed mean extraction, and across a six-point dose-response. The two previously
documented instances point the same way: `docs/research-extraction-need-ratio.md` found its
healthiest configuration was not its safest, and `docs/research-escape-velocity.md` found the runs
that looked healthiest were the ones that died.

The likely reason is structural rather than a calibration miss. Nothing in the model brakes a boom
before the pool empties — `GatherResourcesEvent` is unconditional and uncapped by need, and fertility
does not respond to scarcity — so the only mechanism that ever limits population is starvation after
the commons is already gone. A lever that reduces extraction does not add a brake; it lowers the
ceiling the same broken brake eventually enforces. If that reading is right, no setting of the
existing constants produces a clean run, and the missing piece is a feedback that responds to
scarcity *before* exhaustion. That is a mechanism proposal, so it is logged in
`docs/future-ideas.md` rather than built here.

## Reproducing the surviving configuration

```bash
npx ts-node scripts/sweep.ts --seeds 24 --ticks 30000 --persons 100 --workers 4 --verbose \
  --set NATURAL_RESOURCES_INITIAL=30000 --set NATURAL_RESOURCE_CEILING_INITIAL=30000 \
  --set MAX_NATURAL_RESOURCE_CEILING=60000 --set NATURAL_RESOURCE_CEILING_FLOOR=6000 \
  --set EXTRACTION_PRODUCTIVITY_FLOOR=0.5 --set MAX_EXTRACTION_PRODUCTIVITY=2
```

About 100 minutes on four cores. The trough measurement is far cheaper and is the more sensitive
instrument:

```bash
npx ts-node scripts/trough-probe.ts --seeds 3 --ticks 6000 --persons 100 --set …
```

## Unverified: inequality tracks cycle phase, not population size

One seed, parsed out of a report log rather than measured by a designed experiment, so this is an
observation to test rather than a result. Across 3,000 decades of seed 4, median adult Gini binned
by population level **and** direction of travel:

| Population (% of peak) | Growing | Shrinking |
|---|---|---|
| 0–10% | 0.325 | 0.220 |
| 10–20% | 0.410 | 0.210 |
| 20–40% | 0.400 | 0.490 |
| 40–60% | **0.210** | **0.670** |
| 60–80% | **0.110** | **0.550** |
| 80–100% | 0.150 | 0.370 |

At matched headcount in the upper half of the range, a population on the way up sits at Gini
0.11–0.21 and one on the way down at 0.55–0.67 — three to five times the inequality with the same
number of people. Straight correlation between population and Gini across the run is **+0.035**,
i.e. nothing, which is what to expect if the operative variable is phase rather than scale.

If it holds across seeds it is a mechanical explanation for the project's standing open question
(`docs/research-inequality-signal.md`, and the first paragraph of `CLAUDE.md`): `peakGini` is a
maximum taken over the decline phase, and every configuration declines, so the statistic asks "did
this run ever crash" — which they all did — rather than anything that separates them. Caveats: one
seed, the 20–40% band inverts the pattern, and the bands are not equally populated. Worth a designed
run across seeds with the measure named in advance.

## What this does not establish

The 30,000-tick horizon is 3.75x the previous longest run here, and 0/24 is a flat curve across a 10x
horizon range (3,000 to 30,000). It is not proof of indefinite survival: the small world also read
0/24 at 3,000 and its hazard only became visible at 7,660. A constant per-trough hazard below the
resolution of 24 seeds x 125 cycles would look exactly like this. What can be said is that the hazard
is at least an order of magnitude lower than the small world's, and that the mechanism behind the
difference — an 8x deeper worst-case trough — is measured rather than inferred.

The health-versus-survival trade is a consistent direction across three experiments, not a tested
claim. None of the three was taken to `compare.ts`; the flattened-profile comparison in particular
rests on 12 seeds against 24 at a single horizon, and its arms differ by a factor of two in sample
size. The one paired test run here is the commons-scale one, and even its headline measure came back
PROBABLY REAL rather than REAL — 24 seeds is not enough to settle a 7-versus-0 extinction gap.
