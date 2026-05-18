# ARD 039: GatherResourcesEvent Productivity Model

**Status:** Accepted
**Date:** 2026-05-17

## Context

ARD 011's formula deducts `extracted * extractionEfficiency` from the pool while crediting the gatherer with `extracted`. Whenever `extractionEfficiency ≠ 1`, the two sides diverge — a person extracting one unit at efficiency 0.01 receives 1.0 of personal resources but the pool only loses 0.01. `GatherResourcesEvent` is therefore the dominant non-conservative flow in the model: it mints personal wealth that has no source. In observed runs (seed 42, 100 ticks, 1000 persons), `averageResources` climbs from 48 → 93 while the pool drops from 12,500 → 0 — the personal economy stays "rich" because the gather formula is a multiplier, not a transfer. This decouples personal welfare from pool health and breaks collapse signaling: the reported `STABLE` outcome is an artifact of accounting, not sustainability. The variable name (`extractionEfficiency` with lower = better) is also inverted relative to the standard ecological-economics framing (productivity, higher = better).

## Decision

Rename `extractionEfficiency` → `extractionProductivity` across `Simulation`, `InventionEvent`, `TickSnapshot`, `ReportWriter`, `Reporters`, and all tests. Higher productivity = more personal output per unit labor *and* more pool drain (strict conservation). Initial value is `1.0`.

**New extraction formula (strictly conservative):**

```typescript
const potential = person.experience * (Variables.BASE_GATHER_AMOUNT + person.intelligence * Variables.INTELLIGENCE_GATHER_SCALAR);
const output = potential * simulation.extractionProductivity;
const extracted = Math.min(output, simulation.naturalResources);

person.resources += extracted;
simulation.naturalResources -= extracted;
```

Pool drain equals personal gain in every case. No accounting leak.

**InventionEvent semantics flip cleanly:**

| Branch | Old behavior (efficiency) | New behavior (productivity) |
|---|---|---|
| `DEPLETION_FASTER` | `efficiency *= (1 + delta)` — output per labor falls, pool drain per output rises | `productivity *= (1 + delta)` — tech boom: more output AND faster pool drain |
| `DEPLETION_SLOWER` | `efficiency *= (1 - delta)` — output per labor rises, pool drain per output falls | `productivity *= (1 - delta)` — austerity tech: less output AND slower pool drain |
| `CEILING_GROWTH` | unchanged | unchanged |

`productivity` is floored at `0.01` (same value, same purpose — prevents divide-by-zero in future cost-of-labor extensions and keeps gather from producing zero forever).

Constants in `Variables.ts` are renamed for clarity but values unchanged at calibration time:
- `EXTRACTION_PRODUCTIVITY_INITIAL` (was implicit via `extractionEfficiency = 1.0`)
- `EXTRACTION_PRODUCTIVITY_FLOOR` (was `0.01` literal)

## Reasoning

**Productivity multiplier vs. removing the multiplier.** Eliminating the multiplier entirely (`extracted = potential`) is simpler but kills two of three invention branches; the technology-vs-sustainability tradeoff is a core collapse/thrive lever in this model (ARD 007). Productivity keeps the lever and gives it a more intuitive name.

**Productivity (higher = better) over efficiency (lower = better).** The "extraction efficiency" framing implies *cost per unit*, which is coherent but reads inverted to most readers ("more efficient" should mean "more output," not "lower number"). The current invention branch names already use this confusion: `DEPLETION_FASTER` raises `efficiency` (a "bad" outcome) while `DEPLETION_SLOWER` lowers it. Renaming to productivity aligns the variable name with the invention name: faster productivity = more output. Standard ecological-economics framing (Tainter, HANDY model) uses productivity as the multiplier on labor, not cost.

**Strict conservation over the original "extraction multiplier" semantics.** The original formula encoded a real-world phenomenon — better tools turn a unit of natural input into more usable output (refining, smelting). But in this model the personal economy is the only place wealth is observed, and a non-conservative gather means pool depletion never bites; collapse signals lose grounding. Conservation here is a fidelity choice: the simulation cannot model technological gains *and* honest pool depletion at the same time without one of them being fictitious. We choose honest depletion.

## Consequences

- `src/App/Simulation.ts` — rename field, getter/setter unchanged.
- `src/Events/GatherResourcesEvent.ts` — replace formula per Decision.
- `src/Events/InventionEvent.ts` — rename references; semantics flip via the formula change in `Variables.ts`/Simulation, not in this file.
- `src/Helpers/Variables.ts` — rename `*EFFICIENCY*` constants; values unchanged.
- `src/Helpers/Reporters.ts`, `src/Helpers/ReportWriter.ts` — rename field references; chart series and labels updated to "Productivity."
- All test files referencing `extractionEfficiency` — rename.
- `CLAUDE.md` — update Key design decisions, What's implemented, and architecture summary.
- Pool depletion is now empirically meaningful: a run with pool at 0 will see personal `resources` decline at consumption rate within ~consumption-many ticks. Collapse signaling re-attached to the commons.
- Calibration: existing `BASE_GATHER_AMOUNT` and `INTELLIGENCE_GATHER_SCALAR` will likely need re-tuning since drain rates differ from the old formula. Pre-fix runs over-extracted personal output relative to pool drain by a factor of `1/productivity`; post-fix the two are equal. Expect pool to exhaust faster at the start.
- Tests must cover: (1) `naturalResources` drops by exactly `extracted` (no factor); (2) `person.resources` rises by exactly `extracted`; (3) productivity above 1 increases output; (4) productivity below 1 decreases output; (5) pool-limited case (`output > pool`) extracts only what remains.
- Cross-references: supersedes [ARD 011](./011-gather-resources-event.md); modifies invention semantics established in [ARD 007](./007-resource-cap-and-invention.md) (branch names unchanged, formula reinterpreted); collapse-signal dependency [ARD 016](./016-end-of-simulation-report.md).
