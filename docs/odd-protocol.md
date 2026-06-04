# ODD Protocol: Human Model

**Protocol version:** ODD 2020 (Grimm et al., *JASSS* 23(2):7)
**Model version:** current (`master` branch)
**Date:** 2026-05-17

---

## Overview

### 1. Purpose and Patterns

**Purpose.** The model studies the conditions under which a small human population collapses, struggles, stabilizes, or thrives over multi-generational time. The primary collapse signal is the Gini coefficient of individual `resources` — following the HANDY finding (Motesharrei et al., 2014) that inequality drives collapse more reliably than absolute scarcity. Secondary signals are average happiness, population size, and natural-resource pool depletion.

**Patterns the model should reproduce:**

- Rising Gini preceding population decline (inequality → violence → collapse feedback).
- Natural-resource pool depletion under high extraction efficiency or low regeneration.
- Stable or growing populations when prosocial events (jobs, relationships, childbirth) outweigh antisocial ones.
- U-shaped mortality by age (infants and elderly die at higher rates than prime-age adults).

---

### 2. Entities, State Variables, and Scales

#### Agents — `Person`

Each agent represents one individual. All fields are per-person; collections are mutable but not reassignable.

| Variable | Type | Range | Description |
|---|---|---|---|
| `age` | integer | ≥ 0 | Years lived |
| `resources` | number | ≥ 0 | Accumulated material wealth |
| `experience` | number | [0, EXPERIENCE_CAP] | Practical knowledge; governs gathering |
| `intelligence` | integer | [1, INTELLIGENCE_MAX] | Cognitive ability; affects learning and invention; decays with age via StatDecayEvent (ARD 048) |
| `constitution` | integer | [1, CONSTITUTION_MAX] | Physical resilience; affects illness and disaster survival; decays with age via StatDecayEvent (ARD 048) |
| `charisma` | integer | ≥ 1 | Social influence; affects jobs, relationships, stealing |
| `illness` | number | [0, 1] | Current illness severity; 0 = healthy, 1 = critically ill |
| `happiness` | computed | ≥ 0 | Derived from job, resources, relationship, age, illness |
| `hasJob` | boolean | — | Employment status |
| `education` | enum | NONE/HS/BACHELORS/MASTERS/PHD | Highest completed credential |
| `isWorkingOnEd` | enum | NONE/HS/… | Credential currently being pursued |
| `isInRelationshipWith` | Person \| null | — | Current partner (reference equality) |
| `learningIntent` | number | [0, 1) | Probability weight for LearnEvent |
| `exerciseIntent` | number | [0, 1) | Probability weight for ExerciseEvent |
| `stealingIntent` | number | [0, STEALING_INTENT_CAP] | Probability weight for StealEvent; can grow via emboldening (ARD 036) |
| `lyingIntent` | number | [0, 0.3) | Probability weight for LyingEvent |
| `killingIntent` | number | [0, 0.1) | Probability weight for KillEvent |
| `jailedTicksRemaining` | integer | ≥ 0 | Ticks remaining in current jail sentence; 0 = free; decremented by LooperSingleton before EventFactory (ARD 035) |
| `causeOfDeath` | DeathRecord \| null | — | Null while alive; set on death (cause + optional killer reference) |
| `hasChildren` | Person[] | — | Biological children (living or deceased) |
| `childOf` | Person[] | — | Biological parents (readonly) |
| `killed` | Map\<Person, KillingRecord\> | — | Persons this agent killed, keyed by victim |
| `amountStolen` | StealingRecord[] | — | Theft records (victim, amount, age at time) |
| `peopleLiedTo` | Set\<Person\> | — | Targets of lying (populated by future LyingEvent) |
| `helpsPeople` | TYPE_OF_HELP enum | — | Helping disposition (currently unused; reserved for cooperation mechanic) |

`happiness` is a computed getter (not stored): job (±3–5 for working-age), resources (threshold-based by age group, children use parents' average), relationship (+3), age >65 (−1), illness (−round(illness × 5)); floor 0.

`ageMortalityModifier` is a computed getter: `1 + AGE_DEATH_CURVATURE × (age − PRIME_AGE)²` — U-shaped, minimum at PRIME_AGE.

#### Environment — `Simulation`

One shared environment object. No spatial structure; all agent interactions are global.

| Variable | Type | Description |
|---|---|---|
| `naturalResources` | number | Current extractable pool |
| `naturalResourceCeiling` | number | Maximum pool size (can grow via InventionEvent, capped at `MAX_NATURAL_RESOURCE_CEILING`; ARD 047) |
| `extractionProductivity` | number | Multiplier on gather output and pool drain, bounded to `[EXTRACTION_PRODUCTIVITY_FLOOR, MAX_EXTRACTION_PRODUCTIVITY]`; modified by InventionEvent; ARD 039, ARD 047 |
| `communityPool` | number | Tax/forfeiture/estate fund; pays welfare and prisoner gather (ARD 034, 041, 042) |
| `living` | Person[] | Agents currently alive |
| `deceased` | Person[] | Agents who have died (retained for record-keeping) |
| `history` | TickSnapshot[] | Per-tick aggregate metrics |
| `decadeHistory` | TenYearSummary[] | One entry per 10-tick window plus optional partial window at run end |
| `personTypes` | PersonTypes | Character type definitions used for seeding (ARD 030) |
| `seededTypeCounts` | Record\<string, number\> | Count of persons seeded per named type (ARD 030) |
| `inventionFasterCount` | integer | Cumulative depletion-faster invention outcomes (ARD 032) |
| `inventionSlowerCount` | integer | Cumulative depletion-slower invention outcomes (ARD 032) |
| `inventionCeilingCount` | integer | Cumulative ceiling-growth invention outcomes (ARD 032) |
| `communityPool` | number | Pooled resources funded by per-tick taxation and jail forfeitures; distributed to poor persons and orphaned children each tick (ARD 034) |

#### Scale

- **Time:** one tick = one simulated year. Default run: 100 ticks.
- **Population:** default 100 agents; configurable.
- **Space:** none — the model is non-spatial.

---

### 3. Process Overview and Scheduling

Each tick executes in this order:

1. **`simulation.regenerate()`** — natural-resource pool replenishes by `naturalResourceCeiling × NATURAL_RESOURCE_REGEN_FRACTION`, clamped at `naturalResourceCeiling` (ARD 043).
2. **`DisasterEvent`** — fires once per tick (not per agent); probabilistic trigger; random subset of living agents may be killed or lose resources.
3. **`simulation.collectTax(living)`** — deducts `TAX_RATE × resources` from each living agent; credited to `communityPool` (ARD 034).
4. **Jail countdown** — for each living agent, if `jailedTicksRemaining > 0`, decrement by 1. Happens before EventFactory so the decremented value governs this tick's event set (ARD 035).
5. **Per-agent event loop** — extraction order shuffled each tick via Fisher-Yates (seeded RNG). For each living agent, `EventFactory` fires events based on jail status:
   - **If jailed (`jailedTicksRemaining > 0` before decrement, i.e. > 0 after decrement still running the remaining ticks):**
     - **Note:** after the decrement in step 4, `jailedTicksRemaining` is checked again by `EventFactory`. If still > 0 after decrement, agent gets reduced suite.
     1. `AgeEvent`
     2. `IllnessEvent`
     3. `JailEvent` — flat gather/consume replacing normal economy events (ARD 035)
     4. `StatDecayEvent` — age-based constitution/intelligence decay (ARD 048)
     5. `MisfortuneEvent`
   - **If free (`jailedTicksRemaining === 0` when EventFactory is called):**
     1. `AgeEvent` — increments age
     2. `ExperienceEvent` — experience growth/decay (unconditional)
     3. `IllnessEvent` — illness onset/recovery (unconditional)
     4. `GatherResourcesEvent` — extracts from pool (unconditional)
     5. `ConsumptionEvent` — deducts living costs (unconditional)
     6. `JobEvent` — employment gain/loss (unconditional)
     7. `RelationshipEvent` — partnership formation/dissolution (unconditional)
     8. `ChildbirthEvent` — birth (unconditional, dedup by index)
     9. `KillEvent` — homicide attempt (unconditional; intent gate inside execute(); happiness-pressure multiplier ARD 036)
     10. `MisfortuneEvent` — illness death then suicide check (unconditional)
     11. `ExerciseEvent` — intent-gated
     12. `LearnEvent` — intent-gated
     13. `EnrollmentEvent` **or** `GraduationEvent` (mutually exclusive)
     14. `WindfallEvent` — probability-gated
     15. `InventionEvent` — intelligence-scaled probability gate
     16. `StealEvent` — intent-gated with resource-pressure multiplier (ARD 036); detection + emboldening inside execute() (ARD 035, ARD 036)
     17. `StatDecayEvent` — always appended last; age-based constitution/intelligence decay (ARD 048)
6. **`simulation.distributeWelfare(living)`** — distributes `communityPool × (1 − COMMUNITY_POOL_RESERVE_FRACTION)` equally to eligible agents (resources < WELFARE_THRESHOLD or orphaned children); 20% reserve retained (ARD 034).
7. **`simulation.snapshot()`** — records per-tick aggregate metrics.
8. **Every 10 ticks:** `buildTenYearSummary()` appended to `decadeHistory`; one-line console summary printed.
9. **After the final tick (if `ticks % 10 !== 0`):** partial-decade summary built over the remaining ticks and appended to `decadeHistory` (ARD 031).

Deaths during the loop are processed immediately (agent removed from `living`). Newborns added via `simulation.add()` during the loop are eligible for events in the same tick (ordering depends on shuffle position).

---

## Design Concepts

### 4. Design Concepts

**Basic principles.** The model draws on three research traditions: (1) Sugarscape (Epstein & Axtell, 1996) — emergent social behavior from local agent rules; (2) HANDY (Motesharrei et al., 2014) — inequality-driven collapse dynamics; (3) Cliodynamics (Turchin) — quantitative societal cycles. The core hypothesis is that Gini inequality, not resource scarcity alone, is the leading collapse predictor.

**Emergence.** The Gini coefficient, population trajectory, and outcome classification (COLLAPSE / STRUGGLING / STABLE / THRIVING) are not imposed — they emerge from per-agent decisions each tick. Feedback loops (KillEvent amplified by Gini, GatherResourcesEvent depleting a shared pool, illness propagating through MisfortuneEvent) are the mechanism through which micro-rules produce macro-outcomes.

**Adaptation.** Most intents are seeded at initialization and remain fixed. Two mechanisms now modify stored state in response to outcomes: (1) **Emboldening** — each undetected theft permanently increments `stealingIntent` by `STEALING_EMBOLDEN_INCREMENT`, capped at `STEALING_INTENT_CAP`, encoding reinforcement learning from repeated unpunished crime (ARD 036). (2) **Jailing** — detected crimes set `jailedTicksRemaining`, removing the agent from the normal economy for a fixed sentence (ARD 035). Situational multipliers (resource pressure on stealing, happiness pressure on killing) are transient — they amplify event probability in-tick without modifying stored fields. Job and education status also adapt each tick via probabilistic gain/loss rules.

**Objectives.** Agents have no explicit utility function and do not optimize. Intent fields (`killingIntent`, `stealingIntent`, etc.) act as fixed behavioral weights rather than goals. The `happiness` getter measures wellbeing for external observation; agents do not use it to make decisions (suicide in MisfortuneEvent is the one exception, where low happiness raises mortality risk).

**Learning.** No deliberate learning mechanism exists. `ExperienceEvent` grows `experience` as a passive accumulation of activity, not as strategic updating. `LearnEvent` increments `intelligence` for intent-driven learners. Neither constitutes adaptive strategy revision.

**Prediction.** Agents do not model the future. All decisions are memoryless: a thief does not consider retaliation; a killer does not weigh future Gini. This is a deliberate simplification.

**Sensing.** Agents cannot directly observe each other's state variables. Interactions that depend on another agent's state (KillEvent using victim's `constitution`; StealEvent reading victim's `resources`) are modeled as outcomes of the event, not as prior sensing. `getRandomOther()` selects a target without inspection.

**Interaction.** Interactions are dyadic and globally mixed (no spatial structure). Types of interaction: resource transfer (StealEvent, ChildbirthEvent cost), death (KillEvent, DisasterEvent), relationship formation/dissolution (RelationshipEvent), birth (ChildbirthEvent). The shared natural-resource pool creates implicit indirect interaction: every agent's extraction reduces what others can gather.

**Stochasticity.** All randomness uses a seeded LCG (`SeededRandom`). Sources of stochasticity: initial stat seeding, extraction order shuffle, event probability rolls (illness onset/recovery, job gain/loss, disaster trigger and victim selection, windfall, invention, enrollment, graduation, relationship, killing, stealing, childbirth). Same seed always produces identical output — reproducibility is a first-class property (ARD 005).

**Collectives.** There is one implicit collective: the living population. No formal groups, cliques, or institutions. Relationships are dyadic (`isInRelationshipWith` is a single reference), not group memberships.

**Observation.** Per-tick `TickSnapshot` records: population, death counts by cause (murder/illness/disaster/suicide), `averageResources`, `resourceGini`, `averageHappiness`, `aggregateKillingIntent`, `aggregateStealingIntent`, `naturalResources`. Every 10 ticks a `TenYearSummary` averages the window. At run end: console report via `formatEndReport` and a self-contained HTML report with Chart.js charts via `writeReportHTML`.

---

## Details

### 5. Initialization

Default: 100 agents, 100 ticks, seed 42.

**Agent seeding** (`Simulation.seed(n, rng, personTypes?)`):

| Stat | Initial distribution |
|---|---|
| `age` | uniform [15, 50) |
| `resources` | uniform [0, 100) |
| `experience` | uniform [0, min(age, EXPERIENCE_CAP)] |
| `intelligence` | uniform integer [1, 10] |
| `constitution` | uniform integer [1, 10] |
| `charisma` | uniform integer [1, 10] |
| `learningIntent` | uniform [0, 1) |
| `exerciseIntent` | uniform [0, 1) |
| `stealingIntent` | uniform [0, 0.3) |
| `lyingIntent` | uniform [0, 0.3) |
| `killingIntent` | uniform [0, 0.1) |
| `education` | age-stratified hierarchy (see below) |

Education seeding by age:
- age ≤ 17: `isWorkingOnEd = HIGH_SCHOOL` with probability 0.70; otherwise NONE.
- age 18–24: `isWorkingOnEd = BACHELORS` with probability 0.40; otherwise NONE.
- age ≥ 25: `isWorkingOnEd = NONE`; completed education seeded hierarchically: HS at 85%, then BACHELORS at 40% conditional, MASTERS at 25% conditional, PHD at 20% conditional.

**Environment initialization:**
- `naturalResources = NATURAL_RESOURCES_INITIAL` (defaults to ceiling initial; settable independently for scarcity scenarios — ARD 044)
- `naturalResourceCeiling = NATURAL_RESOURCE_CEILING_INITIAL`
- `extractionProductivity = EXTRACTION_PRODUCTIVITY_INITIAL` (1.0)
- `communityPool = 0`

When `personTypes` is supplied, `floor(n × percentage)` persons of each named type are seeded with stat ranges from that type's definition rather than the defaults above (ARD 030). Remaining persons are seeded with defaults.

All constants live in `src/Helpers/Variables.ts`. A full reference config can be generated with `npm run generate-config`.

---

### 6. Input Data

No external input data. All parameters are internal constants (`Variables.ts`) or CLI overrides (`--config path/to/config.json`). The config file deep-merges over defaults; only changed keys are required.

---

### 7. Submodels

Each event is a submodel. Parameters named below are constants in `Variables.ts`; values are calibration placeholders, not design decisions — see the referenced ARDs for rationale.

#### AgeEvent
Increments `person.age` by 1 each tick. No death check (handled by MisfortuneEvent).

#### ExperienceEvent (ARD 017)
`growth = BASE_EXPERIENCE_GROWTH + intelligence × INTELLIGENCE_EXPERIENCE_SCALAR × learningFade ± activityModifier`
Childhood attenuates growth; education and employment accelerate it; adult/elderly idleness decays it. Result clamped to `[0, EXPERIENCE_CAP]`.

#### IllnessEvent (ARD 018, recovery senescence ARD 049)
Two independent rolls per tick:
- Onset: `rng() < BASE_ILLNESS_ONSET × ageRisk / constitution` → `illness += onset amount`
- Recovery: `rng() < BASE_ILLNESS_RECOVERY × constitution / ageRisk × senescence` → `illness -= recovery amount`
`ageRisk = 1 + age / ILLNESS_AGE_RISK_DIVISOR` (linear, monotonically increasing).
`senescence = max(ILLNESS_RECOVERY_SENESCENCE_FLOOR, 1 - ILLNESS_RECOVERY_SENESCENCE_DECAY × max(0, age - ILLNESS_RECOVERY_SENESCENCE_START_AGE))` — recovery capacity declines with age so chronic illness accumulates in the old and disease carries old-age mortality (ARD 049).
`illness` clamped to `[0, 1]` after both rolls.

#### GatherResourcesEvent (ARD 011, superseded by ARD 039)
Strictly conservative:
`output = experience × (BASE_GATHER_AMOUNT + intelligence × INTELLIGENCE_GATHER_SCALAR) × extractionProductivity`
`extracted = min(output, naturalResources)`
Person gains `extracted`; pool loses `extracted` (no factor).

#### ConsumptionEvent (ARD 024)
Children with living parents pay `resources × CONSUMPTION_CHILD_RESOURCE_RATE` (starvation cannot fire while parents live — implicit subsidy). Orphaned children and adults pay `CONSUMPTION_BASE × ageMultiplier` (1.0 adult; `CONSUMPTION_ELDER_MULTIPLIER` at age ≥ `CONSUMPTION_ELDER_MIN_AGE`). Resources floor at 0; if cost > 0 and resources = 0, `STARVATION_ILLNESS_RATE` is added to illness.

#### JobEvent (ARD 020, ARD 022)
Two branches (mutually exclusive per tick):
- Gain (when unemployed): `prob = (experience × JOB_GAIN_EXPERIENCE_SCALAR + charisma × JOB_GAIN_CHARISMA_SCALAR) × ageModifier(work profile) × (1 + education × EDUCATION_JOB_GAIN_SCALAR)`
- Loss (when employed): `prob = JOB_LOSS_BASE + JOB_LOSS_STAT_SCALAR / (experience+1) / (charisma+1)`

#### RelationshipEvent (ARD 025)
Formation (when unpartnered): `prob = BASE_RELATIONSHIP_RATE × (1 + charisma × RELATIONSHIP_CHARISMA_SCALAR) × ageModifier(26, 35, 0.1)`. Draws `getRandomOther()`; fires only if target also unpartnered; mutually assigns both `isInRelationshipWith` fields.
Dissolution (when partnered): flat `BASE_BREAKUP_RATE` per tick; mutually clears both fields.
Partner death (via `Simulation.kill()`) clears the surviving partner's field.

#### ChildbirthEvent (ARD 029, ARD 037)
Fires only when both partners are living; deduplicated to the lower-index partner.
`p = BASE_CHILDBIRTH_RATE × ageModifier(coupleMaxAge, 26, 12, 0.02) × illnessFactor × resourceFactor × happinessFactor`
Couple aggregates: max illness, min resources, max age, avg happiness.
On birth: deducts `CHILDBIRTH_BIRTH_COST` from each parent (floored at 0); creates `new Person([p1, p2])`; seeds newborn stats and intents via parental heritability (ARD 037: stats regress toward `NEWBORN_STAT_POPULATION_MEAN` with strength `HERITABILITY_STAT_COEFFICIENT` plus uniform noise; intents regress toward 0 with weaker strength `HERITABILITY_INTENT_COEFFICIENT` plus noise, clamped to `[0, 1]`); calls `simulation.add(child)`.

#### KillEvent (ARD 027, ARD 035, ARD 036)
Intent gate inside `execute()` (requires simulation access for Gini and happiness).
`happinessPressure = max(0, 1 − happiness / SITUATIONAL_KILL_HAPPINESS_THRESHOLD)`
Attempt: `prob = killingIntent × ageModifier(24, 30, 0.05) × (1 + currentGini × KILL_GINI_SCALAR) × (1 + happinessPressure × SITUATIONAL_KILL_SCALAR)`
Success: `prob = KILL_SUCCESS_BASE / max(1, victim.constitution)`
On success: `simulation.kill(victim, MURDER, person)` — creates `DeathRecord` and `KillingRecord`.
Detection (after successful kill): `prob = BASE_DETECT_RATE_KILL × (1 + priorCrimes × DETECTION_CRIME_COUNT_SCALAR)`. On detection: `JAIL_RESOURCE_FORFEIT_FRACTION` of killer's resources transferred to `communityPool`; `jailedTicksRemaining += JAIL_TICKS_KILL`.

#### MisfortuneEvent (ARD 019, recalibrated ARD 049)
Two sequential checks; first cause wins:
1. Illness death: `prob = illness × ILLNESS_DEATH_SCALAR × ageMortalityModifier` (zero when illness = 0). With ARD 049 illness senescence, this is the dominant old-age cause — age-related death is disease-mediated (routes through `CAUSE_OF_DEATH.ILLNESS`, no separate "natural" cause).
2. Suicide: `prob = SUICIDE_PROBABILITY_SCALE / (happiness + 1)`. ARD 049 cut the scale ~2 orders of magnitude to realistic rates (~1–4% of deaths).

#### DisasterEvent (ARD 012)
Fires once per tick (not per agent). Trigger: `rng() < DISASTER_PROBABILITY`. Selects random subset of living up to `DISASTER_MAX_AFFECTED_FRACTION`. Per affected agent: kill check `DISASTER_KILL_BASE × ageMortalityModifier / constitution`; resource loss fraction in `[DISASTER_MIN_LOSS_FRACTION, DISASTER_MAX_LOSS_FRACTION]`.

#### EnrollmentEvent (ARD 023)
Gate: `isWorkingOnEd === NONE && education < PHD`.
`prob = BASE_ENROLLMENT_RATE × learningIntent × ageModifier(22, 40, 0.05)`
Sets `isWorkingOnEd = education + 1`.

#### GraduationEvent (ARD 021)
Gate: `isWorkingOnEd !== NONE`.
`prob = BASE_GRADUATION_RATE × ageModifier(22, 30, 0.15)`
Sets `education = isWorkingOnEd`, resets `isWorkingOnEd = NONE`, increments `intelligence` by 1.
Mutually exclusive with EnrollmentEvent in the same tick.

#### ExerciseEvent
Intent-gated: `rng() < exerciseIntent × ageModifier(24, 35, 0.1)`. Increments `constitution` by 1.

#### LearnEvent
Intent-gated: `rng() < learningIntent × ageModifier(18, 45, 0.15)`. Increments `intelligence` by 1.

#### StealEvent (ARD 026, ARD 035, ARD 036)
`resourcePressure = max(0, 1 − resources / SITUATIONAL_STEAL_RESOURCE_THRESHOLD)`
Intent-gated: `rng() < stealingIntent × (1 + charisma × STEAL_CHARISMA_SCALAR) × ageModifier(24, 30, 0.05) × (1 + resourcePressure × SITUATIONAL_STEAL_SCALAR)`.
Selects random victim; no-ops if victim null or has zero resources.
Transfers `min(victim.resources × STEAL_FRACTION, STEAL_MAX_AMOUNT)` from victim to thief. Pushes `StealingRecord`.
Detection: `prob = BASE_DETECT_RATE_STEAL × (1 + priorCrimes × DETECTION_CRIME_COUNT_SCALAR)` where `priorCrimes = amountStolen.length + killed.size`.
- Detected: forfeits `JAIL_RESOURCE_FORFEIT_FRACTION` of thief's resources to `communityPool`; `jailedTicksRemaining += JAIL_TICKS_STEAL`.
- Not detected: `stealingIntent = min(stealingIntent + STEALING_EMBOLDEN_INCREMENT, STEALING_INTENT_CAP)`.

#### JailEvent (ARD 035, ARD 041)
Replaces the normal gather/consume cycle for agents with `jailedTicksRemaining > 0`.
`granted = min(JAIL_GATHER_AMOUNT, communityPool)` is debited from `communityPool` and credited to `person.resources`. Then `JAIL_CONSUMPTION_AMOUNT` is deducted. Resources floored at 0. If jail consumption exceeds resources after gather, `STARVATION_ILLNESS_RATE` is added to illness (same path as ConsumptionEvent). When `communityPool` is empty, no gather occurs and starvation fires.

#### WindfallEvent (ARD 028, ARD 040)
Probability gate at factory: `prob = BASE_WINDFALL_RATE × ageModifier(58, 20, 0.05)`.
`drawn = WINDFALL_BASE_AMOUNT + rng() × WINDFALL_VARIANCE`; `granted = min(drawn, naturalResources)` is debited from the pool and credited to `person.resources`. When the pool is empty, the windfall yields 0.

#### InventionEvent (ARD 007, ARD 039, ARD 047)
Gate: `prob = BASE_INVENTION_RATE × intelligence × ageModifier(40, 45, 0.1)`.
Weighted random draw — one of three outcomes:
- Depletion-faster (tech boom): `extractionProductivity *= 1 + delta`, clamped at `MAX_EXTRACTION_PRODUCTIVITY`
- Depletion-slower (austerity tech): `extractionProductivity /= 1 + delta` (exact inverse of faster, so a faster/slower pair cancels — no toward-floor drift), floored at `EXTRACTION_PRODUCTIVITY_FLOOR`
- Ceiling-growth: `naturalResourceCeiling += delta × ceiling`, clamped at `MAX_NATURAL_RESOURCE_CEILING`
`delta = intelligence × INVENTION_MAGNITUDE_SCALAR`. Productivity is a bounded multiplicative random walk on `[EXTRACTION_PRODUCTIVITY_FLOOR, MAX_EXTRACTION_PRODUCTIVITY]` (ARD 047).

#### Simulation.kill — estate distribution (ARD 042)
On any death, before clearing partner reference or filtering `living`:
- Compute living children: `hasChildren.filter(c => c.causeOfDeath === null)`.
- Apply shares `(ESTATE_COMMUNITY_SHARE, ESTATE_PARTNER_SHARE, ESTATE_CHILDREN_SHARE)`. Missing-heir share consolidates to the other individual heir (partner ↔ children). With no individual heirs, the full estate goes to `communityPool`.
- Estate-zero is a no-op. Cause-blind — murder does not redirect resources to the killer.

#### Age modifier (ARD 008)
`ageModifier(age, peakAge, scale, floor) = max(floor, exp(−(age − peakAge)² / (2 × scale²)))`
Bell-curve weight applied to event probabilities. Each event has its own peak/scale/floor constants in `Variables.ts`.

#### Natural resource regeneration
`naturalResources = min(naturalResources + naturalResourceCeiling × NATURAL_RESOURCE_REGEN_FRACTION, naturalResourceCeiling)` (ARD 043)
Called once at the start of each tick before any agent events.

---

## References

- Epstein, J.M. & Axtell, R. (1996). *Growing Artificial Societies.* MIT Press.
- Grimm, V. et al. (2006). A standard protocol for describing individual-based and agent-based models. *Ecological Modelling*, 198, 115–126.
- Grimm, V. et al. (2010). The ODD protocol: A review and first update. *Ecological Modelling*, 221, 2760–2768.
- Grimm, V. et al. (2020). The ODD protocol for describing agent-based and other simulation models: A second update. *JASSS* 23(2):7.
- Motesharrei, S., Rivas, J. & Kalnay, E. (2014). Human and nature dynamics (HANDY). *Ecological Economics*, 101, 90–102.
- Turchin, P. (2003). *Historical Dynamics.* Princeton University Press.
