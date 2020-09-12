import Person from '../App/Person';

export default class StealingRecord {
  readonly person: Person;
  readonly amount: number;
  readonly age: number;

  constructor(person: Person, amount: number, age: number) {
    this.person = person;
    this.amount = amount;
    this.age = age;
  }
}