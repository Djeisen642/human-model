import StealEvent from '../../Events/StealEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';
import StealingRecord from '../../Records/StealingRecord';

describe('StealEvent', () => {
  describe('no-op cases', () => {
    it('does not throw and does nothing when getRandomOther returns null (sole person)', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      thief.resources = 50;
      sim.add(thief);

      const event = new StealEvent(() => 0);
      expect(() => event.execute(thief, sim)).not.toThrow();
      expect(thief.resources).toBe(50);
      expect(thief.amountStolen.length).toBe(0);
    });

    it('does nothing when victim has zero resources', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.resources = 50;
      victim.resources = 0;
      sim.add(thief);
      sim.add(victim);

      // rng returns 0 so getRandomOther picks the only candidate
      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      expect(thief.resources).toBe(50);
      expect(victim.resources).toBe(0);
      expect(thief.amountStolen.length).toBe(0);
    });
  });

  describe('amount calculation', () => {
    it('takes STEAL_FRACTION of victim resources when below STEAL_MAX_AMOUNT', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      // victim.resources * STEAL_FRACTION = 50 * 0.1 = 5, which is below STEAL_MAX_AMOUNT (10)
      thief.resources = 0;
      victim.resources = 50;
      sim.add(thief);
      sim.add(victim);

      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      const expectedAmount = 50 * Variables.STEAL_FRACTION;
      expect(victim.resources).toBeCloseTo(50 - expectedAmount);
      expect(thief.resources).toBeCloseTo(expectedAmount);
    });

    it('caps amount at STEAL_MAX_AMOUNT when victim is wealthy', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      // victim.resources * STEAL_FRACTION = 1000 * 0.1 = 100, which exceeds STEAL_MAX_AMOUNT (10)
      thief.resources = 0;
      victim.resources = 1000;
      sim.add(thief);
      sim.add(victim);

      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      expect(thief.resources).toBeCloseTo(Variables.STEAL_MAX_AMOUNT);
      expect(victim.resources).toBeCloseTo(1000 - Variables.STEAL_MAX_AMOUNT);
    });
  });

  describe('resource transfer', () => {
    it('thief gains exactly the amount victim loses', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.resources = 20;
      victim.resources = 60;
      sim.add(thief);
      sim.add(victim);

      const before = { thief: thief.resources, victim: victim.resources };
      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      const gained = thief.resources - before.thief;
      const lost = before.victim - victim.resources;
      expect(gained).toBeCloseTo(lost);
      expect(gained).toBeGreaterThan(0);
    });
  });

  describe('StealingRecord', () => {
    it('pushes a StealingRecord with correct victim reference, amount, and thief age', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.age = 24;
      thief.resources = 0;
      victim.resources = 50;
      sim.add(thief);
      sim.add(victim);

      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      expect(thief.amountStolen.length).toBe(1);
      const record = thief.amountStolen[0];
      expect(record).toBeInstanceOf(StealingRecord);
      expect(record.person).toBe(victim);
      expect(record.age).toBe(24);
      expect(record.amount).toBeCloseTo(50 * Variables.STEAL_FRACTION);
    });

    it('does not push a record when victim has no resources', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      victim.resources = 0;
      sim.add(thief);
      sim.add(victim);

      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      expect(thief.amountStolen.length).toBe(0);
    });
  });
});
