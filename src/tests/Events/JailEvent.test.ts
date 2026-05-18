import JailEvent from '../../Events/JailEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('JailEvent (ARD 035, ARD 041)', () => {
  describe('gather fires before consumption check (community-pool funded)', () => {
    it('avoids starvation when gather puts resources above consumption threshold', () => {
      const startResources = Variables.JAIL_CONSUMPTION_AMOUNT - Variables.JAIL_GATHER_AMOUNT;
      const sim = new Simulation();
      sim.communityPool = 100;
      const person = new Person([]);
      person.resources = startResources;
      person.illness = 0;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(person.illness).toBe(0);
      expect(person.resources).toBeCloseTo(0);
    });

    it('net change per tick equals JAIL_GATHER_AMOUNT minus JAIL_CONSUMPTION_AMOUNT when pool is ample', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const person = new Person([]);
      person.resources = 100;
      sim.add(person);

      new JailEvent().execute(person, sim);

      const expected = 100 + Variables.JAIL_GATHER_AMOUNT - Variables.JAIL_CONSUMPTION_AMOUNT;
      expect(person.resources).toBeCloseTo(expected);
    });

    it('debits exactly JAIL_GATHER_AMOUNT from communityPool when pool is sufficient', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const person = new Person([]);
      person.resources = 100;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(sim.communityPool).toBeCloseTo(100 - Variables.JAIL_GATHER_AMOUNT);
    });
  });

  describe('community pool exhaustion', () => {
    it('grants nothing when communityPool is zero and triggers starvation', () => {
      const sim = new Simulation();
      sim.communityPool = 0;
      const person = new Person([]);
      person.resources = 0;
      person.illness = 0;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(sim.communityPool).toBe(0);
      expect(person.resources).toBe(0);
      expect(person.illness).toBeCloseTo(Variables.STARVATION_ILLNESS_RATE);
    });

    it('clamps grant to whatever the pool can supply', () => {
      const sim = new Simulation();
      sim.communityPool = 0.1;
      const person = new Person([]);
      person.resources = 0;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(sim.communityPool).toBe(0);
      // person received 0.1, cost is 1.0 → starves, resources = 0
      expect(person.resources).toBe(0);
      expect(person.illness).toBeCloseTo(Variables.STARVATION_ILLNESS_RATE);
    });
  });

  describe('starvation when resources insufficient', () => {
    it('adds STARVATION_ILLNESS_RATE to illness when resources cannot cover cost after gather', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
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
      sim.communityPool = 100;
      const person = new Person([]);
      person.resources = 0;
      person.illness = 0.1;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(person.illness).toBeCloseTo(0.1 + Variables.STARVATION_ILLNESS_RATE);
    });

    it('illness clamps to 1.0 under starvation', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const person = new Person([]);
      person.resources = 0;
      person.illness = 1.0;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(person.illness).toBe(1.0);
    });

    it('resources never go below 0', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const person = new Person([]);
      person.resources = 0;
      sim.add(person);

      new JailEvent().execute(person, sim);

      expect(person.resources).toBeGreaterThanOrEqual(0);
    });
  });
});
