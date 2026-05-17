import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';

/**
 * Replaces the normal gather/consume cycle for incarcerated persons.
 * Adds JAIL_GATHER_AMOUNT flat to resources and deducts JAIL_CONSUMPTION_AMOUNT flat.
 * Resources floor at 0. If net consumption exceeds gather, starvation illness accumulates
 * via the same path as ConsumptionEvent.
 * See ARD 035.
 */
export default class JailEvent implements IEvent {
  /**
   * Execute flat jail economics for this tick.
   * Starvation illness fires when resources would go negative after deduction.
   *
   * @param person - the incarcerated person
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;
    person.resources += Variables.JAIL_GATHER_AMOUNT;

    const cost = Variables.JAIL_CONSUMPTION_AMOUNT;
    if (person.resources < cost) {
      person.illness = Math.min(1, person.illness + Variables.STARVATION_ILLNESS_RATE);
      person.resources = 0;
    } else {
      person.resources -= cost;
    }
  }
}
