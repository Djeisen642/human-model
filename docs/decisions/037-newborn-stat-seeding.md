# ARD 037: Newborn Stat Seeding via Parental Heritability

**Status:** Accepted
**Date:** 2026-05-17

## Context

`Person`'s constructor (`src/App/Person.ts:40`) assigns only `this.childOf = parents`. Every other field stays at its declaration default: `intelligence = 0`, `constitution = 0`, `charisma = 0`, all intents `= 0`. `Simulation.seed()` patches the founding cohort with random draws, but `ChildbirthEvent` (`src/Events/ChildbirthEvent.ts:56`) calls `new Person([person, partner])` and adds the child to `simulation.living` unmodified.

This is a live crash path. `IllnessEvent.ts:27` rolls `BASE_ILLNESS_ONSET * ageRisk / person.constitution`; a newborn divides by zero. `DisasterEvent.ts:45` does the same. Until now the bug has been latent because births rarely survived long enough to be selected, but ARD 033 (birth tracking) and ARD 029 (childbirth) together mean the simulation is now producing meaningful birth cohorts.

Beyond the crash, the existing constructor erases any intergenerational signal. Every generation re-rolls the cultural and biological slate — children of two robust parents have the same expected constitution as children of two fragile parents. This removes a real selection pressure (epidemics, disasters, and famines all sort by constitution) and prevents family-level path dependence in collapse dynamics.

## Decision

Newborn stats and intents are drawn at birth from a heritability model: regression toward an anchor, scaled by a coefficient, plus uniform noise. Stats regress toward a population mean; intents regress toward zero. The seed logic lives in `ChildbirthEvent` after `new Person([...])` and before `simulation.add(child)`, since the event already holds the RNG and is the only caller of the parented constructor.

**Stats** — `intelligence`, `constitution`, `charisma`:

```typescript
const parentMean = (p1.stat + p2.stat) / 2;
child.stat =
  Variables.NEWBORN_STAT_POPULATION_MEAN +
  (parentMean - Variables.NEWBORN_STAT_POPULATION_MEAN) * Variables.HERITABILITY_STAT_COEFFICIENT +
  (rng() * 2 - 1) * Variables.HERITABILITY_STAT_NOISE_RANGE;
```

**Intents** — `learningIntent`, `exerciseIntent`, `stealingIntent`, `lyingIntent`, `killingIntent`:

```typescript
const parentMean = (p1.intent + p2.intent) / 2;
const raw =
  parentMean * Variables.HERITABILITY_INTENT_COEFFICIENT +
  (rng() * 2 - 1) * Variables.HERITABILITY_INTENT_NOISE_RANGE;
child.intent = Math.max(0, Math.min(1, raw));
```

Intent clamping to `[0, 1]` is semantic (intents are probabilities), not a safety floor. Stats are **not** clamped — the noise distribution is trusted to keep values positive, and calibration of the constants is responsible for ensuring it.

**Non-inherited fields** — all other `Person` fields keep their constructor defaults: `age = 0`, `resources = 0` (per ARD 024, children with living parents are shielded from starvation), `experience = 0`, `education = NONE`, `isWorkingOnEd = NONE`, `illness = 0`, `jailedTicksRemaining = 0`, `isInRelationshipWith = null`, and the readonly collections empty.

**Calibration intent:** Two coefficients capture the empirical asymmetry between trait heritability and behavioral transmission. Stat heritability is set to roughly match twin-study estimates for physical and cognitive traits (~0.4). Intent heritability is deliberately lower — antisocial-behavior transmission across generations is meaningfully weaker (~0.25), and the regression target is zero rather than the population mean to capture the principle that "a strong killer does not beget another strong killer, but someone more likely to kill." Noise ranges are tuning levers; specific values live in `Variables.ts`.

**New constants:**

- `NEWBORN_STAT_POPULATION_MEAN` — anchor that stats regress toward; matches the midpoint of the adult seed range `[1, 10]`
- `HERITABILITY_STAT_COEFFICIENT` — strength of regression toward parental mean for stats
- `HERITABILITY_STAT_NOISE_RANGE` — uniform noise half-width on stat draws
- `HERITABILITY_INTENT_COEFFICIENT` — strength of regression toward parental mean for intents (smaller than stat coefficient)
- `HERITABILITY_INTENT_NOISE_RANGE` — uniform noise half-width on intent draws

## Reasoning

**Why heritability rather than fixed defaults.** A simpler fix — `constitution = 1, intelligence = 1, charisma = 1` for any newborn — eliminates the crash with one screen of code. It loses the intergenerational sorting that this simulation exists to study: every generation would reset to identical baselines, and family-level path dependence (sickly lineages, criminal lineages, gifted lineages) would not exist. Since the eventual goal includes generational dynamics, the cheap fix would be revised the moment we wanted any of that, and the revision would be larger than just doing it now.

**Why regression toward zero for intents, but population mean for stats.** Two reference points reflect two different mechanisms. Stat inheritance is biological; the genetic baseline is the population mean, so children of weak parents regress upward and children of strong parents regress downward — both toward the species mean. Intent transmission is social; the natural baseline for antisocial behavior is zero (most people are not stealing or killing), and elevated parental intent decays toward that baseline in offspring. Using a population mean for intents would mean children of low-stealing parents regress *upward* toward the average, which is not how social learning works.

**Why ChildbirthEvent, not the Person constructor.** The constructor would need an `rng` parameter and conditional logic depending on whether the call has parents. That couples a pure-construction primitive to a random source for one caller's benefit. Since `ChildbirthEvent` already holds the RNG and is the only path that produces parented persons, inline seeding there is cleaner and matches the pattern in `Simulation.seed` (construct, then set fields).

**Why no safety floor on stats.** Considered: `Math.max(1, ...)` on `constitution`/`intelligence`/`charisma` to guarantee no division-by-zero downstream regardless of constants. Rejected: a floor would mask miscalibration. If the noise range is set so wide that values can hit zero, the right response is fixing the calibration, not papering over it. Trusting the noise distribution puts calibration responsibility in `Variables.ts` where it belongs. The risk — a rare crash from a pathological draw — is acceptable because the constants can be chosen to make it numerically unreachable (e.g., `STAT_NOISE_RANGE < NEWBORN_STAT_POPULATION_MEAN * (1 - HERITABILITY_STAT_COEFFICIENT)`).

**Why resources at birth = 0.** ARD 024's child subsidy (children with living parents pay a fraction of their own resources) already shields newborns from immediate starvation. A birth dowry would couple this ARD to a separate inheritance/wealth-transfer design that has its own open questions (does death-inheritance follow the same rule? what about orphan dowries?). Deferring dowry to a dedicated ARD keeps this one focused on the crash and the heritability mechanism.

## Consequences

- `ChildbirthEvent.execute` gains a seeding block after `new Person([person, partner])` and before `simulation.add(child)`. The constructor itself is unchanged.
- `Variables.ts` gains five new constants listed in Decision; values are placeholders pending calibration.
- This ARD **subsumes** the "Intergenerational transmission of intents (Bandura)" item in `docs/future-ideas.md` under *Very useful / Behavioral feedback*. Move to Discarded with a pointer to this ARD.
- This ARD **resolves** the "Newborn initial stat seeding" item under *Required for completion*. Move to Discarded.
- Tests must cover: (1) constructor with parents no longer leaves stats at 0; (2) child stats regress toward parental mean (children of high-constitution parents have higher expected constitution); (3) child intents regress toward zero (children of high-stealingIntent parents have lower stealingIntent than parents); (4) noise distribution produces variance across siblings; (5) clamping keeps intents in `[0, 1]`; (6) no division-by-zero crash when running a full sim with births enabled.
- Known weakness: the noise distribution is uniform, not Gaussian. Real trait distributions are roughly Gaussian; uniform noise produces a flatter distribution of newborn stats than reality. Acceptable at this stage — calibration of the noise range matters more than the shape for collapse-vs-thrive dynamics — but worth a future revision if generational variance becomes a study target.
- The adult-seed ranges in `Simulation.seed` and the newborn population mean are tracked separately. If adult-seed ranges change, `NEWBORN_STAT_POPULATION_MEAN` must be updated by hand to stay consistent. A future refactor could extract shared range constants; deferred as not load-bearing for this ARD.
