import InventionEvent from '../../Events/InventionEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('InventionEvent', () => {
  const totalWeight = Variables.INVENTION_DEPLETION_FASTER_WEIGHT
    + Variables.INVENTION_DEPLETION_SLOWER_WEIGHT
    + Variables.INVENTION_CEILING_GROWTH_WEIGHT;

  describe('depletion-faster outcome', () => {
    it('increases extractionProductivity when roll < INVENTION_DEPLETION_FASTER_WEIGHT', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      const before = sim.extractionProductivity;

      // rng() * totalWeight = 0 < INVENTION_DEPLETION_FASTER_WEIGHT → faster branch
      new InventionEvent(() => 0).execute(person, sim);

      expect(sim.extractionProductivity).toBeGreaterThan(before);
    });

    it('delta scales with intelligence: higher intelligence → larger efficiency increase', () => {
      const sim1 = new Simulation();
      const person1 = new Person([]);
      person1.intelligence = 2;
      sim1.add(person1);

      const sim2 = new Simulation();
      const person2 = new Person([]);
      person2.intelligence = 8;
      sim2.add(person2);

      new InventionEvent(() => 0).execute(person1, sim1);
      new InventionEvent(() => 0).execute(person2, sim2);

      expect(sim2.extractionProductivity).toBeGreaterThan(sim1.extractionProductivity);
    });

  });

  describe('depletion-slower outcome', () => {
    it('decreases extractionProductivity when roll in slower range', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      const before = sim.extractionProductivity;

      // With weights 1:1:2 (ARD 043), totalWeight=4: slower window is rng in [0.25, 0.5).
      new InventionEvent(() => 0.3).execute(person, sim);

      expect(sim.extractionProductivity).toBeLessThan(before);
    });

    it('floors extractionProductivity at EXTRACTION_PRODUCTIVITY_FLOOR even with high intelligence', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 10;
      sim.add(person);
      sim.extractionProductivity = 0.001;

      new InventionEvent(() => 0.3).execute(person, sim);

      expect(sim.extractionProductivity).toBeGreaterThanOrEqual(Variables.EXTRACTION_PRODUCTIVITY_FLOOR);
    });
  });

  describe('ceiling-growth outcome', () => {
    it('increases naturalResourceCeiling when roll >= FASTER_WEIGHT + SLOWER_WEIGHT', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      const before = sim.naturalResourceCeiling;

      // rng() * totalWeight >= FASTER_WEIGHT + SLOWER_WEIGHT
      // With weights 1:1:2 (ARD 043) totalWeight=4: ceiling branch fires when rng >= 0.5 → 0.99 is safely inside.
      new InventionEvent(() => 0.99).execute(person, sim);

      expect(sim.naturalResourceCeiling).toBeGreaterThan(before);
    });

    it('ceiling growth scales with current ceiling (proportional, not fixed)', () => {
      const sim1 = new Simulation();
      const person1 = new Person([]);
      person1.intelligence = 5;
      sim1.add(person1);
      sim1.naturalResourceCeiling = 1000;

      const sim2 = new Simulation();
      const person2 = new Person([]);
      person2.intelligence = 5;
      sim2.add(person2);
      sim2.naturalResourceCeiling = 10000;

      new InventionEvent(() => 0.99).execute(person1, sim1);
      new InventionEvent(() => 0.99).execute(person2, sim2);

      const growth1 = sim1.naturalResourceCeiling - 1000;
      const growth2 = sim2.naturalResourceCeiling - 10000;
      expect(growth2).toBeGreaterThan(growth1);
    });

    it('ceiling growth scales with intelligence', () => {
      const sim1 = new Simulation();
      const person1 = new Person([]);
      person1.intelligence = 2;
      sim1.add(person1);

      const sim2 = new Simulation();
      const person2 = new Person([]);
      person2.intelligence = 9;
      sim2.add(person2);

      new InventionEvent(() => 0.99).execute(person1, sim1);
      new InventionEvent(() => 0.99).execute(person2, sim2);

      const growth1 = sim1.naturalResourceCeiling - Variables.NATURAL_RESOURCE_CEILING_INITIAL;
      const growth2 = sim2.naturalResourceCeiling - Variables.NATURAL_RESOURCE_CEILING_INITIAL;
      expect(growth2).toBeGreaterThan(growth1);
    });
  });

  describe('invention counters (ARD 032)', () => {
    /**
     * @returns sim+person ready for InventionEvent.execute()
     */
    function setup(): { sim: Simulation; person: Person } {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      return { sim, person };
    }

    it('faster branch increments inventionFasterCount only', () => {
      const { sim, person } = setup();
      new InventionEvent(() => 0).execute(person, sim);
      expect(sim.inventionFasterCount).toBe(1);
      expect(sim.inventionSlowerCount).toBe(0);
      expect(sim.inventionCeilingCount).toBe(0);
    });

    it('slower branch increments inventionSlowerCount only', () => {
      // Weights 1:1:2 (ARD 043): slower window is rng in [0.25, 0.5)
      const { sim, person } = setup();
      new InventionEvent(() => 0.3).execute(person, sim);
      expect(sim.inventionFasterCount).toBe(0);
      expect(sim.inventionSlowerCount).toBe(1);
      expect(sim.inventionCeilingCount).toBe(0);
    });

    it('ceiling branch increments inventionCeilingCount only', () => {
      const { sim, person } = setup();
      new InventionEvent(() => 0.99).execute(person, sim);
      expect(sim.inventionFasterCount).toBe(0);
      expect(sim.inventionSlowerCount).toBe(0);
      expect(sim.inventionCeilingCount).toBe(1);
    });

    it('counters accumulate across firings', () => {
      const { sim, person } = setup();
      const event = new InventionEvent(() => 0);
      event.execute(person, sim);
      event.execute(person, sim);
      event.execute(person, sim);
      expect(sim.inventionFasterCount).toBe(3);
    });
  });

  describe('outcome weight boundaries', () => {
    it('depletion-faster branch fires at roll just below FASTER_WEIGHT', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      const before = sim.extractionProductivity;

      // rng() * totalWeight just below FASTER_WEIGHT → use rng just below 1/totalWeight
      const rng = (Variables.INVENTION_DEPLETION_FASTER_WEIGHT - 0.0001) / totalWeight;
      new InventionEvent(() => rng).execute(person, sim);

      expect(sim.extractionProductivity).toBeGreaterThan(before);
    });

    it('depletion-slower branch fires at roll just at FASTER_WEIGHT boundary', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      const before = sim.extractionProductivity;

      // rng() * totalWeight exactly = FASTER_WEIGHT → slower branch
      const rng = Variables.INVENTION_DEPLETION_FASTER_WEIGHT / totalWeight;
      new InventionEvent(() => rng).execute(person, sim);

      expect(sim.extractionProductivity).toBeLessThan(before);
    });
  });
});
