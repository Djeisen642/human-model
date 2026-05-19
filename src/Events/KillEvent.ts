import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import { ageModifier } from '../Helpers/AgeModifier';
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
    const living = simulation.getLiving();
    const resources = living.map(p => p.resources);
    const currentGini = gini(resources);

    const happinessPressure = Math.max(
      0,
      1 - person.happiness / Variables.SITUATIONAL_KILL_HAPPINESS_THRESHOLD,
    );

    const attemptProb = person.killingIntent
      * ageModifier(person.age, Variables.KILLING_PEAK_AGE, Variables.KILLING_AGE_SCALE, Variables.KILLING_AGE_FLOOR)
      * (1 + currentGini * Variables.KILL_GINI_SCALAR)
      * (1 + happinessPressure * Variables.SITUATIONAL_KILL_SCALAR);
    if (this.rng() >= attemptProb) return;

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

/**
 * Gini coefficient using the sorted weighted-sum formula.
 * Returns 0 when all values are equal or the array is empty.
 *
 * @param values - numeric values
 * @returns Gini coefficient in [0, 1)
 */
function gini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const weightedSum = sorted.reduce((sum, x, i) => sum + (i + 1) * x, 0);
  return (2 * weightedSum - (n + 1) * total) / (n * total);
}
