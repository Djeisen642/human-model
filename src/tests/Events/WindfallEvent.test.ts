import WindfallEvent from '../../Events/WindfallEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('WindfallEvent', () => {
  describe('resource gain', () => {
    it('adds at least WINDFALL_BASE_AMOUNT when rng returns 0', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 20;
      sim.add(person);

      new WindfallEvent(() => 0).execute(person, sim);

      expect(person.resources).toBeCloseTo(20 + Variables.WINDFALL_BASE_AMOUNT);
    });

    it('adds at most WINDFALL_BASE_AMOUNT + WINDFALL_VARIANCE when rng returns 1', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 20;
      sim.add(person);

      new WindfallEvent(() => 1).execute(person, sim);

      expect(person.resources).toBeCloseTo(20 + Variables.WINDFALL_BASE_AMOUNT + Variables.WINDFALL_VARIANCE);
    });

    it('gain is independent of starting resources (flat, not proportional)', () => {
      const sim = new Simulation();
      const poor = new Person([]);
      const rich = new Person([]);
      poor.resources = 5;
      rich.resources = 95;
      sim.add(poor);
      sim.add(rich);

      const rngVal = 0.5;
      new WindfallEvent(() => rngVal).execute(poor, sim);
      new WindfallEvent(() => rngVal).execute(rich, sim);

      const poorGain = poor.resources - 5;
      const richGain = rich.resources - 95;
      expect(poorGain).toBeCloseTo(richGain);
    });

    it('accumulates correctly across multiple windfalls', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 0;
      sim.add(person);

      new WindfallEvent(() => 0).execute(person, sim);
      new WindfallEvent(() => 0).execute(person, sim);

      expect(person.resources).toBeCloseTo(Variables.WINDFALL_BASE_AMOUNT * 2);
    });
  });

  describe('gain range', () => {
    it('gain is always in [WINDFALL_BASE_AMOUNT, WINDFALL_BASE_AMOUNT + WINDFALL_VARIANCE]', () => {
      const sim = new Simulation();
      const person = new Person([]);
      sim.add(person);

      const rngValues = [0, 0.25, 0.5, 0.75, 1];
      for (const val of rngValues) {
        const before = person.resources;
        new WindfallEvent(() => val).execute(person, sim);
        const gain = person.resources - before;
        expect(gain).toBeGreaterThanOrEqual(Variables.WINDFALL_BASE_AMOUNT);
        expect(gain).toBeLessThanOrEqual(Variables.WINDFALL_BASE_AMOUNT + Variables.WINDFALL_VARIANCE);
        person.resources = before; // reset for next iteration
      }
    });
  });

  describe('pool sourcing (ARD 040)', () => {
    it('pool drain equals personal gain', () => {
      const sim = new Simulation();
      sim.naturalResources = 1000;
      const person = new Person([]);
      person.resources = 0;
      sim.add(person);

      new WindfallEvent(() => 0.5).execute(person, sim);

      expect(person.resources).toBeCloseTo(1000 - sim.naturalResources);
    });

    it('grants nothing when pool is empty', () => {
      const sim = new Simulation();
      sim.naturalResources = 0;
      const person = new Person([]);
      person.resources = 0;
      sim.add(person);

      new WindfallEvent(() => 0).execute(person, sim);

      expect(person.resources).toBe(0);
      expect(sim.naturalResources).toBe(0);
    });

    it('clamps grant to whatever pool can supply', () => {
      const sim = new Simulation();
      sim.naturalResources = 2;
      const person = new Person([]);
      person.resources = 0;
      sim.add(person);

      new WindfallEvent(() => 1).execute(person, sim);

      expect(sim.naturalResources).toBe(0);
      expect(person.resources).toBe(2);
    });
  });
});
