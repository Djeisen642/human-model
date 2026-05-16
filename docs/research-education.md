# Research: Education Rates and Effects

Gathered to calibrate ARD 021 (GraduationEvent), ARD 022 (job education multiplier), and ARD 023 (EnrollmentEvent). Sources: NCES, BLS, Census Bureau, Georgetown CEW, peer-reviewed meta-analyses.

## Enrollment rates by age

| Age group | Enrollment rate | Notes |
|---|---|---|
| 15–17 | ~86% | US adjusted cohort graduation rate (NCES 2023–24) |
| 18–24 | ~39% | College/graduate school (NCES 2022) |
| 25+ | Drops sharply | Most post-24 enrollment is part-time or professional |

Sim calibration (ARD 021): seed HIGH_SCHOOL at 70% for ages ≤17 (conservative vs. 86%, accounting for early dropouts), BACHELORS at 40% for ages 18–24.

## Adult enrollment rates by age (mid-simulation re-enrollment)

Adults 25+ are **32% of total US college enrollment**. Enrollment by age as a share of that age group (estimated from NCES and Census):

| Age | ~% of group enrolled | Implied per-tick flow (÷ 5-yr degree) |
|---|---|---|
| 25–29 | ~10–12% | ~2–2.5% per tick |
| 30–34 | ~5–6% | ~1–1.2% per tick |
| 35–44 | ~2–3% | ~0.4–0.6% per tick |
| 45–54 | ~1–2% | ~0.2–0.4% per tick |
| 55+ | <1% | <0.2% per tick |

Projections show ages 35+ growing 18% between 2019 and 2030 — adult enrollment is rising, not niche.

Sim calibration (ARD 023): `BASE_ENROLLMENT_RATE` scaled by `learningIntent` (avg ~0.5) and `ageModifier` should land near 2–3% per tick at peak age, falling to <0.5% by age 50.

## Motivations for adult enrollment

Top reasons adults re-enroll (EAB/Sage Journals research):
- Career advancement: ~38–39%
- Pursuing passions / personal growth: ~two-thirds cite this

Adult learners "demonstrate stronger learning motivation and autonomy" than traditional-age students. High `learningIntent` gating on enrollment is well-supported — self-initiated enrollment is driven by the same disposition the sim already tracks.

## Work and school simultaneously

**70%+ of college students work while enrolled** (Georgetown CEW, 25-year trend). 40% of full-time undergrads are employed; 76% of part-time students work 30+ hours/week.

Sim calibration (ARD 023): employment does not block enrollment. `ExperienceEvent` already handles the overlap correctly (education bonus takes precedence when both apply).

## Time to complete a degree

| Metric | Value |
|---|---|
| Students finishing bachelor's in ≤4 years | 44% |
| 6-year bachelor's completion rate | ~64% (public), ~68% (private nonprofit) |
| Average months to bachelor's (active enrollment) | 48.5 months (~4 years) |
| Effective calendar time (including stops) | ~6 years |

Sim calibration: `BASE_GRADUATION_RATE = 0.2` yields a 5-tick average at peak age — within the empirical 4–6 year range.

High school on-time (4-year) graduation rate: **86.4%** (US average, 2023–24). Status dropout rate for 16–24 year-olds: **5.3%** (down from 7.0% in 2012).

## Education and cognitive ability

A 2018 meta-analysis (Ritchie & Tucker-Drob, n > 600,000) found education raises IQ-measured cognition by **1–5 points per additional year**. Effects persist across the lifespan and appear on all broad cognitive categories. Individuals with lower baseline intelligence benefit most.

Sim calibration: a degree represents ~4–5 years; `intelligence += 1` at graduation is conservative and proportionally grounded. Downstream compounding (intelligence → experience growth → resources) makes the effective payoff larger.

## Education and employment

| Education level | Employment rate (ages 25–34) |
|---|---|
| Bachelor's or higher | ~88% |
| No high school diploma | ~60% |
| Ratio (BA+ vs. no diploma) | ~1.47× |

Each additional year of schooling raises re-employment probability by **6–7 percentage points** (ScienceDirect, US labour market data).

Sim calibration: `EDUCATION_JOB_GAIN_SCALAR = 0.15` → BACHELORS (tier 3) multiplier = 1.45, closely matching the empirical 1.47× ratio.

## Education and income inequality (Gini)

- Countries/periods with higher average educational attainment have lower education Gini coefficients.
- The Gini coefficient of income decreases with the share of the population reaching secondary or tertiary education.
- Non-linear (Kuznets curve) effect for higher education: initially increases inequality when only an elite can access it, then reduces it as access broadens.
- A fairer distribution of education is a significant contributor to reducing income inequality (World Bank).

Sim implication: if only the initial young cohort graduates (and older seeded persons start with `education = NONE`), early-decade Gini may worsen before improving — matching the Kuznets dynamic empirically.

## Sources

- [NCES Fast Facts: Enrollment trends](https://nces.ed.gov/fastfacts/display.asp?id=65)
- [NCES: Higher education enrollment by age group](https://www.statista.com/statistics/236093/higher-education-enrollment-rates-by-age-group-us/)
- [NCES Fast Facts: High school graduation rates](https://nces.ed.gov/fastfacts/display.asp?id=805)
- [NCES Fast Facts: Time to degree](https://nces.ed.gov/fastfacts/display.asp?id=569)
- [NCES: Undergraduate retention and graduation rates](https://nces.ed.gov/programs/coe/indicator/ctr)
- [Ritchie & Tucker-Drob (2018): How Much Does Education Improve Intelligence? (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6088505/)
- [BLS: Education matters — earnings and unemployment by attainment](https://www.bls.gov/careeroutlook/2016/data-on-display/education-matters.htm)
- [Impact of education on unemployment and re-employment (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0927537111000054)
- [World Bank: Measuring education inequality — Gini coefficients of education](https://openknowledge.worldbank.org/handle/10986/19738)
- [IZA World of Labor: Can higher education reduce inequality in developing countries?](https://wol.iza.org/articles/can-higher-education-reduce-inequality-in-developing-countries/long)
- [PLOS One: Non-linear links between human capital, educational inequality and income inequality](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0288966)
