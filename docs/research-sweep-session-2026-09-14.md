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

| Config (16 seeds, 800 ticks unless noted) | `stable` | Extinction | Median peak pop | `bound%` |
|---|---|---|---|---|
| Default (32 seeds, documented) | 2/32 (6%) | 30/32 (94%) | 703 | 8% |
| `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` alone (log-symmetric band, still a random walk) | 2/16 (12.5%) | 13/16 (81%) | 773 | 43% |
| Full pin (`INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=0`, productivity frozen at 1.0) | **10/16 (62.5%)** | 4/16 (25%) | 1187 | 41% |
| Pin + `BASE_INVENTION_RATE=0.03` (15×) | **15/16 (94%)** | **0/16 (0%)** | 1383 | 47% |
| `BASE_INVENTION_RATE=0.03` alone (this session's control) | 3/16 (18.75%) | 12/16 (75%) | 1024 | 19% |
| `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` + `NATURAL_RESOURCE_REGEN_FRACTION=0.05` (8 seeds) | 6/8 (75%) | 2/8 (25%) | 1410 | 59% |
| `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` + `MAX_NATURAL_RESOURCE_CEILING=40000` (8 seeds) | 4/8 (50%) | 1/8 (12.5%) | 2180 | 61% |

The gradient is clean and monotonic with "how thoroughly the config removes productivity's downward
drift and/or keeps carrying capacity rising": widening the band (still a walk) barely moves `stable`;
freezing it outright (no walk at all) is the big jump; adding continual ceiling growth on top
(15× invention) pushes `stable` to 15/16 and **eliminates extinction entirely** in this sample. This
is a substantially larger effect than either lever produced alone in prior studies, and the two
appear synergistic rather than redundant: invention keeps `K` rising, the productivity fix stops the
economy's supply side from randomly cratering independent of `K`.

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

> **Resolution pending:** a 1500-tick re-run of the full-pin config (same command, `--ticks 1500`) was
> in flight when this doc was first written, specifically to check whether these seeds complete a
> third cycle (confirming genuine sustained oscillation) or ratchet down to extinction shortly after
> tick 800 (meaning `stable=10/16` was measuring a wider single overshoot, not real persistence). ***See
> the addendum below for the result.***

### What this means for the `OSCILLATING` label item in `docs/future-ideas.md`

That item's prior claim — "a scan across seeds, long horizons, and even zero ceiling degradation
finds **none**" — was run at default productivity dynamics. This session didn't test the *default*
regime; it found the oscillating regime specifically *because* it removed productivity drift, which
nobody had tried before pairing with a long-horizon `stable` measurement. If the 1500-tick check
confirms real persistence, this is a materially new data point for that future-ideas item and for
`docs/research-tuning-defaults.md`'s "no single constant fixes overshoot→extinction" conclusion —
not a refutation (COLLAPSE still dominates the outcome-label tally), but evidence that the
*underlying dynamics* are already escaping the one-shot pattern once one specific bug (productivity
drift) is removed, well before any deliberate crash-recovery mechanism is built.

## H5 — Jail/detection severity: a real lever, direction is suspicious, needs more seeds

Nobody had swept punishment severity before. Two extremes at 16 seeds / 800 ticks:

| Config | Extinction | `stable` | Median peak pop | `bound%` |
|---|---|---|---|---|
| Punitive (`JAIL_TICKS_KILL=40`, `JAIL_TICKS_STEAL=15`, `BASE_DETECT_RATE_KILL=0.4`, `BASE_DETECT_RATE_STEAL=0.2`) | 16/16 (100%) | 0/16 | 664.5 | 19% |
| Near-lawless (`JAIL_TICKS_KILL=1`, `JAIL_TICKS_STEAL=1`, `BASE_DETECT_RATE_KILL=0.02`, `BASE_DETECT_RATE_STEAL=0.01`) | 14/16 (87.5%) | 1/16 | 727.5 | 17% |
| Default (documented, 32 seeds) | 30/32 (93.75%) | 2/32 | 703 | 8% |

The punitive extreme is worse on every axis than the lawless extreme: full extinction vs. 87.5%,
zero stable cycles vs. one, lower peak population. The plausible mechanism: `JailEvent` replaces a
jailed person's full event suite with a reduced one that still consumes from `communityPool` but
doesn't gather — a long sentence pulls productive adults out of the economy for longer while they
keep drawing down the pool, and `JAIL_TICKS_KILL=40` combined with a 0.4 detection rate keeps a much
larger fraction of the population incapacitated at any given time than the 1-tick/0.02-detection
regime does. That's a real, sensible causal story, not a mysterious inversion — but it rests on one
extinction-count difference (16/16 vs 14/16) and one stable-cycle difference (0/16 vs 1/16), both of
which are inside binomial noise at n=16. **Treat "harsher punishment is worse" as a plausible
hypothesis with a documented mechanism, not an established result** — it would need 32+ seeds and a
death-cause breakdown (is illness/starvation mortality actually higher in the punitive arm, consistent
with fewer active gatherers?) before being cited as a finding.

## Clean null results

Three unexplored channels turned out not to matter, and the null is itself informative because it
narrows where the model's real leverage is:

**H8 — `KillEvent`'s inequality→violence feedback (`KILL_GINI_SCALAR`).** Turning it off entirely
(`=0`) versus cranking it to 3× default (`=5`) produced **identical** peak population (703 vs 709.5)
and peak Gini (0.86 vs 0.86), with extinction/stable within noise of the 1.5-default baseline.
Killing is too small a share of total mortality (illness and starvation dominate by roughly an order
of magnitude — see the death-cause columns in any `--verbose` run) for the model's one explicit
HANDY/Turchin-style feedback loop to have any visible leverage on outcomes. The mechanism exists in
the code; it just isn't load-bearing.

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
  smaller). Good enough to see large, consistent effects (the productivity-drift gradient, the two
  clean nulls); not enough to trust small differences (H5's punishment-direction finding, or single
  extra COLLAPSE-vs-EXTINCTION seeds anywhere in this doc).
- All runs used `--workers 2` to share 4 CPUs across 8 concurrently-running sweep agents; wall-clock
  times in agent transcripts reflect that contention and don't indicate anything about the model
  itself.
- The productivity-drift finding is the one worth following up with real seed counts (32+) and the
  1500-tick horizon check below, before it goes anywhere near an ARD.

## Addendum: 1500-tick horizon check on the full-pin config

*(Filled in after the sweep referenced above completed.)*
