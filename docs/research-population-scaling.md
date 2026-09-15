# Research: Founding Population Is Not an Independent Variable

**Recorded:** 2026-09-14 | **Commit:** 896dab1 | **Latest ARD:** 062 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/sweep.ts --seeds 16 --ticks 2000 --persons N [--set NATURAL_RESOURCES_INITIAL=… --set NATURAL_RESOURCE_CEILING_INITIAL=… --set MAX_NATURAL_RESOURCE_CEILING=… --set NATURAL_RESOURCE_CEILING_FLOOR=…] --workers 4`
**Key context vars:** `NATURAL_RESOURCES_INITIAL=10000`, `NATURAL_RESOURCE_CEILING_INITIAL=10000`, `MAX_NATURAL_RESOURCE_CEILING=20000`, `NATURAL_RESOURCE_CEILING_FLOOR=2000`, `BASE_CHILDBIRTH_RATE=0.6`

**The commons sets how big a civilization gets, and the founding population barely matters.** Starting
with 10× the people on the same fixed pool produces a peak population only 1.9× larger. Scaling the
pool with the population instead produces 15.6×. So `simulation.persons` is not a scale knob — it is
a people-to-resources ratio knob, because `NATURAL_RESOURCES_INITIAL` and the ceiling constants are
fixed absolute numbers that take no account of how many people are drawing on them.

Every cell below still goes 16/16 extinct by 2000 ticks. Scaling the commons buys a bigger and
somewhat longer-lived civilization, not a surviving one.

> **Re-verified 2026-09-15 (commit `a805635`) — reproduces on a paired test.** With 300 founders at
> 3000 ticks, tripling all four commons constants alongside the population takes median peak from 708
> to 2556 (a plausible range of +1347 to +2220 people per seed) while extinction stays 24 of 24 in
> both arms and the share of ticks at an exhausted pool is unchanged. See
> `docs/research-scale-robustness.md`.

## Peak population against founding population

16 seeds, 2000 ticks. "Scaled" multiplies all four commons constants by `persons ÷ 100`.

| Founding persons | Commons | Median peak pop | Extinct | worst-tick orphan share | person-ticks on welfare |
|---|---|---|---|---|---|
| 100 (default) | fixed 10k | 703 | 16/16 | 7% | 54% |
| 250 | fixed 10k | 670 | 16/16 | 25% | 58% |
| 500 | fixed 10k | 804 | 16/16 | 27% | 60% |
| 1000 | fixed 10k | **1328** | 16/16 | 35% | 65% |
| 250 | scaled 25k | 1439 | 16/16 | 50% | 56% |
| 500 | scaled 50k | 4760 | 16/16 | 54% | 53% |
| 1000 | scaled 100k | **10975** | 16/16 | 54% | 54% |

**10× the founding population buys 1.9× the peak on a fixed commons, and 15.6× when the commons
scales with it.** The supporting signal is the welfare column: on a fixed commons the share of
person-ticks spent below the welfare threshold climbs steadily (54% → 65%) as the founding
population grows, exactly what per-capita scarcity looks like. Under proportional scaling it stays
flat at 53–56%, because the ratio never changed.

## Everything still dies; the founding population changes when, not whether

Median tick of extinction across 16 seeds:

| Cell | Median | Range |
|---|---|---|
| 100 persons, fixed commons (default) | 188 | 100–1054 |
| 1000 persons, fixed commons | 345 | 117–815 |
| 1000 persons, scaled commons | 476 | 191–1786 |

Note the direction: **a larger founding population on the same fixed commons survives modestly
*longer*, not shorter** (median 345 vs 188). The extra people front-load a deeper crash but also
carry more absolute biomass through it. Scaling the commons extends survival further (476) and
stretches the tail a long way (one seed to 1786), but no cell produces a single sustained cycle —
`stable` is 0/16 in every row of the table above, and the median cycle count is 0–1.

## Two claims from the first pass that did not survive measurement

This study began as a single run at seed 42, and two impressions from it were wrong. Both are worth
recording because they are the exact failure mode the rest of this project's recent work documents.

1. **"A larger founding population dies much faster."** Seed 42 at 1000 persons went extinct at tick
   120, which looked dramatic against the default config's "everything is dead by 1200." But 1200 is
   the horizon at which the *last* default seed dies; the default's *median* is 188, and its own
   range starts at 100. Comparing one seed against a distribution's tail inverted the sign of the
   effect. Measured properly, larger founding populations last longer.
2. **"It recovers from crashes four times over."** Seed 42 with a scaled commons did run four
   boom-bust cycles (peaking 7,906 → 12,297 → ~4,400 → 8,066) before dying at tick 1021. Across 16
   seeds the median cycle count is 1, and no seed sustains a non-collapsing cycle. Multi-cycle
   recovery happens, but it is the tail of the distribution, not the typical behaviour.

## What this means for other work

- **Any experiment that varies `persons` is varying the people-to-resources ratio.** Results from
  runs at different population sizes are not comparable unless the commons was scaled to match. All
  sweeps recorded elsewhere in `docs/research-*.md` use the default 100, so they are internally
  consistent — but a future study that changes the population without changing the commons is
  measuring scarcity, not scale.
- **The multi-tier execution item in `docs/future-ideas.md` needs this.** That entry wants to run
  populations "where emergence and tipping-point dynamics become statistically observable." Run
  as-is at 10,000 agents against a 10,000-unit pool, it would measure starvation at one resource
  unit per person, not emergence. Whatever engine it uses, the commons constants have to scale with
  the population or the experiment answers the wrong question.
- **Whether the commons *should* scale with population is a design question nobody has decided.**
  Right now it is fixed by default, which silently makes founding population a scarcity dial. The
  alternative — expressing the pool per-capita at seed time — would make `persons` a true scale
  knob. That is an ARD-level choice about what the model means, not a calibration tweak, and this
  study does not settle it.

## Caveats

- 16 seeds per cell. The peak-population effect (1.9× vs 15.6×) is far too large for that to be in
  question; the extinction-timing medians (188 vs 345 vs 476) rest on 16 draws from very wide
  distributions and should be treated as indicative only.
- Scaling multiplied all four commons constants by the same factor. Nothing here tests whether the
  regeneration *fraction*, which is already relative to the ceiling, should also change.
- Every cell was run to 2000 ticks, which the horizon work in
  `docs/research-sweep-session-2026-09-14.md` establishes as the minimum honest horizon for an
  extinction claim.
