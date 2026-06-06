# Human Model Project

An agent-based simulation for exploring what causes civilizations to thrive or collapse. Each agent (person) has stats, behavioral intents, and participates in events each simulated year. Emergent dynamics — resource inequality, violence, cooperation, invention — determine whether the population grows and stabilizes or spirals into decline.

The model is inspired by and adjacent to:
- **Sugarscape** (Epstein & Axtell, 1996) — agents gathering resources, reproducing, dying; wealth inequality and social dynamics emerge from simple rules
- **HANDY model** (Motesharrei et al., 2014) — civilizational collapse driven by resource overexploitation combined with inequality, not scarcity alone. This is why the Gini coefficient of `resources` is the primary signal we track, not average wealth.
- **Cliodynamics** (Turchin) — quantitative modeling of secular cycles: demographic pressure, elite overproduction, and societal instability

It's also an exercise in TypeScript and test-driven development. The model is intentionally simplistic and makes assumptions. Contributions and forks that challenge those assumptions are welcome.

The simulation runs on a yearly basis. Every event a person participates in happens over the course of one year.

## Getting started

If you're new to Node.js or developer tooling, see [SETUP.md](SETUP.md) for step-by-step installation instructions (Mac, Linux, Windows).

```bash
npm install
npm start           # 100 people, 100 years, seed 42
```

This runs the simulation and writes a console summary plus an interactive HTML report to `./output/`.

To customize a run, generate a reference config and edit it:

```bash
npm run generate-config   # writes config.default.json with all available keys
npx ts-node src/App/index.ts --config config.default.json --output ./my-output
```

Other flags: `--no-report` (skip HTML), `--embed` (inline Chart.js for offline use).

## Commands

```bash
npm test                 # run Jest suite
npm run build            # compile TypeScript
npm run lint             # ESLint
npm run start:dev        # nodemon — watches src/, restarts on change
npm run sweep -- [opts]  # run many simulations across seeds (see below)
```

## Running many simulations at once

The sweep harness runs the simulation many times with different seeds (or parameter values) and prints an aggregate table — useful for understanding whether a config change actually shifts outcomes or just looks different on one seed.

```bash
npm run sweep -- --ticks 500 --seeds 16
npm run sweep -- --sweep BASE_CHILDBIRTH_RATE=0.2,0.4,0.6 --ticks 300
npm run sweep -- --set MAX_NATURAL_RESOURCE_CEILING=15000 --verbose
```

One thing worth knowing: the model tends toward a terminal one-shot overshoot — population booms once, then crashes. "Outcome variety" at short horizons (100–300 ticks) is often just measuring where in that arc you stopped. Calibrate at 500–800 ticks. See `docs/research-tuning-defaults.md` for the full picture.

## Events and actions

Each year, every person participates in a set of events. Some fire unconditionally; others depend on the person's intents or a probability gate.

* **Gathering resources** — extracts from the shared natural resource pool; output scales with experience and intelligence
* **Consumption** — living costs are deducted each year; running out of resources triggers starvation illness
* **Illness** — onset and recovery roll independently each tick; severity accumulates in the old (recovery gets harder with age)
* **Misfortune** — illness can become fatal; suicide probability scales inversely with happiness
* **Aging** — age increments each tick; constitution and intelligence decay probabilistically past middle age
* **Job gain/loss** — employment depends on experience, charisma, and education; losing a job hurts happiness
* **Stealing** — intent-gated; transfers resources from a victim; detection can result in jail and resource forfeiture; each undetected theft raises stealing intent slightly
* **Killing** — intent-gated; attempt probability scales with inequality (Gini); detection results in jail
* **Invention** — intelligence-scaled probability; outcomes shift extraction productivity or grow the resource ceiling
* **Windfall** — random resource gain drawn from the shared pool
* **Relationships** — formation and dissolution; being in a relationship adds to happiness; partner death clears it
* **Childbirth** — coupled persons may have children; child stats inherit partially from parents
* **Education** — enrollment and graduation raise intelligence and improve job prospects
* **Exercise** — raises constitution
* **Learning** — raises intelligence
* **Helping** — transfers resources to a lower-wealth neighbor; gives the helper a happiness boost
* **Jail** — jailed persons can only age, get sick, and draw a small stipend from the community pool

## Individual properties

* `age` — increments each year
* `resources` — wealth: income from work, lost to consumption, theft, disasters, and jail forfeiture
* `experience` — grows with employment and education; decays with idleness in old age; drives gathering output
* `intelligence` — affects gathering, invention probability, and job prospects; raised by learning and graduation
* `constitution` — defends against illness; raised by exercise; decays with age
* `charisma` — improves relationship formation and job acquisition
* `illness` — continuous severity from 0 to 1; builds up with age and starvation; can become fatal
* `happiness` — computed each tick from job status, resources, relationships, age, and illness; influences suicide risk and childbirth
* `education` — a ladder: high school → bachelors → masters → PhD; each tier improves job prospects
* `isInRelationshipWith` — tracks a partner; relationships form and dissolve; partner death clears it
* `hasChildren` / `childOf` — family graph; children share parent resources while young
* `killingIntent`, `stealingIntent`, `learningIntent`, `exerciseIntent`, `helpingIntent` — behavioral tendencies; seeded at startup, some change over time (stealing intent rises with each undetected theft)
* `jailedTicksRemaining` — counts down a sentence; while jailed, most events are suspended
* `causeOfDeath` — recorded at death: illness, suicide, murder, or disaster

## The natural resource pool

Rather than giving each person an independent income, everyone draws from a shared pool. The pool regenerates each year up to a carrying capacity (the ceiling), but the ceiling itself degrades when the pool is overexploited — modeling how environmental damage reduces long-term productivity. Inventions can push the ceiling higher, but there's a cap. When the pool runs dry, gathering returns nothing and starvation follows.

This is the core HANDY dynamic: it's not just how much there is, it's how unequally it's distributed and how fast the commons degrades.

## Community pool, taxation, and welfare

A small tax fraction is taken from everyone each year and pooled. Persons below a resource threshold (and orphaned children) receive welfare from that pool. Criminals forfeit resources to it on detection. Deceased persons' estates are split between the pool, their partner, and their children.

## Outcome classification

Each run ends with a verdict based on four dimensions: population decline from its peak, final Gini coefficient, average happiness, and how full the resource pool is. The verdicts are `EXTINCTION`, `COLLAPSE`, `STRUGGLING`, `STABLE`, and `THRIVING`. THRIVING requires all four to look good simultaneously — in practice it's rare, because the model is collapse-prone by design.

## Docs

* `docs/odd-protocol.md` — full formal model specification (ODD 2020 protocol)
* `docs/decisions/` — design decision records (ARDs) for every non-obvious choice
* `docs/future-ideas.md` — candidate mechanics not yet built
* `docs/research-*.md` — calibration studies for fertility, mortality, tuning, and more
* `docs/project-background.md` — research inspirations and design philosophy
