# ARD 062: Welfare Skips Parentally Subsidised Children

**Status:** Accepted
**Date:** 2026-09-14

## Context

[ARD 060](./060-gini-measurement-basis.md) and [ARD 061](./061-welfare-shortfall-topup.md) landed
together and contradict each other. ARD 060 removed dependent children from the inequality signal on
the grounds that the model does not treat a child's own `resources` as their standard of living.
ARD 061 then sized each welfare payment from exactly that field. Because children hold close to
nothing, they sort to the top of the shortfall ranking: measured over 200 ticks of the default
config, **~46% of all welfare goes to under-18s**, and when the pool cannot cover every shortfall a
child at 0 receives twenty times what an adult at 19 receives.

Worse than the inconsistency is that most of those transfers do nothing. For a child below
`CONSUMPTION_CHILD_MAX_AGE` with a living parent, a credit to `resources`:

- cannot change their consumption or save them from starvation — `ConsumptionEvent` charges them a
  fraction of their own resources rather than the flat rate, so the starvation branch cannot fire
  while a parent lives (ARD 024);
- cannot change their happiness — `Person.happiness` substitutes the living parents' average
  resources for a child's own (ARD 014);
- cannot change the inequality signal — that is now adults-only (ARD 060).

So the largest single claim on the community pool is inert until the recipient turns 18. This is
scarce capacity: `distributeWelfare` rations proportionally whenever shortfalls exceed the
distributable amount, which on the default config is most ticks of a crash.

## Decision

A person is a welfare recipient when they have a positive shortfall below `WELFARE_THRESHOLD`,
**except** those the model already treats as parentally subsidised — below
`CONSUMPTION_CHILD_MAX_AGE` with at least one living parent. Their need is met by topping up their
parents, who are recipients on their own account.

The exclusion deliberately reuses `ConsumptionEvent`'s own subsidised-child test rather than
`WORKING_AGE_MIN`, so the two cannot disagree about who is supported by a parent. The model's two
child boundaries differ (consumption subsidises below 15, happiness and the Gini basis treat under-18s
as dependants) and the *consumption* one is the one that matters here: a 15-to-17-year-old with
living parents pays the flat adult rate and can starve, so withholding welfare from them would remove
the only mechanism that can save them.

Orphaned children remain recipients on their own account at any age, which restores the intent of
ARD 034's orphan clause — ARD 061 removed that clause as inert under a top-up, and it becomes
load-bearing again here, now expressed as the living-parent test rather than a separate branch.

No new constants.

## Reasoning

**Rejected: means-test the child against their parents' resources and pay the child.** This was the
first proposal, and it mirrors the substitution `happiness` already makes — a child with well-off
parents would show no shortfall and receive nothing. It loses on two counts. The transfer is still
inert for a subsidised child, so it spends rationed capacity to move a number that affects nothing
until adulthood. And when the parents *are* poor they are already recipients themselves, so the
household is assessed twice and paid twice for one shortfall.

**Rejected: exclude every under-18.** Simpler to state and it matches the Gini basis. It loses
because of the boundary mismatch above: `ConsumptionEvent` stops subsidising at
`CONSUMPTION_CHILD_MAX_AGE`, so 15-to-17-year-olds with living parents pay the full adult rate and
do starve. Excluding them would be the one change here that could actually kill agents.

**Rejected: keep the child eligible but pay the parents.** Equivalent in effect to the decision, and
strictly more machinery — it needs a rule for splitting between two parents and for a child whose
parents are themselves above the threshold. Topping the parents up on their own account reaches the
same place through the mechanism that already exists.

**Rejected: leave ARD 061 as it stands.** The status quo is defensible as "children are poor and
welfare goes to the poor." It loses on the model's own terms: the model has decided three separate
times that a dependent child's `resources` is not their welfare, and a fourth mechanism reading it
as if it were is the inconsistency this ARD exists to close.

## Consequences

- `Simulation.distributeWelfare()` gains the subsidised-child exclusion to its recipient filter.
- **Welfare capacity shifts to adults and orphans.** Roughly half the current payout volume is
  freed. Because rationing binds during crashes, this changes crash-phase dynamics and must be
  measured against the pre-change branch, not assumed benign — the sweep comparison in
  `docs/research-thriving-reachability.md` is the reference.
- `Simulation` now reads `CONSUMPTION_CHILD_MAX_AGE`, coupling welfare to a consumption constant.
  That coupling is the point, and a comment at the call site should say so; anyone retuning the
  consumption boundary is also retuning who receives welfare.
- Tests must cover: a subsidised child (below the boundary, living parent) receives nothing even at
  zero resources; an orphan below the boundary still receives a top-up; a 15-to-17-year-old with
  living parents still receives one; an adult is unaffected; excluding children raises what remains
  for adults under rationing; the no-op cases from ARD 061 still hold.
- `docs/odd-protocol.md` — the welfare step in the scheduling sequence names the recipient set and
  must be updated.
- Closes the inconsistency between [ARD 060](./060-gini-measurement-basis.md) and
  [ARD 061](./061-welfare-shortfall-topup.md); modifies ARD 061's recipient set only, leaving its
  shortfall-sizing, surplus retention and proportional rationing intact. Reads the subsidy boundary
  set by [ARD 024](./024-consumption-event.md) and restores the orphan intent of
  [ARD 034](./034-community-pool-tax-welfare.md).
