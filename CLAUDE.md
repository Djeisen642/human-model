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
npm install              # install deps (node_modules not committed)
npm test                 # run jest suite (npx jest, config at src/jest.config.js)
npm run build            # rimraf ./build && tsc
npm run lint             # eslint over .ts files
npm run start:dev        # nodemon (watches src/, runs ts-node src/index.ts)
npm run generate-config  # writes config.default.json from Variables.ts (gitignored)
npm run sweep -- [opts]  # run many sims across seeds, print a metrics/outcome table (calibration tool)
```

### Sweep harness (`scripts/sweep.ts`)

For calibration: runs the tick loop in-process across many seeds and aggregates, instead of hand-running configs one at a time. Per sweep value it prints the outcome distribution (`STABLE×2 COLLAPSE×1 …`), median end/peak population, median peak Gini, `bound%` (share of ticks the commons pool sits below 5% of its ceiling — i.e. how often resources bind), extinction count, and cycle metrics from `CycleDetector` — `cyc` (median boom-bust oscillations per series) and `stable` (count of seeds showing a sustained, non-collapsing cycle). `--verbose` rows add `cyc`/`per`(iod)/`trTrend` and a `STABLE-CYCLE` marker.

```bash
npm run sweep -- --ticks 300 --sweep BASE_CHILDBIRTH_RATE=0.2,0.3,0.4   # sweep one Variables constant
npm run sweep -- --seeds 20 --set MAX_NATURAL_RESOURCE_CEILING=12000 --verbose  # fixed overrides + per-seed detail
```

Options: `--seeds 42,7,1` (or a single `N` → seeds 1..N; default 1..8), `--ticks`, `--persons`, `--set KEY=VAL` (repeatable Variables override), `--sweep KEY=v1,v2,…` (one sweep dimension), `--verbose` (per-seed rows with cause-of-death split). Always calibrate in a regime where the bounding feedbacks fire — see `docs/research-fertility.md`.

**How to think about tuning (read before sweeping — see `docs/research-tuning-defaults.md`).** The model is a *terminal one-shot overshoot*: population booms once to a single peak, then crashes through to extinction. This reframes what a sweep can and can't show:

- **Judge configs at long horizons (500–800 ticks), never at 100.** Short-horizon "outcome variety" is an artifact of measuring the population *mid-overshoot*, before the universal crash. A config that reads `STRUGGLING×8` at 300 ticks can be 16/16 EXTINCTION by 800 (`BASE_INVENTION_RATE=0.01` does exactly this). Run the horizon ladder before believing any improvement.
- **`stable`/`cyc` is the signal for "sane," not the outcome tally.** A genuinely sane default needs a meaningful fraction of seeds in *sustained cycles* at the long horizon. Across the whole explored parameter space `stable=0` is the norm; the rare exceptions (high `BASE_INVENTION_RATE` ≈ 6/16 at 800t; a strong anti-Allee fertility probe ≈ 3/16) still leave the majority extinct.
- **No single constant fixes overshoot→extinction; the fix is structural.** The tell that you're at this limit: bigger inputs (regen, ceiling, fertility, invention) buy a *bigger boom*, not stability. Don't chase a magic constant — long-run persistence needs a new mechanism (crash recovery / anti-Allee), not recalibration. So tune constants for *short-horizon outcome variety* (the current `BASE_CHILDBIRTH_RATE=0.6` rationale), and treat long-run stability as out of reach until the structural piece exists.

### CLI flags (entry point)

```bash
npx ts-node src/App/index.ts [--config path/to/config.json] [--output path/to/dir]
```

- `--config` — JSON file that deep-merges over defaults; only changed keys needed. Run `npm run generate-config` to get a full reference file (`config.default.json`) with all available keys (`simulation.persons/ticks/seed/personTypes` + every `Variables` constant). That file is gitignored — it's generated, not maintained. `simulation.personTypes` (ARD 030) maps a name to `{ percentage, ranges }`; percentages must sum to ≤ 1.0, ranges are partial per-field overrides.
- `--output` — directory to write HTML reports into (default: `./output`). Created if absent. Kept separate from `--config` so batch/concurrent tooling can vary the output dir without touching the variable config.

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
    EventFactory.ts        # Maps person intents → event instances for a given tick; unconditional + intent-gated via ageModifier
    AgeEvent.ts            # Increments age only (death handled by MisfortuneEvent)
    ExperienceEvent.ts     # Unconditional; experience growth/decay each tick (ARD 017)
    IllnessEvent.ts        # Unconditional; illness onset/recovery each tick (ARD 018)
    GatherResourcesEvent.ts # Unconditional; extracts resources from pool each tick
    MisfortuneEvent.ts     # Unconditional; illness and suicide checks each tick
    DisasterEvent.ts       # Population-level; run once per tick by LooperSingleton (not via IEvent)
    ExerciseEvent.ts       # Intent-gated; constitution++
    LearnEvent.ts          # Intent-gated; intelligence++
    KillEvent.ts           # Intent-gated; attempt prob = killingIntent × ageModifier × (1 + Gini × scalar); success = KILL_SUCCESS_BASE / victim.constitution
  Records/
    DeathRecord.ts         # Cause of death + optional killer reference
    KillingRecord.ts       # Victim reference + murderer's age at time of killing
    StealingRecord.ts      # Victim reference + amount stolen + thief's age
  Helpers/
    Constants.ts           # CAUSE_OF_DEATH, EDUCATION, TYPE_OF_HELP enums
    Variables.ts           # ILLNESS_DEATH_SCALAR, age curve constants, per-event age profiles, happiness signals, health thresholds, working-age bounds
    SeededRandom.ts        # LCG seeded RNG; asRNG() returns an RNG-typed function
    AgeModifier.ts         # ageModifier(age, peakAge, scale, floor) — bell curve helper
    Types.ts               # RNG, TenYearSummary, PersonTypeDefinition/PersonTypes, OverridableField, INTEGER_FIELDS (ARD 030)
    Classifier.ts          # Pure: classifyPerson, countPerType, parsePersonTypes — predicate over PersonTypes (ARD 030)
    CycleDetector.ts       # Pure: detectCycles — zigzag boom-bust oscillation detection over a population series; distinguishes a stable cycle from a single boom-bust or a ratchet to extinction (sweep-harness measurement tooling, not an outcome label)
    Reporters.ts           # Pure functions: buildTenYearSummary, formatDecadeSummary, formatSimulationHeader, formatEndReport (includes COHORT SURVIVAL section when personTypes supplied), classifyOutcome
    ReportWriter.ts        # writeReportHTML — writes self-contained HTML report with Chart.js to output/
  tests/                   # Mirrors src/ structure; one test file per source file
```

## ARD requirement

**Any implementation that encodes a non-obvious design choice requires an ARD before the code is written.** This includes: new stats or computed properties, event mechanics (probabilities, magnitudes, outcomes), changes to how existing fields are used, and any parameter whose value could reasonably be different.

The test: if a future agent would have to guess *why* you made a choice, write an ARD first. If the choice is forced by the existing architecture with no real alternative, a comment in code may suffice.

**Discuss the decision with the project owner before writing the ARD.** The ARD records what was agreed — it is not a draft for review. After discussion: write the ARD, add it to the index as Proposed, get explicit sign-off, then move it to Accepted. Do not begin implementation until Accepted.

**Before writing the ARD body, read `docs/decisions/README.md`.** It is the canonical guide for ARD scope, structure, quality bar, and the after-writing checklist. Skipping it produces ARDs that are syntactically correct but thin on judgment — usually missing the rejected alternatives or the calibration intent that make an ARD useful to the next reader.

After an ARD is Accepted: reference it in the relevant "Key design decisions" bullet in CLAUDE.md, and include it in the same commit or PR as the implementation it covers.

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

- **Person stats are mutable, collections are not reassignable**: primitive fields (`age`, `resources`, etc.) are mutable so events can update them in place. Collection fields (`killed`, `hasChildren`, `childOf`, etc.) are `readonly` to prevent accidental replacement — but their contents remain mutable (e.g. `seed()` pushes parents into `childOf` post-construction). Constructor accepts 0, 1, or 2 parents; 1-parent entries arise only from `Simulation.seed()` for single-parent households. See ARD 002, ARD 052.
- **Object references as identity**: `Person` objects have no ID field. Reference equality (`===`) is identity. See ARD 001.
- **Stats and intents start at 0** in the constructor, but `Simulation.seed(n, rng)` randomizes them on startup: age [`SEED_AGE_FLOOR`,50), resources [0,100), experience [0, min(age, EXPERIENCE_CAP)], intelligence/constitution/charisma [1,10], learningIntent/exerciseIntent [0,1), stealingIntent/lyingIntent [0,0.3), killingIntent [0,0.1). Education is seeded only for persons at or above `RELATIONSHIP_MIN_AGE`: ages ≤17 → `isWorkingOnEd = HIGH_SCHOOL` at 70%; ages 18–24 → `isWorkingOnEd = BACHELORS` at 40%; ages 25+ → completed `education` seeded hierarchically (HS 85%, then BACHELORS 40% conditional, MASTERS 25% conditional, PHD 20% conditional). After person creation, `seed()` runs two passes: (1) **parent assignment** — each child (age < `RELATIONSHIP_MIN_AGE`) is assigned to a family unit (two-parent at `SEED_TWO_PARENT_FRACTION`, single-parent otherwise; siblings share families at `SEED_SIBLING_REUSE_PROBABILITY`; parent must be at least `SEED_MIN_PARENT_AGE_GAP` years older; unmatched children remain orphaned); two-parent families set `isInRelationshipWith` on both parents. (2) **adult pairing** — remaining unpartnered adults are paired until the adult paired fraction reaches `SEED_PAIRING_FRACTION`. Extraction order is shuffled each tick via Fisher-Yates using the seeded RNG. See ARD 021, ARD 052, ARD 053.
- **`happiness` is a computed getter** (not a stored stat). Factors: job (+5 if employed; −3 if unemployed and working-age 18–65 only), resources (critical/low/comfortable thresholds vary by age group), relationship (+3), age (>65: −1), illness (−round(illness×5)), `helpHappinessBoost` (set by HelpEvent, decays per tick), `killHappinessBoost` (set by KillEvent on a confirmed kill, decays per tick). Children use average living parents' resources instead of their own. Floor 0. See ARD 009 (original), ARD 014 (revision), ARD 046 (transient boosts).
- **Records are plain data classes** — they record that an event happened, they don't trigger anything.
- **Global natural resource pool (conservative)**: `Simulation` owns `naturalResources` (current pool, initialized from `NATURAL_RESOURCES_INITIAL` independently of the ceiling — ARD 044), `naturalResourceCeiling` (max accessible, initialized from `NATURAL_RESOURCE_CEILING_INITIAL`), and `extractionProductivity` (multiplier on gather output and pool drain; starts at `EXTRACTION_PRODUCTIVITY_INITIAL = 1.0`, bounded to `[EXTRACTION_PRODUCTIVITY_FLOOR, MAX_EXTRACTION_PRODUCTIVITY]` — ARD 047; higher = more output AND faster pool drain). Pool regenerates by `naturalResourceCeiling × NATURAL_RESOURCE_REGEN_FRACTION` each tick (clamped at ceiling) via `simulation.regenerate()`, called at the start of each tick in `LooperSingleton` — coupling means ceiling-growth inventions actually unlock new sustainable population (ARD 043). The **carrying capacity is dynamic and binding** (ARD 050): each tick `simulation.degradeCeiling()` (called before `regenerate()`) erodes the ceiling by `ceiling × CEILING_DEGRADATION_RATE × depletionFraction` (no loss at a full pool, max loss at an empty one), floored at `NATURAL_RESOURCE_CEILING_FLOOR`, so overexploitation degrades carrying capacity (HANDY/Tainter); `MAX_NATURAL_RESOURCE_CEILING` is a small multiple of the initial ceiling so regen stays comparable to extraction and the commons binds. `GatherResourcesEvent` and `WindfallEvent` are both strict-conservation pool draws (drain == personal gain); when the pool is empty they fire as no-ops. `InventionEvent` randomly shifts productivity (tech-boom/austerity) or ceiling; ceiling-growth is the most frequent outcome (weights 1:1:2) but uses a gentle dedicated `INVENTION_CEILING_GROWTH_SCALAR` (ARD 050) so it doesn't ratchet to the cap; productivity is a bounded symmetric random walk and ceiling growth is capped at `MAX_NATURAL_RESOURCE_CEILING` (ARD 047). See ARD 007, ARD 039, ARD 040, ARD 043, ARD 044, ARD 047, ARD 050.
- **Age modifiers**: mortality uses a U-shaped curve (`ageMortalityModifier` getter on `Person`); all event probabilities are multiplied by a per-event bell curve via `ageModifier()` in `Helpers/AgeModifier.ts`. See ARD 008.
- **Experience grows and decays each tick**: `ExperienceEvent` (unconditional) computes `BASE_EXPERIENCE_GROWTH + intelligence * INTELLIGENCE_EXPERIENCE_SCALAR * learningFade ± activity modifier`, clamped to `[0, EXPERIENCE_CAP]`. Childhood attenuates growth; education and employment accelerate; adult/elderly idleness decays. Intelligence fade reuses the learning age curve. See ARD 017.
- **`illness` is live continuous severity `[0, 1]`**: `IllnessEvent` (unconditional, fires before `GatherResourcesEvent`) rolls onset (`BASE_ILLNESS_ONSET * ageRisk / constitution`) and recovery (`BASE_ILLNESS_RECOVERY * constitution / ageRisk * senescence`) independently each tick; severity clamped after both rolls. `ageRisk = 1 + age / ILLNESS_AGE_RISK_DIVISOR` (linear). `senescence = max(FLOOR, 1 - DECAY * max(0, age - START_AGE))` decays recovery with age so chronic illness accumulates in the old (ARD 049). See ARD 018, ARD 049.
- **Mortality is disease-mediated, not suicide-dominated** (ARD 049): suicide (`SUICIDE_PROBABILITY_SCALE / (happiness+1)`) was cut ~2 orders of magnitude to realistic rates (~1–4% of deaths); illness senescence + re-tuned onset/recovery/`ILLNESS_DEATH_SCALAR` make age-modified illness death (`illness × ILLNESS_DEATH_SCALAR × ageMortalityModifier`) the dominant old-age cause. No separate "natural"/"old age" cause — age death routes through `CAUSE_OF_DEATH.ILLNESS`. *Follow-up resolved: realistic mortality exposed a fertility/population-regulation problem; ARD 050 bound the carrying capacity and a sweep-harness study (`docs/research-fertility.md`) showed no `BASE_CHILDBIRTH_RATE` stabilizes the population — so boom-bust is accepted as a HANDY behavior and the rate is set to 0.6 for outcome variety. A follow-up tuning study (`docs/research-tuning-defaults.md`) generalized this: the model is a terminal one-shot overshoot, *no* single constant yields a sane long-run default, and short-horizon variety is a mid-overshoot artifact — tune for short-horizon variety, judge at long horizons, and treat long-run stability as needing a structural fix (crash recovery), not recalibration.* See ARD 049.
- **Resource consumption**: `ConsumptionEvent` (unconditional, after `GatherResourcesEvent`) deducts age-scaled living costs each tick. Children with living parents pay a small % of own resources (starvation cannot fire at zero — implicit parental subsidy); orphaned children and adults pay a flat rate scaled by `CONSUMPTION_ELDER_MULTIPLIER` at 65+. Resources floor at 0; when they hit 0 and cost > 0, `STARVATION_ILLNESS_RATE` is added to illness, feeding the existing illness→mortality chain in `MisfortuneEvent`. No separate starvation death path. See ARD 024.
- **`isInRelationshipWith` lifecycle managed by `RelationshipEvent` + `kill()`**: persons below `RELATIONSHIP_MIN_AGE` skip `RelationshipEvent` entirely (ARD 053); formation requires both persons unpartnered; dissolution uses a flat per-tick rate (`BASE_BREAKUP_RATE`); partner death clears the surviving partner's field, dropping the +3 happiness bonus as a widowhood proxy feeding MisfortuneEvent's suicide check. `BASE_RELATIONSHIP_RATE` raised to improve post-crash re-pairing at low population (ARD 053). Resource pooling deferred. See ARD 025, ARD 053.
- **10-year summary and progress reporting**: Every 10 ticks, `LooperSingleton` builds a `TenYearSummary` (averaged Gini/resources/happiness/naturalResources/naturalResourceCeiling, peak Gini, delta death counts by cause, population delta), appends it to `Simulation.decadeHistory`, and prints a one-line console summary. `TenYearSummary` is defined in `Types.ts`. Formatting lives in `src/Helpers/Reporters.ts` (pure functions). See ARD 015.
- **End-of-simulation report**: After the tick loop, `index.ts` calls `formatEndReport` (console summary with outcome verdict) and `writeReportHTML` (writes `output/report-<seed>-<timestamp>.html` — self-contained HTML with Chart.js charts loaded from CDN). Outcome classification (`COLLAPSE`/`STRUGGLING`/`STABLE`/`THRIVING`) uses named threshold constants in `Variables.ts`. I/O in `src/Helpers/ReportWriter.ts`, pure formatting in `Reporters.ts`. See ARD 016.
- **Multi-dimensional outcome classification** (ARD 051): `classifyOutcome(decadeHistory, startPopulation)` reads four collapse/thrive dimensions (Tainter/Turchin/Diamond, not HANDY-specific) — population decline **from the run's peak** (not from start), inequality (final-decade Gini), wellbeing (happiness), and ecological strain (commons fill = final-decade `avgNaturalResources ÷ avgNaturalResourceCeiling`). COLLAPSE on severe peak-decline or extreme Gini; THRIVING only when all four are good (low Gini, high happiness, near peak, healthy commons — so an overshoot with an exhausted pool can no longer read as thriving); STRUGGLING on any single stress signal; STABLE otherwise; EXTINCTION (ARD 031) still first. `explainOutcome` names the driving dimension. THRIVING is rare in practice — the model is collapse-prone (health coincides with declining populations, stability with overshoot), a genuine finding rather than a threshold bug. Refines ARD 016; research in `docs/research-collapse-classification.md`. See ARD 051.
- **Character types** (config-driven, predicate-based): `simulation.personTypes` in the config maps a name to `{ percentage, ranges }`; ranges are partial `[min, max)` overrides on the 11 numeric fields (`age`, `resources`, `experience`, `intelligence`, `constitution`, `charisma`, `learningIntent`, `exerciseIntent`, `stealingIntent`, `lyingIntent`, `killingIntent`). At seed time, `floor(n * percentage)` persons are quota-allocated per type, Fisher-Yates shuffled, then seeded with the overrides; undeclared fields fall back to defaults. `education`/`isWorkingOnEd` stay age-keyed. No `Person.type` field — a `classifyPerson` predicate evaluated against current stats produces the per-type counts in the end report's `COHORT SURVIVAL` section, so "did engineers grow or shrink?" is answered from current stats, not seed labels. Catalog of proposed archetypes in `docs/research-character-types.md`. See ARD 030.
- **Survivor composition, EXTINCTION, and partial-decade summary**: `formatEndReport` renders a `SURVIVORS` section (age/education/employment/health/family buckets) whenever any persons live. `classifyOutcome` adds `EXTINCTION` (checked first, fires when `endPopulation === 0`); the report appends `Extinct as of Yr NNN` when that fires and the HTML report uses a distinct darker-red color. `LooperSingleton` appends one partial-decade `TenYearSummary` to `decadeHistory` after the loop when `ticks % 10 !== 0`, so the final-decade metrics reflect the actual end of the run instead of the last full decade. See ARD 031.
- **Pool dynamics and invention counters in snapshots**: `TickSnapshot` captures `extractionProductivity` and `naturalResourceCeiling` each tick; `Simulation` keeps cumulative `inventionFasterCount`/`inventionSlowerCount`/`inventionCeilingCount` incremented by `InventionEvent`. Surfaced as a one-line "Inventions:" entry in `RESOURCES` and a "Resource Pool Dynamics" chart in the HTML report. See ARD 032.
- **Birth tracking symmetric with deaths**: `Simulation.recordBirth()` increments `tickBirths` (flushed on snapshot to per-tick `births` and `cumulativeBirths` fields, same lifecycle as `tickDeathCauses`); `ChildbirthEvent` calls it after `simulation.add(child)` (the seed loop does not). `TenYearSummary` gains `births`, derived from cumulative deltas; reports show Births in `POPULATION`, the decade summary line, the decade table, and the HTML population chart. See ARD 033.
- **Community pool, taxation, and welfare**: `Simulation` owns a `communityPool` field. Each tick a flat `TAX_RATE` fraction is deducted from every living person's resources and added to the pool; jail forfeitures (ARD 035) are a second funding source. After consumption, persons with `resources < WELFARE_THRESHOLD` or orphaned children (`age < 18 && livingParents.length === 0`) share `communityPool * (1 - COMMUNITY_POOL_RESERVE_FRACTION)` equally; the remainder stays in reserve. See ARD 034.
- **Jail and retribution**: `Person` gains `jailedTicksRemaining` (default 0). Detection is checked inside `StealEvent` and `KillEvent` after a crime; probability scales with cumulative prior crimes and crime severity. On detection, most resources are forfeited to `communityPool` and `jailedTicksRemaining` is set to a fixed sentence per crime type. `LooperSingleton` decrements the counter each tick before `EventFactory`. While jailed, only `AgeEvent`, `IllnessEvent`, and `JailEvent` run; `JailEvent`'s flat gather is now drawn from `communityPool` (clamped to what the pool can supply — empty pool = starvation), consumption is unchanged. See ARD 035, ARD 041.
- **Dynamic intent multipliers and theft emboldening**: `stealingIntent` can now increase permanently — each undetected theft bumps it by `STEALING_EMBOLDEN_INCREMENT`, capped at `STEALING_INTENT_CAP` (social learning / criminal career escalation). Situational pressure adds transient in-event multipliers without touching stored fields: low resources amplify steal probability in the `StealEvent` gate; low happiness amplifies kill attempt probability in `KillEvent`. See ARD 036.
- **Newborn stat seeding via parental heritability**: `ChildbirthEvent` seeds the child's stats and intents after `new Person([p1, p2])` and before `simulation.add(child)`. Stats (`intelligence`, `constitution`, `charisma`) regress toward `NEWBORN_STAT_POPULATION_MEAN` with strength `HERITABILITY_STAT_COEFFICIENT` plus uniform noise. Intents (all five) regress toward `0` with weaker strength `HERITABILITY_INTENT_COEFFICIENT` plus noise, then clamp to `[0, 1]`. Resources, age, experience, illness all stay at 0. Fixes a latent division-by-zero crash (newborn `constitution = 0` divided in `IllnessEvent`/`DisasterEvent`) and introduces intergenerational sorting. See ARD 037.
- **Estate inheritance split on death**: `Simulation.kill()` distributes `person.resources` across `communityPool`, surviving `isInRelationshipWith`, and living children (`hasChildren.filter(c => c.causeOfDeath === null)`) via three constants (`ESTATE_COMMUNITY_SHARE`, `ESTATE_PARTNER_SHARE`, `ESTATE_CHILDREN_SHARE`, sum = 1.0). Missing-heir shares consolidate to the other individual heir; with no individual heirs the full estate goes to the community pool. Cause-blind — murder follows the same rules; the killer receives no share from the estate. Closes the resource-conservation loop alongside ARDs 039–041. See ARD 042.

## What's implemented

- `Person` data model — all properties, mutable primitives, readonly collections, `happiness` getter (ARD 014: job+5/−3 for working-age only, age-group resource thresholds, children use living-parents avg, floor 0; ARD 046: adds `helpHappinessBoost + killHappinessBoost`), `livingParents` getter, `ageMortalityModifier` getter (U-shaped curve, ARD 008); `jailedTicksRemaining` (countdown to freedom, default 0; decremented by LooperSingleton before EventFactory each tick, ARD 035); `helpingIntent` (seeded higher than antisocial intents, ARD 045); `helpHappinessBoost` / `killHappinessBoost` (transient, decayed per tick by LooperSingleton, ARD 046)
- `Simulation` — `living`, `deceased`, `history`, `decadeHistory`; `getLiving()`, `indexOfLiving()`, `getRandomOther()`, `kill()` (distributes estate per ARD 042 before clearing partner/filter), `add()`, `recordBirth()` (ARD 033), `seed(n, rng, personTypes?)`, `snapshot()`, `regenerate()`, `degradeCeiling()` (erodes the ceiling proportional to pool depletion, floored at `NATURAL_RESOURCE_CEILING_FLOOR`, ARD 050); Gini coefficient computed per tick; `naturalResources`, `naturalResourceCeiling`, `extractionProductivity` resource pool fields (ARD 007, ARD 039); cumulative `inventionFasterCount`/`inventionSlowerCount`/`inventionCeilingCount` (ARD 032); `personTypes` and `seededTypeCounts` retained for ARD-030 end-of-run reporting; `communityPool` funded by `collectTax()` each tick, jail forfeitures, and estate community-shares (ARD 042); drained by `distributeWelfare()` (redistributes to persons with `resources < WELFARE_THRESHOLD` or orphaned children after consumption, ARD 034) and by `JailEvent` gather (ARD 041)
- `LooperSingleton.start(n, ticks, seed, logger?)` — full tick loop: prints header, seeds simulation, calls `degradeCeiling()` then `regenerate()` (ARD 050) then runs EventFactory per person per tick, calls `snapshot()` each tick; builds and stores a `TenYearSummary` every 10 ticks (ARD 015); after the loop appends a partial-decade summary when `ticks % 10 !== 0` (ARD 031); each tick: `collectTax` before EventFactory, `jailedTicksRemaining--` (floored at 0) + `helpHappinessBoost`/`killHappinessBoost` decay before EventFactory, `distributeWelfare` after EventFactory (ARD 034, ARD 035, ARD 046)
- `IEvent` interface
- `AgeEvent` — age increment only (old-age hard cutoff removed; death handled by MisfortuneEvent via age mortality curve)
- `ExperienceEvent` — unconditional; experience growth/decay each tick with childhood attenuation, intelligence fade via learning curve, and activity bonuses/penalties. Clamped to `[0, EXPERIENCE_CAP]`. See ARD 017.
- `IllnessEvent` — unconditional; independent onset and recovery rolls each tick; severity clamped to `[0, 1]`. Onset scales with age and falls with constitution; recovery the inverse, additionally decayed with age past `ILLNESS_RECOVERY_SENESCENCE_START_AGE` so chronic illness accumulates in the old. See ARD 018, ARD 049.
- `GatherResourcesEvent` — unconditional; strictly conservative (ARD 039). `output = experience * (BASE_GATHER_AMOUNT + intelligence * INTELLIGENCE_GATHER_SCALAR) * extractionProductivity`; `extracted = min(output, naturalResources)`; person gains and pool loses exactly `extracted`. Supersedes ARD 011.
- `JobEvent` — unconditional; gain branch fires when unemployed (`gainProb = (experience * JOB_GAIN_EXPERIENCE_SCALAR + charisma * JOB_GAIN_CHARISMA_SCALAR) * ageModifier(...) * (1 + education * EDUCATION_JOB_GAIN_SCALAR)`); loss branch fires when employed (`lossProb = JOB_LOSS_BASE + JOB_LOSS_STAT_SCALAR / (experience+1) / (charisma+1)`). Uses work age profile. See ARD 020, ARD 022.
- `EnrollmentEvent` — gated on `isWorkingOnEd === NONE && education < PHD`; fires when `rng() < BASE_ENROLLMENT_RATE * learningIntent * ageModifier(age, 22, 40, 0.05)`; sets `isWorkingOnEd = education + 1`. Employment does not block enrollment. See ARD 023.
- `GraduationEvent` — enrollment-gated; fires when `isWorkingOnEd !== NONE` and `rng() < BASE_GRADUATION_RATE * ageModifier(age, 22, 30, 0.15)`; sets `education = isWorkingOnEd`, resets `isWorkingOnEd = NONE`, increments `intelligence` by 1 (capped at `INTELLIGENCE_MAX`). Mutually exclusive with EnrollmentEvent in the same tick. See ARD 021.
- `MisfortuneEvent` — unconditional; illness death (`illness * ILLNESS_DEATH_SCALAR * ageMortalityModifier`, zero when illness=0) then suicide (`SUICIDE_PROBABILITY_SCALE / (happiness + 1)`); first cause wins. ARD 049 recalibrated both: illness now carries old-age mortality (dominant cause) and suicide dropped to realistic rates (~1–4% of deaths). See ARD 019 (supersedes ARD 013), ARD 049.
- `DisasterEvent` — population-level, run once per tick in `LooperSingleton` (does not implement `IEvent`); probabilistic trigger (`DISASTER_PROBABILITY`), random subset of living up to `DISASTER_MAX_AFFECTED_FRACTION`, kill check (`DISASTER_KILL_BASE * ageMortalityModifier / constitution`), resource loss fraction in `[DISASTER_MIN_LOSS_FRACTION, DISASTER_MAX_LOSS_FRACTION]`. See ARD 012.
- `ExerciseEvent` — intent-gated; `constitution = min(CONSTITUTION_MAX, constitution + 1)`. Wired in `EventFactory` with exercise age profile.
- `LearnEvent` — intent-gated; `intelligence = min(INTELLIGENCE_MAX, intelligence + 1)`. Wired in `EventFactory` with learning age profile.
- `ConsumptionEvent` — unconditional; children with living parents pay `resources * CONSUMPTION_CHILD_RESOURCE_RATE` (starvation cannot fire at zero while parents live); orphaned children and adults pay `CONSUMPTION_BASE * ageMultiplier` (1.0 adult, `CONSUMPTION_ELDER_MULTIPLIER` at `CONSUMPTION_ELDER_MIN_AGE`+); zero resources triggers `+STARVATION_ILLNESS_RATE` to illness, feeding `MisfortuneEvent` mortality. See ARD 024.
- `RelationshipEvent` — unconditional; formation branch fires when unpartnered (`BASE_RELATIONSHIP_RATE * (1 + charisma * RELATIONSHIP_CHARISMA_SCALAR) * ageModifier(26, 35, 0.1)`), draws `getRandomOther()` and checks target also unpartnered, mutually assigns both fields; dissolution branch fires when partnered (`BASE_BREAKUP_RATE` flat probability), mutually clears both fields. `Simulation.kill()` also clears surviving partner's field on death. See ARD 025.
- `StealEvent` — intent-gated; gate: `stealingIntent * (1 + charisma * STEAL_CHARISMA_SCALAR) * ageModifier(...) * (1 + resourcePressure * SITUATIONAL_STEAL_SCALAR)` where `resourcePressure = max(0, 1 - resources / SITUATIONAL_STEAL_RESOURCE_THRESHOLD)` (ARD 036); selects random victim; transfers `min(victim.resources * STEAL_FRACTION, STEAL_MAX_AMOUNT)` from victim to thief; pushes `StealingRecord`; then detection roll: `BASE_DETECT_RATE_STEAL * (1 + priorCrimes * DETECTION_CRIME_COUNT_SCALAR)` — on detection forfeits `JAIL_RESOURCE_FORFEIT_FRACTION` to `communityPool` and sets `jailedTicksRemaining += JAIL_TICKS_STEAL`; on non-detection permanently bumps `stealingIntent` by `STEALING_EMBOLDEN_INCREMENT` (capped at `STEALING_INTENT_CAP`). See ARD 026, ARD 035, ARD 036.
- `KillEvent` — unconditional in EventFactory; attempt prob = `killingIntent * ageModifier(age, 24, 30, 0.05) * (1 + currentGini * KILL_GINI_SCALAR) * (1 + happinessPressure * SITUATIONAL_KILL_SCALAR)` where `happinessPressure = max(0, 1 - happiness / SITUATIONAL_KILL_HAPPINESS_THRESHOLD)` (ARD 036); success prob = `KILL_SUCCESS_BASE / max(1, victim.constitution)`; on success: `simulation.kill()` then detection roll `BASE_DETECT_RATE_KILL * (1 + priorCrimes * DETECTION_CRIME_COUNT_SCALAR)` — on detection forfeits resources to `communityPool` and sets `jailedTicksRemaining += JAIL_TICKS_KILL`. See ARD 027, ARD 035, ARD 036.
- `WindfallEvent` — probability-gated at factory level (`BASE_WINDFALL_RATE * ageModifier(age, 58, 20, 0.05)`); debits a uniform draw `WINDFALL_BASE_AMOUNT + rng() * WINDFALL_VARIANCE` from `naturalResources` and credits the same amount to `person.resources`; clamps to whatever the pool can supply, so an empty pool yields no windfall. Flat magnitude is still the counter-force to KillEvent and StealEvent's inequality-widening. No record. See ARD 028 (superseded by ARD 040).
- `ChildbirthEvent` — unconditional in EventFactory; fires only when `isInRelationshipWith !== null` and lower-index partner (`simulation.indexOfLiving(person) <= simulation.indexOfLiving(partner)`, for deduplication); probability uses couple aggregates (`max` illness, `min` resources, `max` age, `avg` happiness) so the dedup choice never shifts fertility — `p = BASE_CHILDBIRTH_RATE * ageModifier(coupleAge, 26, 12, 0.02) * illnessFactor * resourceFactor * happinessFactor`; on birth: deducts `CHILDBIRTH_BIRTH_COST` from each parent (floored at 0), creates `new Person([person, partner])`, **seeds newborn stats/intents via parental heritability (ARD 037: stats regress toward `NEWBORN_STAT_POPULATION_MEAN` with `HERITABILITY_STAT_COEFFICIENT`; intents regress toward 0 with `HERITABILITY_INTENT_COEFFICIENT`; intents clamped to `[0,1]`)**, pushes to both parents' `hasChildren`, calls `simulation.add(child)`. Post-birth resource floor can feed the existing starvation chain — intentional cost-of-parenthood feedback. See ARD 029, ARD 037.
- `InventionEvent` — intelligence-scaled probability gate (`BASE_INVENTION_RATE * intelligence * ageModifier(age, 40, 45, 0.1)`); weighted random draw selects one of three outcomes with weights 1:1:2 (`INVENTION_DEPLETION_FASTER_WEIGHT` : `INVENTION_DEPLETION_SLOWER_WEIGHT` : `INVENTION_CEILING_GROWTH_WEIGHT`): depletion-faster (`extractionProductivity *= 1 + delta`, clamped at `MAX_EXTRACTION_PRODUCTIVITY` — tech boom: more output AND faster pool drain), depletion-slower (`extractionProductivity /= 1 + delta` — austerity tech, exact inverse of faster so paired outcomes cancel), ceiling-growth (`naturalResourceCeiling += intelligence * INVENTION_CEILING_GROWTH_SCALAR * ceiling`, clamped at `MAX_NATURAL_RESOURCE_CEILING` — gentle dedicated scalar per ARD 050 so it doesn't ratchet to the cap; counterbalanced by `degradeCeiling()`); productivity `delta = intelligence * INVENTION_MAGNITUDE_SCALAR`; productivity is a bounded random walk on `[EXTRACTION_PRODUCTIVITY_FLOOR, MAX_EXTRACTION_PRODUCTIVITY]`. See ARD 007, ARD 039, ARD 043, ARD 047, ARD 050.
- `HelpEvent` — intent-gated; helper transfers `min(resources × HELP_FRACTION, HELP_MAX_AMOUNT)` to a random lower-resource target; no-op when no eligible target or helper has zero resources; sets `helpHappinessBoost` on success (ARD 046). See ARD 045.
- `JailEvent` — replaces gather/consume cycle for jailed persons; debits up to `JAIL_GATHER_AMOUNT` from `communityPool` (clamped to pool balance) and credits to person, then deducts flat `JAIL_CONSUMPTION_AMOUNT`; resources floored at 0; starvation illness fires when net negative (same path as ConsumptionEvent — also fires when `communityPool` is empty so no gather occurs). See ARD 035, ARD 041.
- `StatDecayEvent` — unconditional; rolls independent probabilistic decay for `constitution` and `intelligence` each tick; decay probability scales linearly with years past `CONSTITUTION_DECAY_START_AGE` / `INTELLIGENCE_DECAY_START_AGE`; each stat decrements by 1 on success, floored at 1. Runs for jailed and free persons alike (physical/cognitive aging doesn't pause in jail). `ExerciseEvent` and `LearnEvent` remain the counterforce. See ARD 048.
- `EventFactory` — when `jailedTicksRemaining > 0`, returns only `[AgeEvent, IllnessEvent, JailEvent, StatDecayEvent, MisfortuneEvent]`; otherwise full suite: unconditional `[AgeEvent, ExperienceEvent, IllnessEvent, GatherResourcesEvent, ConsumptionEvent, JobEvent, RelationshipEvent, ChildbirthEvent, KillEvent, MisfortuneEvent]` plus intent-gated `HelpEvent`, `ExerciseEvent`, `LearnEvent`, and `StealEvent` (with resource-pressure multiplier on steal gate), plus `EnrollmentEvent`/`GraduationEvent`, plus probability-gated `WindfallEvent` and `InventionEvent`, plus always-appended `StatDecayEvent`. See ARD 010, ARD 021, ARD 023, ARD 024, ARD 025, ARD 026, ARD 027, ARD 028, ARD 029, ARD 035, ARD 036, ARD 045, ARD 048.
- `DeathRecord`, `KillingRecord`, `StealingRecord` data classes
- `SeededRandom` (LCG), `RNG` type, `Constants`, `Variables` (includes `HAPPINESS_BASELINE`, `PRIME_AGE`, `AGE_DEATH_CURVATURE`, `BASE_GATHER_AMOUNT`, `INTELLIGENCE_GATHER_SCALAR`, `SUICIDE_PROBABILITY_SCALE`, `ILLNESS_DEATH_SCALAR`, resource-pool constants (including ARD 050 carrying capacity: `MAX_NATURAL_RESOURCE_CEILING`, `NATURAL_RESOURCE_CEILING_FLOOR`, `CEILING_DEGRADATION_RATE`, `INVENTION_CEILING_GROWTH_SCALAR`), disaster constants, experience constants, illness constants (including ARD 049 senescence: `ILLNESS_RECOVERY_SENESCENCE_START_AGE`, `ILLNESS_RECOVERY_SENESCENCE_DECAY`, `ILLNESS_RECOVERY_SENESCENCE_FLOOR`), job constants (`JOB_GAIN_EXPERIENCE_SCALAR`, `JOB_GAIN_CHARISMA_SCALAR`, `JOB_LOSS_BASE`, `JOB_LOSS_STAT_SCALAR`, `EDUCATION_JOB_GAIN_SCALAR`), graduation constants (`BASE_GRADUATION_RATE`, `GRADUATION_HS_MAX_AGE`, `GRADUATION_COLLEGE_MAX_AGE`, `GRADUATION_HS_SEED_RATE`, `GRADUATION_COLLEGE_SEED_RATE`), enrollment constants (`BASE_ENROLLMENT_RATE`), and per-event age profile constants for all planned events including graduation and enrollment)
- `AgeModifier.ts` — `ageModifier(age, peakAge, scale, floor)` bell-curve helper (ARD 008)
- `TickSnapshot` observability: population, per-tick and cumulative death counts by cause (murder/illness/disaster/suicide/old age), `averageResources`, `resourceGini`, `averageHappiness`, `aggregateKillingIntent`, `aggregateStealingIntent`, `naturalResources`, `extractionProductivity` and `naturalResourceCeiling` (ARD 032), per-tick and cumulative `births` (ARD 033)
- `Reporters.ts` — `buildTenYearSummary(window, endTick, startPopulation)` (accepts partial trailing windows per ARD 031), `formatDecadeSummary`, `formatSimulationHeader`, `formatEndReport(..., personTypes?, seededTypeCounts?, living?, extinctionTick?, extractionProductivity?, inventionCounts?)` (renders `COHORT SURVIVAL` when types supplied; `SURVIVORS` when any persons live; `Reason:` line under OUTCOME; `Extinct as of Yr NNN` callout on EXTINCTION; `Inventions:` line in RESOURCES; `Births` in POPULATION + decade table), `classifyOutcome(decadeHistory, startPopulation)` (four-dimensional: peak-relative population decline, Gini, happiness, commons fill; EXTINCTION at population=0, checked first — ARD 051), `explainOutcome(decadeHistory, …)` (names the driving dimension), `summarizeSurvivors`, `formatSurvivorSection`. All pure; no I/O. See ARD 015, ARD 016, ARD 030, ARD 031, ARD 032, ARD 033, ARD 051.
- `Classifier.ts` — `classifyPerson(person, types)`, `countPerType(persons, types)`, `parsePersonTypes(raw)`. Pure predicate-based classification + config parsing/validation (sum ≤ 1.0 enforced; malformed ranges and unknown fields warned and skipped). See ARD 030.
- `ReportWriter.ts` — `writeReportHTML(simulation, n, ticks, seed)`: writes `output/report-<seed>-<outcome>-<timestamp>.html` by compiling `report-template.hbs` with Handlebars and embedding JSON data + Chart.js charts (Gini, population+births, resources, happiness, resource-pool dynamics, antisocial intent per capita, deaths by cause); EXTINCTION outcome color added. See ARD 016, ARD 031, ARD 032, ARD 033, ARD 038.
- `index.ts` — after the run, prints `formatEndReport` to console and calls `writeReportHTML`; `output/` is gitignored
- `Variables.ts` — outcome classification thresholds (ARD 051): `COLLAPSE_GINI_THRESHOLD`, `COLLAPSE_PEAK_DECLINE_FRACTION`, `STRUGGLING_GINI_THRESHOLD`, `STRUGGLING_HAPPINESS_THRESHOLD`, `STRUGGLING_PEAK_DECLINE_FRACTION`, `STRUGGLING_RESOURCE_FRACTION`, `THRIVING_GINI_THRESHOLD`, `THRIVING_HAPPINESS_THRESHOLD`, `THRIVING_MAX_PEAK_DECLINE_FRACTION`, `THRIVING_RESOURCE_FRACTION` (`COLLAPSE_POPULATION_FRACTION` dropped — superseded by peak-relative decline)
- Tests for all of the above

## What's not implemented yet

The event set is complete. See `docs/future-ideas.md` for candidates that may be added in future work.

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
| Help | 40 | 40 | 0.1 |
| Graduation | 22 | 30 | 0.15 |

## Keeping CLAUDE.md current

At the end of every session — whether it changed code or only docs/ARDs — verify that CLAUDE.md reflects actual state. This is the handoff document; if it's stale, the next agent starts blind.

**After writing a new ARD:** see the ARD requirement section above for the full checklist.

**After changing code:** update "What's implemented" and "What's not implemented yet". Read source files to verify — don't rely on memory.

**After a structural model change** (new event added/removed, agent fields added/removed, scheduling order changes, initialization logic changes): update `docs/odd-protocol.md` to match. Calibration-only changes (tweaking constants in `Variables.ts`) do not require an ODD update.

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

## Documentation conventions

Be concise but clear in every doc — `CLAUDE.md`, ARDs, `future-ideas.md`, `decisions/README.md`. These files load into agent context; bloat is a real cost. Cut hedging, restated points, and elaborations the next reader can infer. One sentence beats three when it carries the same information. Keep the why; trim the throat-clearing.

**Research docs (`docs/research-*.md`)** must open with a provenance block so results stay interpretable after Variables are recalibrated:

```
**Recorded:** YYYY-MM-DD | **Commit:** <short hash> | **Base config:** all Variables at defaults unless noted
**Commands:** npm run sweep -- ...
**Key context vars:** LIST=VAL, ... (the 3–5 Variables most likely to shift the results if recalibrated)
```

The commit hash lets a reader run `git show <hash>:src/Helpers/Variables.ts` to see the exact config. List only the variables with meaningful leverage on the reported outcomes — not the full 127-constant dump.
