import StealingRecord from '../Records/StealingRecord';
import KillingRecord from '../Records/KillingRecord';
import Constants from '../Helpers/Constants';
import DeathRecord from '../Records/DeathRecord';

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
   * Happiness score computed from job, resources, relationship status, age, and health.
   *
   * @returns happiness score
   */
  get happiness(): number {
    let happiness = 0;
    happiness += this.hasJob ? 5 : -3;
    return Math.max(0, happiness);
  }
}