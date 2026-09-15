# Calibration guide

Read before running a sweep. Covers what the harness measures, which columns to trust, and what tuning can and can't achieve in this model.

## Sweep harness (`scripts/sweep.ts`)

For calibration: runs the tick loop in-process across many seeds and aggregates, instead of hand-running configs one at a time. Per sweep value it prints the outcome distribution (`STABLE×2 COLLAPSE×1 …`), median end/peak population, median peak Gini, `bound%` (share of ticks the commons pool sits below 5% of its ceiling — i.e. how often resources bind), `orphPk%` (median across seeds of each run's worst single-tick orphan share of children; the run-pooled mean shows in `--verbose` as `orph=`), `welf%` (median share of person-ticks drawing welfare), extinction count, and cycle metrics from `CycleDetector` — `cyc` (median boom-bust oscillations per series) and `stable` (count of seeds showing a sustained, non-collapsing cycle). `--verbose` rows add `cyc`/`per`(iod)/`trTrend` and a `STABLE-CYCLE` marker.

Two narrower probes sit alongside it: `npx ts-node scripts/thrive-probe.ts --ticks 800 --decades [--set K=V]` prints the four ARD-051 outcome dimensions per decade and names which THRIVING gate a run misses (the sweep harness only reports the label); `npx ts-node scripts/gini-decomp.ts` splits `resourceGini` into all-living vs adults-only at a few horizons, and `npx ts-node scripts/gini-basis-probe.ts` dumps both bases per decade as TSV for calibration work. `npx ts-node scripts/throughput-probe.ts --sweep KEY=v1,v2,… --seeds 24` reports median cumulative **births** next to median peak population, which the sweep table does not — use it whenever a lever reads as a null, because "the lever is inert" and "the lever works and the commons absorbs it" are indistinguishable in `sweep.ts` output and mean opposite things (see `docs/research-untested-variables.md`).

```bash
npm run sweep -- --ticks 300 --sweep BASE_CHILDBIRTH_RATE=0.2,0.3,0.4   # sweep one Variables constant
npm run sweep -- --seeds 20 --set MAX_NATURAL_RESOURCE_CEILING=12000 --verbose  # fixed overrides + per-seed detail
```

Options: `--seeds 42,7,1` (or a single `N` → seeds 1..N; default 1..8), `--ticks`, `--persons`, `--set KEY=VAL` (repeatable Variables override), `--sweep KEY=v1,v2,…` (one sweep dimension), `--verbose` (per-seed rows with cause-of-death split). Always calibrate in a regime where the bounding feedbacks fire — see `docs/research-fertility.md`.

## Deciding whether a difference is real (`scripts/compare.ts`)

`sweep.ts` prints medians and counts; deciding whether two of them differ has, until now, been done
by eye. That is how several claims in this project's history were published and later failed to
reproduce. Use this instead of eyeballing:

```bash
npx ts-node scripts/compare.ts --seeds 48 --ticks 2000 --b BASE_CHILDBIRTH_RATE=1.0
npx ts-node scripts/compare.ts --seeds 48 --ticks 2000 --both TAX_RATE=0.1 --a X=1 --b X=2
```

`--a` sets the baseline arm, `--b` the treatment, `--both` a background config shared by each
(repeat any of them). It reports six measures — runs ending extinct, peak population, final
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
- **No single constant fixes overshoot→extinction; the fix is structural.** The tell that you're at this limit: bigger inputs (regen, ceiling, fertility, invention) buy a *bigger boom*, not stability. Don't chase a magic constant — long-run persistence needs a new mechanism (crash recovery / anti-Allee), not recalibration. So tune constants for *short-horizon outcome variety* (the current `BASE_CHILDBIRTH_RATE=0.6` rationale), and don't expect long-run stability from recalibration alone. "Out of reach" is a statement about the levers tried so far, not a ceiling: the structural piece (crash recovery) is unbuilt, the constants are unaudited, and the metrics are partly unvalidated. Given the project's goal is to find thriving, treat that gap as the main work rather than as a settled result. *Partial update, 2026-09-14 (`docs/research-sweep-session-2026-09-14.md`): removing `extractionProductivity`'s variance changes the failure mode without fixing it. Seeds that never oscillate at all drop from 10/16 to 3/16 and survivors run 5+ cycles, but the troughs bottom out at a median of **10 people**, giving a ~7% extinction hazard per cycle — 17–19% of surviving seeds die per 700 ticks in both productivity configs, with no sign of decaying. So it converts one-shot overshoot into repeated near-miss cycling at 41–61% `bound%`, not stability, and no config here is a candidate default. Useful corollary for the crash-recovery item: the mechanism needs to bite at populations of 5–20, and trough depth is the metric to calibrate against.*
- **Test per-capita levers in a regime where the commons does not bind, or the result means nothing.** *(2026-09-14, `docs/research-untested-variables.md`.)* At default settings `HAPPINESS_BASELINE` raises total births 34% and peak population 0%, with extinction 48/48 either way; under the productivity pin the same lever takes extinction 23/48 → 7/48 (Fisher p=8e-4) and cuts the long-run hazard from ~24% to ~9% per 1000 ticks. `EXPERIENCE_CAP` repeats the pattern (23/48 → 11/48, p=0.018). The pool caps the population regardless of how many people are born or how much each can extract, so *any* fertility, production or human-capital constant will read as a null at defaults — including ones that are decisive. This does not overturn "no single constant fixes overshoot→extinction" (the hazard stays constant and positive in every arm; nothing reaches equilibrium), but it does mean a default-regime null is evidence about the regime, not about the lever. Sweep per-capita constants under the pin as well as at defaults, and report both.
