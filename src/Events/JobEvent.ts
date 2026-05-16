import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { ageModifier } from '../Helpers/AgeModifier';
import { RNG } from '../Helpers/Types';

/** Unconditional event: person may gain or lose employment each tick. See ARD 020. */
export default class JobEvent implements IEvent {
  /** @param rng - seeded random source */
  constructor(private rng: RNG) {}

  /**
   * Attempt job gain (if unemployed) or job loss (if employed).
   * Gain probability scales with experience, charisma, and the work age modifier.
   * Loss probability has a flat base plus a stat-inverse term that penalises low capability.
   *
   * @param person - person whose employment status may change
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;
    if (!person.hasJob) {
      const educationMultiplier = 1 + person.education * Variables.EDUCATION_JOB_GAIN_SCALAR;
      const gainProb = Math.min(1, (person.experience * Variables.JOB_GAIN_EXPERIENCE_SCALAR
        + person.charisma * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(person.age, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR)
        * educationMultiplier);
      if (this.rng() < gainProb) {
        person.hasJob = true;
      }
    } else {
      const lossProb = Variables.JOB_LOSS_BASE
        + Variables.JOB_LOSS_STAT_SCALAR * (1 / (person.experience + 1)) * (1 / (person.charisma + 1));
      if (this.rng() < lossProb) {
        person.hasJob = false;
      }
    }
  }
}
