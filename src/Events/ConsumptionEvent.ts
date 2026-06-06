import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';

/** Deducts living costs each tick and routes starvation through the illness system (ARD 024). */
export default class ConsumptionEvent implements IEvent {
  /**
   * Deducts age-scaled living costs from person.resources and applies starvation
   * illness when resources reach zero.
   *
   * Children with living parents consume a percentage of their own resources;
   * orphaned children and all adults pay a flat age-scaled rate.
   *
   * @param person - person paying living costs
   * @param simulation - current simulation state; consumption is recorded for reporting
   */
  execute(person: Person, simulation: Simulation): void {
    if (person.causeOfDeath !== null) return;

    let cost: number;

    if (person.age < Variables.CONSUMPTION_CHILD_MAX_AGE && person.livingParents.length > 0) {
      cost = person.resources * Variables.CONSUMPTION_CHILD_RESOURCE_RATE;
    } else {
      const multiplier = person.age >= Variables.CONSUMPTION_ELDER_MIN_AGE
        ? Variables.CONSUMPTION_ELDER_MULTIPLIER
        : 1.0;
      cost = Variables.CONSUMPTION_BASE * multiplier;
    }

    const before = person.resources;
    person.resources = Math.max(0, person.resources - cost);
    simulation.recordConsumption(before - person.resources);

    if (cost > 0 && person.resources === 0) {
      person.illness = Math.min(1, person.illness + Variables.STARVATION_ILLNESS_RATE);
    }
  }
}
