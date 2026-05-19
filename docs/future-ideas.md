# Future Ideas

Candidates for the simulation, not planned work. Worthwhile ones get formalized as ARDs when their time comes.

If you discover a new mechanism during implementation that could meaningfully affect collapse/thrive dynamics, add it here with a one-sentence note on why it matters. Don't implement without an ARD.

Items are grouped by priority — a working judgment, not a commitment. Promote, demote, or split as the model evolves. Within each tier, original category labels (Mechanics / Behavioral feedback / Social structure / Research / Output) are preserved.

---

## High priority

Known correctness issues that can produce degenerate outcomes — runaway values, thrive-lock, or collapse-lock — before the collapse/thrive signal has time to develop. Should be addressed before drawing conclusions from long runs.

### Mechanics

**Stat caps and age-based decay**
`constitution` and `intelligence` only increment. A 90-year-old who exercised yearly has runaway constitution, and `DisasterEvent` divides by it — making lifelong exercisers near-immortal. Need caps and probably age-based decay reinforcing the U-shaped mortality curve.

**InventionEvent: unbounded extractionProductivity upper end**
The depletion-faster branch multiplies `extractionProductivity` with no cap. With `intelligence=10` (`delta=0.5`), a few sequential inventions push productivity high enough to drain the pool in a handful of ticks, collapsing the simulation regardless of other factors. Needs a `MAX_EXTRACTION_PRODUCTIVITY` constant or a diminishing-returns multiplier.

**InventionEvent: unbounded ceiling growth (thrive-lock)**
Repeated ceiling-growth inventions compound — `ceiling *= (1 + delta)` effectively. After ARD 043 ceiling growth also drives regen, so runaway ceiling can permanently eliminate scarcity. A `MAX_NATURAL_RESOURCE_CEILING` cap or diminishing-returns multiplier would preserve the collapse-via-depletion pathway.

**InventionEvent: asymmetric faster/slower compounding**
After N faster and N slower outcomes, `efficiency * (1+d)^N * (1-d)^N = efficiency * (1-d²)^N`. Paired outcomes don't cancel — efficiency drifts toward 0.01 over time. Creates a slow resource-saving bias that wasn't in ARD 007; may be desirable or unintended, but should be a deliberate choice.

---

## Very useful

Sharpens the collapse/thrive signal or experimental setup, but does not cause degenerate outcomes on its own.

### Mechanics

**Long-term environmental drift**
`naturalResourceCeiling` only grows (via invention); the pool always regenerates back to ceiling × fraction. Tainter/Diamond collapse hinges on declining carrying capacity (soil exhaustion, climate shift). Options: ceiling drifts down stochastically, decays with cumulative extraction, or `NATURAL_RESOURCE_REGEN_FRACTION` itself drifts.

**Termination conditions**
Currently a fixed tick count. Worth adding: population=0 (already fires EXTINCTION but doesn't halt early), collapse-detected (Gini threshold + declining population over N ticks), or a flag to halt when outcome is determined rather than running to the end.

**Resource inheritance on death**
Dead persons' `resources` vanish. Inheritance (heirs receive a fraction) or estate taxes (a portion to a shared pool) gives accumulated wealth a second-order effect on Gini — concentrated wealth steepens inequality, redistribution dampens it.

**Illness reduces gathering capacity**
Illness currently affects only mortality and happiness. Adding `potential *= (1 - person.illness)` makes illness a resource drain too, strengthening the collapse loop.

**Contagious illness / epidemic spread**
`MisfortuneEvent` rolls illness mortality independently per person. Real epidemics propagate by contact and have driven historical collapses. Add a contagion term proportional to the share of nearby ill. Requires a proximity model (preferred) or global mixing as a stopgap. Depends on `person.illness` being live (ARD 018).

**Resource pooling in relationships**
`isInRelationshipWith` is a flag with no economic consequence. Households pool income and consumption — pooling lowers measured inequality and changes household resilience. Decision: pool fully, partially, or treat the household as the economic unit.

### Behavioral feedback (research-grounded)

**Stress-weighted dissolution**
`BASE_BREAKUP_RATE` in ARD 025 is flat because there is no calibration anchor for how much of the empirical 3%/yr rate is baseline vs. economically-driven. Economic stress and financial disagreement are the strongest documented predictors of real-world partnership dissolution. A Gini- or resource-relative term would create a direct feedback loop: high inequality → more breakups → lower happiness → higher MisfortuneEvent mortality. Add once the flat-rate model produces enough sim data to observe whether dissolution rates actually correlate with Gini runs.

**Desistance: intent decay from stable conditions (Sampson & Laub)**
ARD 036 adds emboldening (permanent `stealingIntent` increase per undetected theft) but no counter-mechanism. Empirically, criminal careers peak and then decline as people age, form stable relationships, and gain employment. Intent decay tied to employment, partnership duration, or age would complete the arc and prevent emboldened persons from remaining at peak criminal propensity indefinitely.

**Hedonic adaptation on resources (Easterlin; Kahneman-Deaton)**
Happiness from resources should be log-shaped, not linear. Without diminishing returns, wealthy persons accumulate unbounded happiness — contradicts the empirical decoupling of wealth from life satisfaction.

**Relative deprivation in `happiness` (Luttmer; Wilkinson & Pickett)**
Happiness depends on resources relative to peers. A `(myResources - localMedian) / localMedian` term makes inequality directly costly to wellbeing rather than only correlated via Gini. Requires a proximity definition.

**Generalized trust as a per-person stat (Putnam)**
Victimization is currently recorded but has no behavioral consequence on the victim — antisocial behavior can't degrade social cohesion. A per-person trust score damaged by appearing in others' StealingRecord/KillingRecord and slowly restored by neutral interactions would close that loop and gate positive-sum events.

### Social structure

**Proximity (Tobler; Christakis & Fowler contagion)**
Many of the mechanisms above are local, not global — relative deprivation, contagion, threshold cascades, mortality exposure. The model has no proximity. Three shapes, cheapest to costliest:

1. **Coarse neighborhood label** — assign each person to one of M groups at seed; same label = proximate. Unlocks in-group bias, local norm drift, local comparison.
2. **Social graph** — explicit edges (kin, relationships, work ties). Matches Dunbar / Christakis-Fowler. Memory O(N·k).
3. **2D spatial grid** — coordinates per person; pool can localize. Heaviest; changes many event signatures.

Single decision point because relative deprivation, threshold cascades, bereavement, and contagion all need *some* proximity to be implementable.

### Research / Output

**Multi-tier execution modes**
Three execution tiers behind a common `SimulationEngine` interface: (1) current OOP loop — easy to step through and inspect; (2) CPU performance mode using `Float32Array` stride layout — same logic, flat data, faster iteration, still debuggable via index arithmetic; (3) WebGPU compute mode — agents packed into GPU storage buffers, logic ported to WGSL shaders, orders-of-magnitude throughput for population sizes the CPU loop can't sustain. The interface contract is same-seed → same outcomes; a parity check against the reference engine validates each new tier. Requires an ARD to fix the memory layout (stride, field alignment), the PRNG strategy (per-agent seeding on GPU vs. shared state on CPU), and how relation fields (`killed[]`, `hasChildren[]`) that can't fit in a flat buffer are handled. Value is unlocking population scales where emergence and tipping-point dynamics become statistically observable.

**Multiple simulation runs with comparison**
Run N simulations with different seeds, compare `history` arrays. Requires deciding how `LooperSingleton` exposes results across runs.

---

## Might be droppable

Niche, dependent on heavier infrastructure, or substantially overlapping a higher-tier idea.

### Mechanics

**Disaster pod/proximity targeting**
ARD 012 selects disaster victims randomly from the full population. Real disasters affect physical clusters. Refinement of an existing mechanic; only meaningful with proximity built, and even then the random-victim model already produces clustered loss in aggregate.

**Previous suicide attempts increase future risk**
A prior attempt is the strongest empirical predictor of future suicide. Persons currently have no memory of past crises. Niche — suicide is already in MisfortuneEvent; the second-order amplification is unlikely to swing collapse/thrive verdicts.

### Behavioral feedback (research-grounded)

**Relative deprivation in steal probability (Blau & Blau; World Bank)**
Cross-national data shows a one-decile Gini rise associates with ~4% more property crime; the mechanism is relative deprivation, not absolute poverty. The StealEvent formula could include a `(victim.resources - thief.resources)` gap term so stealing scales with visible inequality rather than thief intent alone. This would create a direct feedback loop — high Gini → more theft → more Gini — that the current formula (intent × ageModifier) can't produce. Requires deciding whether gap-scaling belongs in the formula or in an intent-update mechanism like strain theory above; they are distinct intervention points.

**Tolerated theft equilibrium (Blurton Jones; MIT Artificial Life)**
Primate and multi-agent research shows theft naturally gives way to reciprocal exchange when resource variance is high and groups are small. Packets of intermediate resource size are most targeted; very rich and very poor targets are both avoided (high risk vs. low reward). If StealEvent runs long enough, a stable reciprocal-exchange norm could emerge without any explicit cooperation mechanic — worth measuring in simulation runs to see if it appears. Depends on StealEvent and relationship event both being live.

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

**Seeding strategy as experimental variable** — 2026-05-17 — Subsumed by ARD 030 (`simulation.personTypes` config with per-type stat ranges and percentage quotas).

**Altruistic punishment (Fehr & Gächter)** — 2026-05-17 — Superseded by ARD 035 jail system, which provides community-level retribution without requiring individual resource expenditure.

**Strain theory: aspiration–means gap (Agnew)** — 2026-05-17 — Subsumed by ARD 036 resource-pressure situational multiplier on steal probability, which implements the core strain-theory mechanism (scarcity → elevated theft likelihood) without requiring a cohort-median reference class.

**Intergenerational transmission of intents (Bandura)** — 2026-05-17 — Subsumed by ARD 037 (parental-mean regression with separate stat and intent coefficients implements the heritability and social-learning channels in one mechanism).

**Reputation / trust effects** — 2026-05-17 — Consolidated into "Generalized trust as a per-person stat (Putnam)" in Very useful; the two entries described the same feedback loop with different framings.

**Loss aversion in intent updates (Kahneman & Tversky)** — 2026-05-17 — The core stat→intent feedback is addressed by ARD 036: permanent emboldening on undetected theft covers behavioral escalation; resource-pressure and happiness-pressure situational multipliers cover the circumstance-driven response. The asymmetric permanent update on resource loss specifically (losses raise intent faster than gains lower it) is not implemented; desistance (intent decay from stable conditions) is noted in future-ideas under behavioral feedback.

**Lying event** — 2026-05-19 — Dropped without ARD; the social-manipulation/intent-contagion pathway it would have covered is not a current priority and the event set is otherwise complete.
