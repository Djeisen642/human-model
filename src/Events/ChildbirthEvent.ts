import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import { ageModifier } from '../Helpers/AgeModifier';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';
import { standardNormal } from '../Helpers/SeededRandom';
import { HeritableField, founderSpread } from '../Helpers/TraitRanges';

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
    this.seedNewborn(child, person, partner, simulation);
    person.hasChildren.push(child);
    partner.hasChildren.push(child);
    simulation.add(child);
    simulation.recordBirth();
  }

  /**
   * Seed a newborn's stats and intents from parental heritability (ARD 064, superseding ARD 037).
   *
   * Stats and intents go through the same draw; they differ only in their heritability coefficient
   * and in whether the result is clamped. Intents clamp to [0, 1] for semantic validity; stats are
   * unclamped, as they were before (calibration owns positivity).
   *
   * `helpingIntent` is deliberately not assigned here. That it is never inherited is a known
   * defect with its own ARD pending — fixing it inside this change would bundle two decisions.
   *
   * @param child - newborn person to seed
   * @param p1 - first parent
   * @param p2 - second parent
   * @param simulation - current simulation state, read for the living population's trait spread
   */
  private seedNewborn(child: Person, p1: Person, p2: Person, simulation: Simulation): void {
    const stat = Variables.HERITABILITY_STAT_COEFFICIENT;
    const intent = Variables.HERITABILITY_INTENT_COEFFICIENT;
    child.intelligence = this.draw('intelligence', (p1.intelligence + p2.intelligence) / 2, stat, simulation, false);
    child.constitution = this.draw('constitution', (p1.constitution + p2.constitution) / 2, stat, simulation, false);
    child.charisma = this.draw('charisma', (p1.charisma + p2.charisma) / 2, stat, simulation, false);

    child.learningIntent = this.draw('learningIntent', (p1.learningIntent + p2.learningIntent) / 2, intent, simulation, true);
    child.exerciseIntent = this.draw('exerciseIntent', (p1.exerciseIntent + p2.exerciseIntent) / 2, intent, simulation, true);
    child.stealingIntent = this.draw('stealingIntent', (p1.stealingIntent + p2.stealingIntent) / 2, intent, simulation, true);
    child.killingIntent = this.draw('killingIntent', (p1.killingIntent + p2.killingIntent) / 2, intent, simulation, true);
  }

  /**
   * Draw one heritable trait for a newborn: regression toward the living population's mean for
   * that trait, plus a Gaussian residual scaled to that trait's own spread (ARD 064).
   *
   * The anchor is measured, not configured — this is the change ARD 064 makes. Regressing toward a
   * constant asserts that composition can never drift from its founding values; regressing toward
   * the live mean lets it move under selection and drift, and removes the anchor constants
   * entirely.
   *
   * The residual is scaled by the trait's own standard deviation rather than an absolute width,
   * because an absolute width is a statement about a trait's scale and so cannot be right for two
   * traits with different scales. `sqrt(1 - coefficient^2 / 2)` makes the draw variance-preserving:
   * with parents drawn independently from the population, the child distribution then has the same
   * variance as the population it was drawn from, instead of narrowing or widening each generation.
   * `HERITABILITY_RESIDUAL_SPREAD` scales that derived value, so 1.0 is exactly variance-preserving
   * and the constant stays available for calibration.
   *
   * @param field - which heritable field is being drawn
   * @param parentMean - average of the two parents' values for it
   * @param coefficient - heritability for this field's family (stat or intent)
   * @param simulation - current simulation state, read for the living population's trait spread
   * @param clampToUnit - whether to clamp the result to [0, 1], as intents require
   * @returns the newborn's value for that field
   */
  private draw(
    field: HeritableField,
    parentMean: number,
    coefficient: number,
    simulation: Simulation,
    clampToUnit: boolean,
  ): number {
    const { mean, sd, n } = simulation.traitDistribution(field);
    // Below the sample floor the population cannot describe itself: a handful of survivors at a
    // cycle trough would hand back a mean and spread that are noise. Fall back to the parents as
    // the anchor and the trait's founder range as the spread.
    const enough = n >= Variables.HERITABILITY_MIN_SAMPLE;
    const anchor = enough ? mean : parentMean;
    const spread = enough ? sd : founderSpread(field);

    const residual = spread
      * Math.sqrt(1 - (coefficient * coefficient) / 2)
      * Variables.HERITABILITY_RESIDUAL_SPREAD;
    const raw = anchor + (parentMean - anchor) * coefficient + standardNormal(this.rng) * residual;
    return clampToUnit ? Math.max(0, Math.min(1, raw)) : raw;
  }
}
