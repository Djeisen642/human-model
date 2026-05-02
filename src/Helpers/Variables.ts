export default class Variables {
  /** Baseline happiness every person receives regardless of circumstances. Raise if too many persons floor at 0. */
  static HAPPINESS_BASELINE = 0;

  static ILLNESS = 0.05;
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
