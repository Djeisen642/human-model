# Research: Windfalls and Unexpected Resource Gains

Gathered to calibrate ARD for WindfallEvent. Sources: Penn Wharton Budget Model (SCF), NBER WP16840 (Wolff & Gittleman), Elinder/Erixson/Waldenström (2018, Sweden), Boserup/Kopczuk/Kreiner (2016, Denmark), Cesarini et al. (2017, AER lottery study), CRR Coe & Webb.

## Annual prevalence by type

| Type | Annual probability | Notes |
|---|---|---|
| Inheritance | ~2–4% at peak ages (55–65) | HRS: 1 in 5 households 50+ receives one over 8 years |
| Inter-vivos gifts | ~1–2% additional | 2019 SCF: ~3% of families in a single year (gifts + inheritance combined) |
| Lottery / gambling | Negligible | Powerball jackpot: 1 in 292M; any prize: ~1 in 25 but trivially small |
| Insurance / severance | Sporadic; mostly income replacement | Not a net resource gain for simulation purposes |

**Calibration target:** `BASE_WINDFALL_RATE ≈ 0.03` (3% per year per person) covers inheritance plus meaningful inter-vivos gifts. This is the empirically grounded central estimate for a simulation where one resource unit represents normalized wealth.

## Age profile

Inheritance receipt peaks at **ages 55–65** (parental death timing), roughly bell-shaped, meaningful from ~35–80, near-zero below 30 and above 85.

Recommended age profile constants (following existing `ageModifier()` pattern):
- `WINDFALL_PEAK_AGE = 58`
- `WINDFALL_AGE_SCALE = 20` (moderately wide — real inheritance arrives over a ~30-year window)
- `WINDFALL_AGE_FLOOR = 0.05` (non-zero at any age — gifts, found money, etc.)

No stat adjustment needed (constitution, intelligence, charisma do not predict windfall receipt). Windfalls are external.

## Size distribution

US inheritance amounts (SCF/PSID, 2016–2019):
- Median among recipients: ~$50,000–$55,000
- Mean among recipients: ~$184,000–$186,000 — mean/median ratio ~**3.5–4×**
- By wealth position: bottom 25% receive avg $6,100; top 1% receive avg $2.7M
- Gini of inheritance transfers among recipients: **0.80** (extraordinary concentration even conditional on receipt)

The distribution is lognormal in the middle with a Pareto upper tail (α ≈ 1.36 for the wealthy). A practical approximation: `BASE_AMOUNT + rng() ^ PARETO_EXPONENT * SCALE`, where `PARETO_EXPONENT < 1` produces right skew. With exponent=0.3, scale=30: draws cluster near 5–10 but occasionally reach 25–35.

Relative to income: the median inheritance represents roughly **4 months of household income** for a typical recipient.

## Effect on Gini — the key design decision

**Flat/uniform windfalls** (same amount regardless of current resources):
- Net effect: **Gini-compressing**. Less-wealthy recipients gain more relative to their baseline, even if absolute amounts are equal.
- Elinder et al. (Sweden 2018): Gini falls ~7% at receipt; behaviorally adjusted (~40% consumption by lower-wealth heirs) leaves ~4% net reduction.
- Acts as a redistributive shock → nudges toward thriving signal.

**Proportional windfalls** (magnitude correlated with existing resources):
- Net effect: **Gini-widening** — reinforces existing inequality.
- Empirically most realistic: large inheritances go mostly to already-wealthy households.
- Gini of transfers is 0.80 among recipients; the wealthy retain nearly 100% of inherited wealth vs. ~40% for poorer heirs.
- Creates a feedback loop: high-resources persons get bigger windfalls → Gini rises → KillEvent attempt rate rises (via `KILL_GINI_SCALAR`) → mortality increases → further inequality.

**Practical implications for the ARD:**
- Flat windfall: a modest stabilizer. Reduces Gini variance, makes stable runs more stable.
- Proportional windfall: an inequality amplifier. Accelerates the collapse signal in already-unequal populations.
- Both are empirically defensible — they model different aspects of real inheritance dynamics. The choice should be framed as a design intent: does WindfallEvent exist to create a stabilizing counter-force, or to deepen the inequality signal?

One defensible approach: flat base with a modest wealth multiplier, e.g., `WINDFALL_BASE_AMOUNT * (1 + person.resources * WINDFALL_WEALTH_SCALAR)`. At `WINDFALL_BASE_AMOUNT=5`, `WINDFALL_WEALTH_SCALAR=0.1`: resources=10 → +5.5, resources=100 → +10. This is mildly inequality-widening without being extreme.

## Behavioral effects (secondary)

- **Labor supply:** Swedish lottery data (Cesarini 2017): winning ~$150K reduces lifetime labor earnings ~11 cents per dollar won; ~25% of large winners stop working. Minor effect on simulation — JobEvent handles employment dynamics independently.
- **Fertility:** Taiwan lottery (large windfall): +0.05 children per winner, concentrated on childless couples. Wealth elasticity of fertility ≈ 0.06. Modest.
- **Consumption/spending:** MPC out of windfall income 0.5–0.9 (vs. ~0.15 for permanent income). Flows through resources → ConsumptionEvent naturally handles this.
- **Gini erosion:** Lower-wealth recipients spend ~60% of the windfall; upper-wealth recipients retain ~100%. The redistributive effect of flat windfalls decays over subsequent ticks as the resource consumption mechanic depletes the gains at the bottom faster.

## Suggested constants for ARD

| Constant | Value | Rationale |
|---|---|---|
| `BASE_WINDFALL_RATE` | 0.03 | 3% annual prevalence, consistent with SCF/HRS data |
| `WINDFALL_PEAK_AGE` | 58 | Parental death timing; empirically grounded |
| `WINDFALL_AGE_SCALE` | 20 | ~30-year window of meaningful receipt |
| `WINDFALL_AGE_FLOOR` | 0.05 | Non-zero at any age |
| `WINDFALL_BASE_AMOUNT` | 5 | Small flat base; ~10% of median resources |
| `WINDFALL_VARIANCE` | 15 | Range 5–20 for flat option; mean ~12 (~25% of median resources) |
| `WINDFALL_WEALTH_SCALAR` | 0.1 | Optional multiplier for proportional option; mild inequality widening |
