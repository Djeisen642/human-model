# human-model

Agent-based human population simulator in TypeScript. Each person participates in a set of events once per simulated year; no intra-year cross-event impacts. Zero production dependencies — devDependencies only.

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
    Person.ts              # Core data class (all properties readonly)
    LooperSingleton.ts     # Simulation loop controller (singleton) — STUB
    index.ts               # Entry point
  Records/
    DeathRecord.ts         # Cause of death + optional killer reference
    KillingRecord.ts       # Victim reference + murderer's age at time of killing
    StealingRecord.ts      # Victim reference + amount stolen + thief's age
  Helpers/
    Constants.ts           # CAUSE_OF_DEATH, EDUCATION, TYPE_OF_HELP enums
    Variables.ts           # ILLNESS = 0.05 (base rate), OLD_AGE = 60
  tests/                   # Mirrors src/ structure; one test file per source file
```

## Key design decisions

- **Person is immutable**: all properties are `readonly`. The intended pattern is to produce new `Person` instances rather than mutate state across ticks.
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

Pick up here:

1. **`LooperSingleton.start()`** — needs an actual loop: maintain a population array, advance each person through events each tick, handle death/removal.
2. **Population seeding** — `Person` constructor zeros all stats; need random initialization for a starting population.
3. **Aging** — `age` never increments; it should increase by 1 each tick until death.
4. **`happiness` getter** — stub needs resources, relationship status, age, and health factors added.
5. **Events** (none implemented):
   - Gathering resources: `resources += f(experience, intelligence)`
   - Exercising: `constitution++`
   - Learning: `intelligence++`
   - Job gain/loss
   - Graduation: `isWorkingOnEd` → `education`
   - Lying: modifies targets' intent fields; effectiveness scaled by `charisma`
   - Stealing: resource transfer between persons; creates `StealingRecord`
   - Killing: creates `KillingRecord` on killer, `DeathRecord` on victim
   - Misfortune: illness, disaster, suicide — uses `Variables.ILLNESS` and `Variables.OLD_AGE`
   - Windfall: resource bump
   - Relationships: sets `isInRelationshipWith`
   - Childbirth: new `Person([parent1, parent2])`; removes resources from parents
   - Invention: changes intent values society-wide; requires high intelligence + charisma

## Coding conventions

- Strict TypeScript (`tsconfig.json` has `"strict": true`)
- JSDoc required on all public members (enforced by `eslint-plugin-jsdoc`)
- Single quotes, semicolons, 2-space indent (ESLint)
- Test files mirror source path: `src/tests/App/Person.test.ts` ↔ `src/App/Person.ts`
