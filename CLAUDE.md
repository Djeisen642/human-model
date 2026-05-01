# human-model

Agent-based simulation for studying civilizational collapse vs. thriving. Each person has stats, behavioral intents, and participates in events once per simulated year. The Gini coefficient of `resources` is the primary collapse signal (inequality matters more than scarcity). See `docs/project-background.md` for research inspirations.

Zero production dependencies — devDependencies only.

## Git workflow

**Never commit directly to `master`.** All work happens on a branch and merges via squash.

### Branch naming

| Prefix | Use for |
|--------|---------|
| `docs/` | ARDs, future ideas, readme, CLAUDE.md |
| `feature/` | New simulation code (events, classes, mechanics) |
| `fix/` | Bug fixes |
| `research/` | Exploratory or experimental changes |

### Squash merge into master

```bash
git checkout master
git pull origin master
git merge --squash <branch-name>
git commit -m "concise summary of what the branch did"
git push origin master
```

## Commands

```bash
npm install          # install deps (node_modules not committed)
npm test             # run jest suite (npx jest, config at src/jest.config.js)
npm run build        # rimraf ./build && tsc
npm run lint         # eslint over .ts files
npm run start:dev    # nodemon (watches src/, runs ts-node src/index.ts)
```

## Architecture

```
src/
  App/
    Person.ts              # Core data class — mutable stats/intents, readonly collections
    Simulation.ts          # Owns population (living + deceased), tick history, aggregate metrics
    LooperSingleton.ts     # Drives the tick loop (singleton); delegates population to Simulation
    index.ts               # Entry point — runs start() with defaults (100 persons, 100 ticks, seed 42)
  Events/
    IEvent.ts              # Interface: execute(person, simulation): void
    EventFactory.ts        # Maps person intents → event instances for a given tick; returns unconditional [AgeEvent, GatherResourcesEvent, MisfortuneEvent]
    AgeEvent.ts            # Increments age only (death handled by MisfortuneEvent)
    GatherResourcesEvent.ts # Unconditional; extracts resources from pool each tick
    MisfortuneEvent.ts     # Unconditional; illness and suicide checks each tick
    (one file per event)   # StealEvent, KillEvent, etc. — not yet implemented
  Records/
    DeathRecord.ts         # Cause of death + optional killer reference
    KillingRecord.ts       # Victim reference + murderer's age at time of killing
    StealingRecord.ts      # Victim reference + amount stolen + thief's age
  Helpers/
    Constants.ts           # CAUSE_OF_DEATH, EDUCATION, TYPE_OF_HELP enums
    Variables.ts           # ILLNESS, age curve constants, per-event age profiles
    SeededRandom.ts        # LCG seeded RNG; asRNG() returns an RNG-typed function
    AgeModifier.ts         # ageModifier(age, peakAge, scale, floor) — bell curve helper
    Types.ts               # RNG = () => number
  tests/                   # Mirrors src/ structure; one test file per source file
```

## ARD requirement

**Any implementation that encodes a non-obvious design choice requires an ARD before the code is written.** This includes: new stats or computed properties, event mechanics (probabilities, magnitudes, outcomes), changes to how existing fields are used, and any parameter whose value could reasonably be different.

The test: if a future agent would have to guess *why* you made a choice, write an ARD first. If the choice is forced by the existing architecture with no real alternative, a comment in code may suffice.

After writing an ARD: add it to the index in `docs/decisions/README.md`, reference it in the relevant "Key design decisions" bullet in CLAUDE.md, and include it in the same commit or PR as the implementation it covers.

## Discovering new mechanisms

While implementing, you will sometimes encounter a behavior or interaction that isn't planned but could meaningfully affect the collapse/thrive dynamics. **Do not implement it speculatively.** Instead, add it to `docs/future-ideas.md` with a brief note on why it matters and what problem it solves. It will be reviewed and, if worthwhile, discussed and formalized as an ARD before being built.

When a candidate in `docs/future-ideas.md` is rejected without rising to ARD-level discussion (e.g., subsumed by another idea, insufficient collapse/thrive signal, redundant with an existing mechanism), move it to the `## Discarded` section at the bottom of that file with a one-sentence reason and the date. Decisions formal enough to merit an ARD belong in `docs/decisions/` instead — the Discarded section is for the lighter-weight rejections.

## Design pattern philosophy

Only use a pattern when it has a concrete job to do. Remove it when it stops earning its place. See `docs/project-background.md` for the full philosophy.

Patterns currently in use and why:
- **Singleton** (`LooperSingleton`) — one simulation loop should exist; enforced at the type level
- **Factory** (`EventFactory`) — intent-to-event mapping needs a single home; the factory earns its place because of the intent system
- **Interface + class hierarchy** (`IEvent`) — pairs naturally with the factory; gives each event a consistent, testable shape

See `docs/decisions/` for the reasoning behind each architectural choice.

## Key design decisions

- **Person stats are mutable, collections are not reassignable**: primitive fields (`age`, `resources`, etc.) are mutable so events can update them in place. Collection fields (`killed`, `hasChildren`, etc.) are `readonly` to prevent accidental replacement — but their contents remain mutable. See ARD 002.
- **Object references as identity**: `Person` objects have no ID field. Reference equality (`===`) is identity. See ARD 001.
- **Stats and intents start at 0** in the constructor, but `Simulation.seed(n, rng)` randomizes them on startup: age [15,50), resources [0,100), experience [0,age], intelligence/constitution/charisma [1,10], learningIntent/exerciseIntent [0,1), stealingIntent/lyingIntent [0,0.3), killingIntent [0,0.1).
- **`happiness` is a computed getter** (not a stored stat). Factors: job (+5 if employed; −3 if unemployed and working-age 18–65 only), resources (critical/low/comfortable thresholds vary by age group), relationship (+3), age (>65: −1), illness (−round(illness×5)). Children use average living parents' resources instead of their own. Floor 0. See ARD 009 (original), ARD 014 (revision).
- **Records are plain data classes** — they record that an event happened, they don't trigger anything.
- **Global natural resource pool**: `Simulation` owns `naturalResources` (current pool), `naturalResourceCeiling` (max accessible), and `extractionEfficiency` (pool cost per unit gathered, starts at 1.0). Pool regenerates by `NATURAL_RESOURCE_REGEN_RATE` each tick (capped at ceiling) via `simulation.regenerate()`, called at the start of each tick in `LooperSingleton`. `GatherResourcesEvent` depletes the pool; `InventionEvent` randomly shifts efficiency or ceiling. See ARD 007.
- **Age modifiers**: mortality uses a U-shaped curve (`ageMortalityModifier` getter on `Person`); all event probabilities are multiplied by a per-event bell curve via `ageModifier()` in `Helpers/AgeModifier.ts`. See ARD 008.

## What's implemented

- `Person` data model — all properties, mutable primitives, readonly collections, `happiness` getter (job + resources + relationship + age + health, floor 0), `ageMortalityModifier` getter (U-shaped curve, ARD 008)
- `Simulation` — `living`, `deceased`, `history`; `getLiving()`, `getRandomOther()`, `kill()`, `add()`, `seed()`, `snapshot()`, `regenerate()`; Gini coefficient computed per tick; `naturalResources`, `naturalResourceCeiling`, `extractionEfficiency` resource pool fields (ARD 007)
- `LooperSingleton.start(n, ticks, seed)` — full tick loop: seeds simulation, calls `regenerate()` then runs EventFactory per person per tick, calls `snapshot()` each tick
- `IEvent` interface
- `AgeEvent` — age increment only (old-age hard cutoff removed; death handled by MisfortuneEvent via age mortality curve)
- `GatherResourcesEvent` — unconditional; `extracted = min(experience * (BASE_GATHER_AMOUNT + intelligence * INTELLIGENCE_GATHER_SCALAR), pool / extractionEfficiency)`; pool loses `extracted * extractionEfficiency`. See ARD 011.
- `MisfortuneEvent` — unconditional; illness death (`ILLNESS * ageMortalityModifier`) then suicide (`SUICIDE_PROBABILITY_SCALE / (happiness + 1)`); first cause wins. See ARD 013.
- `EventFactory` — returns unconditional `[AgeEvent, GatherResourcesEvent, MisfortuneEvent]`; intent-gated events to be appended as implemented. See ARD 010.
- `DeathRecord`, `KillingRecord`, `StealingRecord` data classes
- `SeededRandom` (LCG), `RNG` type, `Constants`, `Variables` (includes `PRIME_AGE`, `AGE_DEATH_CURVATURE`, `BASE_GATHER_AMOUNT`, `INTELLIGENCE_GATHER_SCALAR`, `SUICIDE_PROBABILITY_SCALE`, and per-event age profile constants for all planned events)
- `AgeModifier.ts` — `ageModifier(age, peakAge, scale, floor)` bell-curve helper (ARD 008)
- `TickSnapshot` observability: population, death counts by cause, `averageResources`, `resourceGini`, `averageHappiness`, `aggregateKillingIntent`, `aggregateStealingIntent`, `naturalResources`
- Tests for all of the above

## What's not implemented yet

Pick up here, roughly in dependency order:

1. **`EventFactory` intent routing** — intent-gated events (exercise, learn, steal, kill, etc.) not yet wired; each needs `rng() < intent * ageModifier(...)` gate added in `getEventsFor()`. See ARD 010.
2. **Events** (implement roughly in this order):
   - Disaster — population-level event run once per tick in `LooperSingleton`; probabilistic trigger, random number of affected persons, kill or resource damage based on age/constitution. See ARD 012.
   - `ExerciseEvent` — `constitution++`
   - `LearnEvent` — `intelligence++`
   - Job gain/loss event
   - Graduation event — `isWorkingOnEd` → `education`
   - Relationship event — sets `isInRelationshipWith`
   - `StealEvent` — resource transfer; creates `StealingRecord`
   - `KillEvent` — creates `KillingRecord` + `DeathRecord`; calls `simulation.kill()`
   - Windfall event — resource bump
   - Childbirth event — `simulation.add(new Person([p1, p2]))`; costs parents resources
   - Lying event — modifies targets' intent fields; effectiveness scaled by `charisma`
   - Invention event — three outcomes weighted by `Variables` constants: depletion faster (`extractionEfficiency *= 1 + delta`), slower (`extractionEfficiency *= 1 - delta`), ceiling growth (`naturalResourceCeiling += delta * ceiling`); `delta = inventor.intelligence * INVENTION_MAGNITUDE_SCALAR`. See ARD 007.

## Age profiles for new events

Every event wired into `EventFactory` must declare an age profile. When adding a new event:

1. Decide its **peak age** (when this activity is most likely), **scale** (how steeply it falls off — smaller = steeper), and **floor** (minimum modifier; never zero, but can be very small).
2. Add three constants to `Variables.ts` following the naming pattern: `<EVENT>_PEAK_AGE`, `<EVENT>_AGE_SCALE`, `<EVENT>_AGE_FLOOR`.
3. In `EventFactory`, wrap the intent/base-rate check with `ageModifier(person.age, <EVENT>_PEAK_AGE, <EVENT>_AGE_SCALE, <EVENT>_AGE_FLOOR)`.

Reference profiles (from ARD 008):

| Event | Peak | Scale | Floor |
|---|---|---|---|
| Childbirth | 26 | 12 | 0.02 |
| Work | 35 | 40 | 0.1 |
| Exercise | 24 | 35 | 0.1 |
| Learning | 18 | 45 | 0.15 |
| Stealing | 24 | 30 | 0.05 |
| Killing | 24 | 30 | 0.05 |
| Relationships | 26 | 35 | 0.1 |
| Invention | 40 | 45 | 0.1 |
| Lying | 32 | 40 | 0.1 |

## Keeping CLAUDE.md current

At the end of every session — whether it changed code or only docs/ARDs — verify that CLAUDE.md reflects actual state. This is the handoff document; if it's stale, the next agent starts blind.

**After writing a new ARD:** see the ARD requirement section above for the full checklist.

**After changing code:** update "What's implemented" and "What's not implemented yet". Read source files to verify — don't rely on memory.

Before closing: does each section match reality? Is the Architecture section accurate about what's a stub vs. real?

Also before closing, do a brief integrity scan of the code changed this session:

- Is there a scenario where the new code breaks — an edge case, an empty collection, a stat at zero or max, two events running in the same tick that interact badly?
- Is there something the new code *almost* does but stops short of, where the missing piece would meaningfully affect collapse/thrive dynamics?

If the scan finds a real bug: fix it before closing.
If it finds a plausible new direction that isn't in the current plan: add it to `docs/future-ideas.md` with a one-sentence note on why it matters. Don't implement it.

## Coding conventions

- Strict TypeScript (`tsconfig.json` has `"strict": true`)
- JSDoc required on all public members (enforced by `eslint-plugin-jsdoc`)
- Single quotes, semicolons, 2-space indent (ESLint)
- Test files mirror source path: `src/tests/App/Person.test.ts` ↔ `src/App/Person.ts`
