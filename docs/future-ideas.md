# Future Ideas

Candidates for the simulation, not planned work. Worthwhile ones get formalized as ARDs when their time comes.

If you discover a new mechanism during implementation that could meaningfully affect collapse/thrive dynamics, add it here with a one-sentence note on why it matters. Don't implement without an ARD.

Items are grouped by priority — a working judgment, not a commitment. Promote, demote, or split as the model evolves. Within each tier, original category labels (Mechanics / Behavioral feedback / Social structure / Research / Output) are preserved.

---

## High priority

Known correctness issues that can produce degenerate outcomes — runaway values, thrive-lock, or collapse-lock — before the collapse/thrive signal has time to develop. Should be addressed before drawing conclusions from long runs.

### Mechanics

*(The two High-priority items previously here are resolved. Suicide-dominated mortality → ARD 049. The population/fertility-regulation question → ARD 050 (binding carrying capacity) plus the harness-backed decision (`scripts/sweep.ts`, 16 seeds) to **accept boom-bust as a legitimate HANDY outcome** rather than force stability: a smooth density-dependent fertility brake proved counterproductive, and no `BASE_CHILDBIRTH_RATE` yields long-run stability, so the rate was set to 0.6 for outcome variety, not equilibrium. Full write-up in `docs/research-fertility.md`. The one residual is crash recovery, below — a follow-up tuning study (`docs/research-tuning-defaults.md`) confirmed *no* parameter regime gives a sane long-run default and identified an anti-Allee crash-recovery mechanism as the only intervention that produces any sustained cycling, making it the top structural candidate whenever long-run stability or survivable collapse is wanted.)*

---

## Very useful

Sharpens the collapse/thrive signal or experimental setup, but does not cause degenerate outcomes on its own.

### Mechanics

**Redistribution calibration vs the empirical ~25% Gini compression** — see `docs/research-taxation-welfare.md`
ARD 034's `TAX_RATE` (0.02), `WELFARE_THRESHOLD` (20), and `COMMUNITY_POOL_RESERVE_FRACTION` (0.20) have no empirical anchor, yet they are the most direct lever on the Gini coefficient (the primary collapse signal). OECD data gives a clean, in-sim-checkable target: taxes+transfers reduce market-income Gini by **~25% on average** (range ~5–40%), with *transfers* (bottom-weighted, already how ARD 034 targets welfare) doing most of the work. The current flat 2% channel looks near-inert — the community pool ends a run at ~18 against ~2,600 total resources — so it is unlikely to be compressing Gini meaningfully. Recommendation: adopt "disposable Gini ≈ 0.7–0.85 × market Gini" as the calibration objective (measure via a redistribution-off baseline run), raise `TAX_RATE`/lower the reserve until the channel circulates, and add mild progressivity only if a flat rate can't reach the target. Tuning + a small ARD if progressivity is added.

**Crash recovery / age-structure (would make collapse survivable)** — see `docs/research-fertility.md`, `docs/research-tuning-defaults.md`
The population is an intrinsic boom-bust oscillator (accepted as a HANDY-style behavior, ARD 050 + base-rate calibration), and crashes hit *zero* because the survivors of a boom are old and sparse — a thinned population can't rebuild (partnership-density Allee effect + synchronized initial cohort). This is the one lever fertility tuning can't supply. Options: seed a spread/younger initial age structure (and/or some children) to damp the founding cohort wave; or a low-density fertility/partnership boost so crashes bounce off a floor instead of going extinct. **Now the top structural priority:** the tuning-defaults study (`docs/research-tuning-defaults.md`) confirmed *no* parameter regime yields a sane long-run default — every single-lever sweep is a terminal one-shot overshoot (`cyc=0, stable=0`). Two throwaway probes showed which fix matters: pyramid seeding alone does **nothing** (the founding wave washes out and the synchronized cohort regenerates endogenously), but an **anti-Allee low-density fertility boost** (`p *= 1 + boost·max(0, 1−N/ref)`) moved `stable` off zero (2–3/16 seeds at strong settings). It is necessary but not sufficient on its own — a strong boost still lost ~70% of seeds because crash survivors are too old/unpartnered to rescue — so design it together with a second channel (weakened partnership-density dependence at low N, or younger continuously-replenished age structure). One existing lever is a complementary mitigator (not a substitute): a large `BASE_INVENTION_RATE` increase (~15×) yields `stable=6/16` at 800 ticks by continuously lifting/jostling `K` so the demographic wave rides a moving ceiling — but it too leaves the majority extinct, and only at an implausibly high invention rate. ARD-level (new mechanic + non-obvious calibration); discuss with owner first. Sweep-validate per the protocol in `research-tuning-defaults.md` (target: `stable` rises and extinction share falls *without* suppressing the boom peak or erasing outcome variety).

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

**Voluntary trade / bilateral exchange (Sugarscape — Epstein & Axtell 1996; Tainter 1988; Cline, *1177 B.C.* 2014; Kander et al., *Entropy* 2024)**
Every resource transfer in the model is zero-sum or negative-sum (theft, tax, gift, windfall, inheritance); voluntary trade is the missing positive-sum channel where two agents each hold a surplus of something the other needs and both come out ahead. Trade network contraction is a documented leading indicator of collapse — the Late Bronze Age systems collapse is the canonical case, where interdependent Mycenaean, Hittite, and Egyptian exchange circuits failed in sequence within decades — while robust exchange buffers local extraction failures and dampens Gini. Sugarscape, the direct agent-ABM ancestor of this simulation's Gini focus, includes bilateral trade as a core mechanic; without it, the model has no mechanism to generate the surplus that distinguishes thriving civilizations, and can only redistribute scarcity, which may explain why THRIVING is rare in practice.

**Elite extraction differential / HANDY class hierarchy (Motesharrei, Rivas & Kalnay 2014; Turchin — *Secular Cycles* 2009, *Ages of Discord* 2016)**
HANDY's central result: any parameterization where elites consume at a higher per-capita rate than commoners produces collapse regardless of absolute resource abundance, because elite extraction depletes the pool faster than it regenerates while commoners lack the buffer to absorb shocks. Turchin's structural-demographic theory adds two further collapse channels: elite overproduction (elite families reproduce into a fixed number of high-status positions, generating surplus counter-elites who compete destructively) and fiscal crisis (elite resistance to taxation hollows out the state's buffering capacity, measured as a Political Stress Index that peaks 10–20 years before the collapse event). The current model captures the Gini signal but not the mechanism — all agents extract from the pool at the same rate formula regardless of wealth rank, so the HANDY result (high inequality causes collapse even at a healthy pool level) cannot emerge; introducing a consumption-rate multiplier scaled to relative resource rank would let Gini become a leading indicator of collapse from mechanism rather than from luck or theft alone.

### Behavioral feedback (research-grounded)

**Equilibrium-seeking agents with heterogeneous overcorrection (workaholics vs. monks)**
Today agents are reactive and stochastic — events fire *to* them; no agent pursues a goal. Give each a happiness/resource set-point and let them act to close the gap: below their happiness target they divert resources toward happiness-raising inputs (relationship formation, illness recovery, helping — `helpHappinessBoost` already exists), below their resource target they lean into gathering/work/theft at the cost of those inputs. Note happiness is a *computed getter*, not a stock — agents trade the *inputs* happiness is derived from, they don't barter two currencies. The point is **not** that the trade-offs are optimal: per-person miscalibration (set-point + a personal correction gain, both heritable via ARD 037) means the *same* drive produces opposite extremes — high-gain resource-seekers become **workaholics** (over-accumulate, low happiness), high-gain happiness-seekers become **monks** (renounce resources). That heterogeneity is the feature: it *generates* dispersion in resources (Gini, the primary collapse signal) and behavior rather than converging everyone on one set-point, and the corrective pullback is a candidate for the negative feedback the model currently lacks (crash recovery / population self-regulation — see the High-priority residual). This is the general parent of three narrower items below — hedonic adaptation, relative deprivation, and desistance are all special cases of "agents act on their own state." Big paradigm shift (utility/homeostatic agents), so do it as the smallest sharp lever first — one trade-off — and **sweep-validate** (`npm run sweep`) against the boom-bust baseline: does extinction-share fall *without* erasing outcome variety? Encodes non-obvious choices (set-point distribution, correction-gain spread, what's sacrificable for what) → ARD discussion before any code.

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

**Cultural norm erosion / cooperation propensity (Henrich 2015; Ostrom 1990; Boyd, Gintis, Bowles & Richerson, *PNAS* 2003; Gavrilets & Richerson, *PNAS* 2017)**
Ostrom's commons governance research shows cooperative extraction restraint is sustained only by active norm enforcement (graduated sanctions, participatory rule-making); when sanctioning capacity erodes — via inequality, elite defection from shared rules, or population disruption — overextraction accelerates independently of any individual's intent change. Henrich's collective brain thesis frames this as a cultural transmission failure: cooperative knowledge accumulates intergenerationally and collapses faster than it was built when transmission is disrupted. The current model has no feedback where rising inequality erodes willingness to restrain extraction; a cooperation-propensity parameter that decays as Gini rises (Putnam's trust–inequality correlation is empirically robust across countries and US states) and recovers as HelpEvent frequency rises would make the pool directly sensitive to social cohesion — adding the upstream mechanism that drives the commons toward the HANDY collapse trajectory before individual intents visibly change.

### Social structure

**Proximity (Tobler; Christakis & Fowler contagion)**
Many of the mechanisms above are local, not global — relative deprivation, contagion, threshold cascades, mortality exposure. The model has no proximity. Three shapes, cheapest to costliest:

1. **Coarse neighborhood label** — assign each person to one of M groups at seed; same label = proximate. Unlocks in-group bias, local norm drift, local comparison.
2. **Social graph** — explicit edges (kin, relationships, work ties). Matches Dunbar / Christakis-Fowler. Memory O(N·k).
3. **2D spatial grid** — coordinates per person; pool can localize. Heaviest; changes many event signatures.

Single decision point because relative deprivation, threshold cascades, bereavement, and contagion all need *some* proximity to be implementable.

**Collective violence / civil violence threshold (Keeley 1996; Epstein, *PNAS* 2002; Turchin; Diamond 2005)**
Individual KillEvent models independent homicide; organized group violence requires a coordination threshold — agents with shared grievance (high Gini, low happiness) mobilize when local enforcement capacity falls below an activation point, producing punctuated nonlinear outbursts rather than a smooth mortality gradient. Epstein's 2002 PNAS civil violence ABM reproduces this pattern with grievance = f(hardship − perceived legitimacy) gated by local cop density; Diamond identifies coordinated inter-clan warfare accelerating terminal decline in Easter Island and Maya cases specifically after resource stress crossed a threshold. A cluster of high-killingIntent agents that can coordinate would be capable of destroying the commons pool in a single episode — qualitatively different from per-person mortality and able to flip a STABLE trajectory into COLLAPSE, which individual KillEvent cannot. Does not strictly require full proximity infrastructure; a coarse faction-label approach would suffice.

### Research / Output

**Multi-tier execution modes**
Three execution tiers behind a common `SimulationEngine` interface: (1) current OOP loop — easy to step through and inspect; (2) CPU performance mode using `Float32Array` stride layout — same logic, flat data, faster iteration, still debuggable via index arithmetic; (3) WebGPU compute mode — agents packed into GPU storage buffers, logic ported to WGSL shaders, orders-of-magnitude throughput for population sizes the CPU loop can't sustain. The interface contract is same-seed → same outcomes; a parity check against the reference engine validates each new tier. Requires an ARD to fix the memory layout (stride, field alignment), the PRNG strategy (per-agent seeding on GPU vs. shared state on CPU), and how relation fields (`killed[]`, `hasChildren[]`) that can't fit in a flat buffer are handled. Value is unlocking population scales where emergence and tipping-point dynamics become statistically observable.

**Multiple simulation runs with comparison**
Run N simulations with different seeds, compare `history` arrays. Requires deciding how `LooperSingleton` exposes results across runs.

**Emergent patterns to classify**
A catalog of patterns the current tooling (`classifyOutcome`, `CycleDetector`) misses, with literature grounding and the metric for each — full write-up in `docs/research-emergent-patterns.md`. Two kinds: *verdict labels* (taxonomy change → ARD) and *leading indicators / descriptors* (measurement, like the cycle detector — can go into the sweep harness). Candidates: **critical slowing down** (rising autocorrelation/variance before a crash — predictive early warning, Scheffer et al.); **two-class polarization / bimodality** (sharp elite/commoner split vs smooth gradient at the same Gini); **inequality trajectory** (Gini sliding toward oligarchy vs steady); **violence cascade** (the ARD-036 emboldening runaway — the violence signal deferred from ARD 051); **overshoot ratio** and **collapse speed** (HANDY/Tainter trajectory shape); **demographic structure** (youth bulge vs aging); **cohort/trait drift** (did raiders or engineers win the run?). Recommended first three: critical slowing down, polarization, violence cascade.

**`OSCILLATING` outcome label**
A fifth between-the-extremes verdict for a population that sustains repeated boom-bust cycles without going extinct (HANDY's persistent "cycles of prosperity and collapse"). The measurement is already built — `src/Helpers/CycleDetector.ts` (`detectCycles`) reports cycle count, period, trough envelope trend, and a `stableCycle` flag, surfaced in the sweep harness — but a scan across seeds, long horizons (1500 ticks), and even zero ceiling degradation finds **none**: every run booms once and crashes straight through to extinction (the demographic crash is total, not to a recoverable floor). So the label is premature until crash-recovery exists (see High-priority residual). Promoting `stableCycle` into a `classifyOutcome` label would need an ARD, since it changes the verdict taxonomy (refining ARDs 016/051).

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
