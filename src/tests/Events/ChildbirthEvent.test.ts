import ChildbirthEvent from '../../Events/ChildbirthEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

/**
 * Wire two persons into a mutual relationship.
 *
 * @param a - first partner
 * @param b - second partner
 */
function partner(a: Person, b: Person): void {
  a.isInRelationshipWith = b;
  b.isInRelationshipWith = a;
}

/**
 * rng that always returns 0 — causes all probability rolls to pass.
 *
 * @returns 0
 */
const alwaysPass = (): number => 0;

describe('ChildbirthEvent', () => {
  describe('no-op cases', () => {
    it('does nothing when person is not in a relationship', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.resources = 50;
      person.age = 26;
      sim.add(person);

      new ChildbirthEvent(alwaysPass).execute(person, sim);

      expect(sim.getLiving().length).toBe(1);
    });

    it('does nothing when probability roll fails', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      // rng always returns 1 — roll always fails
      new ChildbirthEvent(() => 1).execute(a, sim);

      expect(sim.getLiving().length).toBe(2);
    });

    it('does nothing when resources <= CHILDBIRTH_RESOURCE_MIN (resourceFactor = 0)', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = Variables.CHILDBIRTH_RESOURCE_MIN;
      b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      expect(sim.getLiving().length).toBe(2);
    });

    it('does nothing when illness suppresses probability below rng (illness=1, scalar=0.8 → factor=0.2)', () => {
      // illnessFactor = max(0, 1 - 1.0 * 0.8) = 0.2
      // p ≈ BASE_CHILDBIRTH_RATE * ageModifier(26,...) * 0.2 * resourceFactor * happinessFactor
      // With resources=50 (above SCALE=30), resourceFactor=1; happiness≈0, happinessFactor=1
      // p ≈ 0.40 * 1.0 * 0.2 * 1.0 * 1.0 = 0.08 → rng=0.9 > 0.08 → no birth
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.illness = 1;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(() => 0.9).execute(a, sim);

      expect(sim.getLiving().length).toBe(2);
    });
  });

  describe('deduplication', () => {
    it('fires event on both partners but creates exactly one child', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      // Fire on both — only the lower-index partner should create a child
      new ChildbirthEvent(alwaysPass).execute(a, sim);
      new ChildbirthEvent(alwaysPass).execute(b, sim);

      expect(sim.getLiving().length).toBe(3);
    });
  });

  describe('successful birth', () => {
    it('adds child to simulation.getLiving()', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      expect(sim.getLiving().length).toBe(3);
    });

    it('child\'s childOf contains both parents', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      const child = sim.getLiving().find(p => p !== a && p !== b)!;
      expect(child.childOf).toContain(a);
      expect(child.childOf).toContain(b);
    });

    it('both parents\' hasChildren contain the child', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      const child = sim.getLiving().find(p => p !== a && p !== b)!;
      expect(a.hasChildren).toContain(child);
      expect(b.hasChildren).toContain(child);
    });

    it('deducts CHILDBIRTH_BIRTH_COST from each parent', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 60;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      expect(a.resources).toBeCloseTo(50 - Variables.CHILDBIRTH_BIRTH_COST);
      expect(b.resources).toBeCloseTo(60 - Variables.CHILDBIRTH_BIRTH_COST);
    });

    it('floors parent resources at 0 when cost exceeds resources', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50;
      b.resources = Variables.CHILDBIRTH_BIRTH_COST - 1; // less than cost
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      expect(b.resources).toBe(0);
    });
  });

  describe('suppressor interactions', () => {
    it('full resources and zero illness gives highest probability (fires with high rng threshold)', () => {
      // At peak age, full resources, zero illness, moderate happiness:
      // illnessFactor=1, resourceFactor=1, happinessFactor≥1 → p ≈ BASE_CHILDBIRTH_RATE
      // rng = 0.35 < 0.40 → should fire
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 100; b.resources = 100;
      a.age = 26; b.age = 26;
      a.illness = 0;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(() => 0.35).execute(a, sim);

      expect(sim.getLiving().length).toBe(3);
    });

    it('partial illness reduces probability (same rng that fired above now fails)', () => {
      // illness=0.5 → illnessFactor = max(0, 1 - 0.5*0.8) = 0.6
      // p ≈ 0.40 * 1.0 * 0.6 * 1.0 * happinessFactor ≈ 0.24+
      // rng=0.35 > 0.24 → should NOT fire
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 100; b.resources = 100;
      a.age = 26; b.age = 26;
      a.illness = 0.5;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(() => 0.35).execute(a, sim);

      expect(sim.getLiving().length).toBe(2);
    });
  });
});
