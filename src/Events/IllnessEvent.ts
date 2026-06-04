import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Unconditional event: updates person.illness severity each tick via independent onset
 * and recovery rolls. Severity is clamped to [0, 1]. Older persons get higher onset
 * and lower recovery; higher constitution reverses both. Recovery additionally decays
 * with age past a senescence threshold (the elderly heal less), so chronic illness
 * accumulates in old age and carries old-age disease mortality. See ARD 018, ARD 049.
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

    // Recovery capacity declines with age past the senescence threshold (ARD 049):
    // the elderly heal less, so chronic illness accumulates and carries old-age disease mortality.
    const senescence = Math.max(
      Variables.ILLNESS_RECOVERY_SENESCENCE_FLOOR,
      1 - Variables.ILLNESS_RECOVERY_SENESCENCE_DECAY
        * Math.max(0, person.age - Variables.ILLNESS_RECOVERY_SENESCENCE_START_AGE)
    );

    if (this.rng() < Variables.BASE_ILLNESS_ONSET * ageRisk / person.constitution) {
      person.illness += Variables.ILLNESS_ONSET_AMOUNT;
    }

    if (this.rng() < Variables.BASE_ILLNESS_RECOVERY * person.constitution / ageRisk * senescence) {
      person.illness -= Variables.ILLNESS_RECOVERY_AMOUNT;
    }

    person.illness = Math.max(0, Math.min(1, person.illness));
  }
}
