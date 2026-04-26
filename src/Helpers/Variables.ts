export default class Variables {
  static ILLNESS = 0.05;
  static OLD_AGE = 60;
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
}