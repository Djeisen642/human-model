import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Intent-gated event: helper transfers a fraction of their resources to a lower-resource target.
 * The first positive-sum social interaction in the model; directly reduces Gini by moving
 * resources from richer to poorer. On a successful transfer, adds a transient happiness boost
 * to the helper (warm-glow effect). No-ops when no eligible target exists or the helper has
 * no resources. See ARD 045, ARD 046.
 */
export default class HelpEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Transfer a fraction of the helper's resources to a random lower-resource target.
   * No-op if no other person exists, the drawn target has equal or more resources than
   * the helper, or the helper has no resources to give.
   *
   * @param person - the helper
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    const target = simulation.getRandomOther(person, this.rng);
    if (!target || target.resources >= person.resources || person.resources <= 0) return;

    const amount = Math.min(
      person.resources * Variables.HELP_FRACTION,
      Variables.HELP_MAX_AMOUNT,
    );

    person.resources -= amount;
    target.resources += amount;

    person.helpHappinessBoost = Math.min(
      person.helpHappinessBoost + Variables.HELP_HAPPINESS_BOOST,
      Variables.HELP_HAPPINESS_MAX,
    );
  }
}
