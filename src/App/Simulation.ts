import Person from './Person';
import DeathRecord from '../Records/DeathRecord';
import KillingRecord from '../Records/KillingRecord';
import Constants from '../Helpers/Constants';
import { RNG } from '../Helpers/Types';

/** Per-tick aggregate state captured at the end of each tick. */
export interface TickSnapshot {
  /** Zero-based tick index. */
  tick: number;
  /** Living population count at end of tick. */
  population: number;
  /** Total deaths this tick. */
  deaths: number;
  /** Deaths caused by murder this tick. */
  deathsByMurder: number;
  /** Deaths caused by illness this tick. */
  deathsByIllness: number;
  /** Deaths caused by disaster this tick. */
  deathsByDisaster: number;
  /** Deaths caused by suicide this tick. */
  deathsBySuicide: number;
  /** Mean resources across living population. */
  averageResources: number;
  /** Gini coefficient of resource distribution (0 = perfect equality, 1 = perfect inequality). */
  resourceGini: number;
  /** Mean happiness across living population. */
  averageHappiness: number;
  /** Sum of killingIntent across living population. */
  aggregateKillingIntent: number;
  /** Sum of stealingIntent across living population. */
  aggregateStealingIntent: number;
}

export default class Simulation {
  private living: Person[] = [];
  private deceased: Person[] = [];
  /** Accumulated snapshot history — one entry per completed tick. */
  readonly history: TickSnapshot[] = [];

  private tickDeathCauses: number[] = [];

  /**
   * Returns a shallow copy of the living population.
   *
   * @returns living persons
   */
  getLiving(): Person[] {
    return [...this.living];
  }

  /**
   * Returns a random living person other than `exclude`, or null if no other living person exists.
   *
   * @param exclude - person to exclude from selection
   * @param rng - random number source
   * @returns a random other living person, or null
   */
  getRandomOther(exclude: Person, rng: RNG): Person | null {
    const candidates = this.living.filter(p => p !== exclude);
    if (candidates.length === 0) return null;
    const index = Math.floor(rng() * candidates.length);
    return candidates[index];
  }

  /**
   * Moves `person` from living to deceased, records cause of death, and
   * adds a KillingRecord to the killer when applicable.
   *
   * @param person - person who died
   * @param cause - cause of death (Constants.CAUSE_OF_DEATH)
   * @param killer - murderer, required when cause is MURDER
   */
  kill(person: Person, cause: number, killer?: Person): void {
    person.causeOfDeath = new DeathRecord(cause, killer);
    if (cause === Constants.CAUSE_OF_DEATH.MURDER && killer) {
      killer.killed.set(person, new KillingRecord(person, killer.age));
    }
    this.living = this.living.filter(p => p !== person);
    this.deceased.push(person);
    this.tickDeathCauses.push(cause);
  }

  /**
   * Adds a person to the living population (births and initial seeding).
   *
   * @param person - person to add
   */
  add(person: Person): void {
    this.living.push(person);
  }

  /**
   * Creates `n` persons with stats and intents drawn from uniform distributions
   * and adds them to the living population.
   *
   * Ranges: age [15, 50), resources [0, 100), experience [0, age],
   * intelligence/constitution/charisma [1, 10],
   * learningIntent/exerciseIntent [0, 1),
   * stealingIntent/lyingIntent [0, 0.3), killingIntent [0, 0.1).
   *
   * @param n - number of persons to seed
   * @param rng - random number source
   */
  seed(n: number, rng: RNG): void {
    for (let i = 0; i < n; i++) {
      const person = new Person([]);
      person.age = randomInt(rng, 15, 50);
      person.resources = randomInt(rng, 0, 100);
      person.experience = randomInt(rng, 0, person.age + 1);
      person.intelligence = randomInt(rng, 1, 11);
      person.constitution = randomInt(rng, 1, 11);
      person.charisma = randomInt(rng, 1, 11);
      person.learningIntent = rng();
      person.exerciseIntent = rng();
      person.stealingIntent = rng() * 0.3;
      person.lyingIntent = rng() * 0.3;
      person.killingIntent = rng() * 0.1;
      this.add(person);
    }
  }

  /**
   * Captures aggregate stats for the current tick, appends to history,
   * resets per-tick accumulators, and returns the snapshot.
   *
   * @returns snapshot for the completed tick
   */
  snapshot(): TickSnapshot {
    const tick = this.history.length;
    const population = this.living.length;

    const resources = this.living.map(p => p.resources);
    const averageResources = mean(resources);
    const resourceGini = gini(resources);
    const averageHappiness = mean(this.living.map(p => p.happiness));
    const aggregateKillingIntent = this.living.reduce((s, p) => s + p.killingIntent, 0);
    const aggregateStealingIntent = this.living.reduce((s, p) => s + p.stealingIntent, 0);

    const deaths = this.tickDeathCauses.length;
    const deathsByMurder = this.tickDeathCauses.filter(c => c === Constants.CAUSE_OF_DEATH.MURDER).length;
    const deathsByIllness = this.tickDeathCauses.filter(c => c === Constants.CAUSE_OF_DEATH.ILLNESS).length;
    const deathsByDisaster = this.tickDeathCauses.filter(c => c === Constants.CAUSE_OF_DEATH.DISASTER).length;
    const deathsBySuicide = this.tickDeathCauses.filter(c => c === Constants.CAUSE_OF_DEATH.SUICIDE).length;

    const snap: TickSnapshot = {
      tick,
      population,
      deaths,
      deathsByMurder,
      deathsByIllness,
      deathsByDisaster,
      deathsBySuicide,
      averageResources,
      resourceGini,
      averageHappiness,
      aggregateKillingIntent,
      aggregateStealingIntent,
    };

    this.history.push(snap);
    this.tickDeathCauses = [];
    return snap;
  }
}

/**
 * @param rng - random number source
 * @param min - inclusive minimum
 * @param max - exclusive maximum
 * @returns random integer in [min, max)
 */
function randomInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min));
}

/**
 * @param values - numeric values to average
 * @returns arithmetic mean, or 0 if empty
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
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
