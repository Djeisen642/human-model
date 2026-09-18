# Research: What Kills Runs Is How Far Extraction Productivity Can Wander

**Recorded:** 2026-09-18 | **Commit:** 2d13d25 | **Latest ARD:** 063 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/sweep.ts --seeds 24 --ticks 3000 --persons 300 --workers 4 --set …`; `npx ts-node scripts/compare.ts --seeds 24 --ticks 3000 --persons 300 --both … --b …`
**Key context vars:** `EXTRACTION_PRODUCTIVITY_FLOOR=0.01`, `MAX_EXTRACTION_PRODUCTIVITY=10`, `INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=1`, `NATURAL_RESOURCES_INITIAL=10000`, `NATURAL_RESOURCE_CEILING_INITIAL=10000`

**Headline: the productivity band's problem is its width, not its asymmetry, and the fix proposed in
`docs/future-ideas.md` would not have worked. Bounded invention also beats no invention.** That entry held that
`[EXTRACTION_PRODUCTIVITY_FLOOR=0.01, MAX_EXTRACTION_PRODUCTIVITY=10]` is bad because it is
log-asymmetric — 4.6 log-units of room below the starting 1.0 against 2.3 above — and that a
log-symmetric band (`FLOOR = 1/MAX`) "recovers most of it". Made log-symmetric at `[0.1, 10]`, the
best-known configuration still loses **17 of 24 seeds**. Narrowed to `[0.5, 2]`, also log-symmetric,
it loses **none**. Width predicts survival; symmetry does not.

**Bounded invention beats freezing it.** `[0.5, 2]` and the pin both lose 0 of 24 seeds, and no seed
disagrees, so survival is identical and no number of seeds would separate them on that measure. But
median peak population is **3906 with invention bounded against 3702 with it frozen** (paired, better
than 1 in 10,001), and the commons sits stripped slightly less often (39% vs 41%, ~1 in 5,001). So
freezing is strictly worse than bounding: it costs population and buys nothing. An earlier draft of
this study said the model "survives only when invention is close to inert" — that was wrong, and this
is the measurement that corrects it. What kills runs is *unbounded* invention, not invention.

**What that means for the model, in the one regime tested: survival here needs invention's effect on extraction held to roughly ±2× or switched off entirely.** This was measured at 300 founders with the scaled commons, the only regime known not to go extinct on its own; whether it generalises is untested, and it is not an audit of every configuration this project has tried. Freezing
extraction productivity outright (`INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=0`, "the pin") gives 0 of
24 extinct. Letting it move by at most ±2× gives 0 of 24. Letting it move by ±10× gives 17 of 24 dead.
A run that wanders high strips the commons faster than it regenerates; a run that wanders low starves
with the pool full (already directly observed at productivity 0.03–0.10 in
`docs/research-thriving-reachability.md`). Both tails are fatal, so the wider the band, the more runs
find one. That sits badly with the frontier-expansion entry in `docs/future-ideas.md`, which supposes sustained innovation is a
route to abundance — though that entry proposes *new supply*, which this study did not test and which could
plausibly change the sign of the upward tail.

## The dose-response

24 seeds, 3000 ticks, 300 founders, scaled commons throughout
(`NATURAL_RESOURCES_INITIAL=30000`, `NATURAL_RESOURCE_CEILING_INITIAL=30000`,
`MAX_NATURAL_RESOURCE_CEILING=60000`, `NATURAL_RESOURCE_CEILING_FLOOR=6000`):

| Productivity band | Log-symmetric? | Extinct | Median peak pop | `bound%` |
|---|---|---|---|---|
| pinned (no variance at all) | — | **0/24** | 3702 | 39% |
| `[0.5, 2]` | yes | **0/24** | 3906 | 41% |
| `[0.2, 5]` | yes | 3/24 | 3890 | 49% |
| `[0.1, 10]` | yes | 17/24 | 3630 | 29% |
| `[0.01, 10]` (default) | no | 24/24 | — | — |

Monotone in width across four settings, and the two ends bracket it: zero variance and near-zero
variance both survive completely; the widest symmetric band is barely better than the asymmetric
default.

## The paired tests

The sweep table above is exploratory. Every adjacent step was then tested on paired seeds with
extinction named as the measure before running. Four steps, three real, one underpowered:

| Step | Extinct | Verdict on extinction |
|---|---|---|
| `[0.01,10]` → pinned | 24/24 → 0/24 | **REAL**, under 1 in a million |
| `[0.1,10]` → `[0.5,2]` | 17/24 → 0/24 | **REAL**, ~1 in 65,536 |
| `[0.1,10]` → `[0.2,5]` | 17/24 → 3/24 | **REAL**, ~1 in 1,928 |
| `[0.2,5]` → `[0.5,2]` | 3/24 → 0/24 | not established — needs ~55 seeds/arm, 24 were run |
| `[0.5,2]` → pinned | 0/24 → 0/24 | no difference, and no sample size would find one |

So the gradient is **real at the wide end and flat at the narrow end**, which is a sharper claim than
"monotone": widening past roughly ±5× starts killing runs, and below that survival saturates. The
remaining difference between bounded and frozen shows up as population size, favouring bounded (above).

One measure tracks extinction across every step and is worth more attention than the label: the
**lowest population a run ever reaches**. It goes 1 → 26 (`[0.1,10]`→`[0.2,5]`, ~1 in 5,001), 26 → 41
(`[0.2,5]`→`[0.5,2]`, ~1 in 5,001), and 1 → 41 (`[0.1,10]`→`[0.5,2]`, <1 in 10,001) — real at every
step including the one where extinction could not be resolved. A run bottoming out at one person is
dead in all but name, so trough depth is the more sensitive instrument here and should be preferred
over extinction counts in follow-up work.

The headline comparison, both arms log-symmetric and differing only in width:

```
npx ts-node scripts/compare.ts --seeds 24 --ticks 3000 --persons 300 \
  --both NATURAL_RESOURCES_INITIAL=30000 --both NATURAL_RESOURCE_CEILING_INITIAL=30000 \
  --both MAX_NATURAL_RESOURCE_CEILING=60000 --both NATURAL_RESOURCE_CEILING_FLOOR=6000 \
  --both EXTRACTION_PRODUCTIVITY_FLOOR=0.1 \
  --b EXTRACTION_PRODUCTIVITY_FLOOR=0.5 --b MAX_EXTRACTION_PRODUCTIVITY=2
```

| Measure | Wide `[0.1,10]` | Narrow `[0.5,2]` | Verdict |
|---|---|---|---|
| Extinct | 17/24 | 0/24 | **REAL DIFFERENCE**, ~1 in 65,536 (17 seeds disagreed, all one way) |
| Lowest population reached | 1 | 41 | REAL DIFFERENCE, <1 in 10,001 |
| Population at the end | 0 | 980 | REAL DIFFERENCE, ~1 in 3,334 |
| Median peak population | 3630 | 3906 | PROBABLY REAL, range includes zero |
| Boom-bust cycles | 24 | 28 | TOO CLOSE TO CALL |

Six measures were compared, so roughly one run of the tool in four throws a false alarm somewhere.
Extinction was the predicted measure and is the one to trust; the two rows whose plausible range
includes zero are not results.

## How this corrects the prior finding

`docs/future-ideas.md`'s band entry derived the asymmetry diagnosis from a Monte Carlo of the
reflected walk (200 chains × 4000 steps, median 0.35×, `P(<1)=0.65`) and from a two-seed observation
that unpinning took the hand-built thriving config from THRIVING×2 to EXTINCTION×2. The Monte Carlo
is not wrong about the walk — a wide asymmetric band does drift down. It is wrong about what that
implies, because it only measured the downward tail. The upward tail kills runs too, by stripping the
commons, and a symmetric band keeps both tails. Two seeds could not separate the two explanations.

This is the third time in this project a mechanism claim has come from reasoning about a
distribution rather than measuring outcomes and then failed a paired test. It is also the reason the
`[0.5, 2]` result is reported here as "narrow bands survive" rather than as a proposed default: see
below.

## What this does not settle

**Narrowing the band is a blunt fix, but it is not the pin in another costume.** An earlier draft of
this section said it was, on the reasoning that `[0.5, 2]` lets invention at most double or halve
extraction across a whole run and therefore guts the subsystem. The step C measurement above
contradicts that: bounded invention produces a *larger* population than frozen invention at equal
survival, so the two are not interchangeable and the band is doing something the pin cannot. What
stays true is that a hard `[0.5, 2]` clamp is a crude instrument — it forbids the large productivity
swings rather than making them self-correcting. A bounded-variance process (mean reversion toward
1.0, or a step size that shrinks as productivity leaves the centre) would keep invention's full range
available while still preventing a run from parking at an extreme, and is the design worth comparing
against a fixed narrow band. That is a new mechanism rather than a constant change.

**This was measured only at 300 founders with a scaled commons**, the one regime known not to go
extinct on its own. Whether band width matters the same way at default scale is untested; the
default there is 24/24 extinct at every band tried, which cannot separate anything.

**Inequality does not separate these configurations.** Followed up in
`docs/research-inequality-signal.md`: measured at full strength (the highest adult Gini reached while
the population was still at least half its peak), the default configuration that loses 16 of 16 runs
and the `[0.5, 2]` configuration that loses 0 of 16 sit at median 0.600 and 0.590, indistinguishable
on paired seeds (p = 0.76). The wide band does reach higher inequality than the narrow one (0.645 vs
0.590, p = 0.021), but that is downstream of the band widening the spread of what people extract, and
the default-vs-narrow pair is the control showing survival swings from none to all with inequality
held level. Note the first version of this paragraph argued the same conclusion from the *last living
decade* and was wrong to: a population dying to single digits has nothing left to distribute, so its
Gini collapses toward zero as an artefact.

**No ARD is proposed here.** Changing the band or replacing the random walk refines ARD 047 and needs
one, and per CLAUDE.md that starts with a discussion, not a draft.

## Re-running this

```bash
# the dose-response, ~2 min per row on 4 cores
npx ts-node scripts/sweep.ts --seeds 24 --ticks 3000 --persons 300 --workers 4 \
  --set NATURAL_RESOURCES_INITIAL=30000 --set NATURAL_RESOURCE_CEILING_INITIAL=30000 \
  --set MAX_NATURAL_RESOURCE_CEILING=60000 --set NATURAL_RESOURCE_CEILING_FLOOR=6000 \
  --set EXTRACTION_PRODUCTIVITY_FLOOR=0.5 --set MAX_EXTRACTION_PRODUCTIVITY=2

# the paired test, ~11 min single-process
# (compare.ts does not fork, so it runs one core; budget accordingly)
```
