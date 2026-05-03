import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Unconditional event: updates person.illness severity each tick via independent onset
 * and recovery rolls. Severity is clamped to [0, 1]. Older persons get higher onset
 * and lower recovery; higher constitution reverses both. See ARD 018.
 */
export default class IllnessEvent implements IEvent {
  /** @param rng - seeded random number source */
  constructor(private rng: RNG) {}

  /**
   * Roll onset and recovery independently, then clamp illness to [0, 1].
   *
   * @param person - person whose illness is updated
   * @param simulation - current simulation state (unused but required by IEvent)
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;

    const ageRisk = 1 + person.age / Variables.ILLNESS_AGE_RISK_DIVISOR;

    if (this.rng() < Variables.BASE_ILLNESS_ONSET * ageRisk / person.constitution) {
      person.illness += Variables.ILLNESS_ONSET_AMOUNT;
    }

    if (this.rng() < Variables.BASE_ILLNESS_RECOVERY * person.constitution / ageRisk) {
      person.illness -= Variables.ILLNESS_RECOVERY_AMOUNT;
    }

    person.illness = Math.max(0, Math.min(1, person.illness));
  }
}
