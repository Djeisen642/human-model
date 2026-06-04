# Research: Age-Related Physical and Cognitive Decline

Gathered to calibrate ARD 048 (stat caps and age-based decay for `constitution` and `intelligence`). Sources: PMC sarcopenia reviews, Karolinska 47-year longitudinal study (ScienceDaily 2026), NSCA resistance training position statement, Nature Medicine n=170,795 education/cognition study, Seattle Longitudinal Study, Berlin Aging Study, MIT cognitive skills lifespan analysis, Frontiers masters athlete endurance review.

## Physical decline (maps to `constitution`)

### Peak and onset

Muscle mass and strength peak at **ages 20–30**. A 47-year Swedish longitudinal study (Karolinska) found measurable decline beginning around **age 35** even in trained individuals.

### Decline rates by age bracket

| Age range | Strength loss per decade | Muscle mass loss per decade |
|---|---|---|
| 30–50 | ~8–10% | ~3–5% |
| 50–70 | ~10–15% | ~6% |
| 70+ (sedentary) | **25–40%** | accelerating |

By age 80: ~30% of peak muscle mass lost, ~50% of peak strength lost.

### Exercise as counterforce

- Resistance training produces **25–32% strength gains** even in older adults (NSCA meta-analysis).
- Masters sprinters (10-year longitudinal, PMC 2025): training maintained muscle histology but could not offset performance and strength decline; crucially, the decline did **not accelerate** after 70 as it does in sedentary populations.
- ~54% of VO₂max decline in male masters endurance athletes is explained by reductions in training volume — intensity maintenance is the primary lever.
- Conclusion: exercise substantially modifies the trajectory but cannot arrest it.

### Upper limits

World records in masters athletics show accelerated declines after 70 in all disciplines. An 85-year-old completing the Hawaii Ironman demonstrates remarkable outlier longevity, not typical outcome. Linear performance decline across the lifespan is the dominant pattern; the inflection at 70 is the steepest phase.

---

## Cognitive decline (maps to `intelligence`)

### Peak and onset

**Fluid intelligence** (processing speed, working memory, novel problem-solving) peaks at **ages 20–27**; some components (face recognition, visual short-term memory) peak in the early 30s; certain aspects of fluid reasoning as late as 40.

**Crystallized intelligence** (vocabulary, domain knowledge, expertise) grows through the 60s and remains stable until ~90. In this model, `experience` already represents crystallized knowledge — it is explicitly not what decays here.

### Decline rates

| Measure | Rate |
|---|---|
| Fluid intelligence (IQ units) | ~3–7 points per decade (ages 30–60) |
| Cognitive speed | ~4.9% per decade in midlife |
| Processing speed | ~−0.26 SD per decade (pooled across cohorts) |
| Working memory / executive function | begins declining 30–40, accelerates noticeably after 65 |

### Education and learning as counterforce

**Two independent large-scale findings agree on the key distinction:**

1. Nature Medicine (n=407,356 memory scores; n=15,157 brain MRIs, 33 countries): higher education associates with better memory and larger brain volumes, but **does not slow the rate of decline**. The advantage is a higher starting point, not a shield.
2. Victoria Longitudinal Study (12-year): same conclusion — education raises the floor, does not change the slope.

**Lifelong active learning** (Oxford Academic 2025, Frontiers 2025): later-life learning activities show more promise than formal education for mitigating rate of decline, particularly after 65 when baseline is lower and decline is faster. Effect sizes are moderate and context-dependent.

**Simulation implication:** In this model, `intelligence` represents fluid processing capacity. `experience` represents crystallized knowledge and expertise, and already grows with education/employment (ARD 017). The compensation effect documented in aging research (an experienced physician diagnoses better despite slower processing) is correctly captured by `experience` carrying cognitive load into old age — `intelligence` decay does not need to model that compensation, `experience` already does.

### Upper limits

Cognitive performance upper limits with age: even highly trained individuals (chess grandmasters, professional musicians) show measurable slowing on reaction-time tasks by their 50s. The compensating mechanism is expertise-driven pattern recognition (crystallized), not preserved fluid speed.

---

## Calibration anchors for simulation constants

These are the empirical targets the constants in `Variables.ts` should be calibrated to hit in a representative run.

**Constitution decay:**
- Decay should be negligible before 35, meaningful (~1–2% annual probability of −1) at age 50, substantial (~3–5% annual) at age 70+, to match 10–15%/decade and 25–40%/decade brackets above.
- Active exercisers (ExerciseEvent fires ~15–25% of ticks) partially offset decay, matching the masters-athlete finding of slower but ongoing decline.

**Intelligence decay:**
- Decay should be lighter than physical and start later (~40 vs. ~30).
- Target: ~0.5–1% annual probability at 50, ~2% at 70+, matching the ~4.9% cognitive-speed decline per decade in midlife and steeper post-65 trajectory.
- LearnEvent / GraduationEvent still increment intelligence; active learners age more slowly cognitively, matching the lifelong-learning literature.

**Hard caps:**
- Seeded [1, 10]. Cap at 20 (2× seed ceiling) leaves meaningful headroom for active lifestyles without enabling immortality via DisasterEvent's `/ constitution` division.
