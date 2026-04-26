import Simulation from '../../App/Simulation';
import Person from '../../App/Person';
import Constants from '../../Helpers/Constants';
import Variables from '../../Helpers/Variables';
import SeededRandom from '../../Helpers/SeededRandom';

const alwaysFirst: () => number = () => 0;

describe('Simulation', () => {
  describe('add / getLiving', () => {
    it('should start with no living persons', () => {
      const sim = new Simulation();
      expect(sim.getLiving()).toHaveLength(0);
    });

    it('should add persons to the living population', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      expect(sim.getLiving()).toHaveLength(1);
      expect(sim.getLiving()).toContain(p);
    });

    it('getLiving should return a copy, not the internal array', () => {
      const sim = new Simulation();
      sim.add(new Person([]));
      const copy = sim.getLiving();
      copy.push(new Person([]));
      expect(sim.getLiving()).toHaveLength(1);
    });
  });

  describe('getRandomOther', () => {
    it('should return null when no other person exists', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      expect(sim.getRandomOther(p, alwaysFirst)).toBeNull();
    });

    it('should never return the excluded person', () => {
      const sim = new Simulation();
      const p1 = new Person([]);
      const p2 = new Person([]);
      const p3 = new Person([]);
      sim.add(p1);
      sim.add(p2);
      sim.add(p3);
      for (let i = 0; i < 20; i++) {
        expect(sim.getRandomOther(p1, Math.random)).not.toBe(p1);
      }
    });

    it('should return the only other person when one candidate exists', () => {
      const sim = new Simulation();
      const p1 = new Person([]);
      const p2 = new Person([]);
      sim.add(p1);
      sim.add(p2);
      expect(sim.getRandomOther(p1, alwaysFirst)).toBe(p2);
    });
  });

  describe('kill', () => {
    it('should move the person from living to deceased', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      sim.kill(p, Constants.CAUSE_OF_DEATH.ILLNESS);
      expect(sim.getLiving()).not.toContain(p);
    });

    it('should set causeOfDeath on the victim', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      sim.kill(p, Constants.CAUSE_OF_DEATH.ILLNESS);
      expect(p.causeOfDeath).not.toBeNull();
      expect(p.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.ILLNESS);
    });

    it('should add a KillingRecord to the killer on murder', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      sim.add(killer);
      sim.add(victim);
      sim.kill(victim, Constants.CAUSE_OF_DEATH.MURDER, killer);
      expect(killer.killed.has(victim)).toBe(true);
      expect(killer.killed.get(victim)?.person).toBe(victim);
    });

    it('should record the death cause for snapshot', () => {
      const sim = new Simulation();
      const p1 = new Person([]);
      const p2 = new Person([]);
      sim.add(p1);
      sim.add(p2);
      sim.kill(p1, Constants.CAUSE_OF_DEATH.MURDER);
      sim.kill(p2, Constants.CAUSE_OF_DEATH.ILLNESS);
      const snap = sim.snapshot();
      expect(snap.deaths).toBe(2);
      expect(snap.deathsByMurder).toBe(1);
      expect(snap.deathsByIllness).toBe(1);
    });
  });

  describe('snapshot', () => {
    it('should append to history each call', () => {
      const sim = new Simulation();
      sim.snapshot();
      sim.snapshot();
      expect(sim.history).toHaveLength(2);
    });

    it('should increment tick each call', () => {
      const sim = new Simulation();
      const s0 = sim.snapshot();
      const s1 = sim.snapshot();
      expect(s0.tick).toBe(0);
      expect(s1.tick).toBe(1);
    });

    it('should reset death counts after snapshot', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      sim.kill(p, Constants.CAUSE_OF_DEATH.DISASTER);
      sim.snapshot();
      const s2 = sim.snapshot();
      expect(s2.deaths).toBe(0);
    });

    it('should compute averageResources correctly', () => {
      const sim = new Simulation();
      const p1 = new Person([]);
      p1.resources = 10;
      const p2 = new Person([]);
      p2.resources = 20;
      sim.add(p1);
      sim.add(p2);
      const snap = sim.snapshot();
      expect(snap.averageResources).toBe(15);
    });

    it('should compute resourceGini of 0 for equal resources', () => {
      const sim = new Simulation();
      [10, 10, 10].forEach(r => {
        const p = new Person([]);
        p.resources = r;
        sim.add(p);
      });
      expect(sim.snapshot().resourceGini).toBeCloseTo(0);
    });

    it('should compute a positive resourceGini for unequal resources', () => {
      const sim = new Simulation();
      [0, 0, 100].forEach(r => {
        const p = new Person([]);
        p.resources = r;
        sim.add(p);
      });
      expect(sim.snapshot().resourceGini).toBeGreaterThan(0);
    });

    it('should report population 0 and gini 0 with no living persons', () => {
      const sim = new Simulation();
      const snap = sim.snapshot();
      expect(snap.population).toBe(0);
      expect(snap.resourceGini).toBe(0);
      expect(snap.averageResources).toBe(0);
    });
  });

  describe('seed', () => {
    it('should add exactly n persons', () => {
      const sim = new Simulation();
      sim.seed(10, alwaysFirst);
      expect(sim.getLiving()).toHaveLength(10);
    });

    it('should add 0 persons when n is 0', () => {
      const sim = new Simulation();
      sim.seed(0, alwaysFirst);
      expect(sim.getLiving()).toHaveLength(0);
    });

    it('should produce deterministic results for the same seed', () => {
      const sim1 = new Simulation();
      const sim2 = new Simulation();
      sim1.seed(5, new SeededRandom(42).asRNG());
      sim2.seed(5, new SeededRandom(42).asRNG());
      sim1.getLiving().forEach((p, i) => {
        const q = sim2.getLiving()[i];
        expect(p.age).toBe(q.age);
        expect(p.resources).toBe(q.resources);
        expect(p.intelligence).toBe(q.intelligence);
      });
    });

    it('age should be in [15, 50)', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.age).toBeGreaterThanOrEqual(15);
        expect(p.age).toBeLessThan(50);
      });
    });

    it('resources should be in [0, 100)', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.resources).toBeGreaterThanOrEqual(0);
        expect(p.resources).toBeLessThan(100);
      });
    });

    it('intelligence, constitution, charisma should be in [1, 10]', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.intelligence).toBeGreaterThanOrEqual(1);
        expect(p.intelligence).toBeLessThanOrEqual(10);
        expect(p.constitution).toBeGreaterThanOrEqual(1);
        expect(p.constitution).toBeLessThanOrEqual(10);
        expect(p.charisma).toBeGreaterThanOrEqual(1);
        expect(p.charisma).toBeLessThanOrEqual(10);
      });
    });

    it('experience should be in [0, age]', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.experience).toBeGreaterThanOrEqual(0);
        expect(p.experience).toBeLessThanOrEqual(p.age);
      });
    });

    it('killingIntent should be in [0, 0.1)', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.killingIntent).toBeGreaterThanOrEqual(0);
        expect(p.killingIntent).toBeLessThan(0.1);
      });
    });

    it('stealingIntent and lyingIntent should be in [0, 0.3)', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.stealingIntent).toBeGreaterThanOrEqual(0);
        expect(p.stealingIntent).toBeLessThan(0.3);
        expect(p.lyingIntent).toBeGreaterThanOrEqual(0);
        expect(p.lyingIntent).toBeLessThan(0.3);
      });
    });

    it('minimum age with rng always 0 should be 15', () => {
      const sim = new Simulation();
      sim.seed(1, alwaysFirst);
      expect(sim.getLiving()[0].age).toBe(15);
    });
  });

  describe('resource pool', () => {
    it('should initialize naturalResources to NATURAL_RESOURCE_CEILING_INITIAL', () => {
      const sim = new Simulation();
      expect(sim.naturalResources).toBe(Variables.NATURAL_RESOURCE_CEILING_INITIAL);
    });

    it('should initialize naturalResourceCeiling to NATURAL_RESOURCE_CEILING_INITIAL', () => {
      const sim = new Simulation();
      expect(sim.naturalResourceCeiling).toBe(Variables.NATURAL_RESOURCE_CEILING_INITIAL);
    });

    it('should initialize extractionEfficiency to 1.0', () => {
      const sim = new Simulation();
      expect(sim.extractionEfficiency).toBe(1.0);
    });

    it('regenerate should increase naturalResources by NATURAL_RESOURCE_REGEN_RATE', () => {
      const sim = new Simulation();
      sim.naturalResources = 100;
      sim.regenerate();
      expect(sim.naturalResources).toBe(100 + Variables.NATURAL_RESOURCE_REGEN_RATE);
    });

    it('regenerate should not exceed naturalResourceCeiling', () => {
      const sim = new Simulation();
      sim.naturalResources = sim.naturalResourceCeiling - 1;
      sim.regenerate();
      expect(sim.naturalResources).toBe(sim.naturalResourceCeiling);
    });

    it('regenerate should leave naturalResources at ceiling when already full', () => {
      const sim = new Simulation();
      sim.regenerate();
      expect(sim.naturalResources).toBe(sim.naturalResourceCeiling);
    });

    it('snapshot should include naturalResources', () => {
      const sim = new Simulation();
      sim.naturalResources = 5_000;
      const snap = sim.snapshot();
      expect(snap.naturalResources).toBe(5_000);
    });

    it('snapshot naturalResources reflects post-extraction state', () => {
      const sim = new Simulation();
      sim.naturalResources = 3_000;
      const snap = sim.snapshot();
      expect(snap.naturalResources).toBe(3_000);
    });
  });
});
