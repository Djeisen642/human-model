# Research: Fertility and Childbirth

Gathered to calibrate ARD for ChildbirthEvent. Sources: CDC/NCHS 2022, Hutterite natural fertility data (Eaton & Mayer 1953), WHO birth spacing guidelines, Dutch Hunger Winter studies, PMC fertility and happiness research.

## Age-specific fertility rates (ASFR): the full curve

**Hutterite natural fertility** (no contraception, well-nourished, all births wanted) — the biological ceiling:

| Age group | Annual birth probability |
|---|---|
| <20 | ~30% |
| 20–24 | ~55% |
| 25–29 | ~50% |
| 30–34 | ~45% |
| 35–39 | ~41% |
| 40–44 | ~22% |
| 45–49 | ~6% |

TFR ≈ 10.9. These are per-couple rates for couples actively trying to reproduce.

**Modern US observed rates (CDC 2022)** — population-level, including non-partnered and voluntarily childless women:

| Age group | Annual birth probability |
|---|---|
| 15–17 | 0.6% |
| 18–19 | 2.4% |
| 20–24 | 5.8% |
| 25–29 | 9.4% |
| 30–34 | 9.8% |
| 35–39 | 5.5% |
| 40–44 | 1.3% |

The modern US peak is 30–34 (exceeding 25–29 since 2016) due to delayed childbearing — this reflects contraceptive use and social factors, not biology alone.

**Per-cycle conception probability (couples actively trying):** 25–30% at ages 20–24; 20–25% at 25–29; 15–20% at 30–34; 10–15% at 35–39; ~5% at 40. Decline after 35 is gradual until 40, where it steepens sharply.

**Sim calibration:** `CHILDBIRTH_PEAK_AGE=26`, `CHILDBIRTH_AGE_SCALE=12`, `CHILDBIRTH_AGE_FLOOR=0.02` already encode the right shape. `BASE_CHILDBIRTH_RATE ≈ 0.40–0.45` is well-grounded at the Hutterite ceiling — appropriate for a simulation where all partnerships represent actively reproducing couples.

## Fertility suppressors and their magnitudes

**Illness:**
- Mild illness (0.1–0.3): minimal effect.
- Moderate illness (0.4–0.7): hormonal disruption, inflammation suppress ovulation; fecundability ratios of 0.5–0.7 (fertility halved to one-third).
- Severe illness (>0.8): near-complete suppression common in active autoimmune, endocrine, and chronic disease.
- **Recommended scalar:** `(1 - illness × 0.8)` multiplicative factor. Yields 0% suppression at illness=0, 80% suppression at illness=1, ~40% suppression at illness=0.5.

**Resource deprivation:**
- Critical threshold: energy availability below ~30 kcal/kg fat-free mass/day triggers hypothalamic amenorrhea.
- Dutch Hunger Winter (1944–45, ~400–800 cal/day): birth rate fell ~50%.
- Recovery is rapid once food is restored — within weeks to months (≤1 tick in sim).
- **Recommended approach:** soft threshold ramp. Fertility=0 at or below `CHILDBIRTH_RESOURCE_MIN`; full fertility at or above `CHILDBIRTH_RESOURCE_SCALE`; linear ramp between. E.g., `CHILDBIRTH_RESOURCE_MIN=10`, `CHILDBIRTH_RESOURCE_SCALE=30`.

**Happiness:**
- Multiple studies confirm higher subjective wellbeing in year N predicts childbearing in year N+1, controlling for other factors.
- Effect is real but modest — operates more on intention than biological fecundability.
- **Recommended scalar:** `(1 + happiness × CHILDBIRTH_HAPPINESS_SCALAR)` with scalar ~0.05. At happiness=0: no effect. At happiness=10: +50% multiplier. Keeps it from dominating.

**Gini / inequality:** Research is inconclusive on direct aggregate fertility suppression. Per 1% Gini increase, fertility intention decreases ~0.08% — very small. The more robust finding is that high inequality increases *dispersion* (rich delay and have fewer; poor have more and earlier) without collapsing the aggregate. The resource threshold mechanism already captures this; adding a Gini modifier directly would double-count it.

## Interbirth interval

- Global average: 32.1 months (2.7 years) — WHO 2005.
- WHO recommendation: 24–36 months. Risks rise below 24 months and above 60 months.
- US median: 24–29 months (~2–2.5 years).
- Biological minimum: ~12 months (lactational amenorrhea provides ~6 months partial suppression after birth).

**Sim implication:** `BASE_CHILDBIRTH_RATE ≈ 0.40` already produces a geometric distribution with mean ~2.5 years between births, matching the global average. No separate cooldown mechanic needed for the average case; the probability distribution handles it.

## Birth resource cost

US uncomplicated birth: $14,000–$26,000 in medical services; first-year total $14,680–$36,050; 18-year cost ~$318,000 (USDA). Scaled to the simulation's `CONSUMPTION_BASE=1.0` representing one adult-year of living cost, a one-time birth drain of **~10–15 resources per parent** is proportionate. At median resources (~50), that is a 20–30% hit — significant but survivable for a stable couple.

Ongoing child consumption is already handled by `ConsumptionEvent` (`CONSUMPTION_CHILD_RESOURCE_RATE` of own resources while parents live).

## Fertility collapse thresholds

- Below ~1,000 cal/day for an extended period: ~50% birth rate reduction.
- Societal collapse examples (Soviet 1990s, wartime): TFR can drop from ~2.0 to ~1.2 in 2–3 years (~40% reduction).
- Modern developed-country floor: ~1.0–1.2 TFR (South Korea 2024: 0.72).
- At the 100-tick timescale, population collapse from fertility alone is slow; the Gini/mortality channels are faster collapse signals. Fertility collapse amplifies rather than initiates.

## Suggested constant values for ARD

| Constant | Value | Rationale |
|---|---|---|
| `BASE_CHILDBIRTH_RATE` | 0.40 | Hutterite ceiling for partnered, willing couples |
| `CHILDBIRTH_ILLNESS_SCALAR` | 0.8 | Near-complete suppression at illness=1 |
| `CHILDBIRTH_RESOURCE_MIN` | 10 | Famine threshold; fertility=0 at or below |
| `CHILDBIRTH_RESOURCE_SCALE` | 30 | Full fertility at or above; ramp between 10–30 |
| `CHILDBIRTH_HAPPINESS_SCALAR` | 0.05 | Up to +50% at happiness=10; modest but real |
| `CHILDBIRTH_BIRTH_COST` | 12 | One-time resource deduction per parent at birth |
| `CHILDBIRTH_PEAK_AGE` | 26 | Already in Variables.ts — consistent with data |
| `CHILDBIRTH_AGE_SCALE` | 12 | Already in Variables.ts — consistent with data |
| `CHILDBIRTH_AGE_FLOOR` | 0.02 | Already in Variables.ts — consistent with data |
