# Zero-Variability Follow-up: Combinations and Parameter Sweeps

**Purpose:** Follow-up to `research-zero-variability-tests.md`. Runs combination knockouts (two variables zeroed simultaneously) and parameter sweeps over the most surprising single-variable findings.

**Baseline (default settings):**
```
EXTINCTION×4 COLLAPSE×4 | endPop=0.5 | peakPop=566.5 | peakGini=0.78 | bound%=29% | extinct=4/8
```

---

## Combination Knockouts

### 1. No illness deaths + No consumption — `ILLNESS_DEATH_SCALAR=0` + `CONSUMPTION_BASE=0`

**Goal:** Remove both dominant mortality paths to isolate inequality and resource depletion as the sole collapse drivers.

```
STRUGGLING×8 | endPop=1462.5 | peakPop=1517 | peakGini=0.50 | bound%=51% | extinct=0/8
```

**Finding:** Zero extinctions — everyone survives. But all 8 runs land at STRUGGLING, not STABLE or THRIVING. With 1,462 people alive and the commons pool bound 51% of the time, the multi-dimensional classifier correctly flags resource strain as a stress signal. PeakGini=0.50 is much lower than baseline (0.78) because with no starvation culling the poor, inequality is more evenly distributed.

**Implication:** The outcome classifier's resource-commons dimension is doing real work. Even in a near-immortal world, Gini + pool depletion prevent thriving. Inequality alone isn't enough to collapse the system, but it keeps it permanently STRUGGLING.

---

### 2. No disasters + No killing — `DISASTER_PROBABILITY=0` + `KILL_SUCCESS_BASE=0`

**Goal:** Test whether a peaceful, no-shock world can reach THRIVING. If disasters and violence are the primary collapse drivers, removing both should improve outcomes dramatically.

```
COLLAPSE×6 EXTINCTION×1 STRUGGLING×1 | endPop=76.5 | peakPop=672 | peakGini=0.58 | bound%=42% | extinct=1/8
```

**Finding:** Still mostly COLLAPSE. A peaceful, no-shock world is only marginally better than baseline. This confirms that illness death (the dominant mortality cause per ARD 049) and resource exhaustion, not disasters or violence, are the primary collapse drivers. THRIVING remains unachievable in a 200-tick run even without any violence or shocks. The one STRUGGLING run is the ceiling of what a "peaceful" world achieves without also fixing mortality and resource dynamics.

---

### 3. No welfare — `WELFARE_THRESHOLD=0`

**Goal:** Disable redistribution entirely (no one falls below the zero threshold). Test whether welfare is a meaningful equalizer or just a mild nudge.

```
COLLAPSE×4 EXTINCTION×4 | endPop=1 | peakPop=117 | peakGini=0.91 | bound%=26% | extinct=4/8
```

**Finding:** Welfare is a critical population enabler, not just an inequality buffer. PeakPop drops to 117 — barely above the seeded 100 — because poor persons die before they can reproduce. PeakGini=0.91 (vs 0.78 baseline), near-maximum inequality. Without welfare, the poor die faster than reproduction can offset them, and the population never sustains a growth phase. Results are as bad as or worse than the no-regen test in single-variable runs.

---

## Parameter Sweeps

### 4. Jail detection rate sweep — `BASE_DETECT_RATE_STEAL`

Kill detection rate (`BASE_DETECT_RATE_KILL`) held at default 0.15. Baseline steal rate = 0.05.

```
BASE_DETECT_RATE_STEAL=0      STRUGGLING×2 COLLAPSE×5 EXTINCTION×1  endPop=195   peakGini=0.51  bound%=50%  extinct=1/8
BASE_DETECT_RATE_STEAL=0.025  COLLAPSE×4 EXTINCTION×2 STRUGGLING×2  endPop=7.5   peakGini=0.78  bound%=31%  extinct=2/8
BASE_DETECT_RATE_STEAL=0.05   EXTINCTION×4 COLLAPSE×4 (baseline)    endPop=0.5   peakGini=0.78  bound%=29%  extinct=4/8
BASE_DETECT_RATE_STEAL=0.1    EXTINCTION×5 COLLAPSE×2 STRUGGLING×1  endPop=0     peakGini=0.81  bound%=39%  extinct=5/8
BASE_DETECT_RATE_STEAL=0.2    COLLAPSE×5 EXTINCTION×3               endPop=18    peakGini=0.71  bound%=12%  extinct=3/8
BASE_DETECT_RATE_STEAL=0.4    EXTINCTION×2 COLLAPSE×6               endPop=70    peakGini=0.57  bound%=66%  extinct=2/8
```

**Finding:** Non-monotonic — the worst outcomes are in the **middle** (rate=0.1), not at the extremes. Two regimes:

- **Low/zero detection (0–0.025):** Emboldened thieves redistribute downward. Poor people steal more (via `resourcePressure` multiplier), intent grows to cap, and the wealth transfer acts like informal redistribution. Jail is avoided, so all productive capacity stays online. Gini falls, endPop rises. Best single-variable outcome is no detection at all.

- **Mid detection (0.05–0.1):** Worst zone. Detection is high enough to jail criminals (draining both their own productivity and the communityPool via JailEvent), but not high enough to deter repeat offending. Criminals cycle through jail, lose productive ticks, and drain the pool. This is the current baseline.

- **High detection (0.2–0.4):** Deterrence begins to dominate. Emboldening is interrupted before intent reaches cap, so fewer active thieves over time. Gini improves (0.57 at 0.4). But bound% spikes at 0.4 (66%) — fewer jailed workers means more free workers gathering, which ironically depletes the pool faster, suggesting a secondary resource-overshoot problem at very high detection.

**Implication for calibration:** The baseline detection rate (0.05) sits in the worst zone. Either lower it (let theft redistribute informally) or raise it significantly (true deterrence). A rate around 0.2–0.3 appears to be the inflection point where deterrence starts to outweigh the jail-drag cost. This warrants an ARD-level discussion before any change.

---

### 5. Invention rate sweep — `BASE_INVENTION_RATE`

```
BASE_INVENTION_RATE=0         COLLAPSE×3 EXTINCTION×5  endPop=0     peakPop=348  peakGini=0.78  bound%=60%  extinct=5/8
BASE_INVENTION_RATE=0.001     COLLAPSE×3 EXTINCTION×4  endPop=0.5   peakPop=448  peakGini=0.74  bound%=31%  extinct=4/8
BASE_INVENTION_RATE=0.002     EXTINCTION×4 COLLAPSE×4  endPop=0.5   peakPop=566  peakGini=0.78  bound%=29%  extinct=4/8  ← baseline
BASE_INVENTION_RATE=0.004     COLLAPSE×4 STRUGGLING×1  endPop=58    peakPop=583  peakGini=0.72  bound%=19%  extinct=3/8
BASE_INVENTION_RATE=0.008     COLLAPSE×6 STRUGGLING×2  endPop=134   peakPop=593  peakGini=0.55  bound%=35%  extinct=0/8
```

**Finding:** Clear monotonic improvement with invention rate:
- **PeakPop grows** from 348 (no invention) to ~593 (0.008) — ceiling-growth inventions directly expand carrying capacity.
- **Extinctions fall** from 5/8 to 0/8 as rate increases.
- **Gini falls** substantially at high rates (0.78 → 0.55 at 0.008) — more resources for everyone from higher ceilings reduces inequality.
- **Bound% is non-monotonic**: peaks at 60% (no invention), drops to 19% (0.004), then rises again at 0.008 (more people surviving → more extraction). The sweet spot for resource sustainability is around 0.004.

The current baseline (0.002) is conservative: it provides modest carrying capacity growth but sits closer to the "barely matters" end of the curve. Doubling to 0.004 noticeably improves outcomes (fewer extinctions, better endPop) without fully resolving the collapse tendency. At 0.008 we get zero extinctions but the model becomes COLLAPSE-dominant rather than EXTINCTION-dominant — still far from THRIVING.

**Implication:** Invention rate is a strong lever. The baseline value may be intentionally conservative to keep the simulation collapse-prone (a design goal per CLAUDE.md). If the intent is to model invention as a meaningful but non-rescue mechanism, the current 0.002 is defensible. If invention should be a genuine stabilizer, 0.004 is a better target.

---

## Summary

| Test | Key finding |
|------|-------------|
| No illness + no consumption | STRUGGLING×8 — Gini + resource commons alone enforce STRUGGLING even in a near-immortal world |
| No disasters + no killing | Still COLLAPSE-dominant — illness + resource dynamics are the real drivers, not violence/shocks |
| No welfare | peakPop barely exceeds seeded 100 — welfare enables population growth, not just inequality smoothing |
| Jail detection sweep | Non-monotonic: worst outcomes at 0.05–0.1 (current baseline); best at 0 (redistribution) or high deterrence |
| Invention sweep | Monotonic improvement; baseline (0.002) is deliberately conservative; 0.004 is the resource-sustainability sweet spot |

## Candidates for ARD-level discussion

1. **Jail calibration** — baseline detection rate sits in the worst empirical zone. Decision: tolerate the drag as realistic (crime does impose social costs), tune toward deterrence (~0.2–0.3), or reframe jail as lower-productivity rather than full productivity loss.
2. **Invention rate** — current baseline deliberately conservative. If innovation should stabilize the model meaningfully, 0.004 is the crossover where extinctions start dropping reliably.
3. **Welfare as population gate** — the no-welfare test reveals welfare enables reproduction among the poor, not just redistribution. This interacts with any future discussion about varying tax/welfare thresholds.
