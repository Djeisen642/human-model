import Person from '../App/Person';
import Simulation from '../App/Simulation';
import Variables from '../Helpers/Variables';
import Constants from '../Helpers/Constants';
import { RNG } from '../Helpers/Types';

/**
 * Population-level disaster event run once per tick by LooperSingleton.
 * Does NOT implement IEvent — it operates on a random subset of the population,
 * not on a single person.
 */
export default class DisasterEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Probabilistically triggers a disaster. When it fires, a random subset of
   * the living population loses resources; some fraction die outright based on
   * their age and constitution.
   *
   * Kill check: rng() < DISASTER_KILL_BASE * ageMortalityModifier / constitution
   * Resource loss fraction: uniform in [DISASTER_MIN_LOSS_FRACTION, DISASTER_MAX_LOSS_FRACTION]
   *
   * @param simulation - current simulation state
   */
  execute(simulation: Simulation): void {
    if (this.rng() > Variables.DISASTER_PROBABILITY) return;

    const living = simulation.getLiving();
    if (living.length === 0) return;

    // Weight affected count toward small events via rng*rng, always at least 1
    const affectedCount = Math.max(1, Math.floor(
      this.rng() * this.rng() * living.length * Variables.DISASTER_MAX_AFFECTED_FRACTION,
    ));
    const affected = selectRandom(living, affectedCount, this.rng);

    for (const person of affected) {
      if (person.causeOfDeath !== null) continue;

      const killRoll = this.rng();
      const fractionRoll = this.rng();

      // Kill check (age and constitution determine survival, per ARD 012)
      if (killRoll < Variables.DISASTER_KILL_BASE * person.ageMortalityModifier / person.constitution) {
        simulation.kill(person, Constants.CAUSE_OF_DEATH.DISASTER);
      }

      // Economic damage: independent of kill check; applies to all affected persons
      const fractionLost = Variables.DISASTER_MIN_LOSS_FRACTION
        + fractionRoll * (Variables.DISASTER_MAX_LOSS_FRACTION - Variables.DISASTER_MIN_LOSS_FRACTION);
      person.resources = Math.max(0, person.resources * (1 - fractionLost));
    }
  }
}

/**
 * Selects up to n distinct persons at random from arr using a partial Fisher-Yates shuffle.
 *
 * @param arr - source array
 * @param n - number to select
 * @param rng - random number source
 * @returns selected persons (length = min(n, arr.length))
 */
function selectRandom(arr: Person[], n: number, rng: RNG): Person[] {
  const copy = [...arr];
  const selected: Person[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    selected.push(copy[i]);
  }
  return selected;
}
