import HelpEvent from '../../Events/HelpEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('HelpEvent', () => {
  describe('no-op cases', () => {
    it('does not throw when no other person exists (sole person)', () => {
      const sim = new Simulation();
      const helper = new Person([]);
      helper.resources = 50;
      sim.add(helper);

      const event = new HelpEvent(() => 0);
      expect(() => event.execute(helper, sim)).not.toThrow();
      expect(helper.resources).toBe(50);
    });

    it('does nothing when target has equal or more resources than helper', () => {
      const sim = new Simulation();
      const helper = new Person([]);
      const target = new Person([]);
      helper.resources = 30;
      target.resources = 30;
      sim.add(helper);
      sim.add(target);

      const event = new HelpEvent(() => 0);
      event.execute(helper, sim);

      expect(helper.resources).toBe(30);
      expect(target.resources).toBe(30);
      expect(helper.helpHappinessBoost).toBe(0);
    });

    it('does nothing when helper has zero resources', () => {
      const sim = new Simulation();
      const helper = new Person([]);
      const target = new Person([]);
      helper.resources = 0;
      target.resources = 0;
      sim.add(helper);
      sim.add(target);

      const event = new HelpEvent(() => 0);
      event.execute(helper, sim);

      expect(helper.resources).toBe(0);
      expect(target.resources).toBe(0);
      expect(helper.helpHappinessBoost).toBe(0);
    });
  });

  describe('amount calculation', () => {
    it('transfers HELP_FRACTION of helper resources when below HELP_MAX_AMOUNT', () => {
      const sim = new Simulation();
      const helper = new Person([]);
      const target = new Person([]);
      // 50 * HELP_FRACTION (0.1) = 5, below HELP_MAX_AMOUNT (10)
      helper.resources = 50;
      target.resources = 10;
      sim.add(helper);
      sim.add(target);

      const event = new HelpEvent(() => 0);
      event.execute(helper, sim);

      const expectedAmount = 50 * Variables.HELP_FRACTION;
      expect(helper.resources).toBeCloseTo(50 - expectedAmount);
      expect(target.resources).toBeCloseTo(10 + expectedAmount);
    });

    it('caps transfer at HELP_MAX_AMOUNT when helper is wealthy', () => {
      const sim = new Simulation();
      const helper = new Person([]);
      const target = new Person([]);
      // 1000 * HELP_FRACTION (0.1) = 100, exceeds HELP_MAX_AMOUNT (10)
      helper.resources = 1000;
      target.resources = 0;
      sim.add(helper);
      sim.add(target);

      const event = new HelpEvent(() => 0);
      event.execute(helper, sim);

      expect(helper.resources).toBeCloseTo(1000 - Variables.HELP_MAX_AMOUNT);
      expect(target.resources).toBeCloseTo(Variables.HELP_MAX_AMOUNT);
    });
  });

  describe('resource transfer', () => {
    it('helper loses exactly the amount target gains', () => {
      const sim = new Simulation();
      const helper = new Person([]);
      const target = new Person([]);
      helper.resources = 80;
      target.resources = 20;
      sim.add(helper);
      sim.add(target);

      const beforeHelper = helper.resources;
      const beforeTarget = target.resources;

      const event = new HelpEvent(() => 0);
      event.execute(helper, sim);

      const lost = beforeHelper - helper.resources;
      const gained = target.resources - beforeTarget;
      expect(lost).toBeCloseTo(gained);
      expect(lost).toBeGreaterThan(0);
    });
  });

  describe('happiness boost (ARD 046)', () => {
    it('sets helpHappinessBoost after a successful transfer', () => {
      const sim = new Simulation();
      const helper = new Person([]);
      const target = new Person([]);
      helper.resources = 80;
      target.resources = 20;
      sim.add(helper);
      sim.add(target);

      const event = new HelpEvent(() => 0);
      event.execute(helper, sim);

      expect(helper.helpHappinessBoost).toBeCloseTo(Variables.HELP_HAPPINESS_BOOST);
    });

    it('does not set helpHappinessBoost on a no-op', () => {
      const sim = new Simulation();
      const helper = new Person([]);
      const target = new Person([]);
      helper.resources = 20;
      target.resources = 80; // target richer — no transfer
      sim.add(helper);
      sim.add(target);

      const event = new HelpEvent(() => 0);
      event.execute(helper, sim);

      expect(helper.helpHappinessBoost).toBe(0);
    });

    it('helpHappinessBoost stacks up to HELP_HAPPINESS_MAX', () => {
      const sim = new Simulation();
      const helper = new Person([]);
      const target = new Person([]);
      helper.resources = 1000;
      target.resources = 0;
      sim.add(helper);
      sim.add(target);

      helper.helpHappinessBoost = Variables.HELP_HAPPINESS_MAX - 0.1;

      const event = new HelpEvent(() => 0);
      event.execute(helper, sim);

      expect(helper.helpHappinessBoost).toBeCloseTo(Variables.HELP_HAPPINESS_MAX);
    });
  });
});
