# Research: Homicide and Interpersonal Violence

Gathered to calibrate ARD for KillEvent. Sources: UNODC Global Study on Homicide 2023, FBI UCR 2019, CDC 2022, BJS, World Bank, PNAS (Epstein 2002), multiple PMC studies.

## Baseline annual homicide rates

All figures are intentional homicides per 100,000 population per year:

| Context | Rate |
|---|---|
| Most stable (Japan, Iceland) | 0.1–0.2 |
| Western Europe average | ~1.0–1.7 |
| Global average (UNODC 2021) | 5.8 |
| Africa regional average | 12.7 |
| Americas regional average | 15.0 |
| Highly unstable (Jamaica, Honduras) | 30–60+ |

**Per-person annual probability of being murdered** = rate / 100,000. US: ~0.006%. Honduras: ~0.03%. Japan: ~0.0002%.

Offending rates are not evenly distributed. Among young adult males in high-violence contexts, the per-perpetrator rate is 25–30 per 100,000 (0.025–0.03% annually) — roughly 20–30× the population average.

## Age and sex profile of perpetrators

Globally, ~90% of homicide suspects are male (UNODC); ~88% in US FBI data (2023).

The "age-crime curve" (Hirschi & Gottfredson 1983) is one of the most replicated findings in criminology:
- Rises steeply from adolescence, peaks at **~22–26**, declines more gradually through the 30s and 40s.
- The 18–24 cohort accounts for ~22% of all US homicide offenders; under-25s account for ~30%.
- Peak male victim rate (a reasonable proxy for offending): 25.2 per 100,000 at ages 20–24 (CDC 2022).
- By age 40–45, rates are roughly half the peak; by 60+, roughly one-fifth.

**Sim calibration:** existing `KILLING_PEAK_AGE=24`, `KILLING_AGE_SCALE=30`, `KILLING_AGE_FLOOR=0.05` are well-grounded. No change needed.

## Correlates of homicide perpetration

**Inequality (Gini) — the strongest predictor:**
- Gini explains ~50% of cross-national homicide variance — stronger than poverty, unemployment, or any other single variable (Kelly 2000, World Bank; multiple meta-analyses).
- Mechanism (Daly & Wilson evolutionary framework): in unequal societies, low-resource individuals perceive low expected returns from prosocial behavior, raising the attractiveness of risky aggressive strategies ("fast life history"). This is the direct theoretical link between the simulation's primary collapse signal and killing.
- The interaction of scarcity × inequality is significant: a 2024 PMC study (PMC10955375) found that homicide rates increase when resources are scarce *and* inequality is high — neither alone predicts as strongly.

**Individual-level predictors:**
- Prior involvement in violence is the strongest individual predictor of future violence. `killingIntent` at [0, 0.1) is a reasonable proxy for accumulated violent disposition.
- Unemployment and low happiness/hopelessness are robust secondary predictors.

## Victim selection: random vs. targeted

From FBI 2019 UCR expanded homicide data:
- 28.3% known non-family (acquaintance, neighbor, friend)
- 13.0% family member
- 9.9% stranger
- ~49% unknown relationship (many believed acquaintance/gang-related)

Dominant pattern is **known-person killing**, not stranger homicide. `getRandomOther()` (random from living population) is a reasonable approximation of the acquaintance/proximity dynamic.

Vulnerability also matters: lower-income persons are victimized at 3–5× the rate of high-income persons (BJS). Adding vulnerability weighting (prefer victims with low constitution or low resources) would be more empirically accurate — candidate for future-ideas.

## Key ABM reference: Epstein civil violence model (PNAS 2002)

Epstein's model uses `grievance = hardship × (1 − legitimacy)` compared against `risk_aversion × arrest_probability`. Agents flip to "active" (violent) when `grievance − risk_aversion × arrest_probability > 0.1`.

Key insight: violence as a **threshold phenomenon** produces punctuated equilibrium — long quiet periods, then sudden bursts — matching real civil unrest. The simulation's intent-scaled probability is a continuous analog; a Gini modulator on the attempt probability achieves a similar amplification effect without a hard threshold.

## Calibration targets for KillEvent

Translate to annual attempt probabilities (one tick = one year):

| Condition | Target annual probability |
|---|---|
| `killingIntent=0.1` (max), peak age, bad conditions | 5–10% |
| `killingIntent=0.01` (median), peak age, average conditions | 0.5–1% |
| `killingIntent=0.001`, off-peak age | 0.01–0.1% |

Once an attempt fires, real-world firearms lethality is ~85–90%. In an abstracted simulation where constitution matters, a `KILL_SUCCESS_BASE / victim.constitution` formula is consistent with the data.

**Separating attempt from success** is empirically motivated: intent drives whether an attack is initiated; victim's constitution drives whether it's fatal. This makes constitution meaningfully protective, not just a Gather/Illness modifier.

**Gini modulator:** given the 50% variance explained by Gini, a term like `1 + currentGini × KILL_GINI_SCALAR` applied to attempt probability would wire the inequality→violence loop directly — the most important feedback missing from the current model.
