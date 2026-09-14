# Research: Sweep Session — Productivity Drift, Punishment, and Two Dead Ends

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

## Headline finding: eliminating productivity drift unlocks sustained cycling that `classifyOutcome` can't see

`docs/research-tuning-defaults.md` scanned for the `OSCILLATING` regime (population sustaining
repeated boom-bust cycles instead of a single terminal collapse) and "finds none" outside two narrow
cases: a 15× `BASE_INVENTION_RATE` (`stable=6/16` at 800t) and a strong anti-Allee fertility probe
(`stable≈3/16`). This session found a third, much stronger lever, and it was hiding behind a
mechanism nobody had isolated before: **`extractionProductivity`'s downward drift (see
`docs/research-thriving-reachability.md` item 1) isn't just an unchosen pessimism — removing it
changes the model's *qualitative* dynamics from "boom once, crash to extinction" to "boom, crash
partway, boom again."**

| Config (16 seeds, 800 ticks unless noted) | `stable` | never cycles (`cyc=0`) | Extinction | Median peak pop | `bound%` |
|---|---|---|---|---|---|
| **Default, measured here (16 seeds)** | 1/16 (6%) | **10/16** | 15/16 (94%) | 703 | 8% |
| Default (32 seeds, documented, for reference) | 2/32 (6%) | — | 30/32 (94%) | 703 | 8% |
| `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` alone (log-symmetric band, still a random walk) | 2/16 (12.5%) | — | 13/16 (81%) | 773 | 43% |
| Full pin (`INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=0`, productivity frozen at 1.0) | **10/16 (62.5%)** | **3/16** | 4/16 (25%) | 1187 | 41% |
| `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` + `BASE_INVENTION_RATE=0.03` (15×) | **15/16 (94%)** | — | **0/16 (0%)** | 1383 | 47% |
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
inference that rests on comparing against it — as the least trustworthy claim in this table, and
consider re-measuring `docs/research-tuning-defaults.md`'s invention ladder outright.

**The gradient is not a single clean axis — an earlier draft of this doc overstated that.** The two
resource rows at the bottom carry the *same* productivity treatment as the `FLOOR=0.1`-alone row
(2/16) yet score 6/8 and 4/8, so resource abundance is doing substantial work independently of
anything about productivity. What the table actually supports is narrower: removing productivity
*variance* is the single largest mover found here, widening the band alone is not the same
intervention as freezing it (2/16 vs 10/16), and several other levers push `stable` up too. The
"synergy" reading of `FLOOR=0.1` + 15× invention (15/16, zero extinctions) is the most interesting
cell in the table and also the least verified — it is one 16-seed run whose invention-alone control
is the row that failed to reproduce.

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

> **Resolution pending:** a 1500-tick re-run of the full-pin config (same command, `--ticks 1500`) was
> in flight when this doc was first written, specifically to check whether these seeds complete a
> third cycle (confirming genuine sustained oscillation) or ratchet down to extinction shortly after
> tick 800 (meaning `stable=10/16` was measuring a wider single overshoot, not real persistence). ***See
> the addendum below for the result.***

### What this means for the `OSCILLATING` label item in `docs/future-ideas.md`

That item's prior claim — "a scan across seeds, long horizons, and even zero ceiling degradation
finds **none**" — was run at default productivity dynamics. This session didn't test the *default*
regime; it found the oscillating regime specifically *because* it removed productivity drift, which
nobody had tried before pairing with a long-horizon `stable` measurement. The 1500-tick check (see
addendum below) confirms this is real but incomplete: most populations that start cycling keep
cycling well past the point the original scan would have measured them, several rebuild to most of
their historical peak, but roughly 1-in-5 of them still roll an extinction on a later down-phase. So
this is a materially new data point for that future-ideas item and for
`docs/research-tuning-defaults.md`'s "no single constant fixes overshoot→extinction" conclusion —
not a refutation (COLLAPSE still dominates the outcome-label tally, and extinction is still a live
risk, not eliminated), but evidence that the *underlying dynamics* are already most of the way to
escaping the one-shot pattern once one specific bug (productivity drift) is removed, well before any
deliberate crash-recovery mechanism is built. That remaining gap looks like exactly the shape a
crash-recovery mechanism (the still-unbuilt anti-Allee item) is meant to close.

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
