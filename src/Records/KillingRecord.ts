import Person from '../App/Person';

export default class KillingRecord {
  /**
   * Person killed
   */
  readonly person: Person;
  /**
   * Age at which the murderer killed the person
   */
  readonly age: number;

  /**
   * Killing Record Constructor
   *
   * @param person - person killed
   * @param age - age at which murderer killed person
   */
  constructor(person: Person, age: number) {
    this.person = person;
    this.age = age;
  }
}