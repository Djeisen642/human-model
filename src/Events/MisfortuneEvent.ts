import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import Constants from '../Helpers/Constants';
import { RNG } from '../Helpers/Types';

/** Unconditional event: background mortality from illness and suicide, checked each tick. */
export default class MisfortuneEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Run illness and suicide checks in sequence; first cause of death wins.
   * Illness probability is zero when illness=0 (severity-gated per ARD 019).
   * Disaster is handled at the tick level by LooperSingleton, not here.
   *
   * @param person - the person at risk
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    const illnessDeathProb = person.illness * Variables.ILLNESS_DEATH_SCALAR * person.ageMortalityModifier;
    if (this.rng() < illnessDeathProb) {
      simulation.kill(person, Constants.CAUSE_OF_DEATH.ILLNESS);
      return;
    }
    if (this.rng() < Variables.SUICIDE_PROBABILITY_SCALE / (person.happiness + 1)) {
      simulation.kill(person, Constants.CAUSE_OF_DEATH.SUICIDE);
    }
  }
}
