# Research: Is THRIVING Reachable?

**Recorded:** 2026-09-14 | **Commit:** 7e47605 | **Latest ARD:** 059 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/thrive-probe.ts --ticks 800 --seeds 2 --decades [--set KEY=VAL …]`; `npx ts-node scripts/gini-decomp.ts`
**Key context vars:** `EXTRACTION_PRODUCTIVITY_FLOOR=0.01`, `MAX_EXTRACTION_PRODUCTIVITY=10`, `NATURAL_RESOURCE_CEILING_INITIAL=10000`, `NATURAL_RESOURCE_REGEN_FRACTION=0.03`, `TAX_RATE=0.02`, `WELFARE_THRESHOLD=20`, `BASE_CHILDBIRTH_RATE=0.6`, `THRIVING_*` thresholds

CLAUDE.md flagged ARD 051's THRIVING label as possibly "definitionally unreachable" and asked for that
to be established rather than assumed. This is the existence check: cheating freely (extreme
Variables, hand-built cohorts, disabled degradation), can any reachable state of the simulation trip
THRIVING — and can it hold at 800 ticks?

## Answer: yes, at all three levels

| Level | Result |
|---|---|
| Unmodified defaults, transient | **seed 1 run to exactly 60 ticks classifies THRIVING** (Gini 0.276, happiness 6.94, 0% off peak, commons 62%) |
| Modest Variables change, sustained ~300 ticks | abundance + universal redistribution: **28 consecutive THRIVING decades**, t20–t280 |
| Sustained to 800 ticks | config below: **THRIVING on both seeds at t=800**, and on ~every decade of the run |

So the category is not definitionally unreachable, and it is not a threshold bug. The four gates
describe a region of state space the model can enter and stay in. It just never goes there on its
own.

The transient hit matters on its own: **the default config passes all four gates at tick 60 and
fails by tick 70**, when the commons empties. Nobody saw it because runs are judged at 100+ ticks.

## What the four gates actually demand

| Gate | Threshold | What it costs the model |
|---|---|---|
| Commons fill | ≥ 0.40 | extraction below regen — i.e. population below `regen_fraction × ceiling ÷ per-capita gather` |
| Happiness | ≥ 6.0 | adults employed, partnered, and above the comfortable-resource threshold; children cap at 3 (no job, no partner) so child share must stay under ~60% |
| Gini | < 0.30 | see below — this is mostly an age-structure gate, not an inequality gate |
| Peak decline | < 0.15 | population alive and at/near its running maximum at t=800 |

Happiness and commons are easy once the economy works. The binding pair is Gini and peak-decline.

## The 800-tick existence config

Starting from defaults, only these changed (`A1` in the run log):

```
# abundance: the commons is not the binding constraint
NATURAL_RESOURCES_INITIAL=100000  NATURAL_RESOURCE_CEILING_INITIAL=100000
MAX_NATURAL_RESOURCE_CEILING=200000  NATURAL_RESOURCE_CEILING_FLOOR=100000
NATURAL_RESOURCE_REGEN_FRACTION=0.05  CEILING_DEGRADATION_RATE=0
# universal redistribution: flat 10% tax paid out equally to everyone, no reserve
TAX_RATE=0.10  WELFARE_THRESHOLD=1e9  COMMUNITY_POOL_RESERVE_FRACTION=0
# pin extraction productivity (disable the faster/slower invention branches)
INVENTION_DEPLETION_FASTER_WEIGHT=0  INVENTION_DEPLETION_SLOWER_WEIGHT=0
# remove the fertile window; tune fertility to slow monotone growth
CHILDBIRTH_AGE_SCALE=1000  CHILDBIRTH_AGE_FLOOR=1.0  BASE_CHILDBIRTH_RATE=0.03
# social stability
BASE_RELATIONSHIP_RATE=0.5  BASE_BREAKUP_RATE=0.005  JOB_LOSS_BASE=0.001
```

Result at 800 ticks, seeds 1–2: **THRIVING / THRIVING**, population 2291 / 1856 (both at their peak,
0% decline), Gini 0.16, happiness 9.0, commons 97%. Mortality, illness, disaster and suicide are all
at their **default** values — the earlier near-immortality probe turned out to be unnecessary.

The regime is unremarkable to look at: population grows ~0.2%/tick monotonically for 800 ticks,
employment ~100%, extraction runs at roughly a fifth of regen, and nothing ever crashes. That is
what "thriving" looks like in this model, and the model can host it.

## Ablations — which cheats are load-bearing

Each row drops one block from the config above.

| Dropped | Outcome at 800t | Failing gate |
|---|---|---|
| near-immortality (already dropped in the config above) | THRIVING ×2 | — |
| productivity pin | **EXTINCTION ×2** | everything |
| productivity pin → symmetric band (`EXTRACTION_PRODUCTIVITY_FLOOR=0.1`) | THRIVING ×1, STRUGGLING ×1 | commons |
| universal redistribution | STRUGGLING ×2 | **Gini 0.53 / 0.55** |
| abundance (defaults) | STRUGGLING ×2 | commons 0%, happiness |
| abundance (moderate, ceiling 30k) | STRUGGLING ×2 | commons 0% (population held at peak, 2384) |
| social-stability constants | EXTINCTION / COLLAPSE | confounded — fertility not retuned |
| wide fertile window (fertility not retuned) | EXTINCTION ×2 | confounded |
| wide fertile window (default window, `BASE_CHILDBIRTH_RATE=0.10`, ceiling 30k) | STRUGGLING | commons 0% — population grew monotonically to 3065, 4% off peak |

Three real dependencies fall out: **extraction productivity must not wander**, **redistribution must
be universal**, and **the commons must not bind**. The last two ablations changed effective fertility
without retuning `BASE_CHILDBIRTH_RATE`, so they establish only that the knife edge is narrow, not
that those constants matter in themselves.

## Four model facts that keep THRIVING out of reach

### 1. `extractionProductivity` drifts down — the drift ARD 047 removed came back through the bounds

ARD 047 fixed the faster/slower asymmetry so a faster–slower pair cancels exactly, leaving "a clean
bounded random walk whose long-run behavior is determined by the floor, the cap, and the weights."
The step is now unbiased, but the *band* is not: `[0.01, 10]` around a start of 1.0 is 4.6 log-units
of headroom below and 2.3 above. A reflected driftless log-walk is asymptotically uniform over that
band, so:

```
Monte Carlo (200 chains × 4000 invention steps, delta=0.25):
  median productivity 0.35×     P(< 1.0) = 0.65     P(< 0.2) = 0.42
  analytic median exp((ln 0.01 + ln 10)/2) = 0.316
```

Gather output is linear in productivity, so **the model's long-run economy is ~3× poorer than its
calibrated starting point, for no reason anyone chose.** It was directly observed: a run with a full
commons starved to death with productivity pinned at 0.03–0.10 while `naturalResources` sat at 100%
of ceiling. Unpinning productivity is the single change that takes the existence config from
THRIVING ×2 to EXTINCTION ×2; raising the floor to 0.1 (a log-symmetric band) recovers most of it.

This is the same class of defect as the age-38 fertility window in ARD 059: a number that encodes
something nobody intended, sitting under a pessimistic result.

### 2. The commons has no brake before the wall

`GatherResourcesEvent` extracts `min(output, naturalResources)` — output does not scale with how full
the pool is. So there is no negative feedback in the interior: if `N × gather < regen` the pool fills
to the ceiling, otherwise it drains to zero. The pool is bang-bang, and the only signal the
population ever receives is starvation *after* exhaustion.

That is why the commons gate at 40% is either trivially satisfied (surplus regime, pool pinned at
~100%) or catastrophically failed — the model has no way to sit at a partly-drawn commons. And it is
why every default run overshoots: nothing tells the population it is approaching the limit until it
is past it. Both abundance ablations fail on exactly this, with the population still at its peak.

### 3. Gini is partly an age-structure statistic

`Simulation.snapshot()` computes Gini over all living persons, and newborns enter at `resources = 0`
(ARD 037) with no income until they accumulate experience. Measured on the default config at tick 60:

```
giniAll = 0.346   giniAdults = 0.192   childShare = 30%
```

A society with genuinely equal adults (0.19) reads 0.35 and fails the 0.30 THRIVING gate on
dependency ratio alone. Since population growth raises child share, **growth mechanically pushes Gini
through the gate** — a direct conflict with the peak-decline gate, which wants the population rising.
This is the already-filed future-ideas item "Resource Gini counts dependent children's structural
zeros"; this study quantifies it at roughly +0.15 in a healthy growing phase.

### 4. Welfare concentrates when few qualify

`distributeWelfare` splits `communityPool × (1 − reserve)` **equally among the eligible**. In a
wealthy population where almost nobody is below `WELFARE_THRESHOLD`, the entire tax take lands on a
handful of people. Observed directly: a run with `TAX_RATE=0.05, WELFARE_THRESHOLD=60` had Gini climb
from 0.17 to 0.86 while everyone was healthy, employed and the commons was full. The mechanism meant
to compress inequality manufactured it. Setting the threshold above everyone's resources (a flat UBI)
inverts this completely — Gini falls to 0.02–0.16 and stays there, which is why it is load-bearing in
the existence config.

## What would have to change for THRIVING to be reachable by default

In priority order, and each is ARD-level:

1. **Fix the productivity band.** `EXTRACTION_PRODUCTIVITY_FLOOR = 1 / MAX_EXTRACTION_PRODUCTIVITY`
   makes the walk log-symmetric about its starting value, so ARD 047's stated intent actually holds.
   Cheapest change here, largest effect, and it removes an unchosen pessimism from every result the
   project has recorded since ARD 047.
2. **Give the commons a soft brake.** Scale gather output by pool fill (or make fertility/consumption
   respond to it) so extraction falls as the pool draws down. This is what turns overshoot into
   approach, and it is what the existing "crash recovery / anti-Allee" item is missing — anti-Allee
   rescues the trough, a soft brake prevents the crash.
3. **Decide what Gini is measuring.** Adult-only or household Gini would make the primary collapse
   signal track adult inequality instead of dependency ratio. Already on the future-ideas list;
   this study is the case for promoting it.
4. **Fix welfare concentration.** Cap the per-capita share, or make the payout proportional to the
   shortfall rather than an equal split of the whole pool.

Items 1 and 2 are the ones that would plausibly move the default config. 3 and 4 are measurement and
mechanism defects that will distort any calibration attempted before they are fixed.

## Caveats

- Two seeds per config. Enough for an existence claim, not for effect sizes.
- Most default-fertile-window cells with fertility retuned upward did not finish within the time
  budget — populations in the thousands are slow in-process. The one that did (`BASE_CHILDBIRTH_RATE
  =0.10`, ceiling 30k, one seed) grew monotonically to 3065 and failed on the **commons**, not on
  demography, so the narrow fertile window does not look independently load-bearing — but that rests
  on a single seed.
- The social-stability ablation is confounded with fertility retuning and should not be read as
  showing those constants matter in themselves.
- `scripts/thrive-probe.ts` reports the four gates per decade using a *prefix* peak, i.e. what
  `classifyOutcome` would have returned had the run ended at that decade. The final-row verdict calls
  `classifyOutcome` directly.
