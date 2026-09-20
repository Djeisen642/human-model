import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';

/**
 * Unconditional event: person extracts resources from the natural pool each tick.
 * Strictly conservative: pool drain equals personal gain. See ARD 039.
 */
export default class GatherResourcesEvent implements IEvent {
  /**
   * Extract resources from the pool and credit them to the person.
   * Potential is experience-primary with intelligence as a floor multiplier,
   * scaled by extractionProductivity and by the person's wealth-derived claim on the commons
   * (`accessMultiplier`, ARD 068; exactly 1 for everyone while that mechanism is off, and
   * multiplication by 1 is exact, so the default configuration is unchanged).
   * Actual extraction is capped by the pool.
   *
   * @param person - the person gathering
   * @param simulation - current simulation state (pool is depleted in place)
   */
  execute(person: Person, simulation: Simulation): void {
    const potential = person.experience * (Variables.BASE_GATHER_AMOUNT + person.intelligence * Variables.INTELLIGENCE_GATHER_SCALAR);
    const output = potential * simulation.extractionProductivity * person.accessMultiplier;
    const extracted = Math.min(output, simulation.naturalResources);

    person.resources += extracted;
    simulation.naturalResources -= extracted;
  }
}
