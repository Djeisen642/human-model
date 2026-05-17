import InventionEvent from '../../Events/InventionEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('InventionEvent', () => {
  const totalWeight = Variables.INVENTION_DEPLETION_FASTER_WEIGHT
    + Variables.INVENTION_DEPLETION_SLOWER_WEIGHT
    + Variables.INVENTION_CEILING_GROWTH_WEIGHT;

  // rng threshold boundaries for each outcome
  const fasterThreshold = Variables.INVENTION_DEPLETION_FASTER_WEIGHT / totalWeight;

  describe('depletion-faster outcome', () => {
    it('increases extractionEfficiency when roll < INVENTION_DEPLETION_FASTER_WEIGHT', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      const before = sim.extractionEfficiency;

      // rng() * totalWeight = 0 < INVENTION_DEPLETION_FASTER_WEIGHT → faster branch
      new InventionEvent(() => 0).execute(person, sim);

      expect(sim.extractionEfficiency).toBeGreaterThan(before);
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

      expect(sim2.extractionEfficiency).toBeGreaterThan(sim1.extractionEfficiency);
    });

    it('floors extractionEfficiency at 0.01 on depletion-faster when efficiency is already near zero', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 10;
      sim.add(person);
      // Force efficiency to near-zero so floor is exercised
      // The faster branch multiplies by (1 + delta) which increases efficiency — use slower branch to reach floor
      // Set efficiency explicitly to test floor on slower branch
      sim.extractionEfficiency = 0.001;

      // rng() * totalWeight should be in [FASTER_WEIGHT, FASTER_WEIGHT + SLOWER_WEIGHT)
      const rngForSlower = (fasterThreshold + 0.0001);

      new InventionEvent(() => rngForSlower).execute(person, sim);

      expect(sim.extractionEfficiency).toBeGreaterThanOrEqual(0.01);
    });
  });

  describe('depletion-slower outcome', () => {
    it('decreases extractionEfficiency when roll in slower range', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      const before = sim.extractionEfficiency;

      // rng() * totalWeight should be in [FASTER_WEIGHT, FASTER_WEIGHT + SLOWER_WEIGHT)
      // With equal weights of 1, totalWeight=3: need rng in [1/3, 2/3)
      // rng = 0.5 → roll = 1.5, which is in [1, 2) → slower branch
      new InventionEvent(() => 0.5).execute(person, sim);

      expect(sim.extractionEfficiency).toBeLessThan(before);
    });

    it('floors extractionEfficiency at 0.01 even with high intelligence', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 10;
      sim.add(person);
      sim.extractionEfficiency = 0.001;

      new InventionEvent(() => 0.5).execute(person, sim);

      expect(sim.extractionEfficiency).toBeGreaterThanOrEqual(0.01);
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
      // With equal weights totalWeight=3: need rng >= 2/3 → use 0.99
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

  describe('outcome weight boundaries', () => {
    it('depletion-faster branch fires at roll just below FASTER_WEIGHT', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      const before = sim.extractionEfficiency;

      // rng() * totalWeight just below FASTER_WEIGHT → use rng just below 1/totalWeight
      const rng = (Variables.INVENTION_DEPLETION_FASTER_WEIGHT - 0.0001) / totalWeight;
      new InventionEvent(() => rng).execute(person, sim);

      expect(sim.extractionEfficiency).toBeGreaterThan(before);
    });

    it('depletion-slower branch fires at roll just at FASTER_WEIGHT boundary', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.intelligence = 5;
      sim.add(person);
      const before = sim.extractionEfficiency;

      // rng() * totalWeight exactly = FASTER_WEIGHT → slower branch
      const rng = Variables.INVENTION_DEPLETION_FASTER_WEIGHT / totalWeight;
      new InventionEvent(() => rng).execute(person, sim);

      expect(sim.extractionEfficiency).toBeLessThan(before);
    });
  });
});
