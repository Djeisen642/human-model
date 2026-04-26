import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';

/** Advances a person's age by one tick. Death from aging is handled by MisfortuneEvent via ageMortalityModifier. */
export default class AgeEvent implements IEvent {
  /**
   * Increment age by one tick.
   *
   * @param person - the person aging
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;
    person.age++;
  }
}
