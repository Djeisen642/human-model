import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { ageModifier } from '../Helpers/AgeModifier';
import { RNG } from '../Helpers/Types';

/**
 * Unconditional event: handles relationship formation and dissolution each tick.
 * Formation branch: fires when person is unpartnered; probability scales with charisma
 * and age. Both persons must be unpartnered for a relationship to form.
 * Dissolution branch: fires when person is partnered; flat per-tick breakup probability.
 * See ARD 025.
 */
export default class RelationshipEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Run formation or dissolution branch depending on current relationship status.
   * Formation draws a random other from the simulation and checks they are unpartnered.
   * Dissolution mutually clears both persons' isInRelationshipWith fields.
   *
   * @param person - person whose relationship status is updated
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    if (person.age < Variables.RELATIONSHIP_MIN_AGE) return;
    if (person.isInRelationshipWith === null) {
      const formProb = Variables.BASE_RELATIONSHIP_RATE
        * (1 + person.charisma * Variables.RELATIONSHIP_CHARISMA_SCALAR)
        * ageModifier(
          person.age,
          Variables.RELATIONSHIP_PEAK_AGE,
          Variables.RELATIONSHIP_AGE_SCALE,
          Variables.RELATIONSHIP_AGE_FLOOR,
        );
      if (this.rng() < formProb) {
        const other = simulation.getRandomOther(person, this.rng);
        if (other && other.isInRelationshipWith === null) {
          person.isInRelationshipWith = other;
          other.isInRelationshipWith = person;
        }
      }
    } else {
      if (this.rng() < Variables.BASE_BREAKUP_RATE) {
        const partner = person.isInRelationshipWith;
        person.isInRelationshipWith = null;
        if (partner) partner.isInRelationshipWith = null;
      }
    }
  }
}
