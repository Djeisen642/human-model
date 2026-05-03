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

  /** Starting size of the natural resource pool (also the initial ceiling). */
  static NATURAL_RESOURCE_CEILING_INITIAL = 10_000;
  /** Pool replenishment per tick, capped at the current ceiling. */
  static NATURAL_RESOURCE_REGEN_RATE = 50;
  /** Relative weight for invention outcome: extraction efficiency worsens. */
  static INVENTION_DEPLETION_FASTER_WEIGHT = 1;
  /** Relative weight for invention outcome: extraction efficiency improves. */
  static INVENTION_DEPLETION_SLOWER_WEIGHT = 1;
  /** Relative weight for invention outcome: resource ceiling grows. */
  static INVENTION_CEILING_GROWTH_WEIGHT = 1;
  /** Scales inventor's intelligence into the magnitude of any invention effect. */
  static INVENTION_MAGNITUDE_SCALAR = 0.05;

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

  static INVENTION_PEAK_AGE = 40;
  static INVENTION_AGE_SCALE = 45;
  static INVENTION_AGE_FLOOR = 0.1;

  static LYING_PEAK_AGE = 32;
  static LYING_AGE_SCALE = 40;
  static LYING_AGE_FLOOR = 0.1;

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
