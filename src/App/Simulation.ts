import Person from './Person';
import DeathRecord from '../Records/DeathRecord';
import KillingRecord from '../Records/KillingRecord';
import Constants from '../Helpers/Constants';
import Variables from '../Helpers/Variables';
import { RNG, TenYearSummary } from '../Helpers/Types';

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
  /** Deaths caused by old age this tick. */
  deathsByOldAge: number;
  /** Cumulative total deaths up to and including this tick. */
  cumulativeDeaths: number;
  /** Cumulative murder deaths up to and including this tick. */
  cumulativeDeathsByMurder: number;
  /** Cumulative illness deaths up to and including this tick. */
  cumulativeDeathsByIllness: number;
  /** Cumulative disaster deaths up to and including this tick. */
  cumulativeDeathsByDisaster: number;
  /** Cumulative suicide deaths up to and including this tick. */
  cumulativeDeathsBySuicide: number;
  /** Cumulative old-age deaths up to and including this tick. */
  cumulativeDeathsByOldAge: number;
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
  /** Remaining natural resource pool at end of tick (after this tick's regen and extraction). */
  naturalResources: number;
}

export default class Simulation {
  private living: Person[] = [];
  private deceased: Person[] = [];
  /** Accumulated snapshot history — one entry per completed tick. */
  readonly history: TickSnapshot[] = [];
  /** One summary per completed decade; appended by LooperSingleton every 10 ticks. */
  readonly decadeHistory: TenYearSummary[] = [];

  /** Current available natural resource pool; depleted by gathering. */
  naturalResources: number = Variables.NATURAL_RESOURCE_CEILING_INITIAL;
  /** Maximum accessible resources; grows via InventionEvent. */
  naturalResourceCeiling: number = Variables.NATURAL_RESOURCE_CEILING_INITIAL;
  /** Pool cost per unit gathered; starts at 1.0, modified by InventionEvent. Floor: 0.01. */
  extractionEfficiency = 1.0;

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
      person.experience = randomInt(rng, 0, Math.min(person.age, Variables.EXPERIENCE_CAP) + 1);
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
   * Replenishes naturalResources by NATURAL_RESOURCE_REGEN_RATE, capped at naturalResourceCeiling.
   * Call once at the start of each tick before events run.
   */
  regenerate(): void {
    this.naturalResources = Math.min(
      this.naturalResources + Variables.NATURAL_RESOURCE_REGEN_RATE,
      this.naturalResourceCeiling,
    );
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
    const deathsByOldAge = this.tickDeathCauses.filter(c => c === Constants.CAUSE_OF_DEATH.OLD_AGE).length;

    const prev = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    const cumulativeDeaths = (prev?.cumulativeDeaths ?? 0) + deaths;
    const cumulativeDeathsByMurder = (prev?.cumulativeDeathsByMurder ?? 0) + deathsByMurder;
    const cumulativeDeathsByIllness = (prev?.cumulativeDeathsByIllness ?? 0) + deathsByIllness;
    const cumulativeDeathsByDisaster = (prev?.cumulativeDeathsByDisaster ?? 0) + deathsByDisaster;
    const cumulativeDeathsBySuicide = (prev?.cumulativeDeathsBySuicide ?? 0) + deathsBySuicide;
    const cumulativeDeathsByOldAge = (prev?.cumulativeDeathsByOldAge ?? 0) + deathsByOldAge;

    const snap: TickSnapshot = {
      tick,
      population,
      deaths,
      deathsByMurder,
      deathsByIllness,
      deathsByDisaster,
      deathsBySuicide,
      deathsByOldAge,
      cumulativeDeaths,
      cumulativeDeathsByMurder,
      cumulativeDeathsByIllness,
      cumulativeDeathsByDisaster,
      cumulativeDeathsBySuicide,
      cumulativeDeathsByOldAge,
      averageResources,
      resourceGini,
      averageHappiness,
      aggregateKillingIntent,
      aggregateStealingIntent,
      naturalResources: this.naturalResources,
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
