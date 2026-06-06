# Research: Crash Root Cause Diagnosis

**Recorded:** 2026-06-06 | **Commit:** d1458f3 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/diagnose-crash.ts --seeds 16 --ticks 500 --persons 100`
**Key context vars:** `BASE_CHILDBIRTH_RATE=0.6`, `RELATIONSHIP_MIN_AGE=16`, `SEED_AGE_FLOOR=1`, `SEED_PAIRING_FRACTION=0.62`, `BASE_RELATIONSHIP_RATE=0.18`

---

## Question

What is the primary driver of population collapse — resource exhaustion, insufficient births, or illness/mortality accumulation?

## Findings

Avg peak population: 449 at tick 81. All 16 seeds extinct by tick 500.

### Death causes (whole run)

| Cause | Count | Share |
|---|---|---|
| Illness | 10698 | 89.2% |
| Murder | 987 | 8.2% |
| Suicide | 169 | 1.4% |
| Disaster | 137 | 1.1% |

### Pre-crash vs crash window

| Metric | Pre-crash (ticks −20 to −10) | Crash window (±10 around peak) |
|---|---|---|
| Avg population | 406 | 440 |
| Births/tick | **6.97** | **2.68** |
| Deaths/tick | 1.93 | 2.34 |
| Avg age | 30.6 | 38.4 |
| Avg illness | 0.018 | 0.023 |
| Avg resources | 33.5 | 22.7 |
| Pool fill | 28.2% | 40.8% |
| Paired fraction | 49.1% | 56.0% |

Ticks where deaths > births in crash window: 129 / 336 (avg deficit 2.57/tick).

## Root cause: birth collapse from demographic aging

The crash is **not** driven by resource exhaustion or a mortality spike. The decisive signal:

- Births fall 61% (6.97 → 2.68/tick) while deaths rise only 21% (1.93 → 2.34/tick)
- The natural resource pool fill actually **increases** during the crash (28% → 41%) — the commons recovers as population shrinks, confirming resources are not the binding constraint
- Average age rises 8 years in 10 ticks around the peak, crossing into the steep decline of the childbirth `ageModifier` (peak 26, scale 12)

The founding cohort ages together and fertility collapses before resources do. This is a **demographic overshoot** — a synchronized cohort booms, ages past peak fertility, and dies faster than children are born to replace it. The pool, carrying capacity, and pairing are all adequate; the bottleneck is cohort age.

Illness is 89% of all deaths, but this is the *cause of death*, not the *cause of collapse*. Illness accumulates gradually throughout the run. What triggers irreversible decline is births falling below deaths as the cohort ages — illness then drains the survivors of the old cohort.

Murder at 8.2% is non-trivial and accelerates decline at peak (Gini-driven killing rises with inequality at the boom).

## Implications for crash recovery

The anti-Allee fertility boost (in `docs/future-ideas.md`) is the correct structural fix, but it must specifically compensate for **age-driven fertility reduction**, not just low density. At the crash trough, pairing is adequate (56%) and resources are recovering — the barrier is that survivors are in their 40s–50s where `ageModifier(coupleAge, 26, 12, 0.02)` is near floor. A boost that fires at low N but doesn't address the age modifier gap will have limited effect.

Two complementary approaches worth designing together (as noted in future-ideas.md):
1. **Anti-Allee fertility multiplier** — raises effective birth probability at low N to partially offset the age penalty
2. **Weakened partnership-density dependence at low N** — already partially addressed by ARD 052/053; pairing is not the current bottleneck

A third lever not yet in future-ideas.md: **illness drives the age curve steeper** — reducing `BASE_ILLNESS_ONSET` or raising `BASE_ILLNESS_RECOVERY` would keep the old-cohort alive longer and give them more ticks to produce children before dying. This is a different intervention point than fertility but targets the same demographic gap.
