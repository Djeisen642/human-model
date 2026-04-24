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
    Simulation.ts          # Owns population (living + deceased), tick history, aggregate metrics — STUB
    LooperSingleton.ts     # Drives the tick loop (singleton); delegates population to Simulation — STUB
    index.ts               # Entry point
  Events/
    IEvent.ts              # Interface: execute(person, simulation): void
    EventFactory.ts        # Maps person intents → event instances for a given tick — STUB
    (one file per event)   # AgeEvent, GatherResourcesEvent, StealEvent, etc. — not yet implemented
  Records/
    DeathRecord.ts         # Cause of death + optional killer reference
    KillingRecord.ts       # Victim reference + murderer's age at time of killing
    StealingRecord.ts      # Victim reference + amount stolen + thief's age
  Helpers/
    Constants.ts           # CAUSE_OF_DEATH, EDUCATION, TYPE_OF_HELP enums
    Variables.ts           # ILLNESS = 0.05 (base rate), OLD_AGE = 60
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
- **Stats and intents start at 0**: `resources`, `experience`, `intelligence`, `constitution`, `charisma`, and all five intent fields (`learningIntent`, `exerciseIntent`, `stealingIntent`, `lyingIntent`, `killingIntent`) are initialized to `0`. Random seeding for a starting population is not yet implemented.
- **Stats and intents start at 0**: `resources`, `experience`, `intelligence`, `constitution`, `charisma`, and all five intent fields (`learningIntent`, `exerciseIntent`, `stealingIntent`, `lyingIntent`, `killingIntent`) are initialized to `0`. Random seeding for a starting population is not yet implemented.
- **`happiness` is a computed getter** (not a stored stat). Currently stubbed: `+5 if hasJob, -3 if not, min 0`. The readme specifies it should also factor in resources, relationship status, age, and health.
- **Records are plain data classes** — they record that an event happened, they don't trigger anything.

## What's implemented

- `Person` data model with all planned properties
- `DeathRecord`, `KillingRecord`, `StealingRecord` data classes
- `Constants` and `Variables` helpers
- `LooperSingleton` skeleton (singleton pattern; `start()` returns a stub `1`)
- Tests for all of the above

## What's not implemented yet

Pick up here, roughly in dependency order:

1. **`Person` stat mutability** — remove `readonly` from primitive fields (`age`, `resources`, `intelligence`, etc.) per ARD 002. Keep `readonly` on collection fields.
2. **`Simulation` class** — owns `living: Person[]`, `deceased: Person[]`, `history: TickSnapshot[]`; exposes `getLiving()`, `getRandomOther()`, `kill()`, `add()`, `snapshot()`.
3. **Population seeding** — `Simulation.seed(n, rng)` creates `n` persons with randomized stats/intents drawn from reasonable distributions.
4. **`IEvent` interface + `EventFactory`** — per ARD 003; factory maps person intents to event instances each tick.
5. **`LooperSingleton.start()`** — creates `Simulation`, seeds it, runs tick loop: for each living person, get events from factory, execute, then call `simulation.snapshot()`.
6. **Aging** — `AgeEvent`: `person.age++` each tick; death by old age when `age >= Variables.OLD_AGE`.
7. **`happiness` getter** — expand stub to factor in resources, relationship status, age, and health.
8. **Events** (implement roughly in this order):
   - Gathering resources: `resources += f(experience, intelligence)`
   - Exercising: `constitution++`
   - Learning: `intelligence++`
   - Misfortune: illness, disaster, suicide — uses `Variables.ILLNESS`
   - Job gain/loss
   - Graduation: `isWorkingOnEd` → `education`
   - Relationships: sets `isInRelationshipWith`
   - Stealing: resource transfer; creates `StealingRecord`
   - Killing: creates `KillingRecord` + `DeathRecord`; calls `simulation.kill()`
   - Windfall: resource bump
   - Childbirth: `simulation.add(new Person([p1, p2]))`; removes resources from parents
   - Lying: modifies targets' intent fields; effectiveness scaled by `charisma`
   - Invention: modifies intent values across all living persons; requires high intelligence + charisma
9. **Observability** — after simulation ends, `simulation.history` contains per-tick `TickSnapshot` records. Key metrics to watch: population size, `resourceGini` (inequality), `averageHappiness`, aggregate `killingIntent`. These are the collapse/thrive signals.

## Coding conventions

- Strict TypeScript (`tsconfig.json` has `"strict": true`)
- JSDoc required on all public members (enforced by `eslint-plugin-jsdoc`)
- Single quotes, semicolons, 2-space indent (ESLint)
- Test files mirror source path: `src/tests/App/Person.test.ts` ↔ `src/App/Person.ts`
