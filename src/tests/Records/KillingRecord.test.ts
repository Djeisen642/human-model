import Person from '../../App/Person';
import KillingRecord from '../../Records/KillingRecord';

describe('KillingRecord', () => {
  it('should create a KillingRecord', () => {
    const person = new Person([]);
    const age = 10;
    const record = new KillingRecord(person, age);

    expect(record).toBeTruthy();
    expect(record.person).toBe(person);
    expect(record.age).toBe(age);
  });
});