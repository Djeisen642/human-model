import Simulation from '../../App/Simulation';
import Person from '../../App/Person';
import Constants from '../../Helpers/Constants';

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
});
