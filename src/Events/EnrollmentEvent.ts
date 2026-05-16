import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';

/**
 * Fires when a non-enrolled person decides to pursue the next education level.
 * Advances isWorkingOnEd to education + 1. See ARD 023.
 */
export default class EnrollmentEvent implements IEvent {
  /**
   * Enroll the person in the next education level above their current credential.
   *
   * @param person - person enrolling
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;
    person.isWorkingOnEd = person.education + 1;
  }
}
