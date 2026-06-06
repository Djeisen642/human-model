# human-model

Agent-based simulation for studying civilizational collapse vs. thriving. Grounded in [HANDY](https://www.sciencedirect.com/science/article/pii/S0921800914000615) (Motesharrei et al., 2014), Sugarscape (Epstein & Axtell, 1996), and Cliodynamics (Turchin). The Gini coefficient of individual `resources` is the primary collapse signal — inequality matters more than scarcity.

## Quick start

```bash
npm install
npm start           # 100 people, 100 ticks, seed 42
```

Produces a console summary and an HTML report in `./output/`.

## CLI flags

```bash
npx ts-node src/App/index.ts [--config path/to/config.json] [--output path/to/dir] [--no-report] [--embed]
```

- `--config` — JSON file that deep-merges over defaults. Run `npm run generate-config` to get `config.default.json` with all available keys (`simulation.persons/ticks/seed/personTypes` + every `Variables` constant).
- `--output` — directory for HTML output (default: `./output`). Created if absent.
- `--no-report` — skip HTML generation (console only).
- `--embed` — embed Chart.js inline instead of loading from CDN (offline-safe).

## Commands

```bash
npm test                 # Jest suite
npm run build            # rimraf ./build && tsc
npm run lint             # ESLint over .ts files
npm run start:dev        # nodemon (watches src/, runs ts-node)
npm run generate-config  # writes config.default.json (gitignored)
npm run sweep -- [opts]  # multi-seed calibration harness
```

## Sweep harness

Runs the tick loop in-process across many seeds and aggregates outcomes — the primary calibration tool.

```bash
npm run sweep -- --ticks 300 --sweep BASE_CHILDBIRTH_RATE=0.2,0.3,0.4
npm run sweep -- --seeds 20 --set MAX_NATURAL_RESOURCE_CEILING=12000 --verbose
```

Options: `--seeds 42,7,1` (or a single N → seeds 1..N; default 1..8), `--ticks`, `--persons`, `--set KEY=VAL` (repeatable), `--sweep KEY=v1,v2,…`, `--verbose`.

Per sweep value the harness prints: outcome distribution, median end/peak population, median peak Gini, `bound%` (how often the commons pool sits below 5% of ceiling), extinction count, and cycle metrics (`cyc` = median boom-bust oscillations, `stable` = seeds showing a sustained non-collapsing cycle).

**Calibration note:** The model is a terminal one-shot overshoot — population booms once then crashes to extinction. Judge configs at long horizons (500–800 ticks), not 100. Short-horizon "outcome variety" is a mid-overshoot artifact. See `docs/research-tuning-defaults.md`.

## What the simulation does

Each tick represents one year. Every person runs a suite of events drawn from `EventFactory` — unconditional events fire every tick; intent-gated and probability-gated events depend on the person's stats and intents.

**Per-tick order:**
1. Ceiling degradation (overexploitation erodes carrying capacity)
2. Pool regeneration (natural resource regrowth up to ceiling)
3. Global disaster check
4. Tax collection → community pool
5. Jail countdown decrement + happiness-boost decay
6. Per-agent event loop (Fisher-Yates shuffled)
7. Welfare distribution (community pool → poorest persons and orphaned children)
8. Snapshot (aggregate metrics recorded)
9. Every 10 ticks: decade summary printed to console

**Free-agent event suite:** AgeEvent, ExperienceEvent, IllnessEvent, GatherResourcesEvent, ConsumptionEvent, JobEvent, RelationshipEvent, ChildbirthEvent, KillEvent, MisfortuneEvent + intent-gated HelpEvent/ExerciseEvent/LearnEvent/StealEvent + EnrollmentEvent/GraduationEvent + probability-gated WindfallEvent/InventionEvent + always-appended StatDecayEvent.

**Jailed-agent suite:** AgeEvent, IllnessEvent, JailEvent, StatDecayEvent, MisfortuneEvent only.

## Output

**Console:**
- Header with simulation parameters
- One-line decade summaries (population, Gini, resources, deaths)
- End report: outcome verdict, population trajectory, resource state, death breakdown by cause, invention counts, community pool, cohort survival (if person types configured)

**HTML report** (`output/report-<seed>-<outcome>-<timestamp>.html`):
- Self-contained with Chart.js
- Charts: inequality vs. population, population & mortality, happiness, health & employment, age structure, carrying capacity & productivity, education distribution, resource pool dynamics, couples & fertility, antisocial intent, crime & punishment, deaths by cause, age-at-death histogram, wealth-by-age

**Outcome classification** (`EXTINCTION` → `COLLAPSE` → `STRUGGLING` → `STABLE` → `THRIVING`): four-dimensional — population decline from peak, final-decade Gini, happiness, and commons fill (resource pool as fraction of ceiling). THRIVING requires all four to be good simultaneously; EXTINCTION is checked first.

## Person stats and intents

Each person carries: `age`, `resources`, `experience`, `intelligence`, `constitution`, `charisma`, `illness` [0,1], `learningIntent`, `exerciseIntent`, `stealingIntent`, `killingIntent`, `helpingIntent`, `isEmployed`, `education`/`isWorkingOnEd`, `isInRelationshipWith`, `jailedTicksRemaining`.

`happiness` is a computed getter (not stored): job (±5/−3 for working-age), age-group resource thresholds, relationship (+3), age >65 (−1), illness (−round(illness×5)), transient boost from Help/Kill events.

## Natural resource pool

`Simulation` owns `naturalResources` (current pool), `naturalResourceCeiling` (carrying capacity), and `extractionProductivity` (output multiplier + drain multiplier). Each tick the ceiling degrades proportional to pool depletion (`CEILING_DEGRADATION_RATE`), then the pool regenerates by `ceiling × NATURAL_RESOURCE_REGEN_FRACTION`. InventionEvent can shift productivity (random walk) or grow the ceiling (capped at `MAX_NATURAL_RESOURCE_CEILING`).

## Character types (optional)

Config `simulation.personTypes` maps a name to `{ percentage, ranges }` where `ranges` are partial `[min, max)` overrides on the 11 numeric fields. At seed time, persons are quota-allocated per type and seeded with the overrides; undeclared fields use defaults. The end report's `COHORT SURVIVAL` section shows how each type's share evolved, evaluated from current stats (not a stored label).

## Docs

- `docs/odd-protocol.md` — full ODD 2020 model specification
- `docs/decisions/` — 58 Architecture/Research Decision records (ARDs)
- `docs/future-ideas.md` — candidate mechanics not yet built
- `docs/research-*.md` — calibration studies (fertility, mortality, relationships, tuning)
- `docs/project-background.md` — research inspirations and design philosophy
