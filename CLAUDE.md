# human-model

Agent-based simulation for studying civilizational collapse vs. thriving. Each person has stats, behavioral intents, and participates in events once per simulated year. The research question: what starting conditions and behavioral dynamics cause a population to grow and stabilize versus spiral into decline?

Inspired by Sugarscape (Epstein & Axtell, 1996), the HANDY civilizational collapse model (Motesharrei et al., 2014), and Turchin's Cliodynamics. Key HANDY finding relevant here: collapse is driven by resource overexploitation combined with inequality — not scarcity alone. The Gini coefficient of `resources` across the population is therefore a more meaningful collapse signal than average resources.

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

Squash keeps `master` as a clean, readable changelog — each commit represents one complete piece of work. Branch history is preserved locally and remotely if you need the detail.

### PR sync after every push

After every `git push`, a hook rewakes the agent to sync the PR state:

**If no PR exists:** create a draft PR immediately. Write a description based on `git log master..HEAD` — what the branch does, not just what the latest commit did.

**If a PR exists:**
1. Read all commits on the branch (`git log master..HEAD`) and the current PR description
2. Update the PR description to reflect what the branch now actually does
3. If the commits represent a meaningfully different scope from the original PR title/summary — different subsystem, different purpose, or the original goal is now a minority of the work — **propose splitting**: suggest the user create a new PR for the new scope rather than widening this one

The split threshold is qualitative: if someone reading the original PR title would be surprised by what's in the branch, it's time to split.

### Why squash over other strategies

- `master` reads as a narrative, not a topology
- ARD immutability is meaningful — nothing lands on `master` by accident
- Branch work can be as granular as needed without cluttering the main history
- Each squash commit is a natural unit for revert if something goes wrong

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
    EventFactory.ts        # Maps person intents → event instances for a given tick — STUB (only AgeEvent wired)
    AgeEvent.ts            # Increments age; kills person at OLD_AGE
    (one file per event)   # GatherResourcesEvent, StealEvent, etc. — not yet implemented
  Records/
    DeathRecord.ts         # Cause of death + optional killer reference
    KillingRecord.ts       # Victim reference + murderer's age at time of killing
    StealingRecord.ts      # Victim reference + amount stolen + thief's age
  Helpers/
    Constants.ts           # CAUSE_OF_DEATH, EDUCATION, TYPE_OF_HELP enums
    Variables.ts           # ILLNESS = 0.05 (base rate), OLD_AGE = 60
    SeededRandom.ts        # LCG seeded RNG; asRNG() returns an RNG-typed function
    Types.ts               # RNG = () => number
  tests/                   # Mirrors src/ structure; one test file per source file
```

## Discovering new mechanisms

While implementing, you will sometimes encounter a behavior or interaction that isn't planned but could meaningfully affect the collapse/thrive dynamics. **Do not implement it speculatively.** Instead, add it to `docs/future-ideas.md` with a brief note on why it matters and what problem it solves. It will be reviewed and, if worthwhile, discussed and formalized as an ARD before being built.

## Design pattern philosophy

This project deliberately explores design patterns — but only when they have a concrete job to do. Before applying a pattern, answer: *what specific problem does this solve here?* If you can't answer that concretely, don't use it.

When a pattern stops earning its place — the abstraction adds more friction than it removes, or the problem it solved no longer exists — remove it and simplify. A pattern that made sense at one stage of the project may not survive the next. That's expected, not a failure.

Patterns currently in use and why:
- **Singleton** (`LooperSingleton`) — one simulation loop should exist; enforced at the type level
- **Factory** (`EventFactory`) — intent-to-event mapping needs a single home; the factory earns its place because of the intent system
- **Interface + class hierarchy** (`IEvent`) — pairs naturally with the factory; gives each event a consistent, testable shape

See `docs/decisions/` for the reasoning behind each architectural choice.

## Key design decisions

- **Person stats are mutable, collections are not reassignable**: primitive fields (`age`, `resources`, etc.) are mutable so events can update them in place. Collection fields (`killed`, `hasChildren`, etc.) are `readonly` to prevent accidental replacement — but their contents remain mutable. See ARD 002.
- **Object references as identity**: `Person` objects have no ID field. Reference equality (`===`) is identity. See ARD 001.
- **Stats and intents start at 0** in the constructor, but `Simulation.seed(n, rng)` randomizes them on startup: age [15,50), resources [0,100), experience [0,age], intelligence/constitution/charisma [1,10], learningIntent/exerciseIntent [0,1), stealingIntent/lyingIntent [0,0.3), killingIntent [0,0.1).
- **`happiness` is a computed getter** (not a stored stat). Currently partial: `+5 if hasJob, -3 if not, min 0`. Still needs: resources, relationship status, age, and health factors.
- **Records are plain data classes** — they record that an event happened, they don't trigger anything.

## What's implemented

- `Person` data model — all properties, mutable primitives, readonly collections, `happiness` getter (partial)
- `Simulation` — `living`, `deceased`, `history`; `getLiving()`, `getRandomOther()`, `kill()`, `add()`, `seed()`, `snapshot()`; Gini coefficient computed per tick
- `LooperSingleton.start(n, ticks, seed)` — full tick loop: seeds simulation, runs EventFactory per person per tick, calls `snapshot()` each tick
- `IEvent` interface
- `AgeEvent` — age increment + old-age death
- `EventFactory` — skeleton; always returns `[AgeEvent]` (intent-gated events not yet wired)
- `DeathRecord`, `KillingRecord`, `StealingRecord` data classes
- `SeededRandom` (LCG), `RNG` type, `Constants`, `Variables`
- `TickSnapshot` observability: population, death counts by cause, `averageResources`, `resourceGini`, `averageHappiness`, `aggregateKillingIntent`, `aggregateStealingIntent`
- Tests for all of the above

## What's not implemented yet

Pick up here, roughly in dependency order:

1. **`happiness` getter** — expand to factor in resources, relationship status, age, and health (currently only job status)
2. **`EventFactory` intent routing** — wire intent values to probabilistic event selection; currently returns only `[AgeEvent]`
3. **Events** (implement roughly in this order):
   - `GatherResourcesEvent` — `resources += f(experience, intelligence)`
   - `ExerciseEvent` — `constitution++`
   - `LearnEvent` — `intelligence++`
   - `MisfortuneEvent` — illness, disaster, suicide; uses `Variables.ILLNESS`
   - Job gain/loss event
   - Graduation event — `isWorkingOnEd` → `education`
   - Relationship event — sets `isInRelationshipWith`
   - `StealEvent` — resource transfer; creates `StealingRecord`
   - `KillEvent` — creates `KillingRecord` + `DeathRecord`; calls `simulation.kill()`
   - Windfall event — resource bump
   - Childbirth event — `simulation.add(new Person([p1, p2]))`; costs parents resources
   - Lying event — modifies targets' intent fields; effectiveness scaled by `charisma`
   - Invention event — shifts intent values across all living persons; requires high intelligence + charisma

## Keeping CLAUDE.md current

At the end of every session that changes code, update "What's implemented" and "What's not implemented yet" to reflect actual state. Read source files to verify — don't rely on memory. This is the handoff document; if it's stale, the next agent starts blind.

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
