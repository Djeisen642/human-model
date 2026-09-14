# ARD 061: Welfare Pays the Shortfall, Not an Equal Split

**Status:** Accepted
**Date:** 2026-09-14

## Context

`Simulation.distributeWelfare()` divides `communityPool × (1 − COMMUNITY_POOL_RESERVE_FRACTION)`
**equally** among everyone eligible, where eligible means `resources < WELFARE_THRESHOLD` or an
orphaned child (ARD 034). The size of the pot and the number of recipients are set by unrelated
things — the pot by total taxable wealth, the headcount by how many people are destitute — so the
per-recipient payment is unbounded from below on the recipient side. As a society gets richer and
fewer people qualify, each remaining recipient's payment grows without limit.

This is not hypothetical. In the thriving-reachability study
(`docs/research-thriving-reachability.md`), a configuration with a raised tax rate and a raised
welfare threshold drove Gini from 0.17 to 0.86 in a population that was healthy, fully employed, and
sitting on a full commons. The mechanism ARD 034 introduced to compress inequality was the thing
generating it: welfare was making a handful of people spectacularly rich.

## Decision

Pay each recipient their **shortfall** — the gap between their resources and `WELFARE_THRESHOLD` —
rather than an equal share of the pot.

When the distributable amount covers every shortfall, each recipient is topped up exactly to the
threshold and the surplus stays in the community pool. When it does not, the distributable amount is
split in proportion to each recipient's shortfall, so the deepest need is served first in the sense
that matters: nobody can receive more than their gap, and the poorest receive the largest amounts.

`WELFARE_THRESHOLD` therefore becomes both the eligibility line and the top-up target — one constant
serving both roles rather than introducing a second. The orphan-eligibility clause becomes inert
under this rule (an orphan at or above the threshold has no shortfall, so receives nothing) and is
removed; a *higher* guarantee for orphans would be a separate decision.

No new constants. `COMMUNITY_POOL_RESERVE_FRACTION` is retained.

## Reasoning

**Rejected: split the whole pot weighted by shortfall.** The obvious near-miss. The poorest would
get the largest share, but the entire distributable amount still leaves the pool every tick, so a
rich society with one poor person still hands that person everything. It softens the failure mode
without removing it — the payout still has no relationship to how much anyone actually needs.

**Rejected: keep the equal split and cap each payment at a new constant.** The smallest code change,
and it does bound the damage. It loses on two counts: the cap is a free parameter with no natural
value, so it needs its own calibration study; and it leaves the surplus unspecified, which is the
same design hole in a new place. The shortfall is already the right cap and it is already in the
model.

**Rejected: universal basic income.** ARD 034 rejected paying everyone equally on the grounds that
it does not target the distress that drives collapse, and that reasoning is untouched here. Worth
recording, though, that the thriving-reachability study found the *opposite* signal: making welfare
universal (setting the threshold above everyone's resources, i.e. a flat dividend) was one of the
load-bearing changes in the only configuration that sustained THRIVING to 800 ticks, holding Gini at
0.02–0.16. That was measured in a heavily modified configuration and is not evidence for reversing
ARD 034, but it is a strong enough hint that universality deserves a deliberate experiment rather
than a standing assumption. Recorded in `docs/future-ideas.md`; not decided here.

**What real systems do, and which axis actually matters.** Guaranteed-minimum-income schemes pay
precisely this shape: the UK's Universal Credit, France's RSA and Germany's Bürgergeld all compute a
household entitlement and pay the gap between it and current income. Friedman's negative income tax
is the same top-up routed through the tax system. Against those sit the universal and categorical
designs — Alaska's Permanent Fund Dividend and most European child benefits pay a flat amount
regardless of need — and the conditional transfers (Bolsa Família, Progresa/Oportunidades) that add
behavioural requirements, and in-kind provision (food assistance, housing) that restricts what the
transfer can buy.

The usual axis of argument is universal versus targeted. That is not this bug. The current design is
targeted *and* flat, and no real system is built that way, because no real system sets its budget
and its payment rate independently — a means-tested programme computes entitlements and funds them,
it does not divide a fixed pot by a headcount. Whatever the model eventually decides about
universality, the payment should track need.

**Deliberately omitted: a withdrawal taper.** Real top-ups phase out gradually (Universal Credit
withdraws at 55p in the pound) to avoid a cliff where earning slightly more costs the whole
transfer. This model has no labour-supply response to that cliff — `JobEvent` and
`GatherResourcesEvent` are indifferent to welfare eligibility — so a taper would add a parameter
that changes nothing. It becomes worth adding only if agents are ever given a work/leisure choice.

## Consequences

- `Simulation.distributeWelfare()` is rewritten around shortfalls; the eligibility filter reduces to
  "has a positive shortfall" and the orphan clause is removed.
- **The community pool now accumulates.** Previously it was drained to its reserve every tick; under
  a top-up it retains whatever need does not consume, so `communityPool` and the per-decade
  `avgCommunityPool` will trend upward in prosperous runs and act as a genuine buffer entering a
  crash. `COMMUNITY_POOL_RESERVE_FRACTION` changes character accordingly: it no longer creates the
  buffer, it caps how fast the buffer can be spent in a crisis. Its calibrated value should be
  re-examined, but that is a tuning question, not a decision for this ARD.
- No recipient can be lifted above `WELFARE_THRESHOLD` by welfare alone, which bounds the
  mechanism's contribution to inequality by construction.
- Tests must cover: a recipient below the threshold is topped up exactly to it when the pool
  suffices; the unspent remainder stays in the pool; when total shortfall exceeds the distributable
  amount the split is proportional to shortfall and exhausts it; a person at or above the threshold
  receives nothing; an orphan above the threshold receives nothing (the behaviour change from ARD
  034); no-op on an empty population and on an empty pool. The existing "distributes equal shares to
  each eligible recipient" and orphan-eligibility tests in `src/tests/App/Simulation.test.ts` are
  replaced rather than amended.
- `docs/odd-protocol.md` — the welfare step in the scheduling sequence and the `communityPool` state
  description both state the equal-split rule and must be updated.
- `docs/future-ideas.md` — the welfare-concentration item is subsumed. The redistribution-calibration
  item (`TAX_RATE` / threshold levels against the OECD ~25% compression target) is **not** subsumed
  and stays, but its baseline shifts: the channel now behaves differently, so that study should be
  run after this lands, not before.
- Modifies [ARD 034](./034-community-pool-tax-welfare.md)'s distribution rule; its taxation side,
  eligibility intent, and reserve constant are unchanged. Reads the inequality signal redefined by
  [ARD 060](./060-gini-measurement-basis.md).
