# Research: Inequality Does Drive Collapse Here, Past a Threshold, and Welfare Buffers It

**Recorded:** 2026-09-20 | **Commit:** 6d69e06 | **Latest ARD:** 068 | **Base config:** the surviving 100-founder regime of `docs/research-clean-long-run-100-founders.md` — all Variables at defaults except the overrides below
**Commands:**
`npx ts-node scripts/compare.ts --seeds 24 --ticks 3000 --persons 100 --workers 4 --both NATURAL_RESOURCES_INITIAL=30000 --both NATURAL_RESOURCE_CEILING_INITIAL=30000 --both MAX_NATURAL_RESOURCE_CEILING=60000 --both NATURAL_RESOURCE_CEILING_FLOOR=6000 --both EXTRACTION_PRODUCTIVITY_FLOOR=0.5 --both MAX_EXTRACTION_PRODUCTIVITY=2 --b EXTRACTION_ACCESS_GRADIENT=0.5`
`npx ts-node scripts/trough-probe.ts --seeds 24 --ticks 3000 --persons 100 --tsv --set <same six> [--set TAX_RATE=0] --set EXTRACTION_ACCESS_GRADIENT=<0|0.25|0.5|0.75>`
**Key context vars:** `EXTRACTION_ACCESS_GRADIENT`, `EXTRACTION_ACCESS_MIN=0.1`, `EXTRACTION_ACCESS_MAX=20`, `TAX_RATE=0.02`, `WELFARE_THRESHOLD=20`, `CHILDBIRTH_RESOURCE_MIN=10`/`CHILDBIRTH_RESOURCE_SCALE=30`

---

**Wealth-scaled access to the commons (ARD 068) makes cycle troughs 18% shallower to 33% deeper
depending on dose, and the effect is a threshold rather than a gradient: nothing at 0.25 or 0.5,
decisive at 0.75.** Removing welfare funding (`TAX_RATE=0`) roughly doubles the damage and pulls the
threshold down to 0.5. Per-capita private holdings are unchanged across doses, so this is not the
commons being hoarded into private stockpiles; it is inequality amplifying the boom-bust cycle in
both directions. **This is the first mechanism in this project for which inequality is causal for a
collapse-relevant measure rather than an output of scarcity.**

**The prediction registered in ARD 068 was half right and is corrected here.** It said trough depth
would fall *monotonically* with the gradient. It does not: the first two doses are flat nulls, and
the whole effect appears between 0.5 and 0.75. A study that had swept only 0 and 0.5 — which is
exactly what ran first — would have published a null.

## Trough depth by dose

Deepest cycle trough per seed (the measure that predicts extinction in an oscillating regime, per
`docs/research-clean-long-run-100-founders.md`), 24 paired seeds, 3,000 ticks, 100 founders.

| gradient | deepest trough | median trough | cycles | peak pop | paired change vs 0 | verdict |
|---|---|---|---|---|---|---|
| **`TAX_RATE` = 0.02 (default welfare)** ||||||
| 0 | 162.0 | 218.5 | 10.0 | 4,240 | — | baseline |
| 0.25 | 167.0 | 215.3 | 10.0 | 4,326 | +2.4 (CI −5.3 to +10.1), p = 0.53, 11/24 lower | no effect |
| 0.5 | 174.5 | 219.2 | 9.0 | 4,374 | +1.0 (CI −10.6 to +12.5), p = 0.86, 10/24 lower | no effect |
| 0.75 | 131.1 | 189.8 | 8.5 | 4,585 | **−29.6 (CI −38.9 to −20.2), p < 0.001, 21/24 lower** | real, −18% |
| **`TAX_RATE` = 0 (welfare unfunded)** ||||||
| 0 | 184.2 | 240.1 | 11.0 | 3,795 | — | baseline |
| 0.25 | 186.3 | 254.1 | 11.0 | 3,946 | +1.7 (CI −10.2 to +13.5), p = 0.77, 11/24 lower | no effect |
| 0.5 | 167.4 | 231.2 | 10.0 | 4,125 | −16.1 (CI −29.3 to −2.8), p = 0.012, 16/24 lower | real but weakest cell |
| 0.75 | 120.4 | 177.1 | 9.0 | 4,662 | **−61.6 (CI −73.9 to −49.2), p < 0.001, 24/24 lower** | real, −35% |

Six paired tests were run, so one nominal alarm is expected by chance. The two 0.75 cells are far
past that (p < 0.001 with 21/24 and 24/24 seeds moving the same way). **The `TAX_RATE=0`, gradient
0.5 cell at p = 0.012 and 16/24 is the one to distrust** and should be replicated on fresh seeds
before it is leaned on; it is the cell that sets where exactly the threshold sits.

**The two tax rows are different economies, not one economy with a dial.** Removing the tax removes
welfare's funding, and the gradient-0 baselines differ accordingly (trough 184 against 162, peak
3,795 against 4,240). Read the gradient effect *within* each row. The comparison *across* rows is a
difference-in-differences and is reported as such: at gradient 0.5 welfare erases the effect
entirely (+1.0 against −16.1), and at 0.75 it absorbs about half the damage (−29.6 against −61.6).

## What the mechanism is not: sequestration

ARD 068 flagged that private wealth never depreciates and never returns to the pool, so a collapse
at a high gradient might be concentration stripping the commons into permanent private stockpiles
rather than inequality as such. That confound is ruled out for this result. Median over 4 seeds,
sampled every 100 ticks from tick 500 to 3,000:

| gradient | total private holdings | population | **per capita** | pool |
|---|---|---|---|---|
| 0 | 21,219 | 931 | **22.8** | 0 |
| 0.75 | 27,133 | 1,193 | **22.7** | 0 |

Total private wealth is 28% higher at the high gradient and per-capita holdings are identical to
within 0.1. The extra private stock is entirely accounted for by there being more people. Nothing is
being hoarded out of the commons.

## What it looks like instead: inequality amplifies overshoot

Every column moves the same way with dose, in both tax rows: peak population **up** (4,240 → 4,585
with welfare; 3,795 → 4,662 without), cycles **down** (10 → 8.5; 11 → 9, so periods lengthen), and
troughs **down**. Concentration produces a bigger boom on the same commons and therefore a deeper
crash. The `compare.ts` run at gradient 0.5 independently found peak population up 156 (CI +33 to
+278, p = 0.008) and one fewer cycle (p < 0.001), consistent with the same picture at a dose too low
to move the trough.

**Hypothesis for why concentration raises the peak, not established here.** `ChildbirthEvent` ramps
fertility linearly between `CHILDBIRTH_RESOURCE_MIN` = 10 and `CHILDBIRTH_RESOURCE_SCALE` = 30 and
saturates above it. Welfare pins the poor at `WELFARE_THRESHOLD` = 20, which sits *inside* that band,
so under a gradient the rich saturate at full fertility while the poor cannot fall below the fertile
floor. Net: more fertile couples, bigger boom. That also predicts the welfare interaction — with the
floor removed the poor fall under 10 and go sterile as well as hungry, which is the row where the
threshold drops to 0.5. Testing this needs an experiment that cuts the pathway (flatten the
fertility ramp, or move `WELFARE_THRESHOLD` outside the band), not another dose sweep.

## What this does not establish

- **Horizon.** 3,000 ticks, with trough depth as the proxy. That is the right proxy precisely because
  extinction at a fixed horizon measures the horizon, but no extinction count was taken at a long
  horizon, and the same regime is documented as losing 7 of 24 seeds by 30,000 ticks at gradient 0.
- **Above 0.75.** Untested here. A reduced-form model of this wealth dynamic condenses past about
  0.9, so the shape of the curve between 0.75 and condensation is unknown and may not be monotone.
- **Whether this rescues Gini as the headline signal.** It shows inequality *can* be made causal. It
  does not show that the Gini as currently computed tracks the mechanism — that needs the Gini
  measured alongside trough depth across these same arms, which was not done.
- **Mechanism.** See the hypothesis above; unfalsified, untested.
