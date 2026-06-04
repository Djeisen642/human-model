# Research: Taxation and Welfare Redistribution

Gathered to assess ARD 034 (Community Pool, Taxation, and Welfare). ARD 034 cites Wilkinson &
Pickett and Putnam for *why* redistribution dampens inequality, but sets `TAX_RATE`,
`WELFARE_THRESHOLD`, and `COMMUNITY_POOL_RESERVE_FRACTION` with no empirical anchor — and this
is the single most direct lever on the Gini coefficient, the project's primary collapse signal.
A redistribution system that is mistuned either way silently rewrites the headline metric.

Sources: OECD *Income Redistribution Across OECD Countries* (Economic Policy Paper No. 23,
2018; CEPR VoxEU summary), OECD *Society at a Glance 2024*, Our World in Data (reduction in
income inequality before/after tax), OECD Revenue Statistics (tax-to-GDP).

## The key empirical anchor: ~25% Gini reduction

Redistribution is measured as the gap between the **market-income Gini** (before taxes and
transfers) and the **disposable-income Gini** (after), as a percent of the market-income Gini.

- **Taxes and transfers reduce market-income inequality by slightly more than 25% on average
  across the OECD.**
- The spread is wide: **~40% in Ireland/Finland/Belgium down to ~5% in Chile**; the US sits
  around 18–23%.
- Countries with similar market inequality land at very different disposable inequality:
  market Gini ≈ 0.38 in both Japan and Norway, but disposable Gini ≈ 0.27 (Norway) vs ~0.32
  (Japan) — i.e. the *policy*, not the pre-tax economy, sets the difference.
- **Transfers (cash benefits) do most of the work** — roughly two-thirds to three-quarters of
  the redistributive effect across the OECD; direct taxes do the rest. The welfare-distribution
  half of ARD 034 is therefore the more important lever, not the tax half.

This gives a clean, simulation-checkable calibration target that ARD 034 lacks: **the
tax+welfare system should compress the Gini by ~15–30% relative to a counterfactual run with
redistribution switched off.** That is directly measurable — run with `TAX_RATE = 0` and welfare
disabled, compare end Gini.

## Tax level anchors

- OECD average **tax-to-GDP ≈ 34%** (range ~17% Mexico to ~46% France); but most of that funds
  services, not cash redistribution.
- The flat `TAX_RATE` in the model is closer to an *effective redistributive levy* than a full
  tax burden, so it should be read against the transfer share, not headline tax-to-GDP.

The model uses `TAX_RATE = 0.02` (2% of resources per tick), `WELFARE_THRESHOLD = 20` (against a
seeding range of [0, 100)), and `COMMUNITY_POOL_RESERVE_FRACTION = 0.20`.

## Where the current calibration likely falls short

1. **Flat 2% may be too weak to hit the ~25% target.** With welfare narrowly targeted (only
   `resources < 20` or orphans) and 20% of the pool held in reserve each tick, throughput is
   small. In the seed-42 run the community pool ends at **18** — trivial against an average of
   ~32 resources/person × 82 persons ≈ 2,600 total. The redistribution channel is barely moving
   resources, so it is unlikely to be producing anything near a 25% Gini compression. *This
   should be measured against the `TAX_RATE = 0` baseline, not assumed.*

2. **Flat tax is regressive-neutral, not progressive.** ARD 034 rejected progressive taxation
   for simplicity, which is defensible at 100 persons — but note the empirical record: the
   reason OECD systems achieve 25% is the *combination* of progressive transfers (heavily
   bottom-weighted) with broad taxation. The model already gets the transfer-targeting right
   (welfare to the bottom); the flat tax is the weaker half. A mildly progressive tax (rate
   scaling with resources) would better match the empirical mechanism if the flat rate proves
   too weak to hit the target.

3. **`WELFARE_THRESHOLD = 20` is a poverty line; check it tracks consumption.** A coherent
   threshold is "below what a person needs to avoid the starvation path." With `CONSUMPTION_BASE
   = 1.0`/tick, 20 resources is ~20 ticks of subsistence — generous as a poverty line. Worth
   confirming it is not so high that most of the population qualifies (which would turn targeted
   welfare into near-UBI and dilute the per-recipient amount to noise).

## Recommendations

Calibration recommendations — a parameter sweep, not new mechanics, so this is a tuning + (if
progressivity is added) a small ARD, not a redesign.

1. **Adopt the ~15–30% Gini-compression target as the calibration objective for ARD 034's
   constants.** Measure it directly: a paired run (redistribution on vs off, same seed) should
   show disposable-Gini ≈ 0.7–0.85 × market-Gini. Tune `TAX_RATE`,
   `COMMUNITY_POOL_RESERVE_FRACTION`, and `WELFARE_THRESHOLD` together to land in that band.

2. **Expect `TAX_RATE` to rise** from 0.02 toward the level needed to hit the target; the
   current pool balances (ending at ~18) suggest the channel is near-inert. Raise tax and/or
   lower the reserve fraction until the pool actually circulates resources.

3. **Keep transfers bottom-weighted** (ARD 034 already does) — this matches the empirical fact
   that transfers, not taxes, do most of the OECD redistribution.

4. **Consider mild progressivity only if a flat rate can't reach the target** without becoming
   implausibly high. The empirical mechanism is progressive, but the simplicity argument in ARD
   034 holds until the flat rate is shown insufficient.

## Suggested constants / targets for a calibration ARD

| Constant | Current | Suggested direction | Rationale |
|---|---|---|---|
| `TAX_RATE` | 0.02 | raise until target met | Channel currently near-inert (pool ends ~18); 2% likely too weak for 25% compression |
| `WELFARE_THRESHOLD` | 20 | verify vs consumption | ~20 ticks of subsistence; ensure it isn't so high it becomes near-UBI |
| `COMMUNITY_POOL_RESERVE_FRACTION` | 0.20 | lower if throughput too low | Holding 20%/tick throttles redistribution; reduce if pool isn't circulating |
| (validation) | — | disposable Gini ≈ 0.7–0.85 × market Gini | OECD ~25% reduction; measurable via redistribution-off baseline run |
