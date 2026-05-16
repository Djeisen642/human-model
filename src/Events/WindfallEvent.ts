import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Unconditional (probability-gated at factory): adds a flat random resource bump.
 * Flat magnitude is the counter-force to KillEvent's and StealEvent's
 * inequality-widening effects. See ARD 028.
 */
export default class WindfallEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Add a uniform random draw in [WINDFALL_BASE_AMOUNT, WINDFALL_BASE_AMOUNT + WINDFALL_VARIANCE]
   * to the person's resources.
   *
   * @param person - the recipient
   * @param simulation - unused; present to satisfy IEvent
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;
    person.resources += Variables.WINDFALL_BASE_AMOUNT + this.rng() * Variables.WINDFALL_VARIANCE;
  }
}
