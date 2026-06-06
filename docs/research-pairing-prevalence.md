# Research: Pairing Prevalence and Crash Recovery

**Recorded:** 2026-06-06 | **Commit:** ca6ad89 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/measure-pairing.ts --seeds 16 --ticks 500 --persons 100`
**Key context vars:** `BASE_RELATIONSHIP_RATE=0.12`, `BASE_BREAKUP_RATE=0.03`, `RELATIONSHIP_PEAK_AGE=26`, `RELATIONSHIP_AGE_SCALE=35`, `RELATIONSHIP_AGE_FLOOR=0.1`

---

## Question

Is the model's pairing prevalence high enough to support crash recovery? What fraction of living
persons are paired across the run, and specifically at low population?

## Findings

| Condition | Model | Empirical target |
|---|---|---|
| Overall avg paired fraction | 42% | ~60–70% |
| Early stable ticks (0–99) | ~49% | ~60–70% |
| At low population (< 20 living) | **21%** | — |
| Seeds extinct by tick 500 | 14 / 16 | — |

Pairing by tick range:

| Ticks | Avg paired% | Samples |
|---|---|---|
| 0–49 | 49% | 800 |
| 50–99 | 49% | 800 |
| 100–149 | 43% | 663 |
| 150–199 | 27% | 555 |
| 200–249 | 39% | 317 |
| 250–299 | 46% | 250 |
| 300–349 | 34% | 228 |
| 350–399 | 30% | 150 |
| 400–449 | 48% | 102 |
| 450–499 | 50% | 100 |

The variability across decades tracks the boom-bust cycle. Ticks 150–199 and 300–349 correspond to
crash troughs where pairing collapses.

## Why the model under-pairs

The theoretical steady-state pairing fraction at peak age and average charisma is well above 50% given
the current formation and dissolution rates. The gap between theory and measurement has two causes:

1. **The simulation starts at zero pairing.** `Simulation.seed()` creates all persons with
   `isInRelationshipWith = null`. The model takes many ticks to climb toward its equilibrium, and
   crashes reset it before it gets there.

2. **Crashes create sudden unpartnered waves.** `Simulation.kill()` clears the surviving partner's
   `isInRelationshipWith`. At low N, the random-other draw for new formation rarely returns an
   unpartnered person — the effective formation rate collapses even though the base rate is adequate
   at full population.

The 21% crash-phase pairing is the key signal: crash survivors are mostly unpartnered and cannot rebuild
because finding a new partner at low density is hard. This is a structural mate-finding Allee effect
arising from model initialization and crash mechanics, not from the relationship rates alone.

## What lowering breakup rate alone cannot fix

`BASE_BREAKUP_RATE` governs dissolution of existing pairs. Lowering it prevents pairs from dissolving
during normal operation but does not address:
- The zero-to-equilibrium transient (everyone starts unpaired)
- Partner death during crashes (clears the survivor regardless of breakup rate)

## Calibration target

Real-world surveys (US, OECD) consistently show ~60–70% of adults in some romantic or sexual
relationship at any given time. This is the appropriate empirical anchor — not the divorce rate, which
applies only to the married subset.

## Structural fix: ARD 052

The research motivated ARD 052 (Proposed), which addresses both root causes:
- Lower the seeded age floor so children appear in the initial age pyramid
- Assign parents to seeded children using realistic two-parent / single-parent / sibling distributions
- Pair a target fraction of adults at seed time to eliminate the zero-pairing transient
- Add a relationship minimum age gate
- Raise `BASE_RELATIONSHIP_RATE` so post-crash recovery is faster

See `docs/decisions/052-realistic-initial-population-seeding.md`.
