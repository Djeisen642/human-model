# ARD 044: Separate Initial Natural Resources Constant

**Status:** Accepted
**Date:** 2026-05-18

## Context

`Simulation.naturalResources` defaults to `NATURAL_RESOURCE_CEILING_INITIAL`. The starting pool is locked to the ceiling, which means there is no way to express scenarios like "this environment can sustain N people (ceiling), but only a small stockpile is sitting around at t=0." That collapses two distinct research dials — *carrying capacity* and *current stock* — into one parameter, and rules out the kind of scarcity experiments the project owner has identified as a priority (see conversation 2026-05-18: vary population mix at fixed scarce starting conditions to find thriving configurations).

## Decision

Introduce `NATURAL_RESOURCES_INITIAL` in `Variables.ts`. `Simulation.naturalResources` initializes from this constant, independent of `NATURAL_RESOURCE_CEILING_INITIAL`. Default value: equal to `NATURAL_RESOURCE_CEILING_INITIAL`, preserving existing behavior for any caller that doesn't explicitly override the new constant.

```typescript
naturalResources: number = Variables.NATURAL_RESOURCES_INITIAL;
naturalResourceCeiling: number = Variables.NATURAL_RESOURCE_CEILING_INITIAL;
```

The CLI `--config` mechanism (ARD 030 pattern) picks up the new constant for free; no separate plumbing.

## Reasoning

**Separate constant over derived/percentage form.** A formula like `naturalResources = ceiling × INITIAL_FILL_FRACTION` would express the same idea, but binds the two values together at the formula level — useful for *some* scenarios but unnecessary indirection when the use case is "I want to set them independently." The two-constant form is the simplest expression of the user's stated intent.

**Default to ceiling for backward compatibility.** Every existing test, scenario, and report run was authored under the implicit assumption that the pool starts full. Changing that default would force re-tuning of unrelated calibrations. Keeping `NATURAL_RESOURCES_INITIAL = NATURAL_RESOURCE_CEILING_INITIAL` at the default means this ARD is invisible until someone deliberately overrides it.

**Constant rather than runtime parameter on `Simulation()` or `seed()`.** The model's parameter surface is uniformly `Variables.ts`-driven and exposed via `--config`. Introducing a constructor argument would split the calibration surface, contradicting ARD 030's design.

## Consequences

- `src/Helpers/Variables.ts` — add `NATURAL_RESOURCES_INITIAL`. Default equal to `NATURAL_RESOURCE_CEILING_INITIAL`.
- `src/App/Simulation.ts` — change `naturalResources` field initializer to use the new constant.
- `src/tests/App/Simulation.test.ts` — add a test confirming `naturalResources` starts at `NATURAL_RESOURCES_INITIAL` when overridden separately from the ceiling.
- `CLAUDE.md` — note the split under the resource pool key-design bullet.
- `docs/odd-protocol.md` — update Environment initialization.
- Cross-references: orthogonal to [ARD 043](./043-regen-coupled-to-ceiling.md), but the two together enable the full scarcity-scenario design (low ceiling = low regen = low carrying capacity; separate initial pool = how much stockpile exists at t=0).
