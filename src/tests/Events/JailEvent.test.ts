import JailEvent from '../../Events/JailEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('JailEvent (ARD 035)', () => {
  describe('gather fires before consumption check', () => {
    it('avoids starvation when gather puts resources above consumption threshold', () => {
      // Start exactly at CONSUME - GATHER so gather brings resources to exactly CONSUME_AMOUNT.
      // If gather did NOT fire, consumption would trigger starvation. Passing proves gather ran first.
      const startResources = Variables.JAIL_CONSUMPTION_AMOUNT - Variables.JAIL_GATHER_AMOUNT;
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = startResources;
      person.illness = 0;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(person.illness).toBe(0); // no starvation: gather brought resources to exactly CONSUME_AMOUNT
      expect(person.resources).toBeCloseTo(0); // fully consumed, floored
    });

    it('net change per tick equals JAIL_GATHER_AMOUNT minus JAIL_CONSUMPTION_AMOUNT when resources are ample', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 100;
      sim.add(person);

      new JailEvent().execute(person, sim);

      const expected = 100 + Variables.JAIL_GATHER_AMOUNT - Variables.JAIL_CONSUMPTION_AMOUNT;
      expect(person.resources).toBeCloseTo(expected);
    });
  });

  describe('starvation when resources insufficient', () => {
    it('adds STARVATION_ILLNESS_RATE to illness when resources cannot cover cost after gather', () => {
      // JAIL_GATHER_AMOUNT=0.5 < JAIL_CONSUMPTION_AMOUNT=1.0 → with resources=0:
      // after gather=0.5 < cost=1.0 → starvation fires, resources=0, illness += STARVATION_ILLNESS_RATE
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 0;
      person.illness = 0;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(person.illness).toBeCloseTo(Variables.STARVATION_ILLNESS_RATE);
      expect(person.resources).toBe(0);
    });

    it('starvation accumulates on successive ticks when starting from 0', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 0;
      person.illness = 0.1;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(person.illness).toBeCloseTo(0.1 + Variables.STARVATION_ILLNESS_RATE);
    });

    it('illness clamps to 1.0 under starvation', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 0;
      person.illness = 1.0;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(person.illness).toBe(1.0);
    });

    it('resources never go below 0', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 0;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(person.resources).toBeGreaterThanOrEqual(0);
    });
  });
});
