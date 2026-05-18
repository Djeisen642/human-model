import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Probability-gated at factory: draws a uniform random "lucky find" from the
 * natural resource pool and credits it to the person. Strictly conservative —
 * pool drain equals personal gain; when the pool is empty, no windfall fires.
 * Acts as the inequality counter-force to KillEvent and StealEvent.
 * See ARD 028 (original) and ARD 040 (pool-sourced).
 */
export default class WindfallEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Debit a uniform random draw in [WINDFALL_BASE_AMOUNT, WINDFALL_BASE_AMOUNT + WINDFALL_VARIANCE]
   * from the pool and credit it to the person. Clamped to whatever the pool can supply.
   *
   * @param person - the recipient
   * @param simulation - simulation whose pool funds the windfall
   */
  execute(person: Person, simulation: Simulation): void {
    const drawn = Variables.WINDFALL_BASE_AMOUNT + this.rng() * Variables.WINDFALL_VARIANCE;
    const granted = Math.min(drawn, simulation.naturalResources);
    simulation.naturalResources -= granted;
    person.resources += granted;
  }
}
