# Research: What Kills Runs Is How Far Extraction Productivity Can Wander

**Recorded:** 2026-09-18 | **Commit:** 2d13d25 | **Latest ARD:** 063 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/sweep.ts --seeds 24 --ticks 3000 --persons 300 --workers 4 --set …`; `npx ts-node scripts/compare.ts --seeds 24 --ticks 3000 --persons 300 --both … --b …`
**Key context vars:** `EXTRACTION_PRODUCTIVITY_FLOOR=0.01`, `MAX_EXTRACTION_PRODUCTIVITY=10`, `INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=1`, `NATURAL_RESOURCES_INITIAL=10000`, `NATURAL_RESOURCE_CEILING_INITIAL=10000`

**Headline: the productivity band's problem is its width, not its asymmetry, and the fix proposed in
`docs/future-ideas.md` would not have worked.** That entry held that
`[EXTRACTION_PRODUCTIVITY_FLOOR=0.01, MAX_EXTRACTION_PRODUCTIVITY=10]` is bad because it is
log-asymmetric — 4.6 log-units of room below the starting 1.0 against 2.3 above — and that a
log-symmetric band (`FLOOR = 1/MAX`) "recovers most of it". Made log-symmetric at `[0.1, 10]`, the
best-known configuration still loses **17 of 24 seeds**. Narrowed to `[0.5, 2]`, also log-symmetric,
it loses **none**. Width predicts survival; symmetry does not.

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

## The paired test

The sweep table above is exploratory. The claim that *width* rather than *asymmetry* is the cause was
tested directly, both arms log-symmetric and differing only in width, extinction named as the measure
before running:

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

**Narrowing the band is not obviously the right fix.** `[0.5, 2]` means invention can at most double
or halve extraction efficiency across an entire run, which makes `InventionEvent` nearly decorative.
Buying survival by disabling the mechanism under study is the same move as the pin, just less
honest about it. A bounded-variance process that keeps invention meaningful — mean reversion toward
1.0, or a step size that shrinks as productivity leaves the centre — would test the same hypothesis
without gutting the subsystem, and is a new mechanism rather than a constant change.

**This was measured only at 300 founders with a scaled commons**, the one regime known not to go
extinct on its own. Whether band width matters the same way at default scale is untested; the
default there is 24/24 extinct at every band tried, which cannot separate anything.

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
