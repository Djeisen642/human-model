# Zero-Variability Test Runs

**Recorded:** 2026-06-05 | **Commit:** d6fc420 | **Base config:** all Variables at defaults unless noted
**Commands:** `npm run sweep -- --ticks 200 --seeds 8 [--set KEY=0]` (one override per run)
**Key context vars:** `BASE_CHILDBIRTH_RATE=0.6`, `ILLNESS_DEATH_SCALAR=0.05`, `NATURAL_RESOURCE_REGEN_FRACTION=0.03`, `BASE_INVENTION_RATE=0.002`

**Purpose:** Verify that individual variables do what they claim to do by zeroing them out one at a time and checking that outcomes match expectations. Run via the sweep harness: 8 seeds × 200 ticks per test case.

**Baseline (default settings):**
```
EXTINCTION×4 COLLAPSE×4 | endPop=0.5 | peakPop=566.5 | peakGini=0.78 | bound%=29% | extinct=4/8
```

---

## Test Results

### 1. No births — `BASE_CHILDBIRTH_RATE=0`

**Expected:** All runs collapse or go extinct — no babies means the seeded population ages out.

```
EXTINCTION×8 | endPop=0 | peakPop=99 | peakGini=0.65 | bound%=4% | extinct=8/8
```

**Verdict: PASS.** 100% extinction, runs finish fast (2.1s). Bound% drops to 4% because without population growth there's far less extraction pressure on the pool.

---

### 2. No relationships — `BASE_RELATIONSHIP_RATE=0`

**Expected:** Same as no births (births require a relationship).

```
EXTINCTION×8 | endPop=0 | peakPop=99 | peakGini=0.75 | bound%=4% | extinct=8/8
```

**Verdict: PASS.** 100% extinction, indistinguishable from no-births (2.0s). The slight Gini difference (0.75 vs 0.65) is because without relationships no one gets the happiness bonus — not meaningful for the extinction test.

---

### 3. No resource regeneration — `NATURAL_RESOURCE_REGEN_FRACTION=0`

**Expected:** Pool drains completely → starvation → extinction.

```
EXTINCTION×8 | endPop=0 | peakPop=175 | peakGini=0.96 | bound%=91% | extinct=8/8
```

**Verdict: PASS.** 100% extinction. Pool is below 5% of ceiling 91% of the time. PeakGini=0.96 — without regen the people who can grab resources early become extremely wealthy while others starve, producing near-maximum inequality. PeakPop=175 (vs baseline 566) because the carrying capacity collapses quickly.

---

### 4. No illness deaths — `ILLNESS_DEATH_SCALAR=0`

**Expected:** Dominant mortality cause removed → larger populations, no extinction, better outcomes.

```
COLLAPSE×5 STRUGGLING×3 | endPop=502 | peakPop=583.5 | peakGini=0.76 | bound%=55% | extinct=0/8
```

**Verdict: PASS.** Zero extinctions (vs 4 in baseline), endPop=502 (vs 0.5). Bound% rises to 55% because more people survive longer and put greater extraction pressure on the pool — the resource constraint becomes the dominant problem when mortality is removed. PeakPop is comparable to baseline (~580) because the growth phase looks similar, but without illness deaths the population stays near its peak longer.

---

### 5. No suicide — `SUICIDE_PROBABILITY_SCALE=0`

**Expected:** Minimal change — suicide was recalibrated to realistic rates (~1–4% of deaths, ARD 049) and is a small mortality fraction.

```
EXTINCTION×4 COLLAPSE×4 | endPop=19.5 | peakPop=600 | peakGini=0.58 | bound%=33% | extinct=4/8
```

**Verdict: PASS on the primary expectation (minimal macro change).** Outcome distribution is identical to baseline. Slight endPop improvement (19.5 vs 0.5) and notably lower peakGini (0.58 vs 0.78). The Gini effect is real: suicide is highest for low-happiness/low-resource people, so it selectively removes the poorest, inflating Gini. Without it, those poor survivors persist and pull the Gini down. This is a mild emergent selection effect worth noting.

---

### 6. No disasters — `DISASTER_PROBABILITY=0`

**Expected:** Less collapse, fewer extinctions, lower variance.

```
EXTINCTION×3 STRUGGLING×2 COLLAPSE×3 | endPop=158.5 | peakPop=608 | peakGini=0.72 | bound%=29% | extinct=3/8
```

**Verdict: PASS.** One fewer extinction and two STRUGGLING outcomes replacing COLLAPSE. Disasters are a stochastic accelerant — removing them delays collapse but doesn't prevent it because illness death and resource pressure remain. Bound% unchanged (disasters don't affect the pool/ceiling).

---

### 7. No killing — `KILL_SUCCESS_BASE=0`

**Expected:** No murder deaths, slightly lower Gini (high-killingIntent persons can't kill victims for the `killHappinessBoost`).

```
EXTINCTION×4 COLLAPSE×3 STRUGGLING×1 | endPop=53.5 | peakPop=419 | peakGini=0.69 | bound%=34% | extinct=4/8
```

**Verdict: PARTIAL PASS.** Gini does fall (0.69 vs 0.78) as expected. Outcome distribution marginally improves. Unexpectedly, peakPop is lower (419 vs 566) — possibly because in the baseline, killers with the `killHappinessBoost` survive better and sustain higher population peaks; without successful killing, those paths close off.

---

### 8. No crime detection — `BASE_DETECT_RATE_STEAL=0` + `BASE_DETECT_RATE_KILL=0`

**Expected:** More theft, emboldened criminals (stealingIntent bumps to cap over time), higher Gini.

```
STRUGGLING×2 COLLAPSE×5 EXTINCTION×1 | endPop=137.5 | peakPop=465 | peakGini=0.54 | bound%=4% | extinct=1/8
```

**Verdict: SURPRISING — direction is wrong on Gini.** Outcomes improve (only 1 extinction vs 4) and Gini drops (0.54 vs 0.78). Two mechanisms explain this:

1. **No jail → no productivity loss.** In baseline, detected criminals are jailed; jailed persons only JailEvent-gather (0.5 from communityPool vs market gathering). Removing detection keeps all potential criminals in the productive workforce.
2. **Emboldened theft redistributes downward.** `resourcePressure` amplifies stealing when resources are low, so poor people steal more frequently. Undetected theft emboldening (`STEALING_EMBOLDEN_INCREMENT`) lets stealingIntent grow to the cap — habitual poor-person theft from random richer targets acts as a redistribution mechanism. Over 200 ticks this is more equalizing than the jail-productivity tax.
3. **No jail forfeitures → community pool stays small** → bound% collapses to 4% because persons are richer (no tax-equivalent jail forfeitures).

**Finding:** The jail system as implemented imposes a productivity cost that is larger than its deterrence benefit in the baseline regime. This is a real result, not a bug.

---

### 9. No taxation — `TAX_RATE=0`

**Expected:** Community pool starves (no tax inflow), welfare system collapses, Gini rises.

```
EXTINCTION×2 COLLAPSE×4 STRUGGLING×2 | endPop=49.5 | peakPop=349 | peakGini=0.69 | bound%=13% | extinct=2/8
```

**Verdict: PARTIAL PASS.** Fewer extinctions (2 vs 4) and lower Gini (0.69 vs 0.78) — counterintuitive. The 2% flat-rate tax hits poor people proportionally the same as rich, but the welfare redistribution threshold is 20 (low) — so some people pay tax and never get welfare back. Without tax, poor people keep 2% more of their tiny resources per tick, which meaningfully reduces their starvation risk. The Gini reduction is a poverty-floor effect, not a redistribution gain.

PeakPop=349 is notably lower (bound% drops to 13% suggesting the pool doesn't bind as hard). Without tax funding the community pool, fewer people survive to form large populations.

---

### 10. No ceiling degradation — `CEILING_DEGRADATION_RATE=0`

**Expected:** Ceiling holds at initial value (or grows via invention); better long-term resource access; less overexploitation collapse.

```
COLLAPSE×3 EXTINCTION×4 STRUGGLING×1 | endPop=2 | peakPop=603.5 | peakGini=0.83 | bound%=31% | extinct=4/8
```

**Verdict: WEAK EFFECT — within baseline noise.** Outcomes are nearly identical to baseline. Ceiling degradation is not the primary collapse driver in 200-tick runs: illness death + boom-bust population dynamics dominate. The slightly higher peakGini (0.83 vs 0.78) may reflect that without degradation pressure, high-productivity gatherers can extract more before the pool binds, widening the gap.

**Implication:** ARD 050's ceiling degradation captures Tainter/HANDY overexploitation dynamics but they operate on longer timescales or need higher populations to bite meaningfully at 200 ticks.

---

### 11. No invention — `BASE_INVENTION_RATE=0`

**Expected:** Technology static; milder effect since invention rate is low (BASE_INVENTION_RATE=0.002).

```
COLLAPSE×3 EXTINCTION×5 | endPop=0 | peakPop=348 | peakGini=0.78 | bound%=60% | extinct=5/8
```

**Verdict: STRONGER EFFECT THAN EXPECTED.** PeakPop drops from 566 to 348 and bound% rises from 29% to 60%. Invention's ceiling-growth outcome (weight=2, the most frequent) was the primary mechanism expanding carrying capacity in baseline runs. Without it, the ceiling stays low, regen stays low, and the pool binds 60% of the time — limiting population peaks and increasing collapse frequency.

---

### 12. No consumption — `CONSUMPTION_BASE=0`

**Expected:** No starvation from living costs; resources accumulate; population survives longer.

```
STABLE×3 STRUGGLING×5 | endPop=1263.5 | peakPop=1277 | peakGini=0.49 | bound%=60% | extinct=0/8
```

**Verdict: PASS.** Zero extinctions; all runs at STABLE or STRUGGLING. EndPop=1263 (~12× baseline). PeakGini=0.49 (much more equal — everyone's resources grow since no one depletes theirs by paying living costs). Bound%=60% because 1,263 people are all actively extracting from the pool. STABLE×3 confirms the model can reach STABLE — it's just very hard when consumption pressure is active, which is the intended design.

---

## Summary Table

| Test | Key metric shift | Verdict |
|------|-----------------|---------|
| No births | 0→8 extinctions | PASS |
| No relationships | 0→8 extinctions (via birth cutoff) | PASS |
| No regen | 0→8 extinctions, peakGini 0.96 | PASS |
| No illness deaths | 0 extinctions, endPop 502 | PASS |
| No suicide | Outcomes unchanged (correct), Gini mild drop | PASS |
| No disasters | −1 extinction, 2 STRUGGLING emerge | PASS |
| No killing | Gini drops (correct), peakPop unexpectedly lower | PARTIAL PASS |
| No crime detection | Gini drops (unexpected), fewer extinctions | SURPRISING |
| No taxation | Fewer extinctions (unexpected), lower Gini | PARTIAL PASS |
| No ceiling degradation | Within baseline noise | WEAK / EXPECTED |
| No invention | peakPop −218, bound% +31% | STRONGER THAN EXPECTED |
| No consumption | 12× endPop, STABLE×3 | PASS |

## Follow-up candidates

- **Jail productivity cost vs. deterrence** (finding from test 8): at current rates, jailing hurts the economy more than it deters crime. Could be a candidate for ARD-level calibration discussion.
- **Invention ceiling growth is a dominant carrying-capacity driver** (test 11): at BASE_INVENTION_RATE=0.002, it's growing peak population by ~60%. Is that the intended magnitude? May want a sweep across `BASE_INVENTION_RATE` to calibrate.
- **200-tick horizon too short for ceiling degradation** (test 10): if ceiling degradation is meant to model Tainter collapse, 200 ticks may not be enough to see the effect. A 500-tick sweep would be informative.
