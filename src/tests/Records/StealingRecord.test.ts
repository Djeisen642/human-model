import StealingRecord from '../../Records/StealingRecord';
import Person from '../../App/Person';

describe('StealingRecord', () => {
  it('should create a StealingRecord', () => {
    const person:Person = new Person([]);
    const amount = 100;
    const age = 10;
    const record:StealingRecord = new StealingRecord(person, amount, age);

    expect(record).toBeTruthy();
    expect(record.person).toBe(person);
    expect(record.amount).toBe(amount);
    expect(record.age).toBe(age);
  });
});