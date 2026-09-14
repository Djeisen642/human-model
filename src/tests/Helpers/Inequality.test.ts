import Person from '../../App/Person';
import Variables from '../../Helpers/Variables';
import { gini, resourceGini } from '../../Helpers/Inequality';

/**
 * Builds a person at a given age holding given resources.
 *
 * @param age - the person's age
 * @param resources - the person's resources
 * @returns the constructed person
 */
function personAt(age: number, resources: number): Person {
  const p = new Person([]);
  p.age = age;
  p.resources = resources;
  return p;
}

describe('gini', () => {
  it('returns 0 for an empty array', () => {
    expect(gini([])).toBe(0);
  });

  it('returns 0 when every value is equal', () => {
    expect(gini([50, 50, 50])).toBeCloseTo(0);
  });

  it('returns 0 when every value is zero', () => {
    expect(gini([0, 0, 0])).toBe(0);
  });

  it('approaches 1 as one holder takes everything', () => {
    const few = gini([0, 0, 100]);
    const many = gini([...Array(99).fill(0), 100]);
    expect(many).toBeGreaterThan(few);
    expect(many).toBeLessThan(1);
  });

  it('is unchanged by scaling every value', () => {
    expect(gini([10, 20, 70])).toBeCloseTo(gini([100, 200, 700]));
  });
});

describe('resourceGini (ARD 060)', () => {
  it('measures only persons at or above WORKING_AGE_MIN', () => {
    const adults = [personAt(30, 40), personAt(40, 60)];
    const withChild = [...adults, personAt(5, 0)];
    expect(resourceGini(withChild)).toBeCloseTo(resourceGini(adults));
  });

  it('is unaffected by a child holding resources', () => {
    const base = [personAt(30, 40), personAt(40, 60), personAt(5, 0)];
    const richChild = [personAt(30, 40), personAt(40, 60), personAt(5, 500)];
    expect(resourceGini(richChild)).toBeCloseTo(resourceGini(base));
  });

  it('counts a person exactly at WORKING_AGE_MIN', () => {
    const excluded = [personAt(30, 100), personAt(Variables.WORKING_AGE_MIN - 1, 0)];
    const included = [personAt(30, 100), personAt(Variables.WORKING_AGE_MIN, 0)];
    expect(resourceGini(excluded)).toBe(0);
    expect(resourceGini(included)).toBeGreaterThan(0);
  });

  it('counts the elderly, who are not dependants', () => {
    const withElder = [personAt(30, 100), personAt(80, 0)];
    expect(resourceGini(withElder)).toBeGreaterThan(0);
  });

  it('returns 0 when no adults are alive', () => {
    expect(resourceGini([personAt(5, 0), personAt(10, 50)])).toBe(0);
  });

  it('returns 0 for an empty population', () => {
    expect(resourceGini([])).toBe(0);
  });

  it('matches the raw coefficient when everyone is an adult', () => {
    const adults = [personAt(30, 10), personAt(40, 20), personAt(50, 70)];
    expect(resourceGini(adults)).toBeCloseTo(gini([10, 20, 70]));
  });
});
