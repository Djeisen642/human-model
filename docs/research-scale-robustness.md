# Research: Which Findings Survive More Ticks and More People

**Recorded:** 2026-09-15 | **Commit:** a805635 | **Latest ARD:** 062 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/compare.ts --seeds 48 --ticks 4000 --persons {100,300} [--both KEY=VAL …] [--b KEY=VAL]`; scaled-commons arm at `--seeds 24 --ticks 3000 --persons 300 --both NATURAL_RESOURCES_INITIAL=30000 --both NATURAL_RESOURCE_CEILING_INITIAL=30000 --both MAX_NATURAL_RESOURCE_CEILING=60000 --both NATURAL_RESOURCE_CEILING_FLOOR=6000`
**Key context vars:** `INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=1`, `BASE_CHILDBIRTH_RATE=0.6`, `HAPPINESS_BASELINE=0`, `EXPERIENCE_CAP=50`, `NATURAL_RESOURCES_INITIAL=10000`, `MAX_NATURAL_RESOURCE_CEILING=20000`

**Two of the project's four "helps once the commons is fixed" findings survive being run twice as long
with three times as many founders, and two do not.** Freezing extraction productivity (the pin) and
raising the birth rate under it hold in every condition tested, by wide margins. Raising the happiness
baseline holds at a longer horizon but vanishes when the founding population triples. Raising
`EXPERIENCE_CAP` — the cap on how much any one person can ever extract — fades at 4000 ticks and is
exactly zero at 300 founders: it bought delay, and the 2000-tick horizon read that delay as a rescue.

Both corrected results were re-run at the original settings first, and both reproduce the earlier pass
to the run (23 → 11 and 23 → 7 of 48 extinct). So what moved is the test conditions, not the code.

## What was run

The four survival claims from the 2026-09-15 verification pass in
`docs/research-untested-variables.md` and its fertility null, plus three older headline claims that
had never been through a paired test, re-run with `scripts/compare.ts` in three conditions:

| Condition | Founders | Ticks | Commons | Seeds | What it stresses |
|---|---|---|---|---|---|
| **A** | 100 | 4000 | default | 48 | horizon — twice the 2000-tick judging standard |
| **B** | 300 | 4000 | default | 48 | crowding — a third of the resources per founder |
| **C** | 300 | 3000 | ×3 (30k/30k/60k/6k) | 24 | a genuinely bigger world at the same people-to-pool ratio |

Condition B is not a bigger world. `docs/research-population-scaling.md` established that founding
population on a fixed commons is a scarcity dial, so B is the same world with three times the
competition for it. C is the bigger world; it is expensive to run, so it got 24 seeds and the two
flagship claims only.

The measure that tests each claim was named before running. Extinction count for anything claimed to
change survival; peak population for the default-regime claims, where every run dies in both arms and
extinction cannot separate anything. `compare.ts` reports six measures, so about one run in four
throws a false alarm somewhere — a row that was not predicted in advance is not evidence.

## Results

Extinct runs, baseline → treatment, with the odds of a gap that size arising by chance:

| Claim | Arms | Original (100/2000) | A: 100/4000 | B: 300/4000 |
|---|---|---|---|---|
| Freezing productivity cuts extinction | default vs pin | 48 → 23 | **48 → 31**, about 1 in 65,000 | **48 → 21**, <1 in a million |
| Fertility is decisive once the pool is not binding | pin vs pin + `BASE_CHILDBIRTH_RATE=1.0` | 23 → 1 | **31 → 4**, <1 in a million | **21 → 6**, 1 in 385 |
| Happiness helps once the pool is not binding | pin vs pin + `HAPPINESS_BASELINE=10` | 23 → 7 | **31 → 14**, 1 in 4,500 | **21 → 18**, chance (needs 966 seeds) |
| Production capacity helps once the pool is not binding | pin vs pin + `EXPERIENCE_CAP=200` | 23 → 11 | **31 → 21**, 1 in 16 (needs 86 seeds) | **21 → 21**, chance (needs infinitely many) |

Peak population, for the claims where extinction is saturated at 48 of 48 in both arms:

| Claim | Arms | A: 100/4000 | B: 300/4000 |
|---|---|---|---|
| Fertility does nothing at default | default vs `BASE_CHILDBIRTH_RATE=1.0` | +17 (−43 to +88), unsettled | +9 (−19 to +63), unsettled |
| Widening the productivity band is not freezing it | default vs `EXTRACTION_PRODUCTIVITY_FLOOR=0.1` | +43 (+2 to +163), real but small | +31 (−18 to +280), unsettled |
| 15× invention builds more but saves no one | default vs `BASE_INVENTION_RATE=0.03` | +472 (+225 to +658), real | +272 (+74 to +395), real |

## The two that broke, and why they broke differently

**`EXPERIENCE_CAP` is a delay, not a rescue.** It is the cleanest example this project has produced of
the horizon trap the sweep skill warns about. At 2000 ticks with 100 founders it takes extinction from
23 of 48 runs to 11 — odds of about 1 in 133 against chance, and it reproduced exactly when re-run
here. Hold the population at 100 and run to 4000 ticks and the gap narrows to 31 versus 21, which at
48 seeds is no longer distinguishable from chance. Triple the founders and it is 21 versus 21, with
the arms disagreeing on 28 seeds split 14 against 14 — as flat as a result gets. The horizon result
alone would be weak evidence, since 1 in 133 to 1 in 16 is a slide rather than a reversal; the dead
null at 300 founders is what settles it.

**Happiness is scarcity-sensitive, not horizon-sensitive** — the opposite diagnosis from the same kind
of failure. Run to 4000 ticks at the original 100 founders, raising `HAPPINESS_BASELINE` from 0 to 10
still takes extinction from 31 of 48 to 14 (odds about 1 in 4,500), so the longer horizon does not
touch it. At 300 founders on the same commons it is 21 versus 18, and the tool asks for 966 seeds per
arm to resolve a gap that size. Happier couples have more children; with three times the competition
for the same pool, the extra children do not survive to change the outcome. Both results are honest
descriptions of their own conditions — the finding is that the claim is conditional on a
people-to-resources ratio nobody thought to state.

## The two that held

**The pin is still the strongest lever in the model, and still not a fix.** Freezing extraction
productivity beats the default on extinction in every condition, and the effect grows rather than
shrinks with scale: 48 → 31 of 48 at 100 founders, 48 → 21 at 300, and in the scaled-commons world
24 of 24 runs die at default against **0 of 24** under the pin. It also roughly doubles peak
population (686 → 1233 at 100 founders; 706 → 1295 at 300) and multiplies completed boom-bust cycles
several-fold. But read the commons alongside it: the share of ticks with the pool stripped to near
nothing goes from 2% to 20% at 100 founders and 3% to 39% at 300. This is sustained Malthusian
cycling against an exhausted pool, not abundance, exactly as
`docs/research-sweep-session-2026-09-14.md` warned. And at 4000 ticks roughly two-thirds of the
pinned runs at 100 founders are dead anyway.

**Fertility under the pin holds, with a visible cost.** Raising `BASE_CHILDBIRTH_RATE` to 1.0 under
the pin is still the largest survival effect measured: 31 → 4 of 48 at a 4000-tick horizon, 21 → 6
with 300 founders. The gap narrows as conditions get harsher (1 of 48 at the original settings, 6 of
48 at 300 founders), which is what a lever that works by outrunning a constant hazard should look
like. Note that in both conditions it *lowers* peak population — by 170 and 165 people respectively,
both well outside noise. More births against the same pool means more, smaller lives, not a bigger
civilization.

## The one cell where nothing died

Scaling the commons to the population *and* pinning productivity is the first configuration this
project has run that loses nobody: **0 of 24 seeds extinct at 3000 ticks**, against 24 of 24 for the
same world at default productivity. It is also where fertility stops being measurable — with no
deaths in the baseline arm there is nothing for `BASE_CHILDBIRTH_RATE=1.0` to improve, and the
comparison returns 0 versus 0. What the extra births do there is what they do everywhere else: they
lower peak population, by 454 people per seed (range −506 to −389).

Two reasons not to read this as the model finally thriving. The pool is stripped for 39% of ticks, so
this is the same cycle-against-an-empty-commons regime under a bigger pool. And 3000 ticks is short
for a survival claim when the previous strongest cell went from 0 extinct at 800 ticks to 3 of 16 by
1500; the horizon rule applies to good news too. It is worth a proper run at 8000 ticks with an
outcome classification, which this session did not do.

## The commons is still what sets the size of a civilization

Holding the founding population at 300 and tripling only the four commons constants takes median peak
population from 708 to 2556 — a 3.6× civilization from a 3× pool, with the share of ticks at an
exhausted pool unchanged at 3-4%. Extinction stays at 24 of 24 either way. That is
`docs/research-population-scaling.md`'s central claim reproduced on a paired test at a longer horizon:
the pool sets how big you get, and making it bigger buys nobody's survival.

## What this changes

The three default-regime nulls hold, so nothing in `docs/research-untested-variables.md`'s Part 1
needs revisiting. The affected rows in that document's verification table are annotated in place.

The wider lesson is about that document's own framing. It argued that per-capita levers are absorbed
by a binding commons and become decisive once the commons is fixed. That is still the right shape, but
"fixed" turns out to be relative: the productivity pin fixes the commons *for 100 founders*, and two
of the four levers tested under it are measuring headroom that 300 founders consume. A finding under
the pin should now state the founding population it was measured at.

## Caveats

- 48 seeds for conditions A and B, 24 for C. The `EXPERIENCE_CAP` and happiness corrections rest on
  non-detections; both are reported with the seed count that would have been needed, and neither is
  claimed as a measured zero.
- Condition C ran to 3000 ticks, not 4000, because the surviving populations are large enough to make
  it expensive. Its pin result is therefore at a shorter horizon than A and B.
- `compare.ts` compares configurations, not interactions. "The lever works here and not there" is
  still an inference across two comparisons rather than a tested interaction, the same limit the
  previous pass recorded.
- Condition B changes two things at once relative to the original studies — three times the founders
  *and* a third of the resources per founder — because the commons constants are absolute. C separates
  them for the pin claim only.
