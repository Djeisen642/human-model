import StealingRecord from '../Records/StealingRecord';
import KillingRecord from '../Records/KillingRecord';
import Constants from '../Helpers/Constants';
import DeathRecord from '../Records/DeathRecord';
import Variables from '../Helpers/Variables';

export default class Person {
  hasJob = false;
  education = Constants.EDUCATION.NONE;
  isWorkingOnEd = Constants.EDUCATION.NONE;
  readonly killed = new Map<Person, KillingRecord>();
  readonly amountStolen: Array<StealingRecord> = [];
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
  killingIntent = 0;
  /** Probability gate for HelpEvent; seeded higher than antisocial intents. See ARD 045. */
  helpingIntent = 0;
  /** Ticks remaining in current jail sentence; 0 means free. Decremented by LooperSingleton each tick before EventFactory. See ARD 035. */
  jailedTicksRemaining = 0;
  /** Transient happiness boost from a recent successful help; decays each tick. See ARD 046. */
  helpHappinessBoost = 0;
  /** Transient happiness boost from a recent confirmed kill; decays each tick. See ARD 046. */
  killHappinessBoost = 0;

  /**
   * Person Constructor
   *
   * @param parents people that parented this child
   * @throws {Error} if invalid parents are given
   */
  constructor(parents: Person[]) {
    if (parents.length > 2) {
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
   * Happiness score computed from job, resources, relationship status, age, health,
   * and transient boosts from recent helping or killing (ARD 046).
   * Children under 18 use parents' average resources; elderly over 65 face higher thresholds.
   * Job penalty only applies to working-age adults (18–65). Floor is 0.
   *
   * @returns happiness score (>= 0)
   */
  get happiness(): number {
    let happiness = Variables.HAPPINESS_BASELINE;

    // Job: only penalise working-age adults for unemployment
    if (this.age >= Variables.WORKING_AGE_MIN && this.age <= Variables.WORKING_AGE_MAX) {
      happiness += this.hasJob ? Variables.HAPPINESS_JOB_BONUS : -Variables.HAPPINESS_UNEMPLOYED_PENALTY;
    } else if (this.hasJob) {
      happiness += Variables.HAPPINESS_JOB_BONUS;
    }

    // Resources: children use parents' average; elderly have higher thresholds
    const resourceBase = (this.age < Variables.WORKING_AGE_MIN && this.livingParents.length > 0)
      ? this.livingParents.reduce((sum, p) => sum + p.resources, 0) / this.livingParents.length
      : this.resources;

    const elderly = this.age > Variables.WORKING_AGE_MAX;
    const criticalThreshold = elderly ? Variables.HAPPINESS_RESOURCE_CRITICAL_THRESHOLD_ELDERLY : Variables.HAPPINESS_RESOURCE_CRITICAL_THRESHOLD;
    const lowThreshold = elderly ? Variables.HAPPINESS_RESOURCE_LOW_THRESHOLD_ELDERLY : Variables.HAPPINESS_RESOURCE_LOW_THRESHOLD;
    const comfortableThreshold = elderly ? Variables.HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD_ELDERLY : Variables.HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD;

    if (resourceBase < criticalThreshold) happiness -= Variables.HAPPINESS_RESOURCE_CRITICAL_PENALTY;
    else if (resourceBase < lowThreshold) happiness -= Variables.HAPPINESS_RESOURCE_LOW_PENALTY;
    else if (resourceBase >= comfortableThreshold) happiness += Variables.HAPPINESS_RESOURCE_COMFORTABLE_BONUS;

    // Relationship
    if (this.isInRelationshipWith !== null) happiness += Variables.HAPPINESS_RELATIONSHIP_BONUS;

    // Age: small penalty for elderly only
    if (this.age > Variables.WORKING_AGE_MAX) happiness -= Variables.HAPPINESS_ELDERLY_PENALTY;

    // Health: illness in [0, 1]; 0 = healthy, 1 = very ill
    happiness -= Math.round(this.illness * Variables.HAPPINESS_ILLNESS_SCALAR);

    // Transient boosts from recent helping and killing; both decay to zero over time
    happiness += this.helpHappinessBoost + this.killHappinessBoost;

    return Math.max(0, happiness);
  }
}