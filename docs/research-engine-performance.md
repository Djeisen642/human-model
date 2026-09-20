# Research: Why the Tick Loop Was Quadratic

**Recorded:** 2026-09-14 | **Commit:** 7ca95d2 | **Latest ARD:** 062 | **Base config:** all Variables at defaults
**Commands:** ad-hoc benchmark calling `LooperSingleton.start(n, ticks, seed, () => {})` — default config at `n=100, 300 ticks × 4 seeds`, plus `n` in 3200/6400/10000 at 10 ticks; before-numbers taken by checking out the pre-optimisation `src/` (`git checkout f7fd8e1 -- src/`) and re-running the identical script. Parity via `npx ts-node scripts/parity-check.ts --emit … --seeds 32 --ticks 300` (default 100 persons) and `--persons 1000 --ticks 100 --seeds 4`, each emitted on the pre-optimisation revision and verified after.
**Key context vars:** `KILL_GINI_SCALAR=1.5`, `SITUATIONAL_KILL_SCALAR=1.0`, `WORKING_AGE_MIN=18` (sets the Gini basis), `BASE_CHILDBIRTH_RATE=0.6` (sets how far population grows during a run)

This was meant to be a design plan for the multi-tier execution entry in `docs/future-ideas.md`, which
treats simulating larger populations as a memory-layout problem. Measuring first showed it was not.
The engine was slow because four full-population scans ran once per person per tick, and removing them
needed no layout change at all.

## The speedup, measured before and after

The same script run against the pre-optimisation `src/` and the current one:

| Config | Before | After | Speedup |
|---|---|---|---|
| **Default (100 persons, 300 ticks × 4 seeds)** | **10,421 ms** | **554 ms** | **18.8×** |
| 3,200 persons, per tick | 1,724 ms | 126 ms | 13.7× |
| 6,400 persons, per tick | 8,584 ms | 468 ms | 18.3× |
| 10,000 persons, per tick | 21,762 ms | 1,142 ms | 19.1× |

The default row matters most: this is the configuration the project actually runs, and it is ~19×
faster. The gain is not confined to hypothetical large populations.

Before the fix, doubling the population multiplied the time by about four — the signature of an
algorithm doing work proportional to the square of the population. An 800-tick run at 10,000 people
would have taken about **4.8 hours**; it now takes about **15 minutes**.

> **Correction (same day).** The first write-up of this work claimed the 10,000-person run would drop
> to "under a minute." That was wrong by roughly 15×. It came from extrapolating the small-`n` numbers
> as though the engine were now linear, when the residual Gini call documented below is still
> quadratic and dominates at that size — the very limitation this doc records two sections down.
> The 15-minute figure above is extrapolated from measured early ticks, so treat it as an estimate of
> the same kind, though anchored ~50× closer to the measurement.

## One call was 95% of it

`KillEvent` computed `resourceGini` over the entire living population, separately for every person,
every tick. Each call copies the population, filters it to adults, maps out resources and sorts them.

Isolating the changes at n=1600 (30 ticks):

| Variant | Time | Identical results? |
|---|---|---|
| Unmodified | 14,855 ms | baseline |
| O(1) living index only | 14,131 ms | yes |
| Per-tick Gini cache only | 1,074 ms | **no** |
| Both | 224 ms | no |

The index fixes (`getRandomOther`, `kill`, `indexOfLiving`) are worth 5% on their own. Everything else
was that one Gini call. The per-tick cache was a cost probe, not the shipped fix — it changes results,
and peak population moved from 722 to 467 at n=400 under it.

What shipped instead is a bracket: draw the attempt roll first, then compare it against the probability
evaluated at the two extremes the Gini can produce (0 and just under 1). Most rolls fall outside that
range and are decided without the Gini at all. Only rolls inside it — about 3% of person-ticks, because
`KILL_GINI_SCALAR=1.5` makes the range narrow relative to a probability already under 0.1 — pay for the
population scan. This is exactly equivalent, not an approximation: `resourceGini` draws no random
numbers, so moving the roll above it leaves the random sequence untouched, and the in-bracket
expression multiplies its terms in the original order, so it produces bit-for-bit the old probability.

## What is left, and why it cannot be fixed exactly

Stubbing `resourceGini` to a constant makes the whole engine linear:

| n | Shipped | Gini stubbed |
|---|---|---|
| 800 | 271 ms | 146 ms |
| 1600 | 912 ms | 206 ms |
| 3200 | 3,383 ms | 365 ms |

So the residual Gini calls are the entire remaining curve. At n=3200 they are still 89% of runtime, and
the 3,200 → 6,400 → 10,000 progression in the first table (126 → 468 → 1,142 ms/tick) is still cleanly
quadratic: a 3% chance of an expensive call still beats a linear pass once the population is large
enough. This is why the "under a minute" extrapolation was wrong, and why the optimised engine is
*not* linear despite everything else in it being so.

Removing those calls means computing the Gini once at tick start and reading that fixed value for
everyone, which changes results and therefore needs an ARD. Two exact alternatives were considered and
both fail:

- **Recompute only when resources change.** Never helps. Every person gathers and consumes every tick,
  so the cached value is stale by the time the next person reads it.
- **Maintain the Gini incrementally** (an order-statistic tree carrying the rank-weighted sum). Gets the
  right answer in O(log n) per update, but adds the floating-point numbers in a different order than
  sorting and summing does. The tiny rounding differences compound over hundreds of ticks, so it loses
  the bitwise-identical property that makes a refactor reviewable.

**Bitwise-exact and linear-time are mutually exclusive here.** That is the finding, and it is why the
remaining work is a modelling decision rather than another optimisation.

## The modelling reason to do it anyway

Recomputing the Gini per person mid-tick means the inequality term in the kill probability depends on
iteration order: the first person processed sees the inequality of a population that has not yet
gathered or consumed, the last sees it after everyone has. `LooperSingleton` shuffles the population
each tick specifically to keep iteration order out of the results, and this call puts it back — in the
model's central inequality-drives-violence loop, no less.

Freezing the value at tick start removes that artifact. The ARD should report a seed sweep rather than
a single run, since the probe above moved peak population by a third.

## Method note

Every claim of "identical results" here means `scripts/parity-check.ts` compared all 35 snapshot fields
for every tick and found no difference, against a baseline emitted from the pre-optimisation revision
with the new code removed from the tree — a true before-and-after, not a self-comparison. Two runs:

| Parity run | Result |
|---|---|
| 32 seeds × 300 ticks, 100 persons (default config) | identical |
| 4 seeds × 100 ticks, 1,000 persons | identical |

The second exists because the first only covered the default population while every speed number came
from 400–10,000 persons, so equivalence was being asserted in a regime that had not been tested.
Independently, peak population matched exactly between the two versions at 3,200 / 6,400 / 10,000
(3798, 7475, 11588), which is weaker evidence than a parity run but covers the largest sizes.

An earlier attempt to attribute cost with `node --prof` produced an unusable profile (45 samples); the
isolate-and-measure approach above replaced it and is what the numbers come from.

---

# Addendum: What Happens at 100,000 Founders

**Recorded:** 2026-09-20 | **Commit:** c0018e1 | **Latest ARD:** 067 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node src/App/index.ts --config <n persons, 100 ticks, seed 42>`; `node --cpu-prof` over the same entry point at n=8,000; ad-hoc script calling `Simulation.seed(n, rng)` alone at n in 5,000/10,000/20,000/40,000; parity via `npx ts-node scripts/parity-check.ts --emit … --seeds 8 --ticks 300` emitted on d328277 and verified after.
**Key context vars:** `KILL_GINI_SCALAR=1.5`, `WORKING_AGE_MIN=18`, `NATURAL_RESOURCES_INITIAL=10000`, `SEED_TWO_PARENT_FRACTION`, `RELATIONSHIP_MIN_AGE=18` (sets how many seeded children need parents)

**A 100,000-founder run completes in about 54 minutes, and two quadratic terms decide that number — one
of which this pass cut by 3× without changing any result, and one that was not previously documented.**
The Gini call this document already identified is still the tick-loop cost; `Simulation.seed` is the
other, and at 10^5 it burns ~5 minutes before tick 1.

## The Gini call, re-measured and made cheaper

A CPU profile at 8,000 founders puts 82% of samples in `resourceGini` → `gini`. None of it was
arithmetic: `gini` copied its input and sorted with a JS comparator, `resourceGini` built a filtered
array and then a mapped one, and `KillEvent` passed it `simulation.getLiving()` — a fresh shallow copy
of the whole population, once per call.

| Change | 16,000 founders × 100 ticks |
|---|---|
| before | 153s |
| `Float64Array` sorted in place, buffer filled directly, `Simulation.currentResourceGini()` over the live array | 51s |

The end report is byte-identical, and `parity-check` over 8 seeds × 300 ticks found no difference in any
snapshot field. Accumulation order over the sorted values never changed, which is why it can be exact.

**This does not change the order and does not supersede the freeze-the-Gini entry in
`docs/future-ideas.md`.** The sort is still O(n log n) per bracket hit, once per person-tick that clears
it, so cost still grows with the square of the population. It buys headroom, not scale.

## Seeding is the other quadratic, and nobody had measured it

`Simulation.seed`'s post-seed parent assignment (ARD 052) walks the seeded children and, per child,
rebuilds two filtered arrays over every potential parent, copies one, and Fisher-Yates shuffles the copy.

| Founders | `seed()` alone |
|---|---|
| 5,000 | 0.2s |
| 10,000 | 0.65s |
| 20,000 | 2.6s |
| 40,000 | 15.8s |

That extrapolates to roughly 5 minutes at 100,000, spent before the first tick. The filters are
removable bit-exactly — they draw no RNG, they preserve order, and children's ages take only
`RELATIONSHIP_MIN_AGE` distinct threshold values, so the eligible lists can be built once per age. The
per-child shuffle is not removable: its draws are part of the seeded population, so any cheaper
selection changes who exists at tick 0. Same shape as the Gini freeze, so it is ARD-level, and it is
recorded in `docs/future-ideas.md`.

## The run itself — a single seed, not a result

100,000 founders × 100 ticks on seed 42 at defaults reads COLLAPSE: 100,000 → 120 survivors, peak
111,945 at year 10, 124,882 deaths of which 106,197 are illness.

**This is one seed and one configuration. It is not evidence that anything differs from anything.** The
useful observation in it is arithmetic rather than statistical: `resourceGini` reports exactly 1.00 at
years 40 and 50, with the commons at zero and average resources at 0.0. Gini saturates when almost
every entry in the distribution is zero, so at this founder-to-pool ratio the model's primary collapse
signal stops discriminating well before the population does — the same objection `docs/research-inequality-signal.md`
raises, reached from the other end.

Why the ratio, and not the scale, is what this run measures is already settled elsewhere:
`NATURAL_RESOURCES_INITIAL = 10_000` is an absolute constant sized for 100 founders, so 100,000 of them
is a 1000× overshoot. `docs/research-population-scaling.md` measured founding population on a fixed
commons as a scarcity dial, and `docs/research-scale-robustness.md` ran the properly-tested version of
"scale the commons with the founders" at 24 seeds. A single-seed trace at 16,000 founders on a ×100
commons was run here only to size the compute: 4,417s for 100 ticks, ending at 129,081 living people
because the population never stops growing. That is the number that rules out the 100,000-founder
version of it — cost tracks the square of the *living* population, not the founding one, so the big
run would spend its 100 ticks somewhere near 800,000 people and take days, with memory a second open
question. **The trace is a timing probe and is not offered as a comparison.** Deciding anything about that arm needs `scripts/compare.ts` and the procedure in
`.claude/skills/sweep-results/`.
