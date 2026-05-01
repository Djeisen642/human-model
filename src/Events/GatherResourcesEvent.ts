import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';

/** Unconditional event: person attempts to extract resources from the natural pool each tick. */
export default class GatherResourcesEvent implements IEvent {
  /**
   * Extract resources from the pool and credit them to the person.
   * Potential is experience-primary with intelligence as a floor multiplier.
   * Actual extraction is capped by what the pool can supply.
   *
   * @param person - the person gathering
   * @param simulation - current simulation state (pool is depleted in place)
   */
  execute(person: Person, simulation: Simulation): void {
    const potential = person.experience * (Variables.BASE_GATHER_AMOUNT + person.intelligence * Variables.INTELLIGENCE_GATHER_SCALAR);
    const available = simulation.naturalResources / simulation.extractionEfficiency;
    const extracted = Math.min(potential, available);

    person.resources += extracted;
    simulation.naturalResources -= extracted * simulation.extractionEfficiency;
  }
}
