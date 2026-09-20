# The resource ceiling is a constant, and that is why the cycles are flat

**Recorded:** 2026-09-20 | **Commit:** `7b24aca` (comparison arm `5c62765`) | **Latest ARD:** 067 | **Base config:** the scaled-commons pinned regime of `research-scale-robustness.md` — `NATURAL_RESOURCES_INITIAL=30000`, `NATURAL_RESOURCE_CEILING_INITIAL=30000`, `MAX_NATURAL_RESOURCE_CEILING=60000`, `NATURAL_RESOURCE_CEILING_FLOOR=6000`, `INVENTION_DEPLETION_{FASTER,SLOWER}_WEIGHT=0`, 300 founders — unless noted
**Commands:** `npm run sweep -- --seeds 16 --ticks 2000 --persons 300`; `npx ts-node src/App/index.ts --config <scaled> --output <dir> --embed` for seeds 1–4 at 3000 ticks
**Key context vars:** `BASE_INVENTION_RATE=0.002`, `INVENTION_CEILING_GROWTH_SCALAR=0.0035`, `CEILING_DEGRADATION_RATE=0.025`, `NATURAL_RESOURCE_REGEN_FRACTION=0.03`, `MAX_NATURAL_RESOURCE_CEILING`

**The model's carrying capacity stops being a variable six years into a three-thousand-year run.**
`InventionEvent` drives the resource ceiling into `MAX_NATURAL_RESOURCE_CEILING` by tick 6–8 and it
stays pinned there for 97–98% of the run. Every cycle afterwards oscillates against a fixed bound,
which is why the best configuration produces *flat* boom-bust rather than cycles that trend
anywhere. Nothing is broken in the cycling; the thing the cycles would climb has been nailed down.

## 1. The ceiling caps almost immediately

Measured from the per-tick `naturalResourceCeiling` series of four 3000-tick runs:

| seed | initial ceiling | first tick at cap | share of run pegged at cap |
|---|---|---|---|
| 1 | 32,367 | 6 | 97% |
| 2 | 30,000 | 8 | 98% |
| 3 | 33,273 | 6 | 98% |
| 4 | 34,556 | 7 | 98% |

The "Resource Ceiling" line being flat across the whole HTML report is not a rendering artifact. It
is the series. Seed 3 logged **90,004 ceiling inventions** across the run, all of them no-ops after
tick 6 except during the brief dips when a stripped commons degrades the ceiling below its cap.

Why it happens is arithmetic. With extraction productivity pinned (`INVENTION_DEPLETION_*_WEIGHT=0`)
every invention takes the ceiling-growth branch, each multiplying the ceiling by
`1 + intelligence × INVENTION_CEILING_GROWTH_SCALAR`, about +2.1% at the observed intelligence of
~6. Invention fires at `BASE_INVENTION_RATE × intelligence × ageModifier`, so growth scales with
population while the opposing force — `CEILING_DEGRADATION_RATE × depletion`, capped at 2.5% per
tick — does not. Break-even is around 500 people. Above that the ceiling grows without bound until
the cap catches it, which at 300 founders takes six years.

## 2. Invention fires about 1,200× faster than its real-world referent

Seed 3's 90,004 ceiling inventions over 3000 years is **30 per year**. Against a reference rate of
one genuinely revolutionary advance per forty years — 0.025 per year, the project owner's anchor —
the model is roughly 1,200× too fast.

The per-event magnitude is not the problem. At +2.1% per invention, a single advance is a modest
improvement, not a leap. The *rate* is the entire discrepancy, and it is the rate that makes the
compounding explosive.

**Projection, not measurement:** 75 inventions (one per 40 years over 3000 years) compounding at
2.1% would lift carrying capacity 4.75× across a run. If that held, it would produce exactly the
upward-trending cycles the flat regime lacks. This has not been measured — a sweep of
`BASE_INVENTION_RATE` over a 20× to 1000× cut with the cap lifted was still running when this was
written, and the fastest arm proved expensive enough that no job finished in 30 minutes at 1500
ticks. Treat 4.75× as an arithmetic expectation to test, not a result.

One caution already visible: ceiling growth scales with population, so a rate cut calibrated at 300
founders is outrun by the population it enables. A fixed cut sets the clock for one population size.

## 3. What the heritability fix changed, and what it did not

CLAUDE.md flags every long-horizon study as needing re-measurement after ARD 064/066, since all were
taken on a population whose newborns inherited collapsed intents. Re-measured here on the **default**
config, 16 seeds, 2000 ticks, 300 founders, pre-fix (`5c62765`) against post-fix (`7b24aca`) on
identical seeds:

| | pre-fix | post-fix |
|---|---|---|
| outcome | EXTINCTION×16 | EXTINCTION×16 |
| time to extinction (median) | 275 | 597 |
| peak population (median) | 694 | 1200 |
| commons stripped | 4% of ticks | 14% |
| sustained cycles | 0/16 | 0/16 |

Paired on matched seeds with `Statistics.ts`: time to extinction **+315 ticks**, 95% CI [221, 533],
p = 0.0016, longer in 14 of 16 seeds. Peak population **+435**, 95% CI [221, 641], p = 0.0021, higher
in 15 of 16. Both measures were predicted before running, which matters given six columns are on
screen and about one run in four throws a false alarm.

So the fix worked on its own terms and changed nothing about the ending. The population grows to
nearly double the size, survives roughly twice as long, and dies in every seed exactly as before.
That is the signature CLAUDE.md names for a structural limit — bigger inputs buy a bigger boom, not
stability — reached this time through agent quality rather than through resource inputs. The
commons-strain row is the mechanism in the open: better extractors strip the commons harder, 4% of
ticks becoming 14%.

The scaled-commons pinned regime survived the fix and improved. At 24 seeds and 3000 ticks it reads
`CYCLICAL×10 STRUGGLING×14`, 0/24 extinct, 24/24 showing a sustained cycle, population trend flat to
two decimals, against the `COLLAPSE×21 STRUGGLING×3` published pre-fix. **That published comparison
is cited, not re-measured** — the matching pre-fix run was started and abandoned twice for harness
reasons, so read the direction, not the size.

## 4. Two calibration gaps noticed in passing

**Incarceration is 5–17× any real society.** Jailed share of population across the same four runs:
median 3.4–4.6%, peak 8.6–11.7%. The United States, the highest-incarcerating large country, runs
about 0.7% of adults. The share peaks on the shoulder of each cycle rather than at maximum
population, rising as the commons empties and falling once the crash removes thieves and victims
together, so it tracks scarcity rather than crowding.

**Education propagates but stalls at high school.** Post-fix, about 60% of adults hold a credential,
against essentially none pre-fix. But bachelor's-and-above is 1–3% of population in every seed,
while founders are seeded at `Simulation.ts:388` with 85% completing high school and 40% of those
continuing — roughly 34% of founding adults at bachelor's or better. The model begins with a
graduate-heavy population and settles ten-fold below it. Enrolment is
`BASE_ENROLLMENT_RATE × learningIntent × ageModifier`, about 3% per year at peak age against a curve
already decaying past 18, and every further level needs a fresh enrolment roll. One credential per
lifetime is what the rates allow; the founders were handed three.

## What this does not establish

The invention-rate sweep is unrun, so no claim here says a slower rate produces rising cycles — only
that the cap currently prevents them and that the arithmetic predicts a lift worth testing. The
mechanism question is also open and is not a calibration matter: ceiling growth is proportional to
the current ceiling, so nothing in the loop saturates and any rate is a threshold that a growing
population eventually crosses. Bounded-but-rising capacity likely needs diminishing returns on
invention, which is an ARD-level mechanism change rather than a constant to retune.
