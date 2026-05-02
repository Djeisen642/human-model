import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import { ageModifier } from '../Helpers/AgeModifier';
import Variables from '../Helpers/Variables';

/**
 * Unconditional event: updates person.experience each tick.
 * Growth comes from time, intelligence (fades with age via learning curve), and activity status.
 * Idleness decays experience; education and employment accelerate it.
 * Capped at EXPERIENCE_CAP; floored at 0. See ARD 017.
 */
export default class ExperienceEvent implements IEvent {
  /**
   * Compute and apply experience change for this tick.
   *
   * @param person - person whose experience is updated
   * @param simulation - current simulation state (unused but required by IEvent)
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;

    let growth = Variables.BASE_EXPERIENCE_GROWTH;

    if (person.age < Variables.EXPERIENCE_CHILDHOOD_AGE) {
      growth *= Variables.EXPERIENCE_CHILDHOOD_FACTOR;
    }

    const intelligenceFade = ageModifier(
      person.age,
      Variables.LEARNING_PEAK_AGE,
      Variables.LEARNING_AGE_SCALE,
      Variables.LEARNING_AGE_FLOOR,
    );
    growth += person.intelligence * Variables.INTELLIGENCE_EXPERIENCE_SCALAR * intelligenceFade;

    if (person.isWorkingOnEd) {
      growth += Variables.EDUCATION_EXPERIENCE_BONUS;
    } else if (person.hasJob) {
      growth += Variables.EMPLOYMENT_EXPERIENCE_BONUS;
    } else if (person.age >= Variables.EXPERIENCE_ELDERLY_AGE) {
      growth -= Variables.ELDERLY_IDLENESS_DECAY;
    } else {
      growth -= Variables.ADULT_IDLENESS_DECAY;
    }

    person.experience = Math.max(
      0,
      Math.min(Variables.EXPERIENCE_CAP, person.experience + growth),
    );
  }
}
