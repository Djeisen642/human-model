import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Constants from '../Helpers/Constants';
import Variables from '../Helpers/Variables';

/**
 * Fires when an enrolled person completes their current education level.
 * Promotes isWorkingOnEd to education, clears enrollment, and boosts intelligence. See ARD 021.
 */
export default class GraduationEvent implements IEvent {
  /**
   * Graduate the person: set education to the completed level, clear enrollment, increment intelligence.
   *
   * @param person - person graduating
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;
    person.education = person.isWorkingOnEd;
    person.isWorkingOnEd = Constants.EDUCATION.NONE;
    person.intelligence = Math.min(Variables.INTELLIGENCE_MAX, person.intelligence + 1);
  }
}
