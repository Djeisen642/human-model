import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import { ageModifier } from '../Helpers/AgeModifier';
import { resourceGini } from '../Helpers/Inequality';
import Variables from '../Helpers/Variables';
import Constants from '../Helpers/Constants';
import { RNG } from '../Helpers/Types';

/**
 * Intent-gated event: killer attempts to murder a random victim.
 * Attempt probability is amplified by the current Gini coefficient (inequality→violence loop)
 * and by low happiness (frustration-aggression, ARD 036).
 * After a successful kill, a detection roll fires; on detection, resources are forfeited
 * to the community pool and a jail sentence begins (ARD 035).
 * See ARD 027, ARD 035, ARD 036.
 */
export default class KillEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Attempt to kill a random other person.
   * No-op if no other person exists or the attempt roll fails.
   * Rolls: attempt (killingIntent × ageModifier × Gini boost × happiness pressure),
   * then success (KILL_SUCCESS_BASE / victim.constitution).
   * On success: delegates to simulation.kill(), sets killHappinessBoost (ARD 046),
   * then runs detection check.
   *
   * @param person - the potential killer
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    const happinessPressure = Math.max(
      0,
      1 - person.happiness / Variables.SITUATIONAL_KILL_HAPPINESS_THRESHOLD,
    );

    // The attempt probability is `intentAge * giniFactor * happinessFactor`, where the only
    // expensive term is the population-wide Gini. Draw first, then bracket: `resourceGini`
    // returns [0, 1), so `giniFactor` lies in [1, 1 + KILL_GINI_SCALAR] and the probability is
    // bracketed by evaluating the same expression at both ends. A roll outside that bracket
    // decides the branch without the Gini at all, which is the common case — the bracket is
    // only `KILL_GINI_SCALAR` wide relative to a probability already below ~0.1, so the
    // population scan runs for a few percent of person-ticks instead of all of them.
    //
    // Two properties make this exactly equivalent to computing the Gini up front rather than
    // an approximation of it. `resourceGini` is pure and draws no random numbers, so hoisting
    // the roll above it leaves the RNG stream untouched; and the in-bracket expression below
    // multiplies its terms in the original order, so it is bit-for-bit the old probability.
    const intentAge = person.killingIntent
      * ageModifier(person.age, Variables.KILLING_PEAK_AGE, Variables.KILLING_AGE_SCALE, Variables.KILLING_AGE_FLOOR);
    const happinessFactor = 1 + happinessPressure * Variables.SITUATIONAL_KILL_SCALAR;

    const roll = this.rng();
    const upperBound = intentAge * (1 + Variables.KILL_GINI_SCALAR) * happinessFactor;
    if (roll >= upperBound) return;

    // Multiplication is monotonic over non-negative operands, so the Gini=0 evaluation is a
    // true lower bound and a roll beneath it attempts regardless of the real Gini.
    let attemptProb = intentAge * 1 * happinessFactor;
    if (roll >= attemptProb) {
      const currentGini = resourceGini(simulation.getLiving());
      attemptProb = intentAge
        * (1 + currentGini * Variables.KILL_GINI_SCALAR)
        * happinessFactor;
    }
    if (roll >= attemptProb) return;

    const victim = simulation.getRandomOther(person, this.rng);
    if (!victim) return;

    const successProb = Variables.KILL_SUCCESS_BASE / Math.max(1, victim.constitution);
    if (this.rng() < successProb) {
      simulation.kill(victim, Constants.CAUSE_OF_DEATH.MURDER, person);

      person.killHappinessBoost = Math.min(
        person.killHappinessBoost + Variables.KILL_HAPPINESS_BOOST,
        Variables.KILL_HAPPINESS_MAX,
      );

      const priorCrimes = person.amountStolen.length + person.killed.size;
      const detectProb = Variables.BASE_DETECT_RATE_KILL
        * (1 + priorCrimes * Variables.DETECTION_CRIME_COUNT_SCALAR);

      if (this.rng() < detectProb) {
        const forfeit = person.resources * Variables.JAIL_RESOURCE_FORFEIT_FRACTION;
        simulation.communityPool += forfeit;
        person.resources -= forfeit;
        person.jailedTicksRemaining += Variables.JAIL_TICKS_KILL;
      }
    }
  }
}

