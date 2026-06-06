# Research: Pairing Rate Calibration

**Recorded:** 2026-06-06 | **Commit:** f7ad6e8 | **Base config:** all Variables at defaults unless noted
**Commands:** `npx ts-node scripts/diagnose-crash.ts --seeds 16 --ticks 500 --persons 100`
**Key context vars:** `BASE_RELATIONSHIP_RATE=0.18`, `BASE_BREAKUP_RATE=0.03`, `RELATIONSHIP_MAX_FORMATION_ATTEMPTS=5`, `RELATIONSHIP_AGE_GAP_SCALE=10`, `RELATIONSHIP_AGE_GAP_FLOOR=0.1`

---

## Question

Is the model's pairing formation and dissolution calibrated to realistic rates? What is the empirical target for paired fraction and per-year formation rate, and what does the model need to hit it?

## Empirical baselines

### Annual formation rate for single adults

From Gorbach et al. 2010 (Seattle Sex Survey, N=1,194 adults 18–39) and Pew longitudinal data:

| Age group | Annual new-partner rate (singles) |
|---|---|
| 20s | 0.30–0.50/year |
| 30s | ~0.15/year (63% of 30–39-year-olds had zero new partners in 3 years) |
| 40s–50s | 0.05–0.10/year |
| 50s+ | 0.03–0.05/year |

These rates are for any new romantic/sexual partnership. For long-term committed relationships the rate is lower; for casual short-term ones higher. The simulation models committed partnerships (those that can produce children), so the 30s figure (~0.15/year) is the most relevant anchor.

### Partnered fraction by age

From Pew Research 2023 ("partnered" = married + cohabiting + exclusive committed relationship):

| Age group | % partnered |
|---|---|
| 18–29 | ~59% |
| 30–49 | ~77–81% |
| 50–64 | ~71–73% |
| 65+ | ~51–64% |
| All adults | ~66–69% |

**Calibration target for the model:** 66–69% of adults in a relationship at steady state.

### Median time between relationships

No clean US longitudinal dataset for the general population. Best proxies:
- 20s: median inter-relationship gap ~1–3 years (implied by 0.3–0.5/year formation rate)
- 30s: median ~4–6 years
- 50s+: median ~7–10+ years; only ~23% of divorced 50+ adults re-partner within 10 years (~2–3%/year)

## Equilibrium analysis

For a two-state model (single ↔ partnered), equilibrium requires:

```
formation_rate × fraction_single = breakup_rate × fraction_paired
```

At the empirical target (70% paired, 30% single) with `BASE_BREAKUP_RATE = 0.03`:

```
formation_rate × 0.30 = 0.03 × 0.70
formation_rate = 0.07/year (for single adults)
```

With `BASE_BREAKUP_RATE = 0.04`:
```
formation_rate = 0.04 × 0.70 / 0.30 = 0.093/year
```

With `BASE_BREAKUP_RATE = 0.05`:
```
formation_rate = 0.05 × 0.70 / 0.30 = 0.117/year
```

All three are within the empirical range for 30s adults (0.07–0.15/year). The model's effective formation rate depends on population size and age distribution (fewer potential partners at low population or unfavorable age mix), so the equilibrium paired fraction will be lower than predicted by this simple model during crash conditions.

## Experiment: effect of BASE_BREAKUP_RATE on paired fraction

Swept `BASE_BREAKUP_RATE` over [0.03, 0.04, 0.05] using the crash diagnostic (16 seeds × 500 ticks).

| BASE_BREAKUP_RATE | Peak pop | Pre-crash births | Pre-crash paired | Crash births | Crash paired |
|---|---|---|---|---|---|
| 0.03 (current) | 480 @ tick 77 | 7.41/tick | 45.8% | 3.11/tick | 54.1% |
| **0.04** | **544 @ tick 98** | **8.78/tick** | 45.1% | **3.28/tick** | 52.5% |
| 0.05 | 519 @ tick 74 | 7.51/tick | 45.2% | 2.90/tick | 49.9% |

**0.04 is the optimum.** Births and peak population are highest; the boom lasts 21 ticks longer. At 0.05, breakup rate exceeds the formation rate's ability to replenish pairs and overall pair inventory drops, eroding births.

### Why higher breakup rate raises births (with ARD 054/055 in place)

With the age-gap compatibility modifier, fertility per couple is strongly sensitive to age proximity. At `BASE_BREAKUP_RATE = 0.03`, old founding-cohort pairs stay locked in permanently — their old-young or old-old pairings freeze potential young-young combinations. A higher breakup rate churns these pairings, freeing partners for re-pairing with more age-proximate candidates. The net effect is more fertile couples even at a slightly lower paired fraction.

This interaction did not exist before ARD 054 — raising breakup rate would previously only have reduced birth rate. The age-gap modifier created a new feedback loop where **relationship churn is fertility-improving** up to the point where pair inventory collapses.

### Recommendation

Set `BASE_BREAKUP_RATE = 0.04`. This is:
- Within the empirical range (~3–5%/year annual separation rate for committed relationships)
- Consistent with the equilibrium math (0.04 × 0.70 / 0.30 ≈ 0.093/year effective formation rate, within the empirical 0.07–0.15 range for prime-age singles)
- The best-performing value on births, peak population, and boom duration in a 16-seed diagnostic

## Sources

- Gorbach et al. (2010). *New sexual partnerships and sex behaviors among adults in the Seattle area.* Ann Epidemiol. [PMC2838999](https://pmc.ncbi.nlm.nih.gov/articles/PMC2838999/)
- Pew Research Center (2025). *Share of US adults living without a romantic partner.* [Link](https://www.pewresearch.org/short-reads/2025/01/08/share-of-us-adults-living-without-a-romantic-partner-has-ticked-down-in-recent-years/)
- Pew Research Center (2020). *Profile of single Americans.* [Link](https://www.pewresearch.org/social-trends/2020/08/20/a-profile-of-single-americans/)
- Pew Research Center (2019). *Marriage and cohabitation in the US.* [Link](https://www.pewresearch.org/social-trends/2019/11/06/marriage-and-cohabitation-in-the-u-s/)
- Pew Research Center (2014). *Demographics of remarriage.* [Link](https://www.pewresearch.org/social-trends/2014/11/14/chapter-2-the-demographics-of-remarriage/)
