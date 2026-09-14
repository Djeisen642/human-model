# Research: Is `peakGini` Measuring the Society or the Death Spiral? (Hypothesis)

**Recorded:** 2026-09-13 | **Commit:** faf49f8 | **Latest ARD:** 058 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/metric-probe.ts --seeds 8 --ticks 700 [--set KEY=VAL | --sweep KEY=v1,v2,…]`
**Key context vars:** `TAX_RATE=0.02`, `WELFARE_THRESHOLD=20`, `COMMUNITY_POOL_RESERVE_FRACTION=0.20`, `ESTATE_COMMUNITY_SHARE=0.40`, `BASE_CHILDBIRTH_RATE=0.6`

> **Note added 2026-09-14 — the Gini basis changed under this study.** ARD 060 moved `resourceGini` (and `KillEvent`'s) to adults only, and ARD 061 changed how welfare circulates, so every Gini figure below is on the all-living basis and predates both. `scripts/metric-probe.ts` now uses the shared adult-basis helper, so re-running it will not reproduce these numbers. Treat the *relative* claims (peakGini is a crash-phase max-of-noise statistic) as the durable part and the absolute values as historical.

**Status: hypothesis, not an established result.** Everything below rests on 8–20 seeds, largely one
seed set, and on `matureGini` — a metric defined in this study whose cutoff is a judgment call with
no owner sign-off. It is written up because, if it holds, it affects how every prior calibration
decision that leaned on the sweep table's Gini column should be read.

**Read the noise floor first (§ Noise floor).** At 10 seeds this harness cannot resolve `matureGini`
differences below roughly ±0.05. Only two results in this document clear that bar. Every other
comparison here is reported as unresolved, not as an effect.

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
- **`WELFARE_THRESHOLD` is a second, weaker lever, pointing the other way.** An initial two-point
  comparison suggested raising the threshold slightly worsened inequality and was probably noise;
  a four-point sweep (below) shows it is monotone and roughly 2.5× the noise floor — 0.345 at
  threshold 10 rising to 0.468 at 80. Widening the net appears to dilute bottom-targeting. Measured
  only at the default `TAX_RATE=0.02`, so the interaction with tax rate is unmeasured.

## Noise floor

A robustness check re-ran one `KILL_GINI_SCALAR` sweep at 20 seeds instead of 10. The **default
cell moved by 0.056 on seed sampling alone** — larger than the entire range of the 10-seed sweep it
came from (0.063), and enough to erase an apparent dip. Peak population in the same cell moved
476 → 558.

So: **at n=10, `matureGini` differences below roughly ±0.05 are not resolvable, and neither is
peak population below ~15%.** This bounds not just the results here but every sweep run this
session, and arguably prior single-seed-set calibration work at similar n. It should be established
properly (repeated seed families, reported dispersion) before more parameter hunting — the probe
prints medians only, which is itself a defect worth fixing.

Against that bar:

| result | effect size | verdict |
|---|---|---|
| `TAX_RATE` 0 → 0.35 | 0.474 | ~10× floor — the one decisive result |
| `WELFARE_THRESHOLD` 10 → 80 | 0.123 | ~2.5× floor, monotone over 4 points — probably real |
| `CONSUMPTION_ELDER_MULTIPLIER` | ~0.08, non-monotone | marginal; direction unstable |
| estate ladder, `HELP_FRACTION`, kill amplifiers, detection, jail | ≤0.06, no ordering | unresolved — not distinguishable from noise |

## Dose-response: `TAX_RATE`

10 seeds, 700 ticks, medians. The one lever that clears the noise floor decisively.

| `TAX_RATE` | peakGini | giniAtPeakPop | matureGini | compression vs untaxed |
|---|---|---|---|---|
| 0 | 0.733 | 0.644 | 0.565 | — |
| 0.01 | 0.795 | 0.492 | 0.435 | 23.0% |
| 0.02 (default) | 0.821 | 0.373 | 0.366 | 35.2% |
| 0.05 | 0.814 | 0.326 | 0.316 | 44.1% |
| 0.10 | 0.853 | 0.198 | 0.224 | 60.4% |
| 0.20 | 0.813 | 0.116 | 0.134 | 76.3% |
| 0.35 | 0.748 | 0.076 | 0.091 | 83.9% |

Monotone with no reversal across seven points; roughly log-linear above 0.02 (≈ constant
proportional cut per doubling), decaying toward a floor near 0.09 rather than plateauing inside the
tested range. `peakGini` over the same runs spans 0.733–0.853 with no ordering.

**Verification (the two checks this doc asked for).** Both came back clean for this result
specifically:

| | `TAX_RATE=0` | 0.02 | 0.10 | 0.20 |
|---|---|---|---|---|
| seeds 1–10, cutoff 0.5 | 0.565 | 0.366 | 0.224 | 0.134 |
| **seeds 101–110** (independent family), cutoff 0.5 | 0.557 | 0.430 | 0.219 | 0.134 |
| seeds 1–10, cutoff 0.3 | 0.541 | 0.369 | 0.234 | 0.138 |
| seeds 1–10, cutoff 0.7 | 0.585 | 0.377 | 0.209 | 0.126 |

A disjoint seed family reproduces the curve (endpoints 0.557 vs 0.565 and 0.134 vs 0.134); only the
0.02 cell drifts meaningfully, by 0.064, consistent with the noise floor. Varying the cutoff across
0.3/0.5/0.7 shifts individual cells by less than 0.05 and never breaks the ordering. So the
`TAX_RATE` effect is not an artifact of the seed family or of the arbitrary cutoff. That does
**not** generalise to the smaller results in this document, which remain inside the noise floor and
untested against either check.

**Against the OECD target** `future-ideas.md` cites (~25% compression, range 5–40%):
`TAX_RATE=0.01` lands nearest at 23%. The current 0.02 default gives 35% — inside the range, above
centre. Everything from 0.05 up exceeds the empirical envelope entirely.

## Follow-up: re-testing this session's nulls

Four variables previously declared inert on `peakGini` were re-measured. The headline is not that
the better metric rescued them — mostly it did not — but **that `peakGini` produces false positives
as well as false negatives**:

- **`CONSUMPTION_ELDER_MULTIPLIER` — an apparent effect that evaporates.** `peakGini` rises cleanly
  and monotonically with harsher elder costs (0.722 → 0.821 → 0.875 → 0.898), and this was flagged
  during the session as the single best candidate for a real effect. `matureGini` does not
  reproduce it: 0.463 → 0.366 → 0.441 → 0.444, non-monotone, endpoints indistinguishable, with
  `giniAtPeakPop` agreeing. Plausibly a crash-shape artifact — harsher costs shrink the peak
  (641 → 425), and a smaller peak means a noisier terminal Gini. Not supported rather than refuted:
  four points, one seed set, deltas only marginally above the floor.
- **Kill amplifiers — nulls hold on a metric that could have refuted them.** `KILL_GINI_SCALAR`
  (0 → 6.0) and `SITUATIONAL_KILL_SCALAR` (0 → 6.0) both wobble without ordering on `matureGini`,
  inside the noise floor. Consistent with the independent measurement that murder is 5–12% of
  deaths against ~88% illness: scaling a multiplier on a small term leaves it small. The one cell
  worth replicating is `SITUATIONAL_KILL_SCALAR=0` (8/10 extinct vs 10/10 elsewhere) — turning the
  mechanism off entirely is the only structural change in the set.
- **`DETECTION_CRIME_COUNT_SCALAR` and `JAIL_TICKS_KILL` — nulls hold on inequality**, but
  "does nothing" was too broad. `JAIL_TICKS_KILL` shows a monotone ~25% rise in peak population
  (437 → 545 over a 50× range) that `peakGini` missed entirely. Inside the population noise band,
  so unresolved, but it is a different claim from the Gini null.
- **Estate ladder (conservation preserved) — unresolved.** Holding the three shares summed to 1.0:
  0.464 (pure family) / 0.366 (default) / 0.417 / 0.416 (fully socialised). The default sits at the
  minimum and the U-shape survived fixing the conservation bug, but the gaps are ~0.05 — at the
  floor, so no conclusion. `HELP_FRACTION` scatters 0.366–0.429 with no ordering.

**A confound in `matureGini` itself**, surfaced by this round: the window is defined relative to
*each run's own* peak, so configs whose peak population differs (476–661 across these sweeps) are
measured over different windows. A fixed-population or fixed-tick window may be the sounder
definition. This is a real weakness in the proposed metric, not a footnote.

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

- **Inequality and collapse may be decoupled — but this design cannot establish it.** Compressing
  `matureGini` by 84% via taxation left extinction at 9–10/10 seeds. That sits awkwardly against the
  project's framing of the resource Gini as the primary collapse signal and of inequality mattering
  more than scarcity. The honest limit: extinction is *saturated* at 9–10/10 across every config
  tested, so the column cannot detect a moderate collapse effect even if one exists. Testing the
  decoupling properly needs a lower-mortality regime where the extinction rate has room to move.
- **Calibration decisions that leaned on the sweep table's Gini column deserve re-reading**, since
  that column may have been reporting crash noise rather than the economy.
- **The harness's reported column is the thing to fix first** — before any further parameter
  hunting, since parameter hunting against a blind instrument is what produced the "nothing moves
  Gini" impression in the first place.

## Open questions

1. **Establish the noise floor properly.** The ±0.05 figure comes from a single 10-vs-20-seed
   comparison. How many seeds does a `matureGini` comparison actually need, and the probe should
   report dispersion rather than medians alone. This gates everything else.
2. **Is `matureGini` the right definition?** *(Partly answered.)* The 50% cutoff turns out not to
   matter for the `TAX_RATE` result: 0.3/0.5/0.7 shift cells by <0.05 and preserve ordering. The
   deeper objection stands, though — the window still moves with each run's own peak, so configs
   with different population trajectories are compared over different windows. Fixed-tick and
   fixed-population-level windows are still worth testing.
3. *(Answered for `TAX_RATE`.)* The result reproduces on a disjoint seed family (101–110) and
   across cutoffs. It is the one finding here that has survived both checks. Nothing else in this
   document has been subjected to them.
4. *(Partly answered.)* Which other nulls were metric artifacts? Re-tests found mostly genuine nulls
   but one apparent-effect-that-evaporates (`CONSUMPTION_ELDER_MULTIPLIER`). The open part: the
   `JAIL_TICKS_KILL` peak-population trend and the `SITUATIONAL_KILL_SCALAR=0` extinction cell both
   sit at the noise floor and want replication.
5. *(Answered, provisionally.)* `TAX_RATE=0.01` lands nearest the OECD ~25% target at 23%; the
   current 0.02 default gives 35%. Whether to recalibrate is an owner decision, not a measurement
   one — and it should wait on question 1.
6. Should `classifyOutcome` be revisited? It reads final-decade Gini rather than peak Gini, so it
   may be less affected — but "final decade" on a run that went extinct at tick 116 has the same
   tiny-N problem.
7. Is the volatility itself the real finding? A Gini that swings 0.145–0.672 within one run may be
   telling us something about the resource dynamics that no summary statistic will capture.

## Tooling

`scripts/metric-probe.ts` (added with this study) re-measures runs under all three statistics and
supports `--seeds`, `--ticks`, `--persons`, `--set KEY=VAL`, `--sweep KEY=v1,v2,…`. It is
exploratory diagnostic tooling, deliberately kept separate from `scripts/sweep.ts` so that nothing
in the project's existing calibration path changes on the strength of an unvalidated metric.
