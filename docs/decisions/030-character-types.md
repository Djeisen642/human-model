# ARD 030: Character Types in Population Seeding and Classification

**Status:** Proposed
**Date:** 2026-05-17

## Context

`Simulation.seed()` (`src/App/Simulation.ts:147`) applies a fixed set of uniform ranges per stat and intent (per ARD 021). Every initial person is statistically identical to every other in expectation. There is no way to study how a population composed of, say, 80% HANDY-style Commoners and 20% Elites behaves differently from a uniform baseline — but composition is the primary collapse/thrive driver in every framework the project cites (HANDY's two-class model, Turchin's structural-demographic theory). The `--config` system (`src/App/index.ts:28`) already deep-merges user JSON over defaults but only exposes `simulation.{persons,ticks,seed}` and the `variables` overrides; it cannot reshape the seeded distribution. `docs/future-ideas.md:110` flags this as a wanted feature ("Population archetypes / composed mixes"). The catalog of recommended archetypes, with citations, lives in `docs/research-character-types.md` — the ARD only defines the mechanism.

## Decision

### Config schema

Add `simulation.personTypes` as a string → type-definition map:

```json
{
  "simulation": {
    "personTypes": {
      "producer": {
        "percentage": 0.7,
        "ranges": {
          "intelligence": [7, 11],
          "learningIntent": [0.5, 1.0],
          "stealingIntent": [0, 0.05],
          "killingIntent": [0, 0.02]
        }
      },
      "extractor": {
        "percentage": 0.15,
        "ranges": {
          "charisma": [7, 11],
          "stealingIntent": [0.5, 1.0],
          "lyingIntent": [0.5, 1.0],
          "resources": [200, 500]
        }
      }
    }
  }
}
```

The example shows the canonical HANDY two-class scenario (Producer = commoner, Extractor = elite). The full proposed catalog of six archetypes — Producer, Extractor, Warrior, Inventor, Cooperator, Fragile — is documented in `docs/research-character-types.md` with citations and per-type range rationale.

Type names are arbitrary strings chosen by the config author. There is no built-in registry. `ranges` is a partial override map: any field absent from `ranges` falls back to the default `Simulation.seed()` distribution. Each `[min, max]` is applied as `min + rng() * (max - min)` for float fields and `randomInt(rng, min, max)` for integer fields — the field's existing seeding type wins.

Overridable fields: `age`, `resources`, `experience`, `intelligence`, `constitution`, `charisma`, `learningIntent`, `exerciseIntent`, `stealingIntent`, `lyingIntent`, `killingIntent`. `education` and `isWorkingOnEd` remain age-keyed per ARD 021; when `age` is overridden, the existing education seeding still runs against the new age.

### Validation

At config load (`src/App/index.ts`):

- Sum of all `percentage` values must be `≤ 1.0`. Exceeding 1.0 → throw. (Sum < 1.0 is fine; the remainder is default-seeded.)
- Each `[min, max]` must be two numbers with `min ≤ max`. Malformed → warn, skip that override (default-seeded for that field).
- Unknown field names in `ranges` → warn, skip.
- `percentage < 0` → throw.

### No Person.type field — classifier transformer instead

A type is a **predicate**: a Person matches a type iff every overridden field in the type's `ranges` falls within `[min, max]`. The same predicate is used in two directions:

- **Seeding:** quotas allocate persons to a type, then draw stats from the type's ranges so the resulting person matches the predicate by construction.
- **Classification at any time:** a pure function `classifyPerson(person, types) → string[]` returns every type name the person currently matches (zero, one, or many). Used by the end report.

Persons may match multiple types (an "engineer" who is also a "criminal" if the ranges don't overlap-exclude); the report lists each type's match count independently. The seeded cohort label is not persisted on `Person` — equilibrium is measured by re-running the predicate against the living population, so "did engineers grow or shrink?" answers itself from current stats.

### Seeding algorithm

`Simulation.seed(n, rng, personTypes?)`:

1. Build an assignment array of length `n`: for each declared type, push `floor(n * percentage)` copies of its name; pad the remainder with `null`.
2. Fisher-Yates shuffle the assignment array using the seeded RNG, so type assignment doesn't correlate with iteration order.
3. For each person `i`, if `assignment[i]` is a type name, use that type's range overrides for any field it declares; otherwise (or for fields not in the override map) use the existing default ranges.

### Reporting

`formatEndReport` and `writeReportHTML` add a per-type section when `personTypes` was supplied:

- **Seeded fraction**: `floor(n * percentage) / n` per type (known at seed time).
- **Final fraction**: `classifyPerson` count over `simulation.living` divided by living population.
- A delta column makes growth/shrinkage immediately visible.

When no types are declared, the section is omitted to keep small reports clean.

### New constants

None — calibration is fully in the user-supplied config.

## Reasoning

**Config-only over built-in named registry.** A built-in `ENGINEER`/`INVENTOR`/`CRIMINAL` enum would duplicate the concept already expressed by the config: a named bundle of stat ranges. Experiments would still need code edits to introduce new archetypes, and every new archetype would require its own ARD. Config-only means new archetypes are just data.

**Predicate-based classifier over a stored `Person.type` label.** Storing the seed-time label answers "did the starting cohort survive?" but not "is this population still producing engineers?" — the latter is the equilibrium signal. A predicate evaluated against current stats answers both: a person who started as a default-seeded high-intelligence person and is now indistinguishable from a seeded engineer *is* an engineer for the purpose of equilibrium. The stored-label model also requires a `Person` schema change, constructor surgery, and a decision about what type to assign newborns (none of which carry their own analytical payoff). The predicate model has zero `Person` surface area and produces a strictly richer equilibrium signal.

**Deterministic quotas over per-person Bernoulli.** At `n=100` and `percentage=0.05` a Bernoulli draw produces a standard deviation of ~2.2 — half the cohort missing or doubling is plausible run-to-run. Since composition is meant to be a controlled experimental variable, that variance is noise. `floor(n*p)` is reproducible at the cost of small percentages rounding to zero at tiny populations, which is acceptable.

**Sum ≤ 1.0 with default remainder, over sum-exactly-1.0.** Forcing the sum to 1.0 would require declaring a "generic" type whose ranges are the project defaults — duplicating ARD 021's ranges in config and forcing them to drift in lockstep. Default-remainder lets types be additive flavoring on top of the existing baseline.

**No `education`/`isWorkingOnEd` override.** Education is keyed to age via ARD 021. A type that fixes `age` to `[5, 10]` and `education` to `PHD` would create age-education combinations the rest of the model isn't built to handle (e.g. `JobEvent`'s education multiplier on a child). Keeping education on its age-keyed path bounds the override surface. A future ARD can lift this restriction when a concrete experiment needs it.

**No clamping of override ranges to default domains.** A config that sets `constitution: [-5, 50]` will produce out-of-domain values. Existing code already guards the few divide-by-zero paths (`max(1, victim.constitution)` in `KillEvent`); enforcing a "valid" domain in seeding would require defining one in code, which is the overspecification the config approach is meant to avoid.

## Consequences

- `src/App/Simulation.ts` — `seed()` accepts an optional `personTypes` map; implements the quota-shuffle-assign algorithm and per-field range override path
- `src/App/index.ts` — extend `SimConfig.simulation` with optional `personTypes`; validate sum ≤ 1.0 (throw), per-type `percentage ≥ 0` (throw), malformed ranges and unknown fields (warn, skip); pass through to `LooperSingleton.start`
- `src/App/LooperSingleton.ts` — `start()` accepts optional `personTypes`, forwards to `Simulation.seed()` and stores the map on `Simulation` for later reporting
- `src/Helpers/Types.ts` — add `PersonTypeDefinition` (`{ percentage: number, ranges: Partial<Record<OverridableField, [number, number]>> }`) and `PersonTypes = Record<string, PersonTypeDefinition>`
- `src/Helpers/Classifier.ts` (new) — pure `classifyPerson(person, types) → string[]` and `countPerType(persons, types) → Record<string, number>`
- `src/Helpers/Reporters.ts` — `formatEndReport` accepts `personTypes` and current `living`; renders the per-type section when supplied
- `src/Helpers/ReportWriter.ts` — `writeReportHTML` renders the per-type section in HTML
- `src/tests/App/Simulation.test.ts` — declared types appear at exactly `floor(n*p)` count; remainder is default-seeded; per-field overrides apply only to typed cohort; same seed → same assignment (shuffle reproducibility); sum > 1.0 throws; unknown field names warned and skipped; a type with empty `ranges` is just a quota allocation that matches default-range persons
- `src/tests/Helpers/Classifier.test.ts` (new) — predicate matches when all ranges satisfied; partial range definition only checks declared fields; multi-type membership reports correctly; empty `ranges` matches everyone
- `src/tests/Helpers/Reporters.test.ts` — per-type section appears when types supplied; section omitted when not; delta column reports growth/shrinkage
- `CLAUDE.md` — add to "Key design decisions" and "What's implemented"
- `docs/future-ideas.md` — move "Population archetypes / composed mixes" (line 110) to Discarded, noting this ARD subsumes it
- `docs/research-character-types.md` (created with this ARD) — catalogs the proposed Producer/Extractor/Warrior/Inventor/Cooperator/Fragile archetypes with citations and range rationale; canonical experiment scenarios live there, not in the ARD
