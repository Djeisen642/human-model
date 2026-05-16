import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import StealingRecord from '../Records/StealingRecord';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Intent-gated event: thief takes a fraction of a random victim's resources.
 * No detection or retaliation — StealingRecord provides the hook for future mechanics.
 * See ARD 026.
 */
export default class StealEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Transfer a fraction of a random victim's resources to the thief.
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
  }
}
