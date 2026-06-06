import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';

/**
 * Replaces the normal gather/consume cycle for incarcerated persons.
 * Each tick, draws up to JAIL_GATHER_AMOUNT from `communityPool` (clamped to
 * what the pool can supply) and deducts JAIL_CONSUMPTION_AMOUNT flat.
 * Resources floor at 0. If net consumption exceeds gather, starvation illness
 * accumulates via the same path as ConsumptionEvent. When the community pool
 * is empty, the prisoner receives nothing and starves through the existing
 * consumption check.
 * See ARD 035 (original) and ARD 041 (community-pool sourcing).
 */
export default class JailEvent implements IEvent {
  /**
   * Execute jail economics for this tick.
   * Starvation illness fires when resources would go negative after deduction.
   *
   * @param person - the incarcerated person
   * @param simulation - current simulation state (communityPool is debited in place)
   */
  execute(person: Person, simulation: Simulation): void {
    const granted = Math.min(Variables.JAIL_GATHER_AMOUNT, simulation.communityPool);
    simulation.communityPool -= granted;
    person.resources += granted;

    const cost = Variables.JAIL_CONSUMPTION_AMOUNT;
    const before = person.resources;
    if (person.resources < cost) {
      person.illness = Math.min(1, person.illness + Variables.STARVATION_ILLNESS_RATE);
      person.resources = 0;
    } else {
      person.resources -= cost;
    }
    simulation.recordConsumption(before - person.resources);
  }
}
