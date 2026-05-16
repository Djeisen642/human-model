import ConsumptionEvent from '../../Events/ConsumptionEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';
import Constants from '../../Helpers/Constants';

const event = new ConsumptionEvent();
const sim = new Simulation();

/**
 * @param resources - starting resources
 * @param age - starting age
 * @returns a seeded adult with given resources and age
 */
function adult(resources = 10, age = 30): Person {
  const p = new Person([]);
  p.age = age;
  p.resources = resources;
  return p;
}

/**
 * @param resources - starting resources
 * @returns a child with two living parents
 */
function childWithParents(resources = 10): Person {
  const p1 = new Person([]);
  const p2 = new Person([]);
  const child = new Person([p1, p2]);
  child.age = Variables.CONSUMPTION_CHILD_MAX_AGE - 1;
  child.resources = resources;
  return child;
}

/**
 * @param resources - starting resources
 * @returns a child whose both parents are dead
 */
function orphan(resources = 10): Person {
  const p1 = new Person([]);
  const p2 = new Person([]);
  p1.causeOfDeath = { cause: Constants.CAUSE_OF_DEATH.ILLNESS, killer: undefined };
  p2.causeOfDeath = { cause: Constants.CAUSE_OF_DEATH.ILLNESS, killer: undefined };
  const child = new Person([p1, p2]);
  child.age = Variables.CONSUMPTION_CHILD_MAX_AGE - 1;
  child.resources = resources;
  return child;
}

describe('ConsumptionEvent', () => {
  describe('adult consumption', () => {
    it('deducts CONSUMPTION_BASE from a working-age adult', () => {
      const p = adult(10, 30);
      event.execute(p, sim);
      expect(p.resources).toBeCloseTo(10 - Variables.CONSUMPTION_BASE);
    });

    it('deducts CONSUMPTION_BASE * CONSUMPTION_ELDER_MULTIPLIER from an elder', () => {
      const p = adult(10, Variables.CONSUMPTION_ELDER_MIN_AGE);
      event.execute(p, sim);
      expect(p.resources).toBeCloseTo(10 - Variables.CONSUMPTION_BASE * Variables.CONSUMPTION_ELDER_MULTIPLIER);
    });

    it('resources never go below 0', () => {
      const p = adult(0, 30);
      event.execute(p, sim);
      expect(p.resources).toBe(0);
    });

    it('adds starvation illness when an adult reaches 0 resources', () => {
      const p = adult(0, 30);
      event.execute(p, sim);
      expect(p.illness).toBeCloseTo(Variables.STARVATION_ILLNESS_RATE);
    });

    it('starvation fires when cost exceeds available resources', () => {
      const p = adult(Variables.CONSUMPTION_BASE / 2, 30);
      event.execute(p, sim);
      expect(p.resources).toBe(0);
      expect(p.illness).toBeCloseTo(Variables.STARVATION_ILLNESS_RATE);
    });

    it('does not add starvation illness when resources remain above 0', () => {
      const p = adult(100, 30);
      p.illness = 0;
      event.execute(p, sim);
      expect(p.illness).toBe(0);
    });

    it('caps starvation illness at 1', () => {
      const p = adult(0, 30);
      p.illness = 1 - Variables.STARVATION_ILLNESS_RATE / 2;
      event.execute(p, sim);
      expect(p.illness).toBe(1);
    });
  });

  describe('seeded adult (empty childOf)', () => {
    it('pays adult flat rate even with living parents array empty', () => {
      const p = adult(10, 30);
      // childOf is [] by default — never treated as a child
      event.execute(p, sim);
      expect(p.resources).toBeCloseTo(10 - Variables.CONSUMPTION_BASE);
    });
  });

  describe('child with living parents', () => {
    it('consumes CONSUMPTION_CHILD_RESOURCE_RATE fraction of own resources', () => {
      const p = childWithParents(100);
      event.execute(p, sim);
      expect(p.resources).toBeCloseTo(100 * (1 - Variables.CONSUMPTION_CHILD_RESOURCE_RATE));
    });

    it('pays nothing at zero resources and starvation does not fire', () => {
      const p = childWithParents(0);
      event.execute(p, sim);
      expect(p.resources).toBe(0);
      expect(p.illness).toBe(0);
    });
  });

  describe('orphaned child', () => {
    it('pays adult flat rate when both parents are dead', () => {
      const p = orphan(10);
      event.execute(p, sim);
      expect(p.resources).toBeCloseTo(10 - Variables.CONSUMPTION_BASE);
    });

    it('starvation fires at zero resources for an orphan', () => {
      const p = orphan(0);
      event.execute(p, sim);
      expect(p.illness).toBeCloseTo(Variables.STARVATION_ILLNESS_RATE);
    });
  });

  describe('dead person guard', () => {
    it('does nothing when person is already dead', () => {
      const p = adult(10, 30);
      p.illness = 0;
      p.causeOfDeath = { cause: Constants.CAUSE_OF_DEATH.ILLNESS, killer: undefined };
      event.execute(p, sim);
      expect(p.resources).toBe(10);
      expect(p.illness).toBe(0);
    });
  });
});
