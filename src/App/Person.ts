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
  resources: number;
  experience: number;
  intelligence: number;
  constitution: number;
  charisma: number;
  learningIntent: number;
  exerciseIntent: number;
  stealingIntent: number;
  lyingIntent: number;
  killingIntent: number;

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
    this.resources = 0;
    this.experience = 0;
    this.intelligence = 0;
    this.constitution = 0;
    this.charisma = 0;
    this.learningIntent = 0;
    this.exerciseIntent = 0;
    this.stealingIntent = 0;
    this.lyingIntent = 0;
    this.killingIntent = 0;
  }

  /**
   * Happiness score is generated based off many factors associated with a person
   * Job, resources, relationship status, age, health
   *
   * @returns happiness score
   * @private
   */
  get happiness(): number {
    let happiness = 0;
    happiness += this.hasJob ? 5 : -3;
    return Math.max(0, happiness);
  }
}