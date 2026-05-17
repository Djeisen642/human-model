import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import StealingRecord from '../Records/StealingRecord';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Intent-gated event: thief takes a fraction of a random victim's resources.
 * After the theft, a detection roll fires. On detection, resources are forfeited
 * to the community pool and a jail sentence begins (ARD 035). On non-detection,
 * stealingIntent receives a permanent emboldening bump (ARD 036).
 * See ARD 026, ARD 035, ARD 036.
 */
export default class StealEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Transfer a fraction of a random victim's resources to the thief,
   * then run detection and emboldening.
   * No-op if no other person exists or victim has no resources.
   *
   * @param person - the thief
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    const victim = simulation.getRandomOther(person, this.rng);
    if (!victim || victim.resources <= 0) return;

    const amount = Math.min(
      victim.resources * Variables.STEAL_FRACTION,
      Variables.STEAL_MAX_AMOUNT,
    );

    victim.resources -= amount;
    person.resources += amount;
    person.amountStolen.push(new StealingRecord(victim, amount, person.age));

    const priorCrimes = person.amountStolen.length + person.killed.size;
    const detectProb = Variables.BASE_DETECT_RATE_STEAL
      * (1 + priorCrimes * Variables.DETECTION_CRIME_COUNT_SCALAR);

    if (this.rng() < detectProb) {
      const forfeit = person.resources * Variables.JAIL_RESOURCE_FORFEIT_FRACTION;
      simulation.communityPool += forfeit;
      person.resources -= forfeit;
      person.jailedTicksRemaining += Variables.JAIL_TICKS_STEAL;
    } else {
      person.stealingIntent = Math.min(
        person.stealingIntent + Variables.STEALING_EMBOLDEN_INCREMENT,
        Variables.STEALING_INTENT_CAP,
      );
    }
  }
}
