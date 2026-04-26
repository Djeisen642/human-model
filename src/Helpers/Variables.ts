export default class Variables {
  static ILLNESS = 0.05;

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
}
