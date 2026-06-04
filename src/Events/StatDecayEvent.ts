import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Unconditional event: age-based probabilistic decay of constitution and intelligence.
 * Each stat rolls independently; probability scales linearly with years past the
 * respective start age. Stats floor at 1. Runs for jailed and free persons alike.
 * ExerciseEvent and LearnEvent remain the counterforce — active persons hold stats
 * longer. See ARD 048.
 */
export default class StatDecayEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Roll independent decay checks for constitution and intelligence.
   *
   * @param person - person aging
   * @param simulation - current simulation state (unused)
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;

    const constitutionDecayProb = Variables.CONSTITUTION_DECAY_BASE_RATE
      * Math.max(0, person.age - Variables.CONSTITUTION_DECAY_START_AGE);

    if (this.rng() < constitutionDecayProb) {
      person.constitution = Math.max(1, person.constitution - 1);
    }

    const intelligenceDecayProb = Variables.INTELLIGENCE_DECAY_BASE_RATE
      * Math.max(0, person.age - Variables.INTELLIGENCE_DECAY_START_AGE);

    if (this.rng() < intelligenceDecayProb) {
      person.intelligence = Math.max(1, person.intelligence - 1);
    }
  }
}
