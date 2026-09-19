# ARD 064: Heritable Traits Regress Toward the Living Population

**Status:** Proposed
**Date:** 2026-09-19

## Context

`ChildbirthEvent` draws a newborn's heritable fields through two different functions, and they have drifted apart.

`drawStat` (intelligence, constitution, charisma) regresses the parental midpoint toward `NEWBORN_STAT_POPULATION_MEAN`, a constant. `drawIntent` (learningIntent, exerciseIntent, stealingIntent, killingIntent) multiplies the parental midpoint by a coefficient and adds noise, with no anchor term at all — which is regression toward **zero**.

ARD 037 introduced both. Its reasoning for the zero target was about antisocial traits: "most people are not stealing or killing," so elevated parental intent should decay toward that baseline. That argument covers `stealingIntent` and `killingIntent`. It was applied uniformly to `learningIntent` and `exerciseIntent`, which are not antisocial and which `Simulation.seed` draws from the same shape of range as a stat. Those two fields were swept along by reasoning that never addressed them.

The measured consequence: simulating `drawIntent` verbatim against current constants over a randomly-mating 20,000-person population seeded the way `Simulation.seed` seeds founders, mean `learningIntent` falls 0.501 → 0.126 → 0.034 → 0.017 and settles near 0.014 — the closed form is a geometric decay by the heritability coefficient each generation, with the clamp at zero and symmetric noise establishing a small floor. The floor is independent of the founding distribution. Since `EventFactory` gates enrollment, learning, theft and killing on these fields multiplicatively, every population more than about four generations deep is close to behaviourally inert on all four events. A 2000-tick run is roughly 77 generations.

Three things about the current pair of draws are arbitrary in a way that matters, and the first is what let the defect exist:

1. **Two functions.** Nothing structural keeps them consistent. They already diverged once.
2. **Hand-set anchors.** `NEWBORN_STAT_POPULATION_MEAN` is a typed-in number standing in for a population property the simulation could measure directly.
3. **One absolute noise width per family.** `HERITABILITY_INTENT_NOISE_RANGE` applies unchanged to `learningIntent`, seeded across [0, 1), and to `killingIntent`, seeded across [0, 0.1). The same absolute perturbation is a twentieth of one trait's range and half of the other's. This, not the anchor, is why a low-seeded intent sits within one noise width of the clamp floor.

`Person.helpingIntent` is never assigned in `seedNewborn` at all, so it is zero for everyone born inside a run. That is a distinct defect, scoped to its own ARD per project-owner decision, and this ARD does not fix it.

## Decision

Newborn heritable traits — stats and intents alike — are drawn from a single function: the trait's **current mean across the living population**, plus the parental midpoint's deviation from that mean scaled by a heritability coefficient, plus Gaussian noise whose width is the trait's **current standard deviation across the living population** scaled by one dimensionless constant. The result is clamped to the trait's existing legal range.

This is the standard quantitative-genetics formulation: offspring regress toward the population mean, and residual variance scales with trait variance rather than being a fixed absolute quantity.

Consequences for the constant set:

- `NEWBORN_STAT_POPULATION_MEAN` is **deleted**. The population supplies it.
- `HERITABILITY_STAT_NOISE_RANGE` and `HERITABILITY_INTENT_NOISE_RANGE` are **deleted**, replaced by one dimensionless residual-spread constant applied to every trait.
- `HERITABILITY_STAT_COEFFICIENT` and `HERITABILITY_INTENT_COEFFICIENT` are **kept** and keep their meaning: stats and behaviour may legitimately differ in how strongly they transmit. Two coefficients, not one, is the only asymmetry this ARD preserves.
- No per-intent anchor constants are introduced.

Net: five asserted numbers become one dimensionless constant plus the two coefficients that were already meaningful. Every deleted constant is replaced by a quantity the simulation can measure about itself.

When the living population is too small to estimate a mean and spread — a real condition in this model, whose troughs reach tens of people — the draw falls back to the parental midpoint with the residual spread taken from the founder seeding range for that trait. The minimum sample size is a new constant.

## Reasoning

**Why the living population mean, not a constant anchor (per-intent or shared).** A constant anchor asserts that behavioural and physical composition can never drift from its founding values, whatever happens in the run. That is a strong claim, and it is the opposite of the defect being fixed rather than a correction of it: regression toward zero says disposition always evaporates, regression toward a founder constant says it can never change. Neither is a population responding to its own history. Anchoring to the live mean makes composition able to move under selection and drift, which is the class of dynamics this project exists to study, and it removes the need to pick the anchor values at all. The alternative considered most seriously was one anchor constant per intent, each set to that intent's founder-seeding mean; it fixes the collapse and preserves ARD 045's prosocial/antisocial seeding asymmetry, but it does so by adding four more typed-in numbers whose values are asserted rather than derived, and it leaves composition permanently pinned to the founding draw.

**Why one function for stats and intents, when the two have different heritability.** The split is what allowed this defect: two code paths, each with its own anchor, and nothing forcing them to stay consistent. Keeping the split and correcting only the intent anchor leaves the same failure mode available to the next change. Differing heritability is expressible as a parameter — the two coefficients survive — and does not require two functions. This also improves the supersession property `docs/decisions/README.md` asks for: after this ARD there is one branch to revise rather than two, where ARD 037 bundled two and this ARD consequently has to supersede it in full.

**Why noise proportional to trait spread, rather than an absolute width.** An absolute width is a statement about the trait's scale, so it cannot be right for two traits with different scales. Applied to a trait seeded across [0, 0.1) it is a large perturbation that pushes a substantial share of draws into the clamp; applied to one seeded across [0, 1) it is a mild one. Scaling to the trait's own standard deviation makes the constant dimensionless and removes clamp pressure at the low-seeded end without special-casing. It also means a trait whose population has converged draws tighter children, which is the behaviour regression to the mean is supposed to produce.

**Why not keep regression toward zero as intended behaviour.** Rejected: a trait converging to the same floor within four generations regardless of the founding population or anything that happens in the run carries no information past that point, and no process — biological or social — drives all behavioural disposition to near-zero independent of environment. ARD 037's own reasoning argued for a low baseline, not an evaporating one.

**Why not parental inheritance with no population term.** Rejected: an elevated lineage would then never regress except through noise, which is closer to clonal inheritance than to any trait with heritability below 1 — and the coefficients explicitly assert heritability below 1. It replaces one extreme with the other.

## Consequences

- `ChildbirthEvent`: one draw function replaces `drawStat` and `drawIntent`, taking the trait's live mean and spread; `seedNewborn` supplies them per field. `seedNewborn` currently receives only the two parents and must reach the living population, which `execute` already holds — the plumbing is a parameter, not a new dependency.
- `Simulation`: exposes per-trait mean and standard deviation over the living population. These are read once per birth at most; if profiling shows that matters, cache per tick and invalidate on death or birth. Do not pre-compute unconditionally — `scripts/parity-check.ts` will catch any ordering change this introduces.
- `Variables`: three constants deleted (`NEWBORN_STAT_POPULATION_MEAN`, `HERITABILITY_STAT_NOISE_RANGE`, `HERITABILITY_INTENT_NOISE_RANGE`), two added (residual spread, minimum sample size for the estimate), two unchanged (`HERITABILITY_STAT_COEFFICIENT`, `HERITABILITY_INTENT_COEFFICIENT`).
- `ChildbirthEvent.test.ts:341` asserts intents regress toward zero — the behaviour this ARD reverses. It must be rewritten, not deleted: the replacement asserts regression toward the live mean. The clamp test near line 358 stays valid in shape and needs new inputs.
- New tests: (1) generation means converge toward the live population mean rather than toward zero, over enough generations to have caught the original defect; (2) a trait whose population is seeded low stays low and one seeded high stays high across generations, i.e. ARD 045's asymmetry survives without being hard-coded anywhere; (3) children of parents above the mean regress down and below regress up; (4) the small-population fallback fires below the sample-size threshold and produces draws in range.
- **Two behaviours to measure before this is accepted, not after.** Anchoring to a live mean makes the population mean a martingale — preserved in expectation, free to random-walk. This model spends much of its time at troughs of tens to a few hundred people, where drift per generation is large. That may be a feature, since it would give the model across-run behavioural variation it currently has none of, or it may erode ARD 045's seeded asymmetry over the hundreds of generations a long run contains. Measure the across-run spread of each trait's mean at 2000 and 8000 ticks before accepting. Separately, confirm the clamp no longer biases the low-seeded intents once noise scales with spread.
- **This changes every long-horizon result in `docs/research-*.md`.** Any run past roughly four generations measured a population whose four intents had collapsed to a floor. Re-running the headline studies is required follow-up, tracked separately: `research-extraction-need-ratio.md`, `research-productivity-band.md`, `research-scale-robustness.md`, then `research-untested-variables.md`. Note that `research-untested-variables.md`'s three headline "inert lever" findings do not route through any intent, so this defect does not explain them — that hypothesis was checked and does not hold.
- `docs/model-reference.md`'s heritability bullet states that intents regress toward zero and that there are five of them. Both are wrong today (four fields go through `drawIntent`; `helpingIntent` is not seeded at all) and must be rewritten for the unified draw.
- `docs/decisions/README.md`: ARD 037's status becomes `Superseded by ARD 064`.
- Known weakness: the estimate is taken over the living population, so a trait's mean moves when people die as well as when they are born. At a cycle trough a mortality event can shift the anchor materially between one birth and the next. That is arguably correct — it is what a population bottleneck does — but it is a behaviour no previous version had, and it should be reported in the post-implementation research doc rather than discovered later.
