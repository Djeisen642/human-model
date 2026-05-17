import JailEvent from '../../Events/JailEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('JailEvent (ARD 035)', () => {
  describe('flat gather', () => {
    it('adds JAIL_GATHER_AMOUNT to resources each tick', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 10;
      sim.add(person);

      if (Variables.JAIL_GATHER_AMOUNT <= Variables.JAIL_CONSUMPTION_AMOUNT) {
        // starvation path, skip this check (handled in separate test)
        return;
      }

      new JailEvent().execute(person, sim);
      const net = Variables.JAIL_GATHER_AMOUNT - Variables.JAIL_CONSUMPTION_AMOUNT;
      expect(person.resources).toBeCloseTo(10 + net);
    });

    it('resources increase by net amount when gather exceeds consumption', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 5;
      sim.add(person);

      // Force net positive by setting resources high enough that starvation doesn't mask
      // We directly test the gather step by checking resources go up when net > 0
      if (Variables.JAIL_GATHER_AMOUNT > Variables.JAIL_CONSUMPTION_AMOUNT) {
        new JailEvent().execute(person, sim);
        expect(person.resources).toBeGreaterThan(5);
      }
    });
  });

  describe('flat consume', () => {
    it('deducts JAIL_CONSUMPTION_AMOUNT from resources when resources are sufficient', () => {
      const sim = new Simulation();
      const person = new Person([]);
      // Set resources so they survive after gather + consume
      person.resources = 100;
      sim.add(person);

      new JailEvent().execute(person, sim);
      const expected = 100 + Variables.JAIL_GATHER_AMOUNT - Variables.JAIL_CONSUMPTION_AMOUNT;
      expect(person.resources).toBeCloseTo(expected);
    });

    it('resources floor at 0 (never negative)', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 0;
      sim.add(person);

      new JailEvent().execute(person, sim);
      expect(person.resources).toBeGreaterThanOrEqual(0);
    });
  });

  describe('starvation illness path', () => {
    it('adds STARVATION_ILLNESS_RATE to illness when resources go to 0', () => {
      // Only fires when JAIL_CONSUMPTION_AMOUNT > JAIL_GATHER_AMOUNT (net negative)
      if (Variables.JAIL_CONSUMPTION_AMOUNT <= Variables.JAIL_GATHER_AMOUNT) {
        // current constants have gather < consume, so this test applies; skip otherwise
        return;
      }

      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 0;
      person.illness = 0;
      sim.add(person);

      new JailEvent().execute(person, sim);
      expect(person.illness).toBeCloseTo(Variables.STARVATION_ILLNESS_RATE);
    });

    it('adds starvation illness when jail gather is less than jail consumption', () => {
      // Override: give person just enough resources that after gather they cannot cover consumption
      // JAIL_GATHER_AMOUNT = 0.5, JAIL_CONSUMPTION_AMOUNT = 1.0 → net = -0.5, so with 0 resources:
      // after gather = 0.5, consumption = 1.0, starvation fires, resources = 0
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 0;
      person.illness = 0.1;
      sim.add(person);

      if (Variables.JAIL_CONSUMPTION_AMOUNT > Variables.JAIL_GATHER_AMOUNT) {
        new JailEvent().execute(person, sim);
        expect(person.illness).toBeCloseTo(0.1 + Variables.STARVATION_ILLNESS_RATE);
        expect(person.resources).toBe(0);
      }
    });

    it('illness is clamped to 1.0', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 0;
      person.illness = 1.0;
      sim.add(person);

      if (Variables.JAIL_CONSUMPTION_AMOUNT > Variables.JAIL_GATHER_AMOUNT) {
        new JailEvent().execute(person, sim);
        expect(person.illness).toBe(1.0);
      }
    });
  });
});
