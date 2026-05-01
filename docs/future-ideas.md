# Future Ideas

Potential additions to the simulation that haven't been decided on yet. These are not planned work — they're candidates. When the time comes, the worthwhile ones get discussed and formalized as ARDs.

If you discover a new mechanism during implementation that could meaningfully affect the collapse/thrive dynamics, add it here with a brief note on why it matters. Don't implement it without a discussion and an ARD.

---

## Mechanics

**Randomize extraction order each tick**
Persons extract from the shared pool in `living` array order, giving a consistent positional advantage to those seeded first. Shuffling the order each tick (using the seeded RNG) would make the advantage random rather than structural, which matters once `GatherResourcesEvent` is live and the pool is finite.



**Disaster pod/proximity targeting**
ARD 012 selects disaster victims randomly from the full population. In reality, family clusters and neighbors share physical proximity and would be co-affected by local disasters. Once a proximity model exists, disaster should target a cluster rather than random individuals. See the proximity future idea below.

**Illness reduces gathering capacity**
A sick person gathers less — illness consumes energy and limits productive capacity. Currently illness only affects mortality (via `ageMortalityModifier`) and happiness. A direct penalty on gathering output (e.g. `potential *= (1 - person.illness)`) would make illness a resource drain, not just a death risk, strengthening the collapse feedback loop.

**Previous suicide attempts increase future risk**
Empirically, a prior attempt is the strongest predictor of future suicide. Currently persons have no memory of past suicidal crises. Tracking attempt history on `Person` and multiplying the base rate by an escalating factor would capture this feedback loop. Requires a new field on `Person` and a record type.

**Happiness model recalibration**
The current happiness model floors easily at 0 — unemployment plus low resources alone produces -8 before the floor. This means happiness=0 covers a wide range of situations from mildly bad to catastrophically bad, making it a coarse input for suicide probability and other happiness-driven mechanics. Consider shifting the baseline or widening the scale so ordinary hardship doesn't immediately floor.

**Voluntary cooperation / helping event**
The current event set is almost entirely extractive or destructive (stealing, killing, lying). The `helpsPeople` property exists but there's no event where a police/medical/education/research person actually does anything. Civilizations thrive through positive-sum interactions — without cooperation mechanics, the model can only show decline, not thriving.

**Education payoff on stats**
Graduation changes `isWorkingOnEd` → `education` but doesn't modify any stats. For education to affect civilizational health it needs to increase `intelligence` or unlock job types. Without a payoff, the education system is inert.

**Reputation / trust effects**
Being stolen from or lied to should raise defensive intents — either toward that specific person or generally. Currently victimization is recorded but has no behavioral consequence on the victim. Without this feedback loop there's no mechanism for antisocial behavior to degrade social cohesion over time.

## Behavioral feedback (research-grounded)

These are candidate mechanisms drawn from behavioral and social-science research, not from the current implementation roadmap. Several depend on a proximity definition (see "Social structure" below) and would need that decided first.

**Loss aversion in intent updates (Kahneman & Tversky)**
Empirically, losses weigh roughly twice as much as gains of equal size. When a person's `resources` drops sharply, antisocial intents (`stealingIntent`, `killingIntent`) should rise faster than they fall when resources recover. The current model has no feedback at all between stat changes and intent changes — adding it asymmetrically is empirically right and a strong collapse driver.

**Relative deprivation in `happiness` (Luttmer 2005; Wilkinson & Pickett)**
Happiness depends on resources relative to peers, not absolute level — neighbors' income measurably reduces own life satisfaction. The Gini exists at the simulation level but no individual perceives it. A `(myResources - localMedian) / localMedian` term inside `happiness` makes inequality directly costly to wellbeing rather than only correlated with collapse via Gini. Requires a proximity definition for "local."

**Hedonic adaptation on resources (Easterlin; Kahneman-Deaton)**
Happiness from resources should be log-shaped, not linear — diminishing returns above subsistence. Without this, wealthy persons accumulate unbounded happiness and the model can't reproduce the empirical decoupling of resource accumulation from life satisfaction.

**Generalized trust as a per-person stat (Putnam; Knack & Keefer)**
Generalized trust is the social-capital variable that empirically predicts cooperation and growth more robustly than wealth. A per-person trust score, damaged by appearing in another person's `StealingRecord`/`KillingRecord` victim list and slowly restored by neutral interactions, would gate whether positive-sum events fire. Without it, antisocial behavior has no second-order cost on the social fabric.

**Strain theory: aspiration–means gap (Agnew, general strain theory)**
Crime correlates more strongly with the gap between expected and actual outcomes than with absolute poverty. A person whose `resources` falls short of the median for their age/education cohort gets a `stealingIntent` boost. Different from loss aversion: it's about reference class, not personal trajectory. The original Merton formulation is contested; the aspiration–means gap mechanism in Agnew's general strain theory is the defensible core. Requires a proximity definition for the reference cohort.

**Altruistic punishment (Fehr & Gächter)**
In public-goods experiments, cooperation collapses without punishment of defectors and is sustained when punishment is available, even at cost to the punisher. A `punish` event where a person spends resources to harm someone in their `KillingRecord`/`StealingRecord` history — possibly gated by trust or in-group membership — provides a counter-pressure to antisocial intents that nothing in the current roadmap supplies except death.

**Intergenerational transmission of intents (Bandura; behavioral genetics)**
The `new Person([p1, p2])` constructor takes parent references but inherits nothing from them. Twin and adoption studies put heritability of many behavioral dispositions in the 0.3–0.5 range; social-learning research adds substantial parental influence on top. Children's starting intents drawn near a parental mean (with noise) is the minimal version. Without inheritance, every generation re-rolls the cultural slate and path-dependent cultural drift becomes impossible.

**Threshold heterogeneity for cascades (Granovetter)**
Each person has an individual threshold for joining an antisocial behavior based on observed prevalence, drawn from a distribution at seed. Captures empirical tipping points (riots, norm collapse) that uniform reactivity cannot. Requires a definition of "observed" — i.e., proximity.

**Bereavement / exposure-to-death effect**
Persons who experience deaths in their vicinity (network or recent ticks) shift toward lower risk-taking and stronger in-group preference. Connects the existing death stream to surviving behavior instead of letting deaths be invisible to the rest of the population. The strict Terror Management Theory priming literature has had replication failures, but the broader bereavement / mortality-exposure effect on survivor behavior is well-supported. Requires a proximity definition.

## Social structure

**Proximity (Tobler; Festinger propinquity; Christakis & Fowler contagion)**
Many of the mechanisms above are empirically *local*, not global — relative deprivation works against neighbors, behavioral contagion travels along network edges, threshold cascades depend on visible peers, mortality exposure scales with nearby vs. distant deaths. The current model has no proximity structure of any kind. Three plausible shapes, cheapest to costliest:

1. **Coarse neighborhood label** — assign each person to one of M groups at seed; proximate = same label. Unlocks in-group bias, local norm drift, local comparison. Doesn't capture distance gradients. Cheapest.
2. **Social graph** — explicit edges (kin via existing parent refs, plus relationships and work ties accumulated during the run). Matches Dunbar / Christakis-Fowler literature directly. Memory O(N·k).
3. **2D spatial grid** (Sugarscape proper) — persons have coordinates; resource pool can localize too. Heaviest lift; changes many event signatures.

Recording as a single decision point because relative deprivation, threshold cascades, the bereavement effect, and contagion-style intent drift all require *some* proximity definition to be implementable.

**Dunbar-bounded social cognition**
Cognitive cap on stable relationships (~150 in the original argument; the exact number is contested, but the bounded-cognition principle is robust). Distinct from proximity — proximity is *which* others are near, Dunbar is *how many* a person can track. They compose: a person maintains ~150 ties, and which 150 is shaped by proximity. Worth keeping as a separate decision because the graph version of proximity makes them separable (edge-count cap = Dunbar; edge-formation rule = proximity), while the neighborhood-label version blurs them.

## Research / Output

**Multiple simulation runs with comparison**
To study variability in outcomes, you need to run N simulations with different seeds and compare their `history` arrays. Requires deciding how `LooperSingleton` exposes results across runs.

**Termination conditions**
When does a run stop? Options: fixed tick count, population hits zero, collapse detected (Gini exceeds threshold + population declining for N ticks), or manual. Affects `LooperSingleton.start()` signature.

**Seeding strategy as experimental variable**
The starting distribution of stats and intents is the independent variable in the experiment. Needs to be parameterizable so you can ask "what happens when a population starts with high `killingIntent` vs. low?" Requires a configurable `Simulation.seed()` interface.

## Discarded

Ideas that were considered and rejected without rising to ARD-level discussion. Each entry: name, the date it was dropped, and a one-sentence reason — e.g., "subsumed by ARD 00X," "not enough collapse/thrive signal," "operationally indistinguishable from <other mechanism>." Decisions formal enough to merit an ARD belong in `docs/decisions/` instead.

_(none yet)_
