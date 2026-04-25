import Person from '../App/Person';
import Simulation from '../App/Simulation';

/** Contract all simulation events must satisfy. */
export default interface IEvent {
  /**
   * Apply the event's effect to `person` within the context of `simulation`.
   *
   * @param person - the person experiencing the event
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void;
}
