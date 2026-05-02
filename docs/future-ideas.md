# Future Ideas

Potential additions to the simulation that haven't been decided on yet. These are not planned work — they're candidates. When the time comes, the worthwhile ones get discussed and formalized as ARDs.

If you discover a new mechanism during implementation that could meaningfully affect the collapse/thrive dynamics, add it here with a brief note on why it matters. Don't implement it without a discussion and an ARD.

Ideas are grouped by priority. The grouping is a working judgment, not a commitment — promote, demote, or split items as the model evolves. Within each tier, the original category labels (Mechanics / Behavioral feedback / Social structure / Research / Output) are preserved.

---

## Required for completion

The bar: without this, the model can't answer its own research question (collapse vs. thriving), or it has a known bug that will surface once a planned event is wired in.

### Mechanics

**Newborn initial stat seeding**
When childbirth is implemented, `new Person([p1, p2])` produces a person with `constitution = 0` and all other stats at 0. `DisasterEvent` divides by `constitution`, so a newborn with constitution 0 would trigger a division-by-zero kill. Childbirth must seed initial stats (possibly inheriting from parents per the intergenerational transmission idea) before the person is added to the living population.

**Voluntary cooperation / helping event**
The current event set is almost entirely extractive or destructive (stealing, killing, lying). The `helpsPeople` property exists but there's no event where a police/medical/education/research person actually does anything. Civilizations thrive through positive-sum interactions — without cooperation mechanics, the model can only show decline, not thriving.

**Education payoff on stats**
Graduation changes `isWorkingOnEd` → `education` but doesn't modify any stats. For education to affect civilizational health it needs to increase `intelligence` or unlock job types. Without a payoff, the education system is inert.

**Reputation / trust effects**
Being stolen from or lied to should raise defensive intents — either toward that specific person or generally. Currently victimization is recorded but has no behavioral consequence on the victim. Without this feedback loop there's no mechanism for antisocial behavior to degrade social cohesion over time. (The richer "Generalized trust" version below subsumes this — pick one form before implementing.)

**Randomize extraction order each tick**
Persons extract from the shared pool in `living` array order, giving a consistent positional advantage to those seeded first. Shuffling the order each tick (using the seeded RNG) would make the advantage random rather than structural, which matters once `GatherResourcesEvent` is live and the pool is finite. (It is live — this is a current bias polluting Gini measurements.)

**Resource consumption / cost of living**
Resources currently only move up (gather) or down (disaster). No subsistence drain per tick. A person who never works stays at `resources = 0` indefinitely with no consequence; a worker accumulates without bound. Most collapse theories begin with subsistence shortfall — without per-tick consumption (possibly age-dependent, with starvation when resources hit zero) the model can't actually exhibit resource-driven collapse, only inequality-driven and disaster-driven collapse.

**Long-term environmental drift**
`naturalResourceCeiling` is fixed at seed and the pool regenerates back to it each tick. Tainter and Diamond collapse theories hinge on declining carrying capacity — soil exhaustion, climate shift, over-extraction degrading the regenerative substrate. Options: ceiling drifts down stochastically, ceiling decays as a function of cumulative extraction, or `NATURAL_RESOURCE_REGEN_RATE` itself drifts. Without some form of drift, the pool is a stationary background — incompatible with the model's collapse framing.

**Stat caps and age-based decay**
`constitution` and `intelligence` only ever increment (`ExerciseEvent`, `LearnEvent`); there is no cap and no decay. A 90-year-old who exercised every year has constitution well above what's plausible, and `DisasterEvent` divides by it — making lifelong exercisers near-immortal in disasters. Needs caps (per-stat ceiling), and probably age-based decay above some threshold so the U-shaped mortality curve is reinforced by stat decline rather than fighting it.

**Job income mechanics**
The planned `Job` event is in CLAUDE.md but its resource flow is unspecified. Is having a job additive to `GatherResourcesEvent` (jobs produce on top of gathering)? Replacing (employed people don't gather, they earn)? Multiplicative (jobs scale gathering output)? This is a design decision that has to be made *before* the Job event can be implemented, not a future idea — flagging here so it doesn't get answered ad hoc inside the implementation.

### Research / Output

**Termination conditions**
When does a run stop? Options: fixed tick count, population hits zero, collapse detected (Gini exceeds threshold + population declining for N ticks), or manual. Affects `LooperSingleton.start()` signature. Required to actually claim a run reached "collapse" or "thriving" rather than just ran out of ticks.

---

## Very useful

The bar: meaningfully sharpens the collapse/thrive signal or the experimental setup, but the model can produce defensible results without it.

### Mechanics

**Resource inheritance on death**
When a person dies, their `resources` currently vanish — they are tracked on the person object but never redistributed. Inheritance (children or relatives receive a fraction) or estate taxes (a portion flows to a shared pool) would give accumulated wealth a second-order effect on Gini: concentrated wealth passed intact to heirs steepens inequality, while redistribution dampens it. The current design loses this signal entirely.

**Illness reduces gathering capacity**
A sick person gathers less — illness consumes energy and limits productive capacity. Currently illness only affects mortality (via `ageMortalityModifier`) and happiness. A direct penalty on gathering output (e.g. `potential *= (1 - person.illness)`) would make illness a resource drain, not just a death risk, strengthening the collapse feedback loop.

**Contagious illness / epidemic spread**
`MisfortuneEvent` rolls illness mortality independently per person each tick. Real epidemics propagate through contact and have historically driven civilizational collapse (Black Death, Antonine Plague, Columbian exchange). A spread mechanism — base rate plus a contagion term proportional to the share of currently-ill neighbors — would let outbreaks emerge endogenously. Requires either a proximity model (preferred) or a coarser global-mixing assumption as a stopgap. Depends on `person.illness` being a live, mutable state rather than the dead field it is today.

**Resource pooling in relationships**
`isInRelationshipWith` is a flag with no economic consequence; partners' resources stay strictly individual. Real households share a budget — pooled income, joint consumption, joint vulnerability to disaster. Pooling affects Gini directly (pair-level inequality is lower than individual-level) and changes household resilience. Decision: pool fully, partial, or treat the household as the economic unit (which has implications for how `Person.resources` is used elsewhere).

### Behavioral feedback (research-grounded)

**Loss aversion in intent updates (Kahneman & Tversky)**
Empirically, losses weigh roughly twice as much as gains of equal size. When a person's `resources` drops sharply, antisocial intents (`stealingIntent`, `killingIntent`) should rise faster than they fall when resources recover. The current model has no feedback at all between stat changes and intent changes — adding it asymmetrically is empirically right and a strong collapse driver.

**Hedonic adaptation on resources (Easterlin; Kahneman-Deaton)**
Happiness from resources should be log-shaped, not linear — diminishing returns above subsistence. Without this, wealthy persons accumulate unbounded happiness and the model can't reproduce the empirical decoupling of resource accumulation from life satisfaction.

**Relative deprivation in `happiness` (Luttmer 2005; Wilkinson & Pickett)**
Happiness depends on resources relative to peers, not absolute level — neighbors' income measurably reduces own life satisfaction. The Gini exists at the simulation level but no individual perceives it. A `(myResources - localMedian) / localMedian` term inside `happiness` makes inequality directly costly to wellbeing rather than only correlated with collapse via Gini. Requires a proximity definition for "local."

**Generalized trust as a per-person stat (Putnam; Knack & Keefer)**
Generalized trust is the social-capital variable that empirically predicts cooperation and growth more robustly than wealth. A per-person trust score, damaged by appearing in another person's `StealingRecord`/`KillingRecord` victim list and slowly restored by neutral interactions, would gate whether positive-sum events fire. Without it, antisocial behavior has no second-order cost on the social fabric. (Richer version of "Reputation / trust effects" above.)

**Altruistic punishment (Fehr & Gächter)**
In public-goods experiments, cooperation collapses without punishment of defectors and is sustained when punishment is available, even at cost to the punisher. A `punish` event where a person spends resources to harm someone in their `KillingRecord`/`StealingRecord` history — possibly gated by trust or in-group membership — provides a counter-pressure to antisocial intents that nothing in the current roadmap supplies except death.

**Intergenerational transmission of intents (Bandura; behavioral genetics)**
The `new Person([p1, p2])` constructor takes parent references but inherits nothing from them. Twin and adoption studies put heritability of many behavioral dispositions in the 0.3–0.5 range; social-learning research adds substantial parental influence on top. Children's starting intents drawn near a parental mean (with noise) is the minimal version. Without inheritance, every generation re-rolls the cultural slate and path-dependent cultural drift becomes impossible.

### Social structure

**Proximity (Tobler; Festinger propinquity; Christakis & Fowler contagion)**
Many of the mechanisms above are empirically *local*, not global — relative deprivation works against neighbors, behavioral contagion travels along network edges, threshold cascades depend on visible peers, mortality exposure scales with nearby vs. distant deaths. The current model has no proximity structure of any kind. Three plausible shapes, cheapest to costliest:

1. **Coarse neighborhood label** — assign each person to one of M groups at seed; proximate = same label. Unlocks in-group bias, local norm drift, local comparison. Doesn't capture distance gradients. Cheapest.
2. **Social graph** — explicit edges (kin via existing parent refs, plus relationships and work ties accumulated during the run). Matches Dunbar / Christakis-Fowler literature directly. Memory O(N·k).
3. **2D spatial grid** (Sugarscape proper) — persons have coordinates; resource pool can localize too. Heaviest lift; changes many event signatures.

Recording as a single decision point because relative deprivation, threshold cascades, the bereavement effect, and contagion-style intent drift all require *some* proximity definition to be implementable.

### Research / Output

**Multiple simulation runs with comparison**
To study variability in outcomes, you need to run N simulations with different seeds and compare their `history` arrays. Requires deciding how `LooperSingleton` exposes results across runs.

**Seeding strategy as experimental variable**
The starting distribution of stats and intents is the independent variable in the experiment. Needs to be parameterizable so you can ask "what happens when a population starts with high `killingIntent` vs. low?" Requires a configurable `Simulation.seed()` interface.

---

## Might be droppable

The bar: niche, dependent on heavier infrastructure that may not arrive, or substantially overlapping a higher-tier idea.

### Mechanics

**Disaster pod/proximity targeting**
ARD 012 selects disaster victims randomly from the full population. In reality, family clusters and neighbors share physical proximity and would be co-affected by local disasters. Once a proximity model exists, disaster should target a cluster rather than random individuals. (Refinement of an existing mechanic; only meaningful if proximity is built and even then the random-victim model already produces clustered loss in aggregate.)

**Previous suicide attempts increase future risk**
Empirically, a prior attempt is the strongest predictor of future suicide. Currently persons have no memory of past suicidal crises. Tracking attempt history on `Person` and multiplying the base rate by an escalating factor would capture this feedback loop. Requires a new field on `Person` and a record type. (Niche — suicide is already in MisfortuneEvent; the second-order amplification is unlikely to swing collapse/thrive verdicts.)

### Behavioral feedback (research-grounded)

**Strain theory: aspiration–means gap (Agnew, general strain theory)**
Crime correlates more strongly with the gap between expected and actual outcomes than with absolute poverty. A person whose `resources` falls short of the median for their age/education cohort gets a `stealingIntent` boost. Different from loss aversion: it's about reference class, not personal trajectory. The original Merton formulation is contested; the aspiration–means gap mechanism in Agnew's general strain theory is the defensible core. Requires a proximity definition for the reference cohort. (Substantially overlaps with relative deprivation in `happiness` — both compare self to a local reference. If relative deprivation is in, the marginal collapse signal here is small.)

**Threshold heterogeneity for cascades (Granovetter)**
Each person has an individual threshold for joining an antisocial behavior based on observed prevalence, drawn from a distribution at seed. Captures empirical tipping points (riots, norm collapse) that uniform reactivity cannot. Requires a definition of "observed" — i.e., proximity. (At ~100-person populations the tipping-point dynamics may not be visible; arguably interesting only if population scale grows.)

**Bereavement / exposure-to-death effect**
Persons who experience deaths in their vicinity (network or recent ticks) shift toward lower risk-taking and stronger in-group preference. Connects the existing death stream to surviving behavior instead of letting deaths be invisible to the rest of the population. The strict Terror Management Theory priming literature has had replication failures, but the broader bereavement / mortality-exposure effect on survivor behavior is well-supported. Requires a proximity definition. (Niche behavioral nuance; depends on proximity and on having a meaningful death stream that survivors can observe.)

### Social structure

**Dunbar-bounded social cognition**
Cognitive cap on stable relationships (~150 in the original argument; the exact number is contested, but the bounded-cognition principle is robust). Distinct from proximity — proximity is *which* others are near, Dunbar is *how many* a person can track. They compose: a person maintains ~150 ties, and which 150 is shaped by proximity. Worth keeping as a separate decision because the graph version of proximity makes them separable (edge-count cap = Dunbar; edge-formation rule = proximity), while the neighborhood-label version blurs them. (At the model's current ~100-person scale the cap never binds; only relevant if simulation populations grow well past 150.)

---

## Discarded

Ideas that were considered and rejected without rising to ARD-level discussion. Each entry: name, the date it was dropped, and a one-sentence reason — e.g., "subsumed by ARD 00X," "not enough collapse/thrive signal," "operationally indistinguishable from <other mechanism>." Decisions formal enough to merit an ARD belong in `docs/decisions/` instead.

_(none yet)_
