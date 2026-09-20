# Calibration guide

Read before running a sweep. Covers what the harness measures, which columns to trust, and what tuning can and can't achieve in this model.

## Sweep harness (`scripts/sweep.ts`)

For calibration: runs the tick loop in-process across many seeds and aggregates, instead of hand-running configs one at a time. Per sweep value it prints the outcome distribution (`STABLE×2 COLLAPSE×1 …`, five labels since ARD 063: `EXTINCTION`/`COLLAPSE`/`STRUGGLING`/`CYCLICAL`/`STABLE`), median end/peak population, median peak Gini, `bound%` (share of ticks the commons pool sits below 5% of its ceiling — i.e. how often resources bind), `orph%` (median across seeds of each run's orphan share of children pooled over every tick — **this is the orphan number to read**) and `orphPk%` (median across seeds of each run's *worst single tick*; **distrust it**, it is a max-of-noise statistic in the same class as `peakGini` — at a cycle trough the child population falls to a handful, so one orphan reads as 100%, and the best-known config reports `orph% 0.2` against `orphPk% 100`; see `docs/research-productivity-band.md`), `welf%` (median share of person-ticks drawing welfare), extinction count, `good%` (below), cycle metrics from `CycleDetector` — `cyc` (median boom-bust oscillations per series) and `stable` (count of seeds showing a sustained, non-collapsing cycle) — and two growth metrics from `GrowthDetector` (below). `--verbose` rows add `cyc`/`per`(iod)/`trTrend`, a `STABLE-CYCLE` marker, the per-run growth figures, and a `why:` line giving `explainOutcome`'s rationale — **which classifier gate actually fired**. Read that line before theorising: in the scaled-commons regime the same run reads CYCLICAL or STRUGGLING depending on whether the clock stopped in a peak decade (`commons 0% full`) or a trough decade (`commons 46% full`), and the `why:` line is what makes that visible instead of looking like a config difference. Since ARD 063, `cyc`/`stable` are not just descriptive: the same `detectCycles` call feeds `classifyOutcome` directly, so a seed marked `STABLE-CYCLE` is exactly the population-trajectory condition behind a `CYCLICAL` label — one definition of "cycling", not two.

### The label depends on when the clock stops (`good%`)

`classifyOutcome` reads the **final decade**, so in an oscillating regime the label is partly a
statement about where in the cycle the run was truncated. Measured directly: in the scaled-commons
regime the same run reads `CYCLICAL` when the clock stops in a trough decade (commons refilled to
46%) and `STRUGGLING` when it stops in a peak decade (commons stripped to 0%) — the `--verbose`
`why:` lines show this happening across seeds of one configuration.

`good%` is the phase-robust version. It re-classifies the same run at each of the last 30 decade
boundaries — about one full cycle period here — and reports the share that read `CYCLICAL` or
`STABLE`. A configuration genuinely in a good state scores high across the whole cycle; one that
merely stopped in a flattering decade does not. Prefer it to the outcome tally whenever `stable` is
non-zero, and note that the tally and `good%` disagreeing is information, not noise: it means the
label is phase-driven.

This generalises the hand-done probe in `docs/research-scale-robustness.md`, which re-classified two
seeds at 27 stopping points and found COLLAPSE×20 STRUGGLING×7 and COLLAPSE×19 STRUGGLING×8 for runs
whose single end-of-run labels were COLLAPSE and STRUGGLING respectively.

### Is anything running away? (`GrowthDetector`)

Two sweep columns answer the question the outcome labels and the cycle detector both miss: whether a
run was still exploding when the clock stopped. `popTrd` is the population's end-to-end log-growth
per 1000 ticks — 0 means the run finishes where it started, +0.69 means it doubled over 1000 ticks,
−0.69 means it halved. `rnwy` counts seeds where *any* tracked series (population, resource ceiling,
extraction productivity, mean personal resources) is still growing exponentially at the end after a
≥10× rise.

**`rnwy` above zero disqualifies a result rather than decorating it.** A run that ends mid-explosion
has end-state numbers that describe where you truncated it, not what the configuration does — the
same trap as judging a delaying config at a short horizon, one level up. The most likely way to trip
it is `INVENTION_CEILING_GROWTH_*`: technology lifting carrying capacity is exactly the shape of an
unbounded ratchet.

What `rnwy` is deliberately *not*: an alarm for booms. A boom-bust population grows exponentially
inside every boom, so the per-run `exp=` figure in `--verbose` sits around 20–40% in any cycling
regime and means nothing is wrong. Runaway requires sustained growth **end to end**, a large fold
increase, **and** still growing at the end — all three, because each alone has a benign reading. The
thresholds are documented options on `detectGrowth` (`src/Helpers/GrowthDetector.ts`); the detector
is measurement tooling only and does not feed `classifyOutcome`, exactly as `CycleDetector` did not
before ARD 063.

Two narrower probes sit alongside it: `npx ts-node scripts/gini-decomp.ts` splits `resourceGini` into all-living vs adults-only at a few horizons, and `npx ts-node scripts/gini-basis-probe.ts` dumps both bases per decade as TSV for calibration work. `npx ts-node scripts/throughput-probe.ts --sweep KEY=v1,v2,… --seeds 24` reports median cumulative **births** next to median peak population, which the sweep table does not — use it whenever a lever reads as a null, because "the lever is inert" and "the lever works and the commons absorbs it" are indistinguishable in `sweep.ts` output and mean opposite things (see `docs/research-untested-variables.md`). `scripts/thrive-probe.ts` measured gates for the retired THRIVING label and was removed with it (ARD 063).

**`min=` and "lowest population reached" are floored by the founding population — prefer
`scripts/trough-probe.ts`.** Both scan the whole history including the startup ticks, so once a
configuration's cycles hold *above* their starting size, both report the founding population for
every seed and stop discriminating. This is not hypothetical: in
`docs/research-clean-long-run-100-founders.md` the surviving 100-founder configuration reports
`min=` 99–109 across all 24 seeds, which reads like an extraordinarily tight trough floor and is
just the starting 100 showing through — its real troughs sit near 221. The column is valid only
while troughs fall below the founding population, and it saturates silently rather than erroring.

```bash
npx ts-node scripts/trough-probe.ts --seeds 3 --ticks 6000 --persons 100 [--set KEY=VAL] [--tsv]
```

It finds the population series' local minima, drops the leading pivot (the founding population,
not a cycle trough), and reports the deepest, median and shallowest trough per seed. **The deepest
trough is the number that predicts extinction** in an oscillating regime: a run dies when one cycle
happens to bottom out at zero, so extinction count at a fixed horizon measures the horizon as much
as the configuration. The same study makes the case — a config reading 0/24 extinct at 3,000 ticks
lost 7 of 24 by 30,000, with deaths spread evenly from tick 7,660 to 22,353 (a constant per-trough
hazard, not a cliff), while trough depth separated the two arms immediately and cheaply.

`npx ts-node scripts/flow-probe.ts --seed 1 --ticks 2000 --persons 300 --metric net [--set KEY=VAL] [--tsv]` prints the per-person **distribution** of resource flow as box-and-whisker rows, one per decade. Every other resource figure in the model is a mean or a sum (`TickSnapshot.totalConsumption` is a per-tick total, `TenYearSummary.avgResources` a mean of means), so `resourceGini` was the only spread statistic anywhere — one scalar. Four metrics: `extract` (per-tick extraction capacity), `consume` (per-tick living cost), `net` (the difference), and `hold` (resources in hand, which is what Gini compresses). The `under` column is the share of people whose extraction capacity is below their own living cost.

**`extract` is potential, not realised.** `GatherResourcesEvent` takes `min(output, naturalResources)`, so once the pool is stripped the realised figure is lower and order-dependent. Read the `pool` column alongside it: at a full pool potential ≈ realised, at an empty one potential wildly overstates what anyone actually got. This is not a detail — it inverts the comparison. At default extraction the `under` share reads 0–6% while the pool sits at 0%, which means almost nobody is short *on paper* and almost everybody is short in fact; under the cut-extraction config of `docs/research-extraction-need-ratio.md` the pool stays 60–99% full, so its much worse-looking 36–83% `under` share is close to the truth while the baseline's is not. Realised per-person extraction would need `GatherResourcesEvent` instrumented to record it, which is a model change and needs an ARD first.

`npx ts-node scripts/escape-velocity.ts --seeds 24 --ticks 3000 --horizon 1500 --search --emit FILE` asks the forward-looking question the outcome labels cannot: is there a state a run can reach and thereafter be safe? It samples state every `--stride` ticks across several config arms, takes each run's **first** crossing of a candidate level (one observation per run — landmark rows inside a run are correlated, and pooling them fakes a 70× larger sample), and reports how many of those runs were still alive and un-collapsed `--horizon` ticks later, with a Wilson 95% floor. `--sustain K` requires the level to hold for K consecutive landmarks, `--floor N` drops landmarks below N people, `--only ARM` restricts to one arm, and `--analyze FILE` re-runs any of that against emitted data for free. Three things it is easy to get wrong and the flags exist to prevent: **without `--floor` the top of every scale is a death rattle** (four people left means a 100%-full commons and a zero Gini); **a gate that fires on one arm has learned the config, not the state**, which the printed confusion matrix is there to expose; and **a `--search` winner is selected on its sample**, so re-run it on held-out seeds — in `docs/research-escape-velocity.md` that step turned a perfect record into a 1-in-8 failure rate.

```bash
npm run sweep -- --ticks 300 --sweep BASE_CHILDBIRTH_RATE=0.2,0.3,0.4   # sweep one Variables constant
npm run sweep -- --seeds 20 --set MAX_NATURAL_RESOURCE_CEILING=12000 --verbose  # fixed overrides + per-seed detail
```

Options: `--seeds 42,7,1` (or a single `N` → seeds 1..N; default 1..8), `--ticks`, `--persons`, `--set KEY=VAL` (repeatable Variables override), `--sweep KEY=v1,v2,…` (one sweep dimension), `--verbose` (per-seed rows with cause-of-death split). Always calibrate in a regime where the bounding feedbacks fire — see `docs/research-fertility.md`. Overrides are checked against the cross-constant invariants in `Variables.validate()` before a run starts, so a `--set` that breaks one aborts with an explanation instead of producing plausible-looking numbers: sweeping `ESTATE_COMMUNITY_SHARE`, `ESTATE_PARTNER_SHARE` or `ESTATE_CHILDREN_SHARE` alone used to silently create or destroy resources on every death, and now fails loudly. Sweep all three together if you mean to move them.

### Watching, and safely stopping, a run in progress

`sweep.ts` and `compare.ts` print nothing until the last job lands, so a long run used to be opaque
while it worked and a total loss if it was killed — an 80-minute sweep that died at minute 79
produced no rows at all. Both now publish a snapshot after every completed job.

```bash
npm run progress                 # how far along, what finished, eta
npm run progress -- --stop       # ask the run to stop and report what it has
npm run sweep -- --port 9876 …   # also serve the snapshot at http://127.0.0.1:9876 (/json for raw)
```

The status file (`.run-progress.json`, gitignored; override with `--status PATH`) and the port answer
different questions. The file is up to ten seconds stale but **outlives the process**, so a killed
run still leaves every row it finished. The port is always current and dies with the process. The
file is written unconditionally; `--port` is opt-in, because two concurrent sweeps would collide on
one port.

`--stop` sends SIGINT to the pid recorded in the file, which is also the safe way to end a run: it
signals one exact process rather than matching a pattern that can also match your own shell. The
harness finishes its in-flight jobs, prints a table covering only the seeds that completed, and
exits zero.

Stopping works even when a job is the thing that is stuck. Workers only notice the stop request
between jobs, so a runaway configuration that holds one for hours would otherwise leave the parent
hanging on open channels with the workers still burning CPU. Aborted workers get two seconds to
leave on their own and are then killed; their results were being discarded anyway.

A run that dies without finishing — killed, crashed, or cut off with its terminal — leaves a file
that would otherwise read as still working forever. `npm run progress` checks whether the recorded
process still exists and says `DIED without finishing`, with how far it got, so a corpse is never
mistaken for a slow run.

**Read a stopped run's table carefully.** Every count is denominated in the seeds that actually
finished, so `3/5` from an interrupted run means three of five *completed* seeds, not three of the
twelve requested. A partial sweep is fine for deciding whether a configuration is worth pursuing and
is not a result — take it to `compare.ts` at full seed count like any other sweep output. `compare.ts`
reports progress but has no stop path on purpose: half of one arm cannot be paired against all of
the other, and a half-paired test is worse than no test.

## Deciding whether a difference is real (`scripts/compare.ts`)

`sweep.ts` prints medians and counts; deciding whether two of them differ has, until now, been done
by eye. That is how several claims in this project's history were published and later failed to
reproduce. Use this instead of eyeballing:

```bash
npx ts-node scripts/compare.ts --seeds 48 --ticks 2000 --b BASE_CHILDBIRTH_RATE=1.0
npx ts-node scripts/compare.ts --seeds 48 --ticks 2000 --both TAX_RATE=0.1 --a X=1 --b X=2
```

`--a` sets the baseline arm, `--b` the treatment, `--both` a background config shared by each
(repeat any of them). Both arms' runs go into one pool of forked workers (`--workers N`, default CPU
count), so a comparison uses every core; the runs are independent and seeded, so which worker takes
which job cannot change a result. It reports six measures — runs ending extinct, peak population, final
population, lowest population reached, cycles completed, and share of ticks with the pool stripped —
each with a verdict of REAL DIFFERENCE, PROBABLY REAL, or TOO CLOSE TO CALL, the size of the typical
per-seed change, and a plausible range for that size.

**Both arms run the same seeds, and the comparison exploits that.** Run 7 of the baseline and run 7
of the treatment share a starting population and random stream, so they are twins and are compared
against each other rather than against the other arm's median. This cancels seed-level luck and is
much more sensitive than comparing two medians — it is why the tool can resolve effects that a
sweep table cannot. Yes/no measures use an exact McNemar test on the runs where the arms disagree;
measured quantities use a sign-flip permutation test with a bootstrap range. The machinery is in
`src/Helpers/Statistics.ts`, unit-tested against textbook values, and calibrated: fed pure noise
2,000 times it raises a false alarm 5.8% of the time against a 5% target.

**Read the three things it tells you, in this order.** The *range* first — if it spans zero, the
direction is unsettled no matter what the verdict says. Then the *size* — a real difference can still
be too small to care about. The verdict last. A verdict without a size is how you end up chasing an
effect that is real and useless.

**TOO CLOSE TO CALL is not "no effect."** The tool says how many seeds would have been needed to pin
down a gap of the size observed, so an inconclusive result can be reported honestly as "too small to
tell with 48 runs" rather than as a null. Use that number to size the next sweep before running it.

**Six measures are compared at once, so about one run of this tool in four will throw up a false
alarm when nothing truly differs.** A measure you predicted in advance is much stronger evidence than
the one surprising row in an otherwise flat table. The tool prints this reminder itself.

Validated three ways before being trusted: identical configs on both arms find nothing; a variable
independently measured as inert (`ELDERLY_IDLENESS_DECAY`) finds nothing and correctly reports the
direction as unsettled; and a known-large effect (fertility with the productivity band pinned, 23 of
48 runs extinct against 1 of 48) is called decisively.

## Trust the columns unevenly

**Treat the `peakGini` column with suspicion (see `docs/research-gini-metric.md`).** Open hypothesis, not settled: per-tick instrumentation suggests `peakGini` is attained during the terminal crash at populations of ~10–30, making it a max-of-noise statistic that reads 0.79–0.89 almost regardless of configuration — missing a monotone `TAX_RATE` effect and manufacturing an apparent `CONSUMPTION_ELDER_MULTIPLIER` one. The same study puts the resolution limit at ~±0.05 mature-phase Gini at 10 seeds, which most single-lever effects fall inside. `npx ts-node scripts/metric-probe.ts` re-measures a sweep under alternative Gini statistics; its metric is itself unvalidated, so use it to cross-check a Gini claim, not to replace the harness.

## How to think about tuning

**(See `docs/research-tuning-defaults.md`. )** The model is a *terminal one-shot overshoot*: population booms once to a single peak, then crashes through to extinction. This reframes what a sweep can and can't show:

- **Judge configs at 2000 ticks, not 800.** Short-horizon "outcome variety" is an artifact of measuring the population *mid-overshoot*, before the universal crash. A config that reads `STRUGGLING×8` at 300 ticks can be 16/16 EXTINCTION by 800 (`BASE_INVENTION_RATE=0.01` does exactly this). *Updated 2026-09-14 (`docs/research-sweep-session-2026-09-14.md`): **800 ticks repeats this error one level up.** At 48 seeds, `BASE_INVENTION_RATE=0.03` reads 39/48 extinct at 800 against the default's 46/48 — an apparently real rescue — and is 48/48, exactly equal to default, by 2000. Any config whose benefit is **delay** reads as **rescue** at a horizon shorter than the delay it buys. Default hits total extinction at 1200 ticks; the only configs with survivors at 2000 are the productivity ones, and even they decay exponentially (~15% of survivors lost per 400 ticks, no flattening).* **Prefer the extinction-vs-horizon curve (800/1200/1600/2000) to any single-horizon count** — a genuinely different config has a curve that flattens, a delaying one keeps climbing to 48/48, and that difference is invisible at any one horizon.
- **`stable`/`cyc` is the signal for "sane," not the outcome tally.** A genuinely sane default needs a meaningful fraction of seeds in *sustained cycles* at the long horizon. `stable=0` was long the norm across the explored parameter space; the exceptions were thought to be high `BASE_INVENTION_RATE` (≈ 6/16 at 800t), a strong anti-Allee fertility probe (≈ 3/16), and — since ARD 059 — the **default config itself**. *Re-measured 2026-09-14 (`docs/research-sweep-session-2026-09-14.md`): the invention exception does not survive power — at 48 seeds it is 6/48 (12.5%) against a matched 48-seed default control's 2/48 (4.2%), p=0.27, so it is **not** demonstrably above default; its 800-tick extinction benefit (95.8% → 81.2%) does not hold either — at 2000 ticks invention is 48/48 extinct, identical to default, so it only delays. The anti-Allee 3/16 rests on the same n=16 basis and has never been re-measured. `stable` is also **not horizon-stable**: on the productivity pin at 48 seeds it decays 18/48 → 16/48 → 8/48 → 4/48 across 2000/3500/5000/8000 ticks, so `stable=18/48` means "18 seeds have not yet rolled badly," not "18 seeds found equilibrium" — two `stable` figures are comparable only at equal ticks (`docs/research-untested-variables.md`). **At n=16 a 3-seed swing is p ≈ 0.46, so treat any `stable` claim from 16 seeds as unmeasured** — assume no lever has an established `stable` effect until re-run at 48+ seeds, and prefer continuous per-run measures (trough depth, `cyc`, peak-relative decline) where possible.* All still leave the majority extinct. The default's figure was 2/16 and 3/32 at 800 ticks; re-measured after ARD 060/061 it is **0/16 and 1/32** (the pre-change numbers reproduce exactly on the parent commit, so the comparison is sound). 3/32 versus 1/32 is inside binomial noise, so this is not established as a regression — but do not lean on the default having a sustained-cycle property without re-measuring at more seeds.
- **The ARD 059 exception came from fixing an error, not from tuning, and that is the important part.** The fertile window used to end at age 38 because a constant encoded a wrong fact about human biology, not because anyone had chosen a pessimistic value. Correcting it moved `stable` off zero. Nobody has systematically audited the remaining constants against their real-world referents, and the one time anyone looked they found a load-bearing error — so treat "the model collapses" as partly an open question about the constants, not a settled property. Before concluding that a pessimistic result is a finding, check whether it rests on a number that is simply wrong.
- **`extractionProductivity` drifts down ~3× over a long run, and every sweep inherits it.** ARD 047 made the faster/slower invention steps exact inverses, but the band `[0.01, 10]` is log-asymmetric around the starting 1.0, so the reflected walk's stationary median is ≈0.32 (`P(prod < 1) ≈ 0.65`). Gather output is linear in productivity, so long-horizon runs are systematically poorer than the calibration intends — a run can starve to death with the commons at 100% of ceiling. Pinning it is the single change that flips the thriving-existence config from THRIVING to EXTINCTION. Until this is decided, read any long-horizon result as partly a draw from that walk. See `docs/research-thriving-reachability.md`.
- **Extraction per person is the overshoot dial, and it had never been swept.** *(2026-09-19, `docs/research-extraction-need-ratio.md`.)* `GatherResourcesEvent` is unconditional and uncapped by need: a person extracts ~3.9/tick at defaults against a `CONSUMPTION_BASE` of 1.0, while the pool regenerates a fixed 900/tick. Consumption alone would support ~900 people; the pool empties at ~230 extractors. So a population overshoots its sustainable size ~4× before extraction is rationed at all, and the only brake that engages is starvation after the pool is gone. Cutting `BASE_GATHER_AMOUNT`/`INTELLIGENCE_GATHER_SCALAR` together is monotone in every health measure down to a **cliff at roughly 1.35× consumption**, below which an average person cannot cover costs and every seed dies. Better still, at a *fixed* mean, moving weight off the intelligence term onto the flat term halves the commons strain again (23% → 11% of ticks stripped): what drives the damage is the spread in who can extract, not the average. Two cautions. `welf%` is not comparable across configurations that change the resource scale — cutting extraction lowers steady-state holdings toward a `WELFARE_THRESHOLD` that has not moved, so the column falls for a units reason. The effect survives crowding — at 1000 founders with the commons scaled to match, trough population goes 186 → 1046 and commons strain 41% → 24%, both real — which is the test that broke `EXPERIENCE_CAP` and `HAPPINESS_BASELINE`. And the healthiest configuration measured is **not** the safest: on paired seeds at 8000 ticks it reads 3/24 extinct against the baseline's 0/24 — not established at 24 seeds (~55 would settle it), but consistent across two independent seed sets and certainly not an improvement.
- **Carrying capacity is pinned by `MAX_NATURAL_RESOURCE_CEILING`, not grown by invention.** *(2026-09-20, `docs/research-ceiling-pins-carrying-capacity.md`.)* With extraction productivity pinned, every invention takes the ceiling-growth branch and compounds, so the ceiling reaches its cap at **tick 6–8** and stays there for 97–98% of a 3000-tick run. Any study that reads the ceiling as a dynamic quantity is reading a constant. The practical consequence for sweeps: raising `MAX_NATURAL_RESOURCE_CEILING` raises the population the model settles at almost proportionally, so a config compared across different caps is not comparing the thing you think it is — check the cap before attributing a population difference to anything else.

- **No single constant fixes overshoot→extinction; the fix is structural.** The tell that you're at this limit: bigger inputs (regen, ceiling, fertility, invention) buy a *bigger boom*, not stability. Don't chase a magic constant — long-run persistence needs a new mechanism (crash recovery / anti-Allee), not recalibration. So tune constants for *short-horizon outcome variety* (the current `BASE_CHILDBIRTH_RATE=0.6` rationale), and don't expect long-run stability from recalibration alone. "Out of reach" is a statement about the levers tried so far, not a ceiling: the structural piece (crash recovery) is unbuilt, the constants are unaudited, and the metrics are partly unvalidated. Given the project's goal is to find thriving, treat that gap as the main work rather than as a settled result. *Partial update, 2026-09-14 (`docs/research-sweep-session-2026-09-14.md`): removing `extractionProductivity`'s variance changes the failure mode without fixing it. Seeds that never oscillate at all drop from 10/16 to 3/16 and survivors run 5+ cycles, but the troughs bottom out at a median of **10 people**, giving a ~7% extinction hazard per cycle — 17–19% of surviving seeds die per 700 ticks in both productivity configs, with no sign of decaying. So it converts one-shot overshoot into repeated near-miss cycling at 41–61% `bound%`, not stability, and no config here is a candidate default. Useful corollary for the crash-recovery item: the mechanism needs to bite at populations of 5–20, and trough depth is the metric to calibrate against.* *Update, 2026-09-15 (`docs/research-scale-robustness.md`): **one combination does stop the extinction, and it is the trough-depth prediction above coming true.** Scaling all four commons constants with the founding population (300 founders, 30k/30k/60k/6k) **and** pinning productivity gives 0 of 24 seeds extinct at 3000 ticks and still 0 of 24 at 8000, across 687 completed cycles — the first config whose extinction-vs-horizon curve is flat instead of climbing. The reason is trough depth: cycles bottom out at a median of 32 people against the 10 of the 100-founder pinned regime, cutting the per-trough hazard from about 7% to under 0.44%. This narrows "the fix is structural" rather than overturning it — no *single* constant does it, the two families together do, and **it still is not thriving**: `classifyOutcome` reads COLLAPSE×21 STRUGGLING×3, `bound%`=39%, `welf%`=48% (inequality is *not* the problem here — the 0.57–0.59 in the sweep table is `peakGini`; the final-decade adult Gini the classifier reads medians 0.35). Read it as the first non-collapsing regime to calibrate *from*, not as a proposed default. **Open question against the escape-velocity item below: nothing was run past 8000 ticks. Extinction is absorbing, so 0/24 at 8000 does mean the curve is flat over the whole 0–8000 range — but `pin+fertility` read a clean 0/24 at both 1500 and 3000 before losing runs at 4500, so treat this as "has not died inside 8000 ticks" rather than "does not die" until a longer run says otherwise.*** *Answered in part, 2026-09-20 (`docs/research-clean-long-run-100-founders.md`): a run to **30,000 ticks** — 3.75x the longest previously run here — holds 0/24 at **100** founders with a bounded band `[0.5, 2]` and the commons scaled 3x, so the flat curve survives a 10x extension of the horizon and neither the 300-founder scale nor the pin is required. The caution above was right to insist on it: the **unscaled** 100-founder arm read 0/24 at 3,000 and lost 7 of 24 by 30,000, first death at tick 7,660. Trough depth again explains both — ~221 in the scaled world against a worst case near 20 in the unscaled one. Still not proof of indefinite survival: a per-trough hazard below the resolution of 24 seeds x 125 cycles looks exactly like this.*
- **A healthy-looking run is not a safe run — at defaults it is the opposite.** *(2026-09-17, `docs/research-escape-velocity.md`.)* Inside the productivity-pinned arm, the only arm that produces both survivors and deaths, the runs that went extinct had reached **higher** values than the survivors on all nine measured quantities: population, commons fill, ecological surplus, equality, happiness, peak-proximity, employment, fertile share and productivity. Reproduced on two independent 24-seed sets. The survivors sit at a 3% median commons fill and a third of the doomed runs' population — they live because they never got big enough to overshoot. Pooled across arms, extraction productivity above 1.38 was reached by 53 runs and killed all 53, and runs crossing 2,563 people held up 9% of the time against 30% for runs crossing 1,043. Practical consequence when reading any mid-run state: population, commons fill and happiness are **descriptions of the present, not forecasts**, and a config that looks better mid-run is not thereby better. Judge on the extinction-vs-horizon curve, not on how good the peak looks.
- **"Still alive at the end" is not "escaped", even at 3000 ticks.** Same study: of the `pin` runs alive at tick 3000, **38% were dead by 6000** (extinctions at ticks 3264, 3575, 4723), and `pin+fertility` — 0/24 extinct at 3000 — loses its first runs at 3056 and 3778. The extinction curve runs 11 → 16 → 18 → 19 of 24 across 1500/3000/4500/6000 with no flattening. Both `pin` and `pin+fertility` here are at the default (unscaled) commons — this has not yet been run against the scaled-commons cell above, which is the one candidate for genuine escape on record; see the open question in that bullet.
- **Test per-capita levers in a regime where the commons does not bind, or the result means nothing.** *(2026-09-14, `docs/research-untested-variables.md`.)* At default settings, raising `BASE_CHILDBIRTH_RATE` 0.6 → 1.0 moves peak population −0.8% and leaves 48/48 extinct; under the productivity pin the same change gives 1/48 extinct at 2000 ticks and 6/48 at 8000 (Fisher p=7e-15), cutting the hazard from ~24% to ~2% per 1000 ticks. `HAPPINESS_BASELINE` (34% more births, 0% more population at defaults; 23/48 → 7/48 under the pin) and `EXPERIENCE_CAP` (23/48 → 11/48) repeat the pattern. The pool caps the population regardless of how many people are born or how much each can extract, so *any* fertility, production or human-capital constant will read as a null at defaults — including ones that are decisive. This does not overturn "no single constant fixes overshoot→extinction" (the hazard stays constant and positive in every arm; nothing reaches equilibrium), but it does mean a default-regime null is evidence about the regime, not about the lever. Sweep per-capita constants under the pin as well as at defaults, and report both. *Updated 2026-09-15 (`docs/research-scale-robustness.md`): two of those three under-the-pin results are conditional on the horizon and the founding population, and both were re-confirmed at the original settings first, so this is the conditions and not drift. `BASE_CHILDBIRTH_RATE` holds everywhere (31/48 → 4/48 at 4000 ticks; 21/48 → 6/48 at 300 founders). `EXPERIENCE_CAP=200` does not: 23/48 → 11/48 at 2000 ticks becomes 31/48 → 21/48 at 4000 (needs 86 seeds) and 21/48 → 21/48 at 300 founders — it bought delay. `HAPPINESS_BASELINE=10` survives the longer horizon (31/48 → 14/48) but not the crowding (21/48 → 18/48, needs 966 seeds). So the pin unbinds the commons **for 100 founders**; state the founding population alongside any result measured under it, and prefer 4000 ticks to 2000 for an under-the-pin extinction claim.*
