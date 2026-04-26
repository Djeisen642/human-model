# Future Ideas

Potential additions to the simulation that haven't been decided on yet. These are not planned work — they're candidates. When the time comes, the worthwhile ones get discussed and formalized as ARDs.

If you discover a new mechanism during implementation that could meaningfully affect the collapse/thrive dynamics, add it here with a brief note on why it matters. Don't implement it without a discussion and an ARD.

---

## Mechanics

**Voluntary cooperation / helping event**
The current event set is almost entirely extractive or destructive (stealing, killing, lying). The `helpsPeople` property exists but there's no event where a police/medical/education/research person actually does anything. Civilizations thrive through positive-sum interactions — without cooperation mechanics, the model can only show decline, not thriving.

**Education payoff on stats**
Graduation changes `isWorkingOnEd` → `education` but doesn't modify any stats. For education to affect civilizational health it needs to increase `intelligence` or unlock job types. Without a payoff, the education system is inert.

**Reputation / trust effects**
Being stolen from or lied to should raise defensive intents — either toward that specific person or generally. Currently victimization is recorded but has no behavioral consequence on the victim. Without this feedback loop there's no mechanism for antisocial behavior to degrade social cohesion over time.

## Research / Output

**Multiple simulation runs with comparison**
To study variability in outcomes, you need to run N simulations with different seeds and compare their `history` arrays. Requires deciding how `LooperSingleton` exposes results across runs.

**Termination conditions**
When does a run stop? Options: fixed tick count, population hits zero, collapse detected (Gini exceeds threshold + population declining for N ticks), or manual. Affects `LooperSingleton.start()` signature.

**Seeding strategy as experimental variable**
The starting distribution of stats and intents is the independent variable in the experiment. Needs to be parameterizable so you can ask "what happens when a population starts with high `killingIntent` vs. low?" Requires a configurable `Simulation.seed()` interface.
