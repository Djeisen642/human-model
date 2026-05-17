# ARD 034: Community Pool, Taxation, and Welfare Distribution

**Status:** Proposed
**Date:** 2026-05-17

## Context

The model has no resource redistribution mechanism. Antisocial events (StealEvent, KillEvent) and jail forfeitures (ARD 035) concentrate or destroy resources with no counter-force. Orphaned children and near-destitute persons have no recovery path, so the Gini coefficient can only climb and the collapse signal is uncontested. `Simulation` has no community fund field.

## Decision

`Simulation` gains a `communityPool` field (number, starts at 0).

**Tax — each tick before gathering:**

`TAX_RATE` fraction is deducted from every living person's resources and added to `communityPool`. Deduction floors at 0; persons already at zero are not driven negative.

**Jail forfeiture — at conviction (ARD 035):**

`JAIL_RESOURCE_FORFEIT_FRACTION` of the convicted person's resources is transferred to `communityPool` before the sentence begins. The remainder stays with the person.

**Distribution — each tick after consumption:**

Eligible recipients: `resources < WELFARE_THRESHOLD` or `age < 18 && livingParents.length === 0` (orphaned children, including seeded minors with no simulation parents).

Distributable amount: `communityPool * (1 - COMMUNITY_POOL_RESERVE_FRACTION)`.

Each eligible recipient receives an equal share. If no recipients exist, the distributable amount is not paid out and the full pool carries over.

`COMMUNITY_POOL_RESERVE_FRACTION` controls the fraction retained as reserve each tick.

**New constants in `Variables.ts`:**

| Constant | Rationale |
|---|---|
| `TAX_RATE` | Flat fraction of resources deducted per tick per person; controls redistribution throughput |
| `WELFARE_THRESHOLD` | Resource level below which a person qualifies; calibrate against the seeding range [0, 100) |
| `COMMUNITY_POOL_RESERVE_FRACTION` | Fraction retained as reserve each tick; prevents one-tick exhaustion under large eligible populations |
| `JAIL_RESOURCE_FORFEIT_FRACTION` | Fraction transferred from convicted person to pool; belongs here because the pool is the recipient (ARD 035 owns the jail mechanic) |

## Reasoning

**Rejected: distribute to all living persons equally (UBI).** Doesn't target the distress that drives collapse. Welfare directed at orphans and the near-destitute is more aligned with the research basis for why redistribution dampens inequality (Wilkinson & Pickett; Putnam's trust degradation under scarcity).

**Rejected: progressive taxation.** More realistic but requires defining income brackets or a continuous marginal function. At the 100-person scale the distributional difference from a flat rate is small. Progressive taxation can be added once flat-rate dynamics are observable.

**Rejected: pool sourced only from taxes, not forfeitures.** Jail without resource forfeiture makes incarceration cost-free for wealthy criminals. The forfeiture creates a direct feedback: antisocial behavior funds the safety net that counters it.

## Consequences

- `Simulation.ts`: add `communityPool` field; add `collectTax(persons)` and `distributeWelfare(persons)` methods.
- `LooperSingleton.ts`: call `collectTax` before gathering events, `distributeWelfare` after consumption events each tick.
- `TickSnapshot`: add `communityPool` field so pool level appears in summaries and HTML report.
- `Reporters.ts` / `ReportWriter.ts`: surface `communityPool` in RESOURCES section and pool-dynamics chart.
- Tests must cover: tax proportional to resources, floored at 0, welfare distributed only to eligible persons, equal share per recipient, 20% reserve retained, orphan eligibility, pool receives jail forfeiture (integration with ARD 035).
- Depends on ARD 035 for the forfeiture funding path.
