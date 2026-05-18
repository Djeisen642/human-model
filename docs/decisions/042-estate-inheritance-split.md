# ARD 042: Estate Inheritance Split On Death

**Status:** Accepted
**Date:** 2026-05-17

## Context

`Simulation.kill()` (src/App/Simulation.ts:150) marks the person deceased and clears their partner reference, but does nothing with `person.resources`. The dead person's balance sits on the `deceased` record and is never read again — effectively destroyed. In the closed-system accounting that ARDs 039–041 establish, death becomes the dominant unaccounted sink. It also throws away the only honest intergenerational wealth signal the model has: in reality, the resources of the dead flow to surviving partners, children, and the state. Without that flow, the simulation cannot model dynastic concentration or community escheat — both first-order collapse-thrive dynamics. `Person` already exposes `livingParents` (getter), `hasChildren` (readonly array), and `isInRelationshipWith` (cleared by `kill()` before the resource step would run); those are the heirs.

## Decision

On `Simulation.kill(person, cause, killer?)`, split `person.resources` between the surviving partner, living children, and `communityPool` *before* clearing partner reference or filtering `living`. The split applies uniformly regardless of cause (illness, suicide, disaster, old age, murder, jail death) — death is death; the post-mortem distribution doesn't change with cause. The murderer receives no resources from the victim's estate (the predation pathway through `StealEvent` and the killer-side happiness boost discussed for a future ARD are the avenues for kill-driven gain — keeping estate inheritance cause-blind preserves the death/estate decision as a separable mechanic).

**Split shares (constants in `Variables.ts`):**

| Constant | Heir | Calibration intent |
|---|---|---|
| `ESTATE_COMMUNITY_SHARE` | `communityPool` | Community always receives a share — represents estate tax, escheat, and unattributed public absorption. Starting calibration intent: meaningful redistribution without dominating individual inheritance, biased toward sustaining the community pool under high-mortality conditions. |
| `ESTATE_PARTNER_SHARE` | Surviving `isInRelationshipWith`, if any | Surviving partner is the primary individual heir — a stronger share than children, reflecting joint-household consolidation. |
| `ESTATE_CHILDREN_SHARE` | Sum across all `hasChildren` who are still living, split equally | Children share the remaining individual heir slice. Equal split across living children only (deceased children are not heirs). |

Shares must sum to `1.0`. The validation constraint is intent-level; values live in `Variables.ts` as the calibration handle.

**Fallback rules (no new constants):**

| Configuration | Resolution |
|---|---|
| Has partner, has living children | Apply shares as defined. |
| Has partner, no living children | `ESTATE_CHILDREN_SHARE` is added to `ESTATE_PARTNER_SHARE`. Partner receives partner + children share. |
| No partner, has living children | `ESTATE_PARTNER_SHARE` is split equally across living children together with `ESTATE_CHILDREN_SHARE`. |
| No partner, no living children | All resources go to `communityPool` (shares collapse to 100% community). |

After the split, `person.resources` is set to `0` (the estate has been distributed; the deceased record retains a zero balance, which is the only state consistent with the distribution actually happening). The existing partner-clearing and `living` filter run unchanged after the distribution.

## Reasoning

**Cause-blind split over murder-aware split.** Earlier discussion considered routing the victim's resources to the killer (predation framing) or splitting them between killer and the normal estate. Both make `kill()` an inequality amplifier in the same direction as `StealEvent` and remove a clean separation between violence and economic gain. The project owner's framing is that murder is motivated by something other than wealth (frustration, antagonism — a future ARD will give the killer a happiness boost as the actual reward signal). Keeping the estate cause-blind preserves that separation and keeps ARD 042 independent of the future happiness-boost ARD.

**Three-way split with falling-back consolidation over fixed three-way.** A fixed split would force a "community gets the partner share when no partner exists" rule, which over-funds the community pool at the expense of children, or vice versa. The consolidation rules above keep the *individual heir / community* ratio roughly stable across family configurations: when one individual-heir slot disappears, its share goes to the other individual heir, not to community. This matches the intuition that community only fully absorbs an estate when there are no individual heirs at all.

**Equal split across living children over age-weighted or need-weighted.** Equal is the simplest defensible default. Age- or resource-weighted alternatives encode further design choices (should poor children get more? should young children get more?) that are independent of the estate-flow decision. If those become research questions, a follow-up ARD can revise.

**Distribute on the deceased person object before filter.** Distributing before `living` filtering and partner-clearing avoids ordering dependencies. The partner reference is still intact at distribution time, and living children can be filtered directly from `hasChildren` via `person.causeOfDeath === null`. (Children whose parent died in earlier ticks remain alive and eligible.)

**No new record class.** Estate flow is observable via `communityPool` deltas and the receiving persons' `resources` in `TickSnapshot`. Adding an `EstateRecord` would help auditing but adds maintenance surface for no current research question.

## Consequences

- `src/App/Simulation.ts` — modify `kill()` per Decision. Distribution executes first, then existing partner-clear + filter logic.
- `src/Helpers/Variables.ts` — add `ESTATE_COMMUNITY_SHARE`, `ESTATE_PARTNER_SHARE`, `ESTATE_CHILDREN_SHARE`. Validation (sum = 1.0) is an implementer-side assertion or test-only check, not enforced at runtime.
- `src/tests/App/Simulation.test.ts` — add cases: (1) full family — partner + children get correct shares, community pool grows; (2) partner only — partner receives `PARTNER_SHARE + CHILDREN_SHARE`; (3) children only — children equally split `PARTNER_SHARE + CHILDREN_SHARE`; (4) deceased child not counted as heir; (5) no heirs — 100% to community pool; (6) zero-resource estate — no-op; (7) murder — killer receives nothing from estate (`StealEvent`/`KillEvent` interactions unchanged).
- `CLAUDE.md` — add Key design decisions bullet for ARD 042 and update `Simulation.kill()` description under "What's implemented." Add to "ARDs" cross-reference.
- The closed-system accounting is complete after ARDs 039, 040, 041, 042: the only sinks are `ConsumptionEvent`, `DisasterEvent` loss fractions, `JailEvent` consumption when starving, and the `communityPool` reserve fraction (idle wealth). The only source is the natural resource pool plus its regen.
- Calibration: expect `communityPool` to grow noticeably faster in high-mortality phases (old age, illness waves, disasters), and inheritance to start producing visible wealth concentration in families with surviving partners through prime childbearing years. Both are intended dynamics that the previous "vanish on death" rule erased.
- Cross-references: depends on `communityPool` from [ARD 034](./034-community-pool-tax-welfare.md); partner field semantics from [ARD 025](./025-relationship-event.md); `kill()` semantics from [ARD 006](./006-dead-person-handling.md); paired with the resource-conservation triad ([ARD 039](./039-gather-productivity-model.md), [ARD 040](./040-windfall-from-pool.md), [ARD 041](./041-jail-from-community-pool.md)).
