import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import { ageModifier } from '../Helpers/AgeModifier';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Unconditional (internal probability gate): partnered couple may produce a child.
 * Only the lower-index partner fires to prevent double-creation per couple per tick.
 * Three multiplicative suppressors: illness, resources, happiness. See ARD 029.
 */
export default class ChildbirthEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Attempt to produce a child for a partnered person.
   * No-op if unpartnered, deduplication check fails, or probability roll fails.
   * On success: deducts birth cost from each parent, creates child, adds to simulation.
   *
   * @param person - potential parent
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    const partner = person.isInRelationshipWith;
    if (!partner) return;

    // Only the lower-index partner fires to prevent two children per couple per tick
    const living = simulation.getLiving();
    if (living.indexOf(person) > living.indexOf(partner)) return;

    const illnessFactor = Math.max(0, 1 - person.illness * Variables.CHILDBIRTH_ILLNESS_SCALAR);
    const resourceFactor = Math.min(1, Math.max(0,
      (person.resources - Variables.CHILDBIRTH_RESOURCE_MIN) /
      (Variables.CHILDBIRTH_RESOURCE_SCALE - Variables.CHILDBIRTH_RESOURCE_MIN),
    ));
    const happinessFactor = 1 + person.happiness * Variables.CHILDBIRTH_HAPPINESS_SCALAR;

    const p = Variables.BASE_CHILDBIRTH_RATE
      * ageModifier(person.age, Variables.CHILDBIRTH_PEAK_AGE,
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
