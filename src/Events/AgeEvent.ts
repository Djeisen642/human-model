import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Constants from '../Helpers/Constants';
import Variables from '../Helpers/Variables';

/** Advances a person's age by one tick; kills them if they reach OLD_AGE. */
export default class AgeEvent implements IEvent {
  /**
   * Increment age and trigger old-age death when age reaches the threshold.
   *
   * @param person - the person aging
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    person.age++;
    if (person.age >= Variables.OLD_AGE) {
      simulation.kill(person, Constants.CAUSE_OF_DEATH.OLD_AGE);
    }
  }
}
