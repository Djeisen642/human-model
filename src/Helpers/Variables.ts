export default class Variables {
  /** Baseline happiness every person receives regardless of circumstances. Raise if too many persons floor at 0. */
  static HAPPINESS_BASELINE = 0;

  /** Severity scalar for illness death: illnessDeathProb = illness * ILLNESS_DEATH_SCALAR * ageMortalityModifier. Higher than the old ILLNESS constant because typical severity is well below 1. */
  static ILLNESS_DEATH_SCALAR = 0.08;
  /** Suicide probability at happiness=0; falls as happiness rises (divided by happiness+1). */
  static SUICIDE_PROBABILITY_SCALE = 0.03;

  /** Base resources gathered per point of experience, regardless of intelligence. */
  static BASE_GATHER_AMOUNT = 0.05;
  /** Additional resources gathered per point of experience per point of intelligence. */
  static INTELLIGENCE_GATHER_SCALAR = 0.005;

  /** Age of minimum mortality; the U-curve is centred here. */
  static PRIME_AGE = 28;
  /** Controls steepness of the U-shaped mortality curve. */
  static AGE_DEATH_CURVATURE = 0.001;

  /** Initial size of the natural resource pool at t=0; defaults to the ceiling but can be set independently for scarcity scenarios. See ARD 044. */
  static NATURAL_RESOURCES_INITIAL = 10_000;
  /** Initial carrying capacity (maximum accessible pool). See ARD 007. */
  static NATURAL_RESOURCE_CEILING_INITIAL = 10_000;
  /** Per-tick pool replenishment as a fraction of the current ceiling; clamped at ceiling. See ARD 043. */
  static NATURAL_RESOURCE_REGEN_FRACTION = 0.03;
  /** Initial extraction productivity multiplier on gather. 1.0 = no boost or drag. See ARD 039. */
  static EXTRACTION_PRODUCTIVITY_INITIAL = 1.0;
  /** Lower floor on extraction productivity; prevents the slower-invention branch from making gather permanently impossible. See ARD 039. */
  static EXTRACTION_PRODUCTIVITY_FLOOR = 0.01;
  /** Upper cap on extraction productivity; bounds the faster-invention branch so a tech-boom streak cannot drain the pool in a few ticks (collapse-lock). See ARD 047. */
  static MAX_EXTRACTION_PRODUCTIVITY = 10.0;
  /** Upper cap on the natural resource ceiling; bounds the ceiling-growth invention branch so scarcity stays reachable (no thrive-lock) — a large multiple of the initial ceiling. See ARD 047. */
  static MAX_NATURAL_RESOURCE_CEILING = 1_000_000;
  /** Relative weight for invention outcome: productivity rises (tech boom — more output, faster pool drain). See ARD 039. */
  static INVENTION_DEPLETION_FASTER_WEIGHT = 1;
  /** Relative weight for invention outcome: productivity falls (austerity tech — less output, slower pool drain). See ARD 039. */
  static INVENTION_DEPLETION_SLOWER_WEIGHT = 1;
  /** Relative weight for invention outcome: resource ceiling grows. Weighted higher than productivity branches so invention serves as the population-cap unlock. See ARD 043. */
  static INVENTION_CEILING_GROWTH_WEIGHT = 2;
  /** Scales inventor's intelligence into the magnitude of any invention effect. */
  static INVENTION_MAGNITUDE_SCALAR = 0.05;
  /** Per-tick base probability of an invention, multiplied by intelligence (1–10) and ageModifier. At intelligence=10, peak age: ~2% per tick. */
  static BASE_INVENTION_RATE = 0.002;

  // StatDecayEvent constants (ARD 048)
  /** Hard upper bound on constitution; caps ExerciseEvent increments. Calibration intent: high enough that a lifelong exerciser reaches an elevated ceiling; low enough that DisasterEvent and IllnessEvent retain meaningful mortality at any age. */
  static CONSTITUTION_MAX = 20;
  /** Age before which constitution decay probability is zero. Physical decline is negligible before this age. */
  static CONSTITUTION_DECAY_START_AGE = 30;
  /** Per-tick constitution decay probability per year past CONSTITUTION_DECAY_START_AGE. Calibration intent: ~1% annual at age 50, ~4% at age 70, matching 10–15%/decade (50–70) and 25–40%/decade (70+) from sarcopenia research. */
  static CONSTITUTION_DECAY_BASE_RATE = 0.001;
  /** Hard upper bound on intelligence; caps LearnEvent and GraduationEvent increments. Calibration intent: same principle as CONSTITUTION_MAX. */
  static INTELLIGENCE_MAX = 20;
  /** Age before which intelligence decay probability is zero. Cognitive decline onset is later than physical. */
  static INTELLIGENCE_DECAY_START_AGE = 40;
  /** Per-tick intelligence decay probability per year past INTELLIGENCE_DECAY_START_AGE. Calibration intent: lighter than constitution; ~0.7% annual at age 50, ~2% at age 70, matching ~5%/decade fluid-intelligence decline in midlife studies. */
  static INTELLIGENCE_DECAY_BASE_RATE = 0.0007;

  // IllnessEvent constants (ARD 018)
  /** Onset probability at ageRisk=1, constitution=1. */
  static BASE_ILLNESS_ONSET = 0.05;
  /** Recovery probability at ageRisk=1, constitution=1. Most minor illnesses heal in a year. */
  static BASE_ILLNESS_RECOVERY = 0.4;
  /** Severity increase per onset event. Five onsets = fully ill. */
  static ILLNESS_ONSET_AMOUNT = 0.2;
  /** Severity decrease per recovery event. */
  static ILLNESS_RECOVERY_AMOUNT = 0.3;
  /** Divisor for the linear age risk scaler: ageRisk = 1 + age/divisor. Doubles at 30, triples at 60. */
  static ILLNESS_AGE_RISK_DIVISOR = 30;

  // ExperienceEvent constants (ARD 017)
  /** Base experience gained per tick regardless of other factors. */
  static BASE_EXPERIENCE_GROWTH = 1.0;
  /** Age below which childhood attenuation applies. */
  static EXPERIENCE_CHILDHOOD_AGE = 5;
  /** Multiplier on BASE_EXPERIENCE_GROWTH for children under EXPERIENCE_CHILDHOOD_AGE. */
  static EXPERIENCE_CHILDHOOD_FACTOR = 0.2;
  /** Bonus experience per point of intelligence, scaled by learning-curve age modifier. */
  static INTELLIGENCE_EXPERIENCE_SCALAR = 0.05;
  /** Extra experience gained per tick while enrolled in education. */
  static EDUCATION_EXPERIENCE_BONUS = 0.5;
  /** Extra experience gained per tick while employed (and not in education). */
  static EMPLOYMENT_EXPERIENCE_BONUS = 0.3;
  /** Experience lost per tick for unemployed, non-student working-age adults. */
  static ADULT_IDLENESS_DECAY = 0.5;
  /** Experience lost per tick for idle persons aged EXPERIENCE_ELDERLY_AGE or older. */
  static ELDERLY_IDLENESS_DECAY = 0.2;
  /** Age at which elderly idleness decay replaces adult decay. */
  static EXPERIENCE_ELDERLY_AGE = 65;
  /** Maximum experience a person can hold; prevents centenarian extraction dominance. */
  static EXPERIENCE_CAP = 50;

  // JobEvent constants (ARD 020, ARD 022)
  /** Contribution of each point of experience to the per-tick job-gain probability. */
  static JOB_GAIN_EXPERIENCE_SCALAR = 0.03;
  /** Contribution of each point of charisma to the per-tick job-gain probability. */
  static JOB_GAIN_CHARISMA_SCALAR = 0.05;
  /** Flat per-tick probability of losing a job regardless of stats. */
  static JOB_LOSS_BASE = 0.02;
  /** Scales the stat-inverse term added to the flat job-loss rate; penalises low experience and charisma. */
  static JOB_LOSS_STAT_SCALAR = 0.5;
  /** Multiplicative bonus per education tier on job-gain probability. At BACHELORS (3): ×1.45. Calibration placeholder. */
  static EDUCATION_JOB_GAIN_SCALAR = 0.15;

  // EnrollmentEvent constants (ARD 023)
  /** Per-tick probability ceiling for a person to enroll in the next education level; scaled by learningIntent and ageModifier. Calibrated so peak-age adults enroll at ~2–3% per tick, matching empirical adult enrollment flow. */
  static BASE_ENROLLMENT_RATE = 0.05;

  // GraduationEvent constants (ARD 021)
  /** Per-tick graduation probability for an enrolled person at peak age. Yields a 5-tick average completion time. */
  static BASE_GRADUATION_RATE = 0.2;
  /** Maximum age for high-school enrollment seeding in Simulation.seed(). */
  static GRADUATION_HS_MAX_AGE = 17;
  /** Maximum age for college enrollment seeding in Simulation.seed(). */
  static GRADUATION_COLLEGE_MAX_AGE = 24;
  /** Probability that a seeded person aged ≤ GRADUATION_HS_MAX_AGE is enrolled in high school. */
  static GRADUATION_HS_SEED_RATE = 0.7;
  /** Probability that a seeded person aged 18–GRADUATION_COLLEGE_MAX_AGE is enrolled in college. */
  static GRADUATION_COLLEGE_SEED_RATE = 0.4;
  /** Probability that a seeded adult (age > GRADUATION_COLLEGE_MAX_AGE) has completed high school. */
  static GRADUATION_ADULT_HS_RATE = 0.85;
  /** Conditional probability of completing a bachelor's degree, given high school, for seeded adults. */
  static GRADUATION_ADULT_BACHELORS_RATE = 0.40;
  /** Conditional probability of completing a master's degree, given bachelor's, for seeded adults. */
  static GRADUATION_ADULT_MASTERS_RATE = 0.25;
  /** Conditional probability of completing a PhD, given master's, for seeded adults. */
  static GRADUATION_ADULT_PHD_RATE = 0.20;

  // ChildbirthEvent constants (ARD 029)
  /** Per-tick ceiling probability for a healthy, well-resourced, partnered couple at peak age. Calibrated to Hutterite natural fertility (~40–55% at ages 20–30). */
  static BASE_CHILDBIRTH_RATE = 0.40;
  /** Illness suppressor: at 0.8, full illness (1.0) eliminates fertility; 0.5 illness halves it. */
  static CHILDBIRTH_ILLNESS_SCALAR = 0.8;
  /** Resource floor below which fertility is zero; models famine-threshold amenorrhea. */
  static CHILDBIRTH_RESOURCE_MIN = 10;
  /** Resource level at which full fertility is restored; linear ramp between MIN and SCALE. */
  static CHILDBIRTH_RESOURCE_SCALE = 30;
  /** Happiness multiplier on birth probability; small but real signal (0.05 → +50% at happiness=10). */
  static CHILDBIRTH_HAPPINESS_SCALAR = 0.05;
  /** One-time resource deduction per parent at birth; ~25% of median resources. */
  static CHILDBIRTH_BIRTH_COST = 12;

  // Newborn heritability constants (ARD 037)
  /** Anchor point that newborn stats regress toward; midpoint of the adult seed range [1, 10]. */
  static NEWBORN_STAT_POPULATION_MEAN = 5.5;
  /** Strength of regression toward parental mean for stats. ~0.4 matches twin-study heritability for physical/cognitive traits. */
  static HERITABILITY_STAT_COEFFICIENT = 0.4;
  /** Uniform noise half-width on newborn stat draws. Calibrated so worst-case parental mean still yields positive child stats. */
  static HERITABILITY_STAT_NOISE_RANGE = 2.5;
  /** Strength of regression toward parental intent for intents (target = 0). Lower than stat coefficient: behavioral transmission is weaker than trait heritability. */
  static HERITABILITY_INTENT_COEFFICIENT = 0.25;
  /** Uniform noise half-width on newborn intent draws. Large enough to occasionally produce antisocial intents in clean lineages. */
  static HERITABILITY_INTENT_NOISE_RANGE = 0.05;

  // WindfallEvent constants (ARD 028)
  /** Per-tick base probability of a windfall at peak age; ~3% annually, consistent with SCF/HRS inheritance prevalence. */
  static BASE_WINDFALL_RATE = 0.03;
  /** Minimum resources added per windfall; floor of the uniform draw. */
  static WINDFALL_BASE_AMOUNT = 5;
  /** Width of the uniform draw above the base; controls spread of windfall sizes. */
  static WINDFALL_VARIANCE = 15;

  // KillEvent constants (ARD 027)
  /** Amplifies kill-attempt probability with inequality. At Gini=0.6 (collapse threshold) with this value, attempt rate roughly doubles compared to Gini=0. */
  static KILL_GINI_SCALAR = 1.5;
  /** Probability of a fatal outcome when victim has constitution=1; divided by victim.constitution at execution time. */
  static KILL_SUCCESS_BASE = 0.5;

  // HelpEvent constants (ARD 045)
  /** Scales charisma into help probability above intent alone; same magnitude as STEAL_CHARISMA_SCALAR for symmetric treatment. */
  static HELP_CHARISMA_SCALAR = 0.05;
  /** Fraction of helper's resources given per event; calibrated symmetric with STEAL_FRACTION so a single help offsets roughly one steal. */
  static HELP_FRACTION = 0.1;
  /** Hard ceiling on a single transfer; prevents destabilising wealth movements from very wealthy helpers. */
  static HELP_MAX_AMOUNT = 10;

  // Transient happiness boosts (ARD 046)
  /** Happiness added per successful help; modest warm-glow signal. */
  static HELP_HAPPINESS_BOOST = 2;
  /** Maximum accumulated help boost; caps at roughly the job-employment bonus. */
  static HELP_HAPPINESS_MAX = 5;
  /** Happiness subtracted from help boost each tick; controls warm-glow duration (boost / decay = ticks). */
  static HELP_HAPPINESS_DECAY = 0.5;
  /** Happiness added per confirmed kill; stronger immediate signal than helping. */
  static KILL_HAPPINESS_BOOST = 3;
  /** Maximum accumulated kill boost; same ceiling as help boost. */
  static KILL_HAPPINESS_MAX = 5;
  /** Happiness subtracted from kill boost each tick; decays faster than help to reflect brief arousal. */
  static KILL_HAPPINESS_DECAY = 1.0;

  // StealEvent constants (ARD 026)
  /** Scales charisma into steal probability; small so zero-charisma persons can still steal. Charisma range 1–10 adds 5–50% above intent alone. */
  static STEAL_CHARISMA_SCALAR = 0.05;
  /** Fraction of victim's current resources taken per theft. */
  static STEAL_FRACTION = 0.1;
  /** Hard ceiling on a single theft; prevents large resource transfers from destabilising the simulation. */
  static STEAL_MAX_AMOUNT = 10;

  // Jail and retribution constants (ARD 035)
  /** Baseline per-theft detection probability before crime-count scaling. Lower than kill rate — theft is easier to conceal. */
  static BASE_DETECT_RATE_STEAL = 0.05;
  /** Baseline per-kill detection probability. Higher than steal — murder is harder to conceal. */
  static BASE_DETECT_RATE_KILL = 0.15;
  /** Linear boost to detection probability per prior crime committed; encodes accumulating visibility of repeat offenders. */
  static DETECTION_CRIME_COUNT_SCALAR = 0.05;
  /** Sentence length in ticks for a theft conviction. */
  static JAIL_TICKS_STEAL = 3;
  /** Sentence length in ticks for a murder conviction; longer than theft. */
  static JAIL_TICKS_KILL = 10;
  /** Flat resources added per tick while jailed; below typical free gather to make incarceration economically costly. */
  static JAIL_GATHER_AMOUNT = 0.5;
  /** Flat resources consumed per tick while jailed. */
  static JAIL_CONSUMPTION_AMOUNT = 1.0;

  // Dynamic intent multipliers and emboldening constants (ARD 036)
  /** Permanent additive bump to stealingIntent per undetected theft; small enough that many thefts are needed to approach the cap. */
  static STEALING_EMBOLDEN_INCREMENT = 0.01;
  /** Maximum value stealingIntent can reach through emboldening; preserves the stochastic character of the event. */
  static STEALING_INTENT_CAP = 0.8;
  /** Resource level below which resource pressure on steal probability begins. Calibrated near the comfortable threshold. */
  static SITUATIONAL_STEAL_RESOURCE_THRESHOLD = 30;
  /** Maximum multiplier on steal probability at zero resources; roughly doubles probability at full pressure. */
  static SITUATIONAL_STEAL_SCALAR = 1.0;
  /** Happiness level below which happiness pressure on kill attempt probability begins. */
  static SITUATIONAL_KILL_HAPPINESS_THRESHOLD = 3.0;
  /** Maximum multiplier on kill attempt probability at zero happiness; roughly doubles probability at full pressure. */
  static SITUATIONAL_KILL_SCALAR = 1.0;

  // ConsumptionEvent constants (ARD 024)
  /** Resources consumed per tick by a working-age adult. Calibrated so a median gatherer covers costs without long-term depletion. */
  static CONSUMPTION_BASE = 1.0;
  /** Age below which a person is treated as a child for consumption purposes (exclusive). */
  static CONSUMPTION_CHILD_MAX_AGE = 15;
  /** Fraction of own resources consumed per tick by a child with at least one living parent. */
  static CONSUMPTION_CHILD_RESOURCE_RATE = 0.02;
  /** Age at or above which the elder multiplier applies. */
  static CONSUMPTION_ELDER_MIN_AGE = 65;
  /** Scalar on CONSUMPTION_BASE for elderly persons. */
  static CONSUMPTION_ELDER_MULTIPLIER = 1.5;
  /** Illness severity added per tick when resources reach 0 after deduction. */
  static STARVATION_ILLNESS_RATE = 0.25;

  // Per-event age profile constants — used by EventFactory via ageModifier()
  static CHILDBIRTH_PEAK_AGE = 26;
  static CHILDBIRTH_AGE_SCALE = 12;
  static CHILDBIRTH_AGE_FLOOR = 0.02;

  static WORK_PEAK_AGE = 35;
  static WORK_AGE_SCALE = 40;
  static WORK_AGE_FLOOR = 0.1;

  static GATHERING_PEAK_AGE = 28;
  static GATHERING_AGE_SCALE = 35;
  static GATHERING_AGE_FLOOR = 0.1;

  static EXERCISE_PEAK_AGE = 24;
  static EXERCISE_AGE_SCALE = 35;
  static EXERCISE_AGE_FLOOR = 0.1;

  static LEARNING_PEAK_AGE = 18;
  static LEARNING_AGE_SCALE = 45;
  static LEARNING_AGE_FLOOR = 0.15;

  static STEALING_PEAK_AGE = 24;
  static STEALING_AGE_SCALE = 30;
  static STEALING_AGE_FLOOR = 0.05;

  static KILLING_PEAK_AGE = 24;
  static KILLING_AGE_SCALE = 30;
  static KILLING_AGE_FLOOR = 0.05;

  static RELATIONSHIP_PEAK_AGE = 26;
  static RELATIONSHIP_AGE_SCALE = 35;
  static RELATIONSHIP_AGE_FLOOR = 0.1;

  // RelationshipEvent constants (ARD 025)
  /** Base per-tick formation probability before charisma and age scaling. At peak age with median charisma (5), yields ~8% formation rate. */
  static BASE_RELATIONSHIP_RATE = 0.12;
  /** Multiplies charisma (1–10) into formation probability; range 1.06–1.60. */
  static RELATIONSHIP_CHARISMA_SCALAR = 0.06;
  /** Flat per-tick probability that an existing relationship dissolves. Calibrated to ~40% lifetime dissolution at ~8yr average. */
  static BASE_BREAKUP_RATE = 0.03;

  static WINDFALL_PEAK_AGE = 58;
  static WINDFALL_AGE_SCALE = 20;
  static WINDFALL_AGE_FLOOR = 0.05;

  static INVENTION_PEAK_AGE = 40;
  static INVENTION_AGE_SCALE = 45;
  static INVENTION_AGE_FLOOR = 0.1;

  static HELP_PEAK_AGE = 40;
  static HELP_AGE_SCALE = 40;
  static HELP_AGE_FLOOR = 0.1;

  static GRADUATION_PEAK_AGE = 22;
  static GRADUATION_AGE_SCALE = 30;
  static GRADUATION_AGE_FLOOR = 0.15;

  static ENROLLMENT_PEAK_AGE = 22;
  static ENROLLMENT_AGE_SCALE = 40;
  static ENROLLMENT_AGE_FLOOR = 0.05;

  // Outcome classification thresholds (ARD 016)
  /** Final-decade avg Gini at or above this → COLLAPSE. */
  static COLLAPSE_GINI_THRESHOLD = 0.60;
  /** Final population below this fraction of start → COLLAPSE. */
  static COLLAPSE_POPULATION_FRACTION = 0.20;
  /** Final-decade avg Gini at or above this → at least STRUGGLING (unless COLLAPSE). */
  static STRUGGLING_GINI_THRESHOLD = 0.45;
  /** Final-decade avg happiness below this → at least STRUGGLING (unless COLLAPSE). */
  static STRUGGLING_HAPPINESS_THRESHOLD = 3.0;
  /** Final-decade avg Gini below this AND happiness at or above THRIVING_HAPPINESS_THRESHOLD → THRIVING. */
  static THRIVING_GINI_THRESHOLD = 0.30;
  /** Final-decade avg happiness at or above this (with Gini below threshold) → THRIVING. */
  static THRIVING_HAPPINESS_THRESHOLD = 6.0;

  // Community pool, taxation, and welfare constants (ARD 034)
  /** Flat fraction of each living person's resources deducted per tick and added to the community pool. */
  static TAX_RATE = 0.02;
  /** Resource level below which a person qualifies for welfare distribution each tick. */
  static WELFARE_THRESHOLD = 20;
  /** Fraction of the community pool retained as reserve after each distribution; prevents one-tick exhaustion. */
  static COMMUNITY_POOL_RESERVE_FRACTION = 0.20;
  /** Fraction of a convicted person's resources forfeited to the community pool on jailing (ARD 035). */
  static JAIL_RESOURCE_FORFEIT_FRACTION = 0.80;

  // Estate inheritance constants (ARD 042) — shares must sum to 1.0.
  /** Share of a deceased person's resources transferred to the community pool. Always applies. */
  static ESTATE_COMMUNITY_SHARE = 0.40;
  /** Share of a deceased person's resources transferred to the surviving partner; absorbs the children share when there are no living children. */
  static ESTATE_PARTNER_SHARE = 0.35;
  /** Share of a deceased person's resources split equally across living children; absorbs the partner share when there is no surviving partner. */
  static ESTATE_CHILDREN_SHARE = 0.25;

  // Disaster event constants (ARD 012)
  /** Probability that a disaster fires in any given tick (~1 in 10 ticks). */
  static DISASTER_PROBABILITY = 0.1;
  /** Upper bound on affected persons as a fraction of the living population. */
  static DISASTER_MAX_AFFECTED_FRACTION = 0.2;
  /** Minimum fraction of resources lost by each affected person. */
  static DISASTER_MIN_LOSS_FRACTION = 0.1;
  /** Maximum fraction of resources lost by each affected person. */
  static DISASTER_MAX_LOSS_FRACTION = 0.9;
  /**
   * Base probability that an affected person at prime age with constitution 1 dies.
   * Scaled by ageMortalityModifier / constitution at execution time.
   */
  static DISASTER_KILL_BASE = 0.1;
}
