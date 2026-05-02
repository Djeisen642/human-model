import StealingRecord from '../Records/StealingRecord';
import KillingRecord from '../Records/KillingRecord';
import Constants from '../Helpers/Constants';
import DeathRecord from '../Records/DeathRecord';
import Variables from '../Helpers/Variables';

export default class Person {
  hasJob = false;
  education = Constants.EDUCATION.NONE;
  isWorkingOnEd = Constants.EDUCATION.NONE;
  helpsPeople = Constants.TYPE_OF_HELP.NONE;
  readonly killed = new Map<Person, KillingRecord>();
  readonly amountStolen: Array<StealingRecord> = [];
  readonly peopleLiedTo = new Set<Person>();
  isInRelationshipWith: Person|null = null;
  readonly hasChildren: Array<Person> = [];
  readonly childOf: Array<Person> = [];
  age = 0;
  illness = 0;
  causeOfDeath: DeathRecord|null = null;
  resources = 0;
  experience = 0;
  intelligence = 0;
  constitution = 0;
  charisma = 0;
  learningIntent = 0;
  exerciseIntent = 0;
  stealingIntent = 0;
  lyingIntent = 0;
  killingIntent = 0;

  /**
   * Person Constructor
   *
   * @param parents people that parented this child
   * @throws {Error} if invalid parents are given
   */
  constructor(parents: Person[]) {
    if (parents.length !== 0 && parents.length !== 2) {
      throw new Error('Invalid parents given');
    }
    this.childOf = parents;
  }

  /**
   * Living parents of this person (parents whose causeOfDeath is null).
   *
   * @returns array of living parents
   */
  get livingParents(): Person[] {
    return this.childOf.filter(p => p.causeOfDeath === null);
  }

  /**
   * Multiplier on base illness/death probability.
   * Forms a U-shaped curve: minimum near PRIME_AGE, rising toward infancy and old age.
   *
   * @returns mortality multiplier (always >= 1)
   */
  get ageMortalityModifier(): number {
    return 1 + Variables.AGE_DEATH_CURVATURE * Math.pow(this.age - Variables.PRIME_AGE, 2);
  }

  /**
   * Happiness score computed from job, resources, relationship status, age, and health.
   * Children under 18 use parents' average resources; elderly over 65 face higher thresholds.
   * Job penalty only applies to working-age adults (18–65). Floor is 0.
   *
   * @returns happiness score (>= 0)
   */
  get happiness(): number {
    let happiness = Variables.HAPPINESS_BASELINE;

    // Job: only penalise working-age adults for unemployment
    if (this.age >= 18 && this.age <= 65) {
      happiness += this.hasJob ? 5 : -3;
    } else if (this.hasJob) {
      happiness += 5;
    }

    // Resources: children use parents' average; elderly have higher thresholds
    const resourceBase = (this.age < 18 && this.livingParents.length > 0)
      ? this.livingParents.reduce((sum, p) => sum + p.resources, 0) / this.livingParents.length
      : this.resources;

    const criticalThreshold = this.age > 65 ? 20 : 10;
    const lowThreshold = this.age > 65 ? 50 : 30;
    const comfortableThreshold = this.age > 65 ? 100 : 70;

    if (resourceBase < criticalThreshold) happiness -= 5;
    else if (resourceBase < lowThreshold) happiness -= 2;
    else if (resourceBase >= comfortableThreshold) happiness += 3;

    // Relationship
    if (this.isInRelationshipWith !== null) happiness += 3;

    // Age: small penalty for elderly only
    if (this.age > 65) happiness -= 1;

    // Health: illness in [0, 1]; 0 = healthy, 1 = very ill
    happiness -= Math.round(this.illness * 5);

    return Math.max(0, happiness);
  }
}