# Research: Is There an Escape-Velocity Threshold?

**Recorded:** 2026-09-17 | **Commit:** a805635 | **Latest ARD:** 062 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/escape-velocity.ts --seeds 24 --ticks 3000 --stride 50 --horizon 1500 --floor 50 --verbose --search --emit discovery.json`; the same on held-out seeds 101–124; `--arms arms-cheap.json --seeds 24 --ticks 6000 --horizon 3000`; re-analysis via `--analyze FILE [--only ARM] [--sustain K] [--gate SPEC]`
**Key context vars:** `EXTRACTION_PRODUCTIVITY_FLOOR=0.01`, `MAX_EXTRACTION_PRODUCTIVITY=10`, `NATURAL_RESOURCE_CEILING_INITIAL=10000`, `NATURAL_RESOURCE_REGEN_FRACTION=0.03`, `CEILING_DEGRADATION_RATE=0.025`, `BASE_CHILDBIRTH_RATE=0.6`

## The question

The ARD-051 labels judge a run by its final decade. They say what a society looks like now; they
cannot say whether it will still be there later, and `docs/research-tuning-defaults.md` records what
that costs — a config whose only benefit is delay reads as a rescue at any horizon shorter than the
delay it buys. The proposal tested here is a rung above `THRIVING`: a level a run can reach such
that it is thereafter very unlikely to die, set high enough to be worth trusting, and detectable
early enough that a run could be stopped the moment it crossed rather than carried to 2000+ ticks.

## Answer: a threshold exists and holds, but almost nothing reaches it

The criterion, measured:

> **Escape.** Population ≥ 800, commons at least 40% full, extraction no more than 70% of
> regeneration, and population within 15% of its running peak — **all four holding continuously for
> 200 ticks.**

Across two independent 24-seed sets, **39 runs cleared it and 39 were still alive and intact 1500
ticks later** — no failures, Wilson 95% floor ≥ 91%. Median crossing tick is around 1,000, so a run
that clears it can be stopped at that point instead of carried to 3000, cutting roughly 60% of the
compute per escaped run.

Two things keep that from being the good news it sounds like.

**The 200-tick persistence requirement is doing the work, not the levels.** The same four levels
checked at a single instant pass 20/20 in discovery and then fail 3 of 24 on held-out seeds. The
failures come from the abundance arm, which had never once cleared the gate during discovery. One
snapshot of a healthy state means nothing; only holding it does.

**Only one configuration ever clears it.** All 39 crossings are the hand-built thriving config from
`docs/research-thriving-reachability.md`. Zero of the other 240 runs cleared it — including every
run of `pin+fertility`, which lost 0 of 24 runs over 3000 ticks and is the best regime in the model
that was not constructed to pass the THRIVING gates in the first place. So the criterion is
currently *correct but nearly inert*: when it fires it is right, and it fires only for a config we
already knew was thriving.

The reason it is inert is the interesting result, and it is not a measurement problem.

## Result 1 — at defaults, looking healthy predicts dying

Six arms, 24 seeds each, 3000 ticks:

| Arm | Extinct | Median extinction tick | Median peak pop | Median end pop |
|---|---|---|---|---|
| default | 24/24 | 189 | 619 | 0 |
| pin (productivity pinned) | 16/24 | 1308 | 1157 | 0 |
| pin + `BASE_CHILDBIRTH_RATE=1.0` | 0/24 | — | 1025 | 409 |
| symmetric band (`FLOOR=0.1`) | 24/24 | 483 | 725 | 0 |
| abundance (ceiling 30k) | 24/24 | 245 | 2386 | 0 |
| thrive (existence config) | 0/24 | — | 5021 | 5021 |

Only `pin` produces both outcomes, so it is the only arm that can test whether a measure reads state
rather than reading which config it is looking at. Restricted to that arm — 16 extinct, 8 alive —
the best value each doomed run ever reached against where the survivors actually sit:

| Measure | Doomed: p90 / max | Survivors: p10 / median |
|---|---|---|
| population | 1241 / 1308 | 74 / 345 |
| commons fill | 0.992 / 0.992 | 0.000 / 0.030 |
| ecological surplus | 0.673 / 0.736 | −0.539 / 0.000 |
| equality (1 − Gini) | 0.874 / 0.880 | 0.535 / 0.653 |
| happiness | 5.17 / 5.37 | 1.50 / 3.83 |
| at peak (1 − decline) | 1.000 / 1.000 | 0.062 / 0.289 |
| fertile share | 0.327 / 0.337 | 0.000 / 0.212 |

**The runs that died scored higher than the survivors on every single measure.** The survivors'
median commons fill is 3% — they live permanently stripped, at a third of the doomed runs'
population and a third off their own peak. They are not thriving; they are too small to overshoot.
None of 240 candidate gates was cleared by 5+ runs of this arm without a failure, and the pattern
reproduces exactly on held-out seeds (doomed max population 1180 vs survivor median 336; doomed max
commons fill 0.991 vs survivor median 0.051).

Pooled across all six arms the same thing shows up in the single-measure grids. Extraction
productivity above 1.38 was reached by 53 runs and killed all 53 — high productivity means faster
extraction, so it buys a bigger overshoot. And the population grid peaks in the middle: runs
crossing 1,043 people held up 30% of the time, runs crossing 2,563 held up 9%.

This is the mechanism `docs/research-thriving-reachability.md` already named, seen from the
prediction side. `GatherResourcesEvent` extracts `min(output, naturalResources)` with no dependence
on how full the pool is, so there is no negative feedback anywhere in the interior. A population
gets exactly one signal — starvation, after the pool is already gone — and every state short of that
reads fine. A threshold needs "doing well" to predict "continuing to do well". At defaults the model
has the opposite sign, which is why the only thing that clears the gate is a config where the
commons was removed as a constraint by hand.

## Result 2 — surviving a horizon is not escaping

The same `pin` and `pin+fertility` seeds run to 6000 ticks:

| Arm | Extinct by 1500 | by 3000 | by 4500 | by 6000 |
|---|---|---|---|---|
| pin | 11/24 | 16/24 | 18/24 | 19/24 |
| pin+fertility | 0/24 | 0/24 | 2/24 | 2/24 |

**Of the 8 `pin` runs alive at tick 3000, 3 were dead by 6000** — 38%, at ticks 3264, 3575 and 4723.
`pin+fertility`, which looks immortal at 3000 ticks, loses its first two runs at 3056 and 3778. The
extinction curve keeps climbing with no flattening, which is exactly the signature CLAUDE.md warns
is a delaying config rather than a different one.

So "still alive at the end of the run" is not evidence of escape, and any label built on it inherits
the delay-reads-as-rescue error. That is the case for wanting a state-based criterion in the first
place — and the reason the one above is worth keeping even while it is inert.

## Result 3 — the search needed held-out seeds, and the skill's trap was real

The gate came out of a 240-candidate search against 24 seeds, where twelve variants had perfect
records. Re-running the whole design on seeds 101–124:

```
population>=800 poolFill>=0.400 surplus>=0.300 atPeak>=0.850
  instant (sustain=1):  discovery 20/20 held  |  held out 21/24 held, 3 extinct
  200 ticks (sustain=4): discovery 19/19 held  |  held out 20/20 held, 0 extinct
```

The instant version's clean record was a draw — one clean row out of a 240-row search, exactly the
third trap in the `sweep-results` skill. `scripts/compare.ts` does not apply to this claim (it
compares two configurations on outcome measures; this is a predictive-threshold claim), so the
held-out rerun is the substitute, and it is the part of this study to trust.

### A precision caveat worth more than it looks

The `pin` arm went extinct in 16 of 24 discovery seeds and 7 of 24 held-out seeds. Nothing differs
between those samples but the seed numbers; a two-sided Fisher test on the pair gives p = 0.02. Two
identical configurations drawn 24 seeds apart landed 37 points apart on extinction rate. Read every
arm-level count in this study with a margin of roughly ±15 points. That is a reason to distrust
thresholds fitted to arm-level outcomes, not a reason to distrust Result 1, which is measured within
runs and reproduced on both seed sets.

## Method

`scripts/escape-velocity.ts`. State sampled every 50 ticks; crossings counted only up to tick 1500
so every one has 1500 ticks of forward observation. Four choices carry the study, each closing a
specific hole:

**The unit of analysis is the run, not the observation.** 144 runs at a 50-tick stride give ~8,600
landmark rows, but rows inside one run are nearly perfectly correlated. Pooling them would turn a
24-run result into a fake 1,800-run one. Every table takes each run's *first* crossing and nothing
else, so n is the number of runs and the Wilson bound means what it says.

**Landmarks below 50 people are dropped (`--floor`).** Not tidying. A dying run passes through
states that read *perfect*: with four people left the commons refills to 100%, extraction falls
below regeneration, and the adult Gini goes to zero. Without the floor those death rattles sit at
the top of every scale and a threshold fitted to them selects for runs about to go extinct. The
first version of this probe duly reported `poolFill >= 1.0` with a 0% survival rate.

**"Did OK" is stricter than "did not go extinct".** A run holding eight people for 1500 ticks has
escaped nothing. `held` reuses the project's own COLLAPSE test (ARD 051): the run must finish its
forward window within `COLLAPSE_PEAK_DECLINE_FRACTION` of the highest population reached inside that
window. This passes a society that keeps growing and fails one that booms and busts.

**Every gate is checked for whether it separates fates inside a single arm.** A gate firing on one
config has learned the config, not the state, and will not transfer. This check is what turned the
headline from "we found a threshold" into "we found a threshold that only one config can reach".

`surplus` is reconstructed from the pool series rather than instrumented in the engine: realised
extraction over a tick is `min(pool_prev + regen, ceiling) − pool`, with regen equal to
`ceiling × NATURAL_RESOURCE_REGEN_FRACTION`. It is exact while the pool has slack, and pins at 0
once the pool is stripped no matter how far demand exceeds regeneration — which is why `poolFill`
must always be read alongside it.

## What this means for the model

The escape criterion is not blocked on measurement. It is blocked on the same structural gap already
at the top of `docs/future-ideas.md`: the commons has no brake before the wall. Until extraction
responds to how drawn-down the pool is, no interior state carries information about the future, and
"this society is doing well" will keep being a leading indicator of overshoot.

The practical consequence is a sequencing one. Build the soft brake, then re-run this probe — it is
a seven-minute job on four cores — and see whether configs other than the hand-built one start
clearing the gate. If they do, the criterion is ready to become an outcome label. If the gate stays
a fingerprint for the one cheated config, the brake did not fix the thing it was meant to fix, and
that is worth knowing early and cheaply.

**No ARD is proposed yet.** Promoting this to a `classifyOutcome` label would change the verdict
taxonomy (refining ARDs 016/051) and needs one, but there is nothing to encode while the criterion
fires on one configuration in six. The ARD belongs with the re-run after the brake lands.

## Re-running this

```bash
# full study, ~7 min on 4 cores
npx ts-node scripts/escape-velocity.ts --seeds 24 --ticks 3000 --horizon 1500 --search --emit /tmp/d.json

# every re-analysis below is free — it never re-runs a simulation
npx ts-node scripts/escape-velocity.ts --analyze /tmp/d.json --horizon 1500 --sustain 4 \
  --gate "population>=800,poolFill>=0.4,surplus>=0.3,atPeak>=0.85"
npx ts-node scripts/escape-velocity.ts --analyze /tmp/d.json --horizon 1500 --only pin --search
```

Always re-run the winner of a `--search` on a held-out seed set before believing it. In this study
that step changed the answer.
