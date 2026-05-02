# Future Ideas

Candidates for the simulation, not planned work. Worthwhile ones get formalized as ARDs when their time comes.

If you discover a new mechanism during implementation that could meaningfully affect collapse/thrive dynamics, add it here with a one-sentence note on why it matters. Don't implement without an ARD.

Items are grouped by priority — a working judgment, not a commitment. Promote, demote, or split as the model evolves. Within each tier, original category labels (Mechanics / Behavioral feedback / Social structure / Research / Output) are preserved.

---

## Required for completion

The model can't answer collapse vs. thriving without these, or has a known bug surfacing once a planned event lands.

### Mechanics

**Newborn initial stat seeding**
`new Person([p1, p2])` produces `constitution = 0`; `DisasterEvent` and `IllnessEvent` divide by it, so a newborn would crash or be killed instantly. Childbirth must seed initial stats (possibly inheriting from parents, see "Intergenerational transmission") before adding the person.

**Voluntary cooperation / helping event**
The current event set is extractive or destructive. `helpsPeople` exists but no event uses it. Without positive-sum interactions, the model can only show decline, not thriving.

**Education payoff on stats**
Graduation flips `isWorkingOnEd` → `education` but changes no stats. Without a payoff (e.g., `intelligence` boost or job unlock), education is inert.

**Reputation / trust effects**
Victimization is recorded but has no behavioral consequence on the victim. Without a feedback loop, antisocial behavior can't degrade social cohesion. (The "Generalized trust" version below subsumes this — pick one.)

**Randomize extraction order each tick**
Persons extract from the shared pool in `living` array order, giving a structural advantage to those seeded first. Shuffle each tick using the seeded RNG. This is a live bias polluting Gini today.

**Resource consumption / cost of living**
Resources only move up (gather) or down (disaster); no subsistence drain. A non-worker stays at 0 forever; a worker accumulates without bound. Most collapse theories start with subsistence shortfall — without per-tick consumption (and starvation at zero), the model can't exhibit resource-driven collapse.

**Long-term environmental drift**
`naturalResourceCeiling` is fixed; the pool always regenerates back to it. Tainter/Diamond collapse hinges on declining carrying capacity (soil exhaustion, climate shift). Options: ceiling drifts down stochastically, decays with cumulative extraction, or `NATURAL_RESOURCE_REGEN_RATE` itself drifts.

**Stat caps and age-based decay**
`constitution` and `intelligence` only increment. A 90-year-old who exercised yearly has runaway constitution, and `DisasterEvent` divides by it — making lifelong exercisers near-immortal. Need caps and probably age-based decay reinforcing the U-shaped mortality curve.

**Job income mechanics**
The planned `Job` event's resource flow is unspecified — additive to gather, replacement, or multiplicative? A design decision required before Job can be implemented; flagging here so it isn't answered ad hoc.

### Research / Output

**Termination conditions**
Currently a fixed tick count. Need population=0, collapse-detected (Gini threshold + declining population over N ticks), or manual options to claim "collapse" vs. "ran out of ticks."

---

## Very useful

Sharpens the collapse/thrive signal or experimental setup, but the model can produce defensible results without it.

### Mechanics

**Resource inheritance on death**
Dead persons' `resources` vanish. Inheritance (heirs receive a fraction) or estate taxes (a portion to a shared pool) gives accumulated wealth a second-order effect on Gini — concentrated wealth steepens inequality, redistribution dampens it.

**Illness reduces gathering capacity**
Illness currently affects only mortality and happiness. Adding `potential *= (1 - person.illness)` makes illness a resource drain too, strengthening the collapse loop.

**Contagious illness / epidemic spread**
`MisfortuneEvent` rolls illness mortality independently per person. Real epidemics propagate by contact and have driven historical collapses. Add a contagion term proportional to the share of nearby ill. Requires a proximity model (preferred) or global mixing as a stopgap. Depends on `person.illness` being live (ARD 018).

**Resource pooling in relationships**
`isInRelationshipWith` is a flag with no economic consequence. Households pool income and consumption — pooling lowers measured inequality and changes household resilience. Decision: pool fully, partially, or treat the household as the economic unit.

### Behavioral feedback (research-grounded)

**Loss aversion in intent updates (Kahneman & Tversky)**
Losses weigh ~2× gains of equal size. When `resources` drops, antisocial intents should rise faster than they fall when resources recover. The model has no stat→intent feedback today — adding it asymmetrically is empirically right and a strong collapse driver.

**Hedonic adaptation on resources (Easterlin; Kahneman-Deaton)**
Happiness from resources should be log-shaped, not linear. Without diminishing returns, wealthy persons accumulate unbounded happiness — contradicts the empirical decoupling of wealth from life satisfaction.

**Relative deprivation in `happiness` (Luttmer; Wilkinson & Pickett)**
Happiness depends on resources relative to peers. A `(myResources - localMedian) / localMedian` term makes inequality directly costly to wellbeing rather than only correlated via Gini. Requires a proximity definition.

**Generalized trust as a per-person stat (Putnam)**
Per-person trust score, damaged by appearing in others' StealingRecord/KillingRecord and slowly restored by neutral interactions. Gates positive-sum events. (Richer version of "Reputation / trust effects" above.)

**Altruistic punishment (Fehr & Gächter)**
A `punish` event where a person spends resources to harm someone in their KillingRecord/StealingRecord history — possibly gated by trust. Provides counter-pressure to antisocial intents that the current roadmap supplies only via death.

**Intergenerational transmission of intents (Bandura)**
`new Person([p1, p2])` ignores parents. Heritability for behavioral dispositions is 0.3–0.5 (twin/adoption studies); social learning adds parental influence. Children's starting intents drawn near a parental mean (with noise) is the minimal version. Without it, every generation re-rolls the cultural slate.

### Social structure

**Proximity (Tobler; Christakis & Fowler contagion)**
Many of the mechanisms above are local, not global — relative deprivation, contagion, threshold cascades, mortality exposure. The model has no proximity. Three shapes, cheapest to costliest:

1. **Coarse neighborhood label** — assign each person to one of M groups at seed; same label = proximate. Unlocks in-group bias, local norm drift, local comparison.
2. **Social graph** — explicit edges (kin, relationships, work ties). Matches Dunbar / Christakis-Fowler. Memory O(N·k).
3. **2D spatial grid** — coordinates per person; pool can localize. Heaviest; changes many event signatures.

Single decision point because relative deprivation, threshold cascades, bereavement, and contagion all need *some* proximity to be implementable.

### Research / Output

**Multiple simulation runs with comparison**
Run N simulations with different seeds, compare `history` arrays. Requires deciding how `LooperSingleton` exposes results across runs.

**Seeding strategy as experimental variable**
Starting stat/intent distributions are the experiment's independent variable. Needs a parameterizable `Simulation.seed()` interface.

**Profile-based population seeding**
Compose populations from named archetypes — `killer` (high `killingIntent`, low `charisma`), `unhappy`, `scholar`, `drifter`. Experiments specified as mixes ("80/10/10"). More expressive than tuning per-stat distributions globally; lets you ask "above what fraction of killers does Gini collapse?" Refines the broader seeding-as-variable idea above.

**Extinction as a distinct outcome label**
Total extinction (population=0) is classified as COLLAPSE. The end report still prints "Trend: falling" for Gini — technically true, but reads like inequality improved rather than everyone dying. Add an EXTINCTION label or a `formatEndReport` callout when `endPopulation === 0`. Observed in seed 42 default run.

**Partial-decade summary at run end**
When `ticks` isn't a multiple of 10, the final N (N < 10) ticks have no `TenYearSummary`. `formatEndReport` uses the last full decade, which may be stale by up to 9 ticks. Build a partial-window summary at the actual end tick.

---

## Might be droppable

Niche, dependent on heavier infrastructure, or substantially overlapping a higher-tier idea.

### Mechanics

**Disaster pod/proximity targeting**
ARD 012 selects disaster victims randomly from the full population. Real disasters affect physical clusters. Refinement of an existing mechanic; only meaningful with proximity built, and even then the random-victim model already produces clustered loss in aggregate.

**Previous suicide attempts increase future risk**
A prior attempt is the strongest empirical predictor of future suicide. Persons currently have no memory of past crises. Niche — suicide is already in MisfortuneEvent; the second-order amplification is unlikely to swing collapse/thrive verdicts.

### Behavioral feedback (research-grounded)

**Strain theory: aspiration–means gap (Agnew)**
A person whose `resources` falls short of their age/education cohort median gets a `stealingIntent` boost. Distinct from loss aversion (reference class, not personal trajectory). Substantially overlaps with relative deprivation in `happiness` — if that's in, the marginal signal here is small.

**Threshold heterogeneity for cascades (Granovetter)**
Per-person threshold for joining antisocial behavior based on observed prevalence. Captures riots / norm collapse tipping points. At ~100-person populations the dynamics may not be visible; arguably interesting only at larger scale.

**Bereavement / exposure-to-death effect**
Persons who experience nearby deaths shift toward lower risk-taking and stronger in-group preference. Connects the existing death stream to surviving behavior. Niche; depends on proximity. (TMT priming literature has replication issues, but the broader bereavement effect is well-supported.)

### Social structure

**Dunbar-bounded social cognition**
Cognitive cap on stable relationships (~150 in the original argument). Distinct from proximity (which others are near vs. how many a person can track). At the current ~100-person scale the cap never binds; relevant only if simulations grow well past 150.

---

## Discarded

Considered and rejected without rising to ARD-level discussion. Each entry: name, date dropped, one-sentence reason. Decisions formal enough to merit an ARD belong in `docs/decisions/` instead.

_(none yet)_
