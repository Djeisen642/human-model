import Constants from '../../Helpers/Constants';
import DeathRecord from '../../Records/DeathRecord';
import Person from '../../App/Person';

describe('DeathRecord', () => {
  it('should create a DeathRecord', () => {
    const cause = Constants.CAUSE_OF_DEATH.DISASTER;
    const record = new DeathRecord(cause);

    expect(record).toBeTruthy();
    expect(record.cause).toBe(cause);
    expect(record.killer).toBeUndefined();
  });

  it('should create a murder DeathRecord', () => {
    const cause = Constants.CAUSE_OF_DEATH.MURDER;
    const person = new Person([]);
    const record = new DeathRecord(cause, person);

    expect(record).toBeTruthy();
    expect(record.cause).toBe(cause);
    expect(record.killer).toBeDefined();
    expect(record.killer).toBe(person);
  });
});