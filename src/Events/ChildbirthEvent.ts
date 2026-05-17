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
    this.seedNewborn(child, person, partner);
    person.hasChildren.push(child);
    partner.hasChildren.push(child);
    simulation.add(child);
    simulation.recordBirth();
  }

  /**
   * Seed a newborn's stats and intents from parental heritability (ARD 037).
   * Stats regress toward NEWBORN_STAT_POPULATION_MEAN; intents regress toward zero.
   * Intents clamp to [0, 1] for semantic validity; stats are unclamped (calibration owns positivity).
   *
   * @param child - newborn person to seed
   * @param p1 - first parent
   * @param p2 - second parent
   */
  private seedNewborn(child: Person, p1: Person, p2: Person): void {
    child.intelligence = this.drawStat((p1.intelligence + p2.intelligence) / 2);
    child.constitution = this.drawStat((p1.constitution + p2.constitution) / 2);
    child.charisma = this.drawStat((p1.charisma + p2.charisma) / 2);

    child.learningIntent = this.drawIntent((p1.learningIntent + p2.learningIntent) / 2);
    child.exerciseIntent = this.drawIntent((p1.exerciseIntent + p2.exerciseIntent) / 2);
    child.stealingIntent = this.drawIntent((p1.stealingIntent + p2.stealingIntent) / 2);
    child.lyingIntent = this.drawIntent((p1.lyingIntent + p2.lyingIntent) / 2);
    child.killingIntent = this.drawIntent((p1.killingIntent + p2.killingIntent) / 2);
  }

  /**
   * Draw a newborn stat: regression toward population mean plus uniform noise.
   *
   * @param parentMean - average of the two parents' stat values
   * @returns child stat value (unclamped — calibration ensures positivity)
   */
  private drawStat(parentMean: number): number {
    const mean = Variables.NEWBORN_STAT_POPULATION_MEAN;
    return mean
      + (parentMean - mean) * Variables.HERITABILITY_STAT_COEFFICIENT
      + (this.rng() * 2 - 1) * Variables.HERITABILITY_STAT_NOISE_RANGE;
  }

  /**
   * Draw a newborn intent: regression toward zero plus uniform noise, clamped to [0, 1].
   *
   * @param parentMean - average of the two parents' intent values
   * @returns child intent value in [0, 1]
   */
  private drawIntent(parentMean: number): number {
    const raw = parentMean * Variables.HERITABILITY_INTENT_COEFFICIENT
      + (this.rng() * 2 - 1) * Variables.HERITABILITY_INTENT_NOISE_RANGE;
    return Math.max(0, Math.min(1, raw));
  }
}
