# Research: Is `peakGini` Measuring the Society or the Death Spiral? (Hypothesis)

**Recorded:** 2026-09-13 | **Commit:** faf49f8 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/metric-probe.ts --seeds 8 --ticks 700 [--set KEY=VAL | --sweep KEY=v1,v2,…]`
**Key context vars:** `TAX_RATE=0.02`, `WELFARE_THRESHOLD=20`, `COMMUNITY_POOL_RESERVE_FRACTION=0.20`, `ESTATE_COMMUNITY_SHARE=0.40`, `BASE_CHILDBIRTH_RATE=0.6`

**Status: hypothesis, not an established result.** Everything below rests on 8–10 seeds, one seed
set, unreplicated, and on `matureGini` — a metric defined in this study whose cutoff is a judgment
call with no owner sign-off. It is written up because, if it holds, it affects how every prior
calibration decision that leaned on the sweep table's Gini column should be read.

---

## Question

Ten variables were swept this session (disaster frequency, estate shares, help generosity, the
inequality→violence scalar, theft-intent cap, heritability, crime-detection escalation, jail
sentence length, elder consumption, frustration-aggression). Every one returned `peakGini` in a
narrow 0.79–0.89 band. The obvious reading is that the model's inequality is structurally pinned.
The alternative reading — the one this study tests — is that **the metric is pinned, not the
model**.

## Hypothesis

`peakGini`, the sweep harness's headline inequality column, is the maximum of a volatile series
taken over the whole run. Two properties make it a poor instrument for comparing configurations:

1. **It is sampled during the crash, not during the society.** Per-tick instrumentation across 8
   seeds finds peak Gini is attained at populations of 10–234 (median ≈ 29), while the same runs
   peaked at 116–760 people. At the moment of peak population, Gini is a completely different
   number.

   | seed | peak-Gini moment | Gini there | peak-pop moment | Gini there |
   |---|---|---|---|---|
   | 1 | t=87, pop=15 | 0.90 | t=30, pop=153 | 0.32 |
   | 2 | t=60, pop=55 | 0.83 | t=21, pop=116 | 0.30 |
   | 3 | t=105, pop=10 | 0.87 | t=54, pop=178 | 0.30 |
   | 4 | t=160, pop=28 | 0.71 | t=288, pop=760 | 0.46 |
   | 5 | t=173, pop=147 | 0.77 | t=114, pop=633 | 0.41 |
   | 6 | t=339, pop=20 | 0.85 | t=110, pop=574 | 0.28 |
   | 7 | t=86, pop=234 | 0.81 | t=60, pop=389 | 0.46 |
   | 8 | t=402, pop=30 | 0.77 | t=103, pop=636 | 0.39 |

2. **It is a max-of-noise estimator.** Gini is highly volatile within a single run — seed 4 swings
   between 0.145 and 0.672 with no trend. Taking the maximum of such a series over ~500 ticks
   lands near the top of the noise envelope regardless of where the distribution's centre sits, so
   the statistic is structurally insensitive to the thing a sweep is trying to detect.

**Ruled out:** the dependent-children confound noted in `future-ideas.md` is *not* what drives
this. At peak-Gini moments the child share is usually 0% and adult-only Gini matches all-person
Gini to two decimals. That confound may still matter for other Gini readings; it does not explain
this one.

## Proposed alternative metric

`matureGini` — median Gini across ticks where population is at least 50% of that run's own peak.
It samples the society while a society exists, and takes a median rather than an extreme.
`giniAtPeakPop` (Gini at the single peak-population tick) is reported alongside as a cross-check;
it tells the same story but is a one-tick sample and correspondingly noisier.

**The 50% cutoff is arbitrary.** It was not derived and has not been validated against alternatives.
Before `matureGini` becomes anything the project relies on, that threshold needs justification or
a sensitivity check, and the choice is exactly the kind of "parameter whose value could reasonably
be different" that the ARD rule exists for.

## Evidence: the levers are not inert, the ruler is

Median Gini over the mature phase, per seed, 8 seeds:

| config | s1 | s2 | s3 | s4 | s5 | s6 | s7 | s8 | median |
|---|---|---|---|---|---|---|---|---|---|
| `TAX_RATE=0` | 0.575 | 0.552 | 0.558 | 0.590 | 0.599 | 0.449 | 0.573 | 0.681 | **0.574** |
| `TAX_RATE=0.02` (default) | 0.341 | 0.441 | 0.322 | 0.448 | 0.367 | 0.305 | 0.460 | 0.365 | **0.366** |
| `TAX_RATE=0.20` | 0.159 | 0.111 | 0.154 | 0.108 | 0.131 | 0.130 | 0.171 | 0.166 | **0.142** |
| `TAX_RATE=0.20`, `WELFARE_THRESHOLD=60` | 0.221 | 0.141 | 0.221 | 0.136 | 0.175 | 0.166 | 0.138 | 0.177 | **0.171** |

Every seed orders identically and the bands do not overlap — a 4x spread in inequality. The same
runs report `peakGini` of 0.733 (tax off) versus 0.714 (tax at 0.20): a 0.02 difference, and in a
4-seed spot check `peakGini` ordered the two configs *backwards* (0.709 untaxed vs 0.845 taxed)
while `matureGini` showed 0.566 vs 0.132.

Two secondary observations from the same runs:

- **The 2% tax is not "near-inert."** `future-ideas.md` infers inertness from the community pool's
  small end-of-run balance (~18 against ~2,600 total resources). That reads a stock as a flow — the
  pool is small because it turns over every tick, not because it is idle. Removing it raises
  `matureGini` by ~57% (0.366 → 0.574).
- **`WELFARE_THRESHOLD` is not the lever; `TAX_RATE` is.** Raising the threshold from 20 to 60
  slightly *worsened* inequality (0.142 → 0.171), plausibly by diluting bottom-targeting across
  more recipients — though that gap is small enough to be noise at this sample size.

## Incidental finding: estate shares have an unenforced sum invariant

`ESTATE_COMMUNITY_SHARE`, `ESTATE_PARTNER_SHARE`, and `ESTATE_CHILDREN_SHARE` must sum to 1.0, but
`Simulation.kill()` applies them raw with no normalisation or validation. Sweeping one alone
silently breaks the resource conservation that ARDs 039–042 were written to establish: at
`ESTATE_COMMUNITY_SHARE=0.9` with the other two at defaults, a decedent with heirs distributes 1.5x
their estate, minting resources from nothing; at 0 it destroys 40% of them. An earlier sweep this
session did exactly that, so its result (socialised inheritance appearing to buy a larger peak
population) is an artifact and should be disregarded. Any future estate sweep must vary all three
together. Worth deciding separately whether the constants should be normalised or validated at load.

## What this would mean if it holds

- **Inequality and collapse look decoupled in the current model.** Cutting `matureGini` fourfold
  via taxation left extinction at 8/8 seeds. That sits awkwardly against the project's framing of
  the resource Gini as the primary collapse signal and of inequality mattering more than scarcity —
  in these runs inequality is highly tractable and collapse is indifferent to it.
- **Calibration decisions that leaned on the sweep table's Gini column deserve re-reading**, since
  that column may have been reporting crash noise rather than the economy.
- **The harness's reported column is the thing to fix first** — before any further parameter
  hunting, since parameter hunting against a blind instrument is what produced the "nothing moves
  Gini" impression in the first place.

## Open questions

1. Does the effect survive replication on independent seed sets, and is it stable to the
   `MATURE_POP_FRACTION` cutoff?
2. Which of this session's other null results were metric artifacts? (Re-tests of the kill
   amplifiers, elder consumption, detection escalation, and jail length are the obvious first pass.)
3. What `TAX_RATE` hits the ~25% Gini-compression target `future-ideas.md` takes from OECD data?
   The gap between 0.02 (≈36% compression versus untaxed) and 0.20 (≈75%) brackets it.
4. Should `classifyOutcome` be revisited? It reads final-decade Gini rather than peak Gini, so it
   may be less affected — but "final decade" on a run that went extinct at tick 116 has the same
   tiny-N problem.
5. Is the volatility itself the real finding? A Gini that swings 0.145–0.672 within one run may be
   telling us something about the resource dynamics that no summary statistic will capture.

## Tooling

`scripts/metric-probe.ts` (added with this study) re-measures runs under all three statistics and
supports `--seeds`, `--ticks`, `--persons`, `--set KEY=VAL`, `--sweep KEY=v1,v2,…`. It is
exploratory diagnostic tooling, deliberately kept separate from `scripts/sweep.ts` so that nothing
in the project's existing calibration path changes on the strength of an unvalidated metric.
