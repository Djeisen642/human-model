import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import { ageModifier } from '../Helpers/AgeModifier';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Unconditional (internal probability gate): partnered couple may produce a child.
 * Only the lower-index partner fires to prevent double-creation per couple per tick.
 * Probability aggregates both partners' stats so the deduplication choice doesn't
 * shift fertility. See ARD 029.
 */
export default class ChildbirthEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Attempt to produce a child for a partnered couple.
   * No-op if unpartnered, deduplication check fails, or probability roll fails.
   * On success: deducts birth cost from each parent, creates child, adds to simulation.
   *
   * @param person - potential parent
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    const partner = person.isInRelationshipWith;
    if (!partner) return;

    if (simulation.indexOfLiving(person) > simulation.indexOfLiving(partner)) return;

    // Couple aggregates: worst-case for the biological blockers (illness, resources, age),
    // average for the soft signal (happiness). Ensures dedup choice doesn't change probability.
    const coupleIllness = Math.max(person.illness, partner.illness);
    const coupleResources = Math.min(person.resources, partner.resources);
    const coupleHappiness = (person.happiness + partner.happiness) / 2;
    const coupleAge = Math.max(person.age, partner.age);

    const illnessFactor = Math.max(0, 1 - coupleIllness * Variables.CHILDBIRTH_ILLNESS_SCALAR);
    const resourceRange = Variables.CHILDBIRTH_RESOURCE_SCALE - Variables.CHILDBIRTH_RESOURCE_MIN;
    const resourceFactor = Math.min(1, Math.max(0,
      (coupleResources - Variables.CHILDBIRTH_RESOURCE_MIN) / resourceRange,
    ));
    const happinessFactor = 1 + coupleHappiness * Variables.CHILDBIRTH_HAPPINESS_SCALAR;

    const p = Variables.BASE_CHILDBIRTH_RATE
      * ageModifier(coupleAge, Variables.CHILDBIRTH_PEAK_AGE,
        Variables.CHILDBIRTH_AGE_SCALE, Variables.CHILDBIRTH_AGE_FLOOR)
      * illnessFactor * resourceFactor * happinessFactor;

    if (this.rng() >= p) return;

    person.resources = Math.max(0, person.resources - Variables.CHILDBIRTH_BIRTH_COST);
    partner.resources = Math.max(0, partner.resources - Variables.CHILDBIRTH_BIRTH_COST);

    const child = new Person([person, partner]);
    person.hasChildren.push(child);
    partner.hasChildren.push(child);
    simulation.add(child);
  }
}
