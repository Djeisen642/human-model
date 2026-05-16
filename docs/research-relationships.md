# Research: Relationship Formation and Dissolution

Gathered to calibrate ARD 025 (RelationshipEvent). Sources: CDC/NCHS, Our World in Data, Harvard T.H. Chan School of Public Health, NIH/PMC, Springer ABM literature.

## Partnership formation rates by age

By age 25, ~50% of US women have entered a first partnership (marriage or cohabiting); men reach that milestone around 27. By age 30: 74% of women, 61% of men. Peak first-partnership rates are for ages 25–34 across all racial and ethnic groups; rates drop sharply after 65.

Cohabitation outside marriage has grown substantially — from 0.1% to 9.4% of adults 18–24 living with an unmarried partner between 1968 and 2018. For this simulation "relationship" covers any committed partnership.

Implied per-tick formation rate for an unpartnered adult at peak ages: roughly 7–10% per year. The eligible pool shrinks over time (most people pair off), which the sim captures naturally because `getRandomOther()` drawn from an increasingly partnered population will fail the eligibility check more often.

Sim calibration (ARD 024): `BASE_RELATIONSHIP_RATE` should yield ~8% formation per tick at peak age (26) for a person with median charisma, falling to ~1–2% at the age floor.

## Dissolution rates

The crude US divorce/separation rate is ~2.5 per 1,000 population per year. Per 1,000 partnered adults the rate is ~17, implying roughly 1.7% of partnerships dissolve per year at steady state. Accounting for cohort-level evidence (~40% of first partnerships eventually dissolve over an ~8-year average duration), the annual dissolution probability for any given partnership is closer to 3–5%.

Key predictor of dissolution in the research: economic stress and financial disagreement. This is directly relevant — Gini-driven inequality in the sim is already the primary collapse signal, and dissolution rates rising under resource stress reinforces the same mechanism.

Sim calibration (ARD 024): `BASE_BREAKUP_RATE ≈ 0.03` (3% per tick). No stat modifier for now — keeping dissolution simple until we have evidence a charisma or happiness modifier moves the collapse signal meaningfully.

## Widowhood effect (partner death)

Partner death raises the surviving partner's own mortality risk by ~66% in the first three months. 16–18% of surviving partners die within the year of bereavement; the elevated risk persists up to 20 years, diminishing over time.

Mechanism: acute grief → depression → reduced self-care and immune function. Social network loss amplifies it — partners whose shared friends weren't close to the deceased face 5× the mortality risk of those with overlapping social ties.

Sim calibration (ARD 024): when `simulation.kill()` is called, clear the deceased's partner's `isInRelationshipWith`. The survivor loses the +3 happiness bonus immediately, which feeds into MisfortuneEvent's suicide check (`SUICIDE_PROBABILITY_SCALE / (happiness + 1)`) — a reasonable proxy for elevated post-bereavement mortality without a dedicated mechanic. No separate widowhood penalty needed at this stage.

## ABM modeling conventions

Standard pattern in demographic ABMs (Springer 2018, JASSS):

- One agent initiates per tick; eligibility gate (both unpartnered) replaces a bilateral consent roll.
- Dissolution modeled as a flat per-tick probability, sometimes weighted by economic stress or happiness; flat is standard when stress-weighting lacks calibration data.
- Mutual assignment on formation: both agents updated in the same event execution. This prevents a second agent from "claiming" the same partner in the same tick because the eligibility check runs at execution time.

## Sources

- [First Marriage Rate by Age and Race/Ethnicity — BGSU/NCFMR](https://www.bgsu.edu/ncfmr/resources/data/family-profiles/FP-25-05.html)
- [Marriages and Divorces — Our World in Data](https://ourworldindata.org/marriages-and-divorces)
- [First Marriages in the United States — CDC/NCHS Data Brief 49](https://www.cdc.gov/nchs/data/nhsr/nhsr049.pdf)
- [FastStats: Marriage and Divorce — CDC](https://www.cdc.gov/nchs/fastats/marriage-divorce.htm)
- [The Coming Divorce Decline — PMC/NIH](https://pmc.ncbi.nlm.nih.gov/articles/PMC7351120/)
- [Widowhood effect — Wikipedia](https://en.wikipedia.org/wiki/Widowhood_effect)
- [Widowhood effect greatest in first three months — Harvard T.H. Chan](https://hsph.harvard.edu/news/widowhood-effect-greatest-first-three-months/)
- [The Effect of Widowhood on Mortality by Cause — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC2636447/)
- [Agent-Based Modeling of Family Formation and Dissolution — Springer](https://link.springer.com/chapter/10.1007/978-3-319-93227-9_6)
- [Statistical Implementations of Agent-Based Demographic Models — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7436772/)
