# Research: Sweep Session — Productivity Drift, and Four Things That Don't Matter

**Recorded:** 2026-09-14 | **Commit:** 84c675d | **Latest ARD:** 062 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/sweep.ts --seeds 16 --ticks 800 --set KEY=VAL [--set KEY=VAL …] --workers 2` (see per-section commands below)
**Key context vars:** `EXTRACTION_PRODUCTIVITY_FLOOR=0.01`, `MAX_EXTRACTION_PRODUCTIVITY=10`, `BASE_INVENTION_RATE=0.002`, `INVENTION_DEPLETION_FASTER_WEIGHT=1`, `INVENTION_DEPLETION_SLOWER_WEIGHT=1`, `JAIL_TICKS_KILL=10`, `KILL_GINI_SCALAR=1.5`

This session ran eight parallel hypotheses that hadn't been swept before — mostly interactions between
already-documented levers, plus a few completely untouched constants (jail severity, HelpEvent
generosity, KillEvent's inequality-violence feedback). Method: 8 parallel Haiku agents, each running
2 `sweep.ts` commands at 16 seeds / 800 ticks (the CLAUDE.md-mandated long horizon), with a documented
default baseline for comparison: **32 seeds, 800 ticks, unmodified Variables → `EXTINCTION×30
STRUGGLING×2`, median peak population 703, `bound%=8%`, `stable=2/32`** (from
`docs/research-thriving-reachability.md`'s ARD 062 validation table).

## Headline finding: removing productivity drift exposes a latent oscillatory mode — and changes the failure mode rather than fixing it

> **Re-verified 2026-09-15 (commit `a805635`) — the productivity pin holds on a paired test, at
> longer horizons and larger populations.** `docs/research-scale-robustness.md` compares default
> against the pin over the same 48 seeds: 48 → 31 of 48 extinct at 4000 ticks with 100 founders,
> 48 → 21 at 300 founders, and 24 → 0 of 24 in a world whose commons is scaled to its population.
> Peak population roughly doubles in every condition. The doc's own warning that this is Malthusian
> cycling rather than abundance also holds: the share of ticks with the pool stripped goes from 2% to
> 20% at 100 founders and 3% to 39% at 300.

`docs/research-tuning-defaults.md` scanned for the `OSCILLATING` regime (population sustaining
repeated boom-bust cycles instead of a single terminal collapse) and "finds none" outside two narrow
cases: a 15× `BASE_INVENTION_RATE` (`stable=6/16` at 800t) and a strong anti-Allee fertility probe
(`stable≈3/16`). **Addendum 3 below re-measures the first of those and finds it doesn't hold at
adequate power** (6/48 vs a matched default control's 2/48, p=0.27), and the second has never been
re-measured — so the honest starting point is that *no* lever had an established `stable` effect.
Against that, this session found one that does move the dynamics, hiding behind a mechanism nobody
had isolated: **`extractionProductivity`'s downward drift (see
`docs/research-thriving-reachability.md` item 1) isn't just an unchosen pessimism — removing it
changes the model's *qualitative* dynamics from "boom once, crash to extinction" to "boom, crash
partway, boom again."** Note the same power caveat applies to the `stable` counts in the table below;
the `cyc=0` column is the part of this finding that rests on firmer ground.

| Config (16 seeds, 800 ticks unless noted) | `stable` | never cycles (`cyc=0`) | Extinction | Median peak pop | `bound%` |
|---|---|---|---|---|---|
| **Default, measured here (16 seeds)** | 1/16 (6%) | **10/16** | 15/16 (94%) | 703 | 8% |
| Default (32 seeds, documented, for reference) | 2/32 (6%) | — | 30/32 (94%) | 703 | 8% |
| `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` alone (log-symmetric band, still a random walk) | 2/16 (12.5%) | — | 13/16 (81%) | 773 | 43% |
| Full pin (`INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=0`, productivity frozen at 1.0) | **10/16 (62.5%)** | **3/16** | 4/16 (25%) | 1187 | 41% |
| `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` + `BASE_INVENTION_RATE=0.03` (15×) | **15/16 (94%)** | — | **0/16 (0%)** *(3/16 by 1500t)* | 1383 | 47% |
| `BASE_INVENTION_RATE=0.03` alone (this session's control) | 3/16 (18.75%) | — | 12/16 (75%) | 1024 | 19% |
| `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` + `NATURAL_RESOURCE_REGEN_FRACTION=0.05` (8 seeds) | 6/8 (75%) | — | 2/8 (25%) | 1410 | 59% |
| `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` + `MAX_NATURAL_RESOURCE_CEILING=40000` (8 seeds) | 4/8 (50%) | — | 1/8 (12.5%) | 2180 | 61% |

**Baseline reproduces.** The default control was re-measured here rather than taken on faith
(`npx ts-node scripts/sweep.ts --seeds 16 --ticks 800 --workers 2 --verbose`) and lands on the
documented 32-seed figures almost exactly: 94% extinction either way, identical median peak (703) and
`bound%` (8%), `stable` 1/16 vs 2/32. So the denominator these comparisons rest on is sound.

**One number did not reproduce, and it is instructive.** `BASE_INVENTION_RATE=0.03` alone gave
`stable=3/16` and 12/16 extinct here, against `stable=6/16` and 9/16 extinct recorded in
`docs/research-tuning-defaults.md` at 800 ticks for the same nominal config. That study is from
2026-06-05 at commit `fcfe1bd` — i.e. **before ARDs 052–062 landed** (seed structure, pairing,
employment seeding, the fertile-window correction, the adult-basis Gini, and the two welfare
revisions). None of those variables appear in that study's `Key context vars` line, because nobody
could have known to list them. This is precisely the drift the provenance convention in CLAUDE.md was
added to catch, and it is a live example: an invention-lever result that everyone has been citing as
`6/16` reads `3/16` on current `master`. Treat the invention-alone figure — and the "synergy"
inference that rests on comparing against it — as the least trustworthy claim in this table.

> **Followed up: the full invention ladder was re-measured (addendum 3 below), and the `6/16` claim
> does not survive.** At 48 seeds against a matched default control it is 6/48 vs 2/48, p=0.27 — the
> lever's sustained-cycle effect was never distinguishable from the default.

**The gradient is not a single clean axis — an earlier draft of this doc overstated that.** The two
resource rows at the bottom carry the *same* productivity treatment as the `FLOOR=0.1`-alone row
(2/16) yet score 6/8 and 4/8, so resource abundance is doing substantial work independently of
anything about productivity. What the table actually supports is narrower: removing productivity
*variance* is the single largest mover found here, widening the band alone is not the same
intervention as freezing it (2/16 vs 10/16), and several other levers push `stable` up too. The
"synergy" reading of `FLOOR=0.1` + 15× invention (15/16, zero extinctions) rests on one 16-seed run
whose invention-alone control is the row that failed to reproduce — **and its zero-extinction figure
does not survive a longer horizon: at 1500 ticks the same config is 3/16 extinct with `stable` down
to 11/16** (second addendum below).

**The more robust statistic is `cyc=0`** — the count of seeds that never establish *any* oscillation
and simply boom once and die, which needs no judgment call about trough thresholds. It goes from
**10/16 at default to 3/16 under the pin**. That is the cleanest statement of the effect in this
doc, and it does not depend on `stableCycle`'s calibration at all.

**These are not abundance regimes — read `bound%` before reading `stable`.** Every config that scores
well on cycling sits at 41–61% `bound%` against the default's 8%: the commons is fully exhausted for
roughly half of all ticks. What the productivity fix buys is a population that oscillates *against a
depleted resource floor* rather than dying at it — sustained Malthusian cycling, not prosperity.
Given the project's stated goal is abundance rather than merely non-extinction, that distinction
matters more than the `stable` column does, and none of these configs is a candidate for a "good"
default on this evidence.

**Why `classifyOutcome` still reads COLLAPSE almost everywhere in this table**, despite `stable`
climbing to 94%: `detectCycles`'s `stableCycle` flag only requires ≥2 complete oscillations whose
troughs don't ratchet down (`troughTrend ≥ 0.5`) — it says nothing about where the population sits
*right now* relative to its all-time peak. `classifyOutcome`'s COLLAPSE/STRUGGLING labels are driven
substantially by peak-relative decline in the final decade. A population that is genuinely
oscillating will, most of the time, **not** be sitting at its peak — so at whatever tick you stop the
clock, it reads as decline-from-peak even though the underlying dynamic is a stable cycle, not a
one-way crash. Per-seed detail from the full-pin run makes this concrete (`--verbose`, own
verification run, matches the H3 agent's aggregate exactly):

```
seed   1  COLLAPSE  end= 224 peak=1230 min= 20 cyc=2 per=254 trTrend=0.66 STABLE-CYCLE
seed   6  COLLAPSE  end=  98 peak=1153 min= 17 cyc=2 per=267 trTrend=0.98 STABLE-CYCLE
seed  13  COLLAPSE  end=   2 peak=1154 min=  2 cyc=2 per=282 trTrend=0.72 STABLE-CYCLE
```

10 of 16 seeds hit `cyc=2` with `min` population staying well above zero (13–21) and `trTrend`
scattered both above and below 1.0 (0.37 to 2.79) — some cycles are rebuilding, some are still
declining cycle-to-cycle. This is genuinely a different regime from the default's one-shot overshoot,
**but** several seeds (e.g. seed 13: end=2) hit the tick-800 cutoff right at the bottom of what could
be a third crash, which `detectCycles` can't yet see because it only requires 2 confirmed cycles.

**Caveat on the `stable` metric itself.** `stableCycle` passes at `troughTrend ≥ 0.5`, i.e. a
population whose troughs have *halved* over the run still counts as "non-collapsing." Seed 1 at 1500
ticks passes with `trTrend=0.55` — troughs down 45% across 5 cycles. That is a generous bar, and
every `stable` figure in this doc inherits it. It is closer to "hasn't died yet and is still
oscillating" than to "holds a floor." This is a pre-existing property of the harness, not something
this session introduced, but it means `stable` counts should not be read as evidence of equilibrium.
The `cyc=0` column above is the threshold-free alternative.

**An early-failure mode the fix doesn't touch.** Under the pin, seeds 10, 14 and 16 never cycle at
all (`cyc=0`) and are extinct by ticks 258/329/268 with peaks of only ~760–790 — they fail before the
oscillatory regime can establish. The same mode dominates the default config (10 of 16 seeds have
`cyc=0` there, most dead before tick 200). So the productivity fix converts early failure from the
majority outcome into a minority one (10/16 → 3/16) but does not eliminate it; roughly a fifth of
seeds die in the first ~330 ticks regardless.

> **Resolved — see both addenda.** Each productivity config was re-run to 1500 ticks to check whether
> these seeds complete further cycles or ratchet to extinction shortly after tick 800. Short answer:
> they do keep cycling (median `cyc=5`), and they also keep dying at a steady per-cycle rate, because
> the troughs bottom out around 10 people.

### What this means for the `OSCILLATING` label item in `docs/future-ideas.md`

That item's prior claim — "a scan across seeds, long horizons, and even zero ceiling degradation
finds **none**" — was run at default productivity dynamics. This session didn't test the *default*
regime; it found the oscillating regime specifically *because* it removed productivity drift, which
nobody had tried before pairing with a long-horizon `stable` measurement. The 1500-tick checks (both
addenda) confirm the oscillation is real — populations run five-plus cycles, well past the point the
original scan would have measured them, and some rebuild to most of their historical peak — but they
also show it is **not** the persistent regime the `OSCILLATING` label was meant to name: 17–19% of
surviving seeds go extinct per 700 ticks, because every trough passes within ~10 individuals of zero.

So this is a materially new data point for that future-ideas item and for
`docs/research-tuning-defaults.md`'s "no single constant fixes overshoot→extinction" conclusion,
but it is not a refutation of either. What it establishes is narrower and more useful: the model has
a latent oscillatory mode that productivity drift was suppressing, and exposing it converts the
failure from *one-shot terminal overshoot* into *repeated near-miss cycling*. The crash-recovery /
anti-Allee mechanism is still required — this study just says precisely where it has to act
(populations of 5–20) and what to calibrate it against (trough depth).

## H5 — Jail/detection severity: works on crime, irrelevant to outcomes

Nobody had swept punishment severity before. Two extremes at 16 seeds / 800 ticks:

| Config | Extinction | `stable` | Median peak pop | `bound%` | murder deaths/birth | illness deaths/birth |
|---|---|---|---|---|---|---|
| Punitive (`JAIL_TICKS_KILL=40`, `JAIL_TICKS_STEAL=15`, `BASE_DETECT_RATE_KILL=0.4`, `BASE_DETECT_RATE_STEAL=0.2`) | 16/16 (100%) | 0/16 | 664.5 | 19% | 0.081 | 0.985 |
| Near-lawless (`JAIL_TICKS_KILL=1`, `JAIL_TICKS_STEAL=1`, `BASE_DETECT_RATE_KILL=0.02`, `BASE_DETECT_RATE_STEAL=0.01`) | 14/16 (87.5%) | 1/16 | 727.5 | 17% | 0.091 | 0.937 |
| Default, measured here (16 seeds) | 15/16 (93.75%) | 1/16 | 703 | 8% | — | — |

> **An earlier draft of this doc read the extinction column as "harsher punishment is worse" and
> attached a causal mechanism to it (`JailEvent` incapacitating gatherers who still draw from the
> community pool). The death-cause data, run afterwards, does not support that story.**

Deterrence does work on the thing it targets: murder deaths per birth fall ~12% in the punitive arm
(0.081 vs 0.091), in the expected direction. But murder is only **7.6–8.9% of all deaths** in both
arms — illness and starvation carry the other ~91% — so even a large relative change in the homicide
rate cannot move the population trajectory. And the mechanism the earlier draft proposed predicts
higher illness/starvation mortality under incapacitation: the actual difference is 0.985 vs 0.937
illness-deaths-per-birth, ~5%, in the right direction but far too small to carry a 16/16-vs-14/16
extinction gap, and confounded by the lawless arm's runs lasting longer.

**Corrected reading:** the punishment subsystem is internally well-behaved and does what it says, but
it is not load-bearing for collapse/thrive outcomes. The extinction difference between the two arms
(one seed either side of the measured default's 15/16) is noise. This converges with H8 below on the
same conclusion from the other direction — two independent probes of the violence subsystem, both
landing on "too small a share of mortality to matter."

## Clean null results

Three unexplored channels turned out not to matter, and the null is itself informative because it
narrows where the model's real leverage is:

**H8 — `KillEvent`'s inequality→violence feedback (`KILL_GINI_SCALAR`).** Turning it off entirely
(`=0`) versus cranking it to 3× default (`=5`) produced **identical** peak population (703 vs 709.5)
and peak Gini (0.86 vs 0.86), with extinction/stable within noise of the measured default baseline.
Killing is too small a share of total mortality for the model's one explicit HANDY/Turchin-style
feedback loop to have any visible leverage on outcomes — H5's death-cause breakdown puts the number
at **7.6–8.9% of deaths**, against ~91% for illness and starvation. The mechanism exists in the code;
it just isn't load-bearing. Taken with H5, the whole violence subsystem (intent, inequality feedback,
detection, punishment) is a closed loop that barely touches the population trajectory.

**H6 — Informal peer-to-peer help (`HELP_FRACTION`/`HELP_MAX_AMOUNT`).** A 3× boost
(`0.3`/`30`) changed nothing (`EXTINCTION×16`, identical peakGini 0.85, `stable=0/16`). Only a 5×
boost (`0.5`/`50`) moved the needle at all, and only slightly (2 seeds land on COLLAPSE instead of
EXTINCTION, `stable=1/16`, Gini drops 0.85→0.81). This mirrors the formal welfare system's ARD 061/062
null result almost exactly, despite HelpEvent being a structurally different channel (intent-gated,
voluntary, uncapped by a shared pool). Both of the model's redistribution channels — formal and
informal — are now confirmed non-load-bearing for long-horizon survival. Whatever decides the
model's fate, it isn't how generously resources move between people once they exist.

**H7 — Aggressive re-pairing as a crash-recovery proxy (`BASE_RELATIONSHIP_RATE` up to 5×,
`RELATIONSHIP_AGE_GAP_SCALE` loosened, `BASE_BREAKUP_RATE` lowered).** No improvement over baseline
at any setting (`stable` 0/16 and 1/16, extinction 15/16 both times, peak population within noise of
703). Partnership *formation rate* is not the bottleneck on post-crash recovery — couples form fine;
something else (age structure of survivors, fertile-window timing, or the productivity/commons
mechanisms this session's headline finding targets) is what actually prevents rebuilding. This
directly narrows the "crash recovery" future-ideas item: don't spend an ARD on a faster-pairing
mechanic, the lever isn't there.

## H4 — Modest resource increases still just buy a bigger boom (confirms prior finding, adds `stable` data)

A 67% regen bump and a 2× ceiling cap, each paired with the productivity-band fix, both reproduce the
"bigger inputs buy a bigger boom, not stability" pattern from `docs/research-tuning-defaults.md`:
peak population roughly doubles and triples respectively, `bound%` gets *worse* (59–61% vs 8%
baseline) rather than better, and COLLAPSE/EXTINCTION still dominate the outcome label. The new
information is the `stable` column — 6/8 and 4/8 — which fits the same productivity-drift-removal
gradient as the headline finding above (both configs include `EXTRACTION_PRODUCTIVITY_FLOOR=0.1`).
Consistent with `docs/future-ideas.md`'s "commons has no feedback before exhaustion" item: more
resources just relocate where the wall is, they don't add a brake.

## Caveats

- 16 seeds per arm (8 for the two H4 configs that stalled under CPU contention and were rerun
  smaller). Good enough to see large, consistent effects (the `cyc=0` shift, the three nulls); not
  enough to trust small differences — any single extra COLLAPSE-vs-EXTINCTION seed in this doc is
  noise, including every difference in the H5 table's outcome columns.
- The `FLOOR=0.1` + 15× invention cell (15/16 stable, 0 extinctions) is a single 16-seed run and the
  most consequential number here. Its own invention-alone control is the one figure in this study that
  failed to reproduce against prior work (3/16 vs a recorded 6/16). It needs 32+ seeds before anyone
  builds on it.
- `stable` rests on a `troughTrend ≥ 0.5` threshold that permits troughs to halve over a run; prefer
  `cyc=0` counts when a threshold-free statistic will do.
- Everything here is measured on configs that sit at 41–61% `bound%`. These are cycling-under-scarcity
  regimes, not abundance, and nothing in this study speaks to what produces abundance.
- All runs used `--workers 2` to share 4 CPUs across concurrently-running sweep agents; wall-clock
  times in agent transcripts reflect that contention and say nothing about the model itself.
- Two of the eight agents stalled polling their own background jobs and had to be re-driven; their
  configs were rerun directly. No result in this doc is taken solely from an agent's summary — every
  headline number was either re-run here or is quoted from a raw table reproduced in this doc.

## Addendum: 1500-tick horizon check on the full-pin config

`npx ts-node scripts/sweep.ts --seeds 16 --ticks 1500 --set INVENTION_DEPLETION_FASTER_WEIGHT=0 --set INVENTION_DEPLETION_SLOWER_WEIGHT=0 --workers 2 --verbose`, same 16 seeds as the 800-tick run above.

```
outcomes (n=16)                     endPop  peakPop  peakGini  bound%  orphPk%  welf%  extinct  cyc  stable
-----------------------------------------------------------------------------------------------------------
STRUGGLING×3 COLLAPSE×7 EXTINCTION×6    40.5     1214      0.56     39%     100%    49%     6/16  4.5    7/16
```

**Answer: partly confirmed, partly refuted — this is a genuinely mixed result, not a clean yes or no.**

Tracking the 10 seeds tagged `STABLE-CYCLE` at 800 ticks individually out to 1500:

| Seed | 800t | 1500t |
|---|---|---|
| 1 | COLLAPSE, end=224, cyc=2 | **STRUGGLING, end=831, cyc=5, still STABLE-CYCLE** — rebuilt to 68% of peak |
| 3 | COLLAPSE, end=175, cyc=2 | COLLAPSE, end=218, cyc=4, still STABLE-CYCLE |
| 4 | COLLAPSE, end=249, cyc=2 | **STRUGGLING, end=1193, cyc=4, still STABLE-CYCLE** — 97% of its own peak |
| 5 | COLLAPSE, end=228, cyc=2 | COLLAPSE, end=50, cyc=5, still STABLE-CYCLE |
| 6 | COLLAPSE, end=98, cyc=2 | **EXTINCTION, extinct@1324** |
| 7 | COLLAPSE, end=142, cyc=2 | COLLAPSE, end=31, cyc=5, still STABLE-CYCLE |
| 8 | COLLAPSE, end=142, cyc=2 | **STRUGGLING, end=758, cyc=5, still STABLE-CYCLE** — rebuilt to 61% of peak |
| 9 | COLLAPSE, end=312, cyc=2 | COLLAPSE, end=464, cyc=5, **lost STABLE-CYCLE tag** (trough trend fell 0.67→0.38) |
| 12 | COLLAPSE, end=49, cyc=2 | COLLAPSE, end=455, cyc=5, still STABLE-CYCLE |
| 13 | COLLAPSE, end=2, cyc=2 | **EXTINCTION, extinct@852** |

The two seeds flagged as suspicious in the first draft of this doc (very low `end` population relative
to peak right at the tick-800 cutoff) resolved exactly as feared for one of them and worse than feared
for the other: **seed 13 (end=2 at 800t) went extinct 52 ticks later**, confirming that a low-margin
ending at an arbitrary horizon can be a real terminal crash the detector hadn't seen yet. **Seed 6
(end=98, comfortably tagged `STABLE-CYCLE` with `trTrend=0.98`) also went extinct**, 524 ticks further
out — so passing the detector's 2-cycle bar is not sufficient to guarantee survival; the "stable"
label from a 2-cycle read is provisional, not a persistence guarantee.

But the majority of the 800-tick "stable" cohort did not do this. Seven of the ten sustained a 4th or
5th oscillation and are still alive at 1500 ticks, three of them (seeds 1, 4, 8) rebuilding to 61–97%
of their historical peak — genuine recovery, not a slow bleed-out. Aggregate: `extinct` rose from
4/16 → 6/16 and `stable` fell from 10/16 → 7/16 between the two horizons, both consistent with an
ongoing, non-trivial attrition rate among cycling populations rather than either a hard floor or an
inevitable ratchet to zero.

**Conclusion:** removing productivity drift produces a real, qualitatively different regime — most
populations that start cycling keep cycling for at least 1500 ticks, several substantially rebuild —
but it is not (at least not yet, on this evidence) a stable equilibrium in the strict sense. There is
a continuing background hazard of the down-phase of a cycle bottoming out at true zero, roughly
1-in-5 of the 800-tick "stable" cohort by tick 1500. This is still a dramatically better regime than
the default's near-universal one-shot terminal collapse (94% extinct by 800 ticks with `stable=6%`),
and a genuinely new data point for the shelved `OSCILLATING` label item — but the honest framing is
"productivity drift was suppressing a real oscillatory mode, and even the fixed version keeps
occasionally rolling extinction on its down-phases," not "productivity drift was the whole answer."
A crash-recovery mechanism (the still-unbuilt anti-Allee item) would plausibly close this remaining
gap by rescuing exactly the low-trough seeds that currently sometimes fail to recover — that is a
sharper, evidence-backed version of the same future-ideas item, not a new one.

## Addendum 2: 1500-tick horizon check on `FLOOR=0.1` + 15× invention — and why neither config is an equilibrium

The headline cell (15/16 stable, 0/16 extinct at 800 ticks) had never been horizon-checked, because
an earlier draft mislabeled it as the pin config and checked that instead. Run directly
(`--seeds 16 --ticks 1500 --set EXTRACTION_PRODUCTIVITY_FLOOR=0.1 --set BASE_INVENTION_RATE=0.03`):

```
outcomes (n=16)                     endPop  peakPop  peakGini  bound%  orphPk%  welf%  extinct  cyc  stable
-----------------------------------------------------------------------------------------------------------
COLLAPSE×12 STRUGGLING×1 EXTINCTION×3     118   1456.5      0.73     48%     100%    51%     3/16    5   11/16
```

**The zero-extinction result does not hold.** 800 ticks → 1500 ticks takes this config from 0/16 to
3/16 extinct (seeds 6, 12, 13, at ticks 1269, 841, 1065) and `stable` from 15/16 to 11/16. Surviving
seeds are cycling hard — median `cyc=5`, period ~260 ticks — so the oscillatory regime is
unambiguously real. It just isn't safe.

**The mechanism, and the most useful number in this study: the troughs bottom out at a median of 10
people.** Across the 13 surviving seeds the per-run minimum population is 5, 6, 7, 10, 10, 10, 10, 11,
12, 15, 15, 16, 18. Every ~260 ticks these populations pass within a handful of individuals of zero
and happen to come back. That reframes the whole finding: this is not an equilibrium with a floor, it
is **a random walk with an absorbing barrier**, and each cycle is a fresh roll against it.

The attrition rate is consistent across both productivity configurations, which is what you would
expect if that is the operative mechanism:

| Config | extinct @800t | extinct @1500t | share of survivors lost over 700 ticks |
|---|---|---|---|
| Full pin | 4/16 | 6/16 | 2 of 12 → **17%** |
| `FLOOR=0.1` + 15× invention | 0/16 | 3/16 | 3 of 16 → **19%** |

At a ~260-tick period that is roughly a **7% extinction hazard per trough**, and nothing in the data
suggests it decays with time — the troughs are not getting shallower. Extrapolated naively, a constant
per-cycle hazard takes essentially every seed eventually; these configs postpone collapse rather than
escaping it.

**What this does to the session's headline.** "Removing productivity drift unlocks sustained cycling"
survives — `cyc=0` really does go 10/16 → 3/16, and populations really do run five-plus cycles. But
"and eliminates extinction" does not, and neither config is a stability result. The honest summary is
that the productivity fix **changes the failure mode** from *one-shot terminal overshoot* to *repeated
near-miss cycling with a per-cycle extinction hazard*, at 41–61% commons exhaustion throughout.

This sharpens the crash-recovery / anti-Allee future-ideas item into something with a concrete target
rather than a vague aspiration: the mechanism needs to bite at **populations of 5–20**, which is
exactly where these cycles bottom out and exactly where the model currently has no support at all.
The measurable success criterion is trough depth, not `stable` counts — raise the trough floor and the
per-cycle hazard falls out of it. That is a better-specified ARD than "add crash recovery," and it is
the single most actionable thing this session produced.

## Addendum 3: re-measuring `docs/research-tuning-defaults.md`'s invention ladder

The invention-alone control above disagreed with the recorded figure, so the whole ladder was re-run
(`--seeds 16 --sweep BASE_INVENTION_RATE=0.002,0.01,0.03` at each of 300/500/800 ticks), then the
decisive cell was re-run at 48 seeds against a matched control.

| `BASE_INVENTION_RATE` | 300t (orig → new) | 500t (orig → new) | 800t (orig → new) |
|---|---|---|---|
| 0.002 (default) | 11/16 → **10/16** ext | — → 13/16 ext | — → 15/16 ext, 1 stable |
| 0.01 (5×) | 4/16 → **6/16** ext | 12/16 → **9/16** ext | 16/16 → **15/16** ext, 0 → 1 stable |
| 0.03 (15×) | 4/16 → **7/16** ext | 6/16 → **9/16** ext, 3 → **0** stable | 9/16 → **12/16** ext, 6 → **3** stable |

**No individual cell differs significantly at n=16** — every Fisher p ≥ 0.23, and a 3-seed swing at
this sample size is p ≈ 0.46. But the 0.03 row moves against the original at all three horizons, so
the headline cell was re-run properly:

| 800 ticks, 48 seeds, same commit and seeds | default | `BASE_INVENTION_RATE=0.03` | Fisher p |
|---|---|---|---|
| `stable` | 2/48 (4.2%) | 6/48 (12.5%) | **0.268** |
| extinct | 46/48 (95.8%) | 39/48 (81.2%) | 0.051 |

**What survives:** the extinction benefit. 95.8% → 81.2% at p=0.051 supports invention as a *partial
mitigator*, as that study concluded.

**What doesn't:** the sustained-cycle claim, which was the interesting half. The recorded 37.5%
(6/16) is 3× the best current estimate of 12.5% (6/48) and outside its 95% CI [5.9%, 24.7%] — and at
matched power, 12.5% vs the default's 4.2% is **not a distinguishable difference** (p=0.27, CIs
overlapping). "The only single-lever change to produce genuine sustained cycles" is not supported by
data at adequate power. It may still be true; it has simply never been shown.

**What this is really about.** The drift cannot be cleanly separated from noise — ARDs 052–062 landed
between the two measurements, but the original cell was also just underpowered. That second point is
the transferable one: **`stable` is a binary count over 16 seeds, and at that n it cannot resolve the
effect sizes this project routinely reports.** The same applies to the anti-Allee probe's 2–3/16
(never re-measured), to several cells in this very document, and to the sustained-cycle counts in the
headline table above. The methodological lesson the tuning-defaults study exists to teach — run the
horizon ladder, short horizons lie — is untouched and reproduces cleanly. It just needs a companion
rule: **run 48+ seeds before believing a `stable` difference, or use a continuous per-run measure
(trough depth, `cyc`, peak-relative decline) that carries more information per seed.**

## Addendum 4: everything re-run at 48 seeds out to 2000 ticks — 800 ticks was too short

A performance change (PR #107, bitwise-identical, verified here by reproducing the 48-seed default
baseline exactly) made sweeps ~20× faster, so every config in this study was re-run at **48 seeds**
across a 800/1200/1600/2000 horizon ladder. These supersede the 16-seed figures above.

**Extinct seeds out of 48:**

| Config | 800t | 1200t | 1600t | 2000t |
|---|---|---|---|---|
| Default | 46 | **48** | 48 | 48 |
| `BASE_INVENTION_RATE=0.03` (15×) | 39 | 45 | 47 | **48** |
| Full productivity pin | 8 | 12 | 20 | **23** |
| `FLOOR=0.1` + invention 0.03 | 8 | 14 | 21 | **26** |

### The invention lever has no surviving benefit at all

Addendum 3 concluded that invention's extinction reduction held up even though its sustained-cycle
claim didn't. **That conclusion was itself an artifact of stopping at 800 ticks.** Invention delays
total extinction from ~1200 ticks to ~2000 and then everything dies anyway: 48/48, identical to
default. The original study drew a sharp distinction between 0.01 ("only *delays* the crash") and
0.03 ("does more than delay"). At an adequate horizon that distinction disappears — **both rates only
delay.** Nothing about the invention lever survives.

### The productivity configs are qualitatively different, but still decaying

They are the only configs with survivors at 2000 ticks (25 and 22 of 48). But survival is not
stabilising — it decays at a roughly constant rate:

| Config | survivors lost per 400 ticks | exponential half-life | extrapolated to 5000t |
|---|---|---|---|
| Full pin | 10%, 22%, 11% | ~1770 ticks | ~8 of 48 |
| `FLOOR=0.1` + invention | 15%, 21%, 19% | ~1391 ticks | ~5 of 48 |

A constant hazard with no sign of flattening is exponential decay, not equilibrium. Sustained-cycle
counts erode in step (pin 36 → 18 of 48; floor+invention 34 → 14). This confirms the prediction in
addendum 2 quantitatively: the cycles pass close enough to zero that extinction is a matter of time.
Productivity drift is still the one intervention that changes the *shape* of the failure — half the
seeds are alive at 2000 where every other config is at zero — but it postpones collapse rather than
preventing it.

### Methodological: the 800-tick rule has the same flaw it was written to fix

`docs/calibration-guide.md` says judge configs at 500–800 ticks because shorter horizons measure
mid-overshoot. **800 ticks reproduces that error one level up.** At 800 ticks invention-alone looks
like a genuine improvement over default (39 vs 46 extinct, p≈0.05); at 2000 it is exactly null. Any
config whose benefit is *delay* will read as *rescue* at a horizon shorter than the delay it buys.

Two rules follow, and they compound with the seed-count rule from addendum 3:

1. **Judge extinction claims at 2000 ticks, not 800.** 800 is the new 300.
2. **Prefer the extinction-vs-horizon curve to any single-horizon count.** A config that is
   genuinely different has a curve that flattens; a config that merely delays has one that keeps
   climbing to 48/48. That distinction is invisible at any one horizon and obvious across four.
