# Research: Character Types and Population Composition

Gathered to support ARD 030. Frameworks: HANDY two-class collapse model (Motesharrei 2014), Cliodynamics structural-demographic theory (Turchin 2003, 2016), Pareto's elite circulation (1916), Axelrod's evolution-of-cooperation tournaments (1984), Boyd & Richerson's altruistic-punisher model (1992), Schumpeter on innovation (1942), Sugarscape (Epstein & Axtell 1996), Daly & Wilson on inequality and violence (2001), Veblen's leisure class (1899).

## Why a typology at all

The simulation's primary collapse signal is `resourceGini`, with secondary signals in death counts (murder, illness, suicide, disaster), happiness, and population trajectory. Uniform seeding (ARD 021) produces statistically identical agents, so the only way the run-to-run distribution shifts is via stat noise. A composed population — explicit percentages of differently profiled agents — turns composition into a controlled variable: "at what fraction of `Warrior` does the murder feedback loop dominate?" or "does an `Inventor` cohort large enough to lift `naturalResourceCeiling` rescue an otherwise collapsing run?"

This is the experiment HANDY supports analytically (closed-form Commoner/Elite ratios) but ABMs can probe much more richly: nonlinear interactions between archetypes that HANDY's ODEs cannot represent.

## Frameworks

### HANDY two-class model (Motesharrei et al. 2014)

Two human populations: **Commoners** (produce wealth) and **Elites** (consume wealth without producing). When the ratio of Elite consumption to Commoner production exceeds the regeneration capacity of `Nature`, the system collapses. Key finding: under egalitarian or equitable scenarios, collapse is avoidable; under inequitable scenarios, collapse is the typical outcome even with abundant resources. This is the direct theoretical justification for `resourceGini` as the project's primary collapse signal.

**Sim mapping:** Commoner ≈ a person whose `gather` output exceeds their consumption baseline (high intelligence + experience + learningIntent, low stealingIntent). Elite ≈ a person whose `resources` grow primarily via `StealEvent` or starting endowment (high charisma + stealingIntent, high seeded resources).

### Cliodynamics / structural-demographic theory (Turchin 2003, 2016)

Civil violence is driven by **elite overproduction** combined with **immiseration of commoners**. When aspiring elites outnumber elite positions, intra-elite competition escalates to factional violence. Turchin's "sons of Mars" — violent young men in their 20s — are the kinetic vector of collapse. The age-violence curve (peak 22–26) is the empirical signature.

**Sim mapping:** A `Warrior` archetype concentrated in the 18–30 age band, with elevated `killingIntent`, directly reproduces the Turchin dynamic when combined with elevated Gini (the existing `KILL_GINI_SCALAR` term is the structural-demographic feedback in microcosm).

### Pareto's elite circulation (1916)

Elites cycle between two strategies: **Lions** (rule by force; high constitution, high coercive intent) and **Foxes** (rule by cunning; high charisma, manipulation, deal-making). Stable societies have a balance; rigid ones collapse when one type cannot displace the other.

**Sim mapping:** Lions ≈ `Warrior`; Foxes ≈ `Extractor` (charisma-based wealth concentration). Useful conceptually for naming the elite split but the two-axis distinction reproduces what HANDY + Turchin already imply.

### Evolution of cooperation (Axelrod 1984; Boyd & Richerson 1992; Fehr & Gächter 2002)

In iterated games, **Cooperators** can persist against **Defectors** only when supplemented by **Altruistic Punishers** (cooperators who pay a cost to punish defectors). Pure cooperator populations are invadable; mixed populations are stable. Cooperation is also more likely to evolve under group selection or kin selection conditions.

**Sim mapping:** A `Cooperator` archetype with high charisma, very low antisocial intents acts as the relationship/happiness substrate. The simulation does not currently model altruistic punishment as an event — future-ideas candidate. For now, Cooperators are passive prosocial baseline.

### Schumpeter on innovation (1942)

Innovation is concentrated in a small population of entrepreneurs; their inventions raise the productive ceiling for everyone via "creative destruction." Without them, productivity stagnates and resource constraints bind.

**Sim mapping:** An `Inventor` archetype with very high intelligence will, once `InventionEvent` lands (per ARD 007), shift `extractionEfficiency` or `naturalResourceCeiling` — the only mechanism in the model that can move the long-run carrying capacity. The Schumpeterian question becomes quantitative: what fraction of Inventors is enough to keep the carrying capacity ahead of population growth?

### Sugarscape (Epstein & Axtell 1996)

Sugarscape agents are differentiated by `metabolism` (energy cost per tick) and `vision` (perception range). Low-metabolism agents survive longer; high-metabolism agents die faster. The model demonstrates that even with uniform behavior rules, a metabolism distribution alone produces emergent wealth inequality and mortality stratification.

**Sim mapping:** A `Fragile` archetype with low `constitution` and low starting `resources` is the Sugarscape low-metabolism analog — vulnerable to illness, disasters, and starvation without any antisocial dynamic. Useful for isolating non-violent mortality drivers.

### Daly & Wilson on inequality and violence (2001)

Empirical and evolutionary-psychology framework: in unequal societies, low-resource individuals adopt "fast life history" strategies — higher risk-taking, earlier reproduction, more violent. This is the mechanism behind the ~50% of cross-national homicide variance explained by Gini (Kelly 2000). The `KILL_GINI_SCALAR` term in ARD 027 is this mechanism in compressed form.

## Proposed type catalog (v1)

The catalog has two layers: research-backed archetypes drawn from the frameworks above, and **sim-native archetypes** designed against this model's specific mechanics (which don't map cleanly to any single external framework — the simulation has its own intent-and-event surface). Each archetype is the **dominant** perturbation on a distinct measure, so experiments can attribute outcomes cleanly.

### Research-backed archetypes

Six archetypes. Adding a seventh (Drifter / leisure class) was considered and rejected — too much overlap with default seeding for a clean signal.

| Type | Distinguishing stats (suggested ranges) | Primary signal moved | Framework |
|---|---|---|---|
| **Producer** (Commoner) | `intelligence` [7,11), `learningIntent` [0.5,1), `stealingIntent` [0,0.05), `killingIntent` [0,0.02) | ↑ pool extraction, ↓ Gini, anti-collapse | HANDY commoner |
| **Extractor** (Elite) | `charisma` [7,11), `stealingIntent` [0.5,1), `lyingIntent` [0.5,1), `resources` [200,500) | ↑ Gini → triggers KillEvent feedback | HANDY elite; Pareto fox |
| **Warrior** | `killingIntent` [0.5,1), `constitution` [7,11), `age` [18,30) | ↑ murder rate, especially under high Gini | Turchin "sons of Mars" |
| **Inventor** | `intelligence` [9,11), `learningIntent` [0.7,1), `age` [30,55) | ↑ resource ceiling (when `InventionEvent` lands) | Schumpeter |
| **Cooperator** | `charisma` [7,11), all antisocial intents [0,0.02) | ↑ happiness, ↓ suicide; relationship glue | Axelrod / Boyd-Richerson |
| **Fragile** | `constitution` [1,4), `resources` [0,20) | ↑ illness and disaster deaths without violence | Sugarscape low-metabolism |

### Sim-native archetypes

This simulation's mechanics — the age-modulated learning curve, the loneliness-to-suicide chain via happiness, the consumption/starvation feedback, the windfall/steal interaction — produce dynamics that don't map cleanly onto existing typologies. The archetypes below were designed to probe these distinctive surfaces directly.

| Type | Distinguishing stats (suggested ranges) | Primary signal moved | Sim surface probed |
|---|---|---|---|
| **Late Bloomer** | `learningIntent` [0.8,1), `age` [35,55), `intelligence` [3,6) | ↑ adult intelligence over time | `ExperienceEvent` learning fade past peak age 18; tests whether persistent intent overcomes age decay |
| **Hermit** | `charisma` [1,3), all antisocial intents [0,0.02) | ↑ suicide, ↓ relationship formation | `RelationshipEvent` charisma gate; `MisfortuneEvent` suicide via no-relationship/no-job happiness floor |
| **Lone Wolf** | `charisma` [1,3), `killingIntent` [0.3,1), `stealingIntent` [0.3,1) | mid murder/steal effectiveness, ↑ self-suicide | The "talentless predator" — antisocial intent without the charisma to extract via jobs/stealing; tests whether unsupported violence still moves Gini |
| **Heir** | `resources` [300,800), `age` [15,22), `experience` [0,2), `learningIntent` [0,0.2) | ↑ starting Gini without ↑ killing intent | Unearned wealth meeting `ConsumptionEvent` once parental subsidy ends at age 18; tests whether capital alone survives |
| **Aristocrat** | `resources` [300,800), `charisma` [7,11), all antisocial intents [0,0.02) | ↑ Gini at start without corrosive feedback | Distinct from Extractor: starts rich and prosocial; tests whether windfall+gather equilibrium can sustain inherited inequality without violence |
| **Survivor** | `constitution` [9,11), `resources` [0,30), `age` [30,55) | ↓ illness death, ↑ longevity at low resources | The hardened-poor: bottom of the resource ladder but durable; tests whether `IllnessEvent` and `DisasterEvent` constitution scaling alone can keep a poor class alive without producing them upward |

These are speculative until run against the simulation — the value of each will depend on the calibration of the existing events, and several may be replaced or refined as data comes in.

### Range calibration intent

The ranges above are **deliberately stronger than the default uniform distributions** so that the archetype produces a visible signal at modest population fractions (5–15%). Range choices follow three rules:

1. **One or two defining stats per type, biased to the top third** of the default range — strong enough to dominate the average but not so extreme that the type becomes a caricature.
2. **Antisocial intents are bounded down for prosocial types** — a Producer with high `intelligence` but a default `killingIntent` of up to 0.1 would muddy the prosocial signal.
3. **Age is overridden only when the archetype is age-coupled** (Warrior's youth bulge, Inventor's middle-age peak). Producer, Extractor, Cooperator, Fragile inherit the default `age` distribution.

### Measurement mapping

| Type | Watched signal | Expected direction under composition increase |
|---|---|---|
| Producer | `averageResources`, `naturalResources` depletion rate | ↑ resources, ↑ pool depletion |
| Extractor | `resourceGini`, total `StealingRecord` count | ↑ Gini, ↑ stealing |
| Warrior | murder deaths in `decadeHistory` | ↑ murders, peaks in decades after large young cohort |
| Inventor | `naturalResourceCeiling`, `extractionEfficiency` | depends on `InventionEvent` calibration; baseline negligible |
| Cooperator | `averageHappiness`, suicide deaths | ↑ happiness, ↓ suicides |
| Fragile | illness deaths, disaster deaths | ↑ both |

A run can be diagnosed by reading the per-type survival delta in the end report: a 10% seeded Warrior cohort that ends at 3% suggests the Warriors killed each other (or were killed) at high rates; a 10% Producer cohort that ends at 14% suggests Producers were targeted less and outbred or out-survived the rest.

## Canonical experiments

Scenarios worth running once ARD 030 lands:

1. **HANDY two-class.** 80% Producer, 20% Extractor, no Warriors. Replicates the analytical HANDY setup and tests whether the ABM reproduces HANDY's inequitable-collapse prediction.
2. **Turchin youth bulge.** 70% Producer, 5% Extractor, 25% Warrior. Tests whether Warrior concentration plus modest inequality reproduces the structural-demographic violence spike.
3. **Schumpeterian rescue** (post-`InventionEvent`). Vary Inventor fraction 0% / 2% / 5% / 10% against a baseline of 70% Producer / 20% Extractor / 10% Warrior. Identifies the Inventor density needed to keep `naturalResourceCeiling` ahead of depletion.
4. **Cooperator stress test.** 50% Producer, 25% Cooperator, 15% Extractor, 10% Warrior. Tests whether the prosocial Cooperator presence stabilizes happiness and suppresses the Gini→violence feedback.
5. **Fragility floor.** 60% Producer, 30% Fragile, 10% Extractor. Isolates the non-violent mortality contribution — Fragile cohort survival is the diagnostic.

## Why not other typologies

- **Big Five (OCEAN)** — personality traits (Openness, Conscientiousness, etc.) describe individuals but don't map onto resource-and-violence mechanics. A high-Openness agent in our model does nothing different.
- **Dark Triad (narcissism, Machiavellianism, psychopathy)** — collapses into our existing antisocial intents (`stealingIntent`, `lyingIntent`, `killingIntent`). The Extractor archetype already covers the Machiavellian; the Warrior covers the psychopathic.
- **Holland RIASEC career codes** — too occupation-focused for an abstract civilizational model.
- **Marxist class taxonomy** — bourgeoisie / proletariat / lumpenproletariat overlaps substantially with HANDY's commoner/elite split, but adds vocabulary without distinct mechanics.

The proposed six are the smallest set that spans the simulation's measurement surface with citable theoretical backing.
