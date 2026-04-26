import Person from '../../App/Person';
import Variables from '../../Helpers/Variables';

describe('Person', () => {
  it('should create a Person', () => {
    const person = new Person([]);

    expect(person).toBeTruthy();
    expect(person.age).toBe(0);
  });

  it('Should create a Person with parents', () => {
    const parent1 = new Person([]);
    const parent2 = new Person([]);
    const parents = [parent1, parent2];
    const person = new Person(parents);

    expect(person).toBeTruthy();
    expect(person.childOf).toBe(parents);
  });

  describe('ageMortalityModifier', () => {
    it('is 1 at PRIME_AGE (U-curve minimum)', () => {
      const person = new Person([]);
      person.age = Variables.PRIME_AGE;
      expect(person.ageMortalityModifier).toBe(1);
    });

    it('is greater than 1 in infancy', () => {
      const person = new Person([]);
      person.age = 0;
      expect(person.ageMortalityModifier).toBeGreaterThan(1);
    });

    it('is greater than 1 in old age', () => {
      const person = new Person([]);
      person.age = 70;
      expect(person.ageMortalityModifier).toBeGreaterThan(1);
    });

    it('is higher at age 70 than at age 0', () => {
      const infant = new Person([]);
      infant.age = 0;
      const elder = new Person([]);
      elder.age = 70;
      expect(elder.ageMortalityModifier).toBeGreaterThan(infant.ageMortalityModifier);
    });

    it('is symmetric: same deviation above and below PRIME_AGE yields equal modifier', () => {
      const younger = new Person([]);
      younger.age = Variables.PRIME_AGE - 10;
      const older = new Person([]);
      older.age = Variables.PRIME_AGE + 10;
      expect(younger.ageMortalityModifier).toBeCloseTo(older.ageMortalityModifier);
    });
  });
});
