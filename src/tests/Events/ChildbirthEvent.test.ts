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
    it('lower-index partner fires and creates a child', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b); // a is index 0, b is index 1
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      expect(sim.getLiving().length).toBe(3);
    });

    it('higher-index partner alone does not create a child', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b); // a is index 0, b is index 1
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(b, sim); // b is higher-index → no-op

      expect(sim.getLiving().length).toBe(2);
    });

    it('firing on both partners creates exactly one child', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);
      new ChildbirthEvent(alwaysPass).execute(b, sim);

      expect(sim.getLiving().length).toBe(3);
    });
  });

  describe('successful birth', () => {
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

    it('floors parent resources at 0 when cost exceeds resources, birth still occurs', () => {
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
      expect(sim.getLiving().length).toBe(3); // birth still happened despite b being poor
    });
  });

  describe('suppressor interactions', () => {
    it('full resources and zero illness gives highest probability (fires with high rng threshold)', () => {
      // Peak age, full resources, zero illness → illnessFactor=1, resourceFactor=1.
      // p = 0.40 * 1.0 * 1.0 * 1.0 * happinessFactor; happinessFactor ≥ 1 so p ≥ 0.40.
      // rng = 0.35 → fires regardless of HAPPINESS_BASELINE tuning.
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

    it('partial illness reduces probability (rng with headroom against HAPPINESS_BASELINE tuning)', () => {
      // Couple illness = max(0.5, 0) = 0.5 → illnessFactor = 1 - 0.5*0.8 = 0.6.
      // p = 0.40 * 1.0 * 0.6 * 1.0 * happinessFactor.
      // Max realistic happinessFactor at this setup ≈ 1.5 (happiness ~10) → p_max ≈ 0.36.
      // rng = 0.7 has ~2x headroom over p_max, so the test is robust to baseline tuning.
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 100; b.resources = 100;
      a.age = 26; b.age = 26;
      a.illness = 0.5;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(() => 0.7).execute(a, sim);

      expect(sim.getLiving().length).toBe(2);
    });
  });

  describe('couple aggregation', () => {
    it('partner illness blocks the couple even when person is healthy', () => {
      // a (lower-index) is fully healthy; b (partner) is fully ill.
      // Couple illness = max(0, 1) = 1 → illnessFactor = 1 - 0.8 = 0.2.
      // p ≈ 0.40 * 1.0 * 0.2 * 1.0 * happinessFactor ≈ 0.08–0.12.
      // rng = 0.5 well above p_max for any reasonable HAPPINESS_BASELINE.
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 100; b.resources = 100;
      a.age = 26; b.age = 26;
      a.illness = 0;
      b.illness = 1;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(() => 0.5).execute(a, sim);

      expect(sim.getLiving().length).toBe(2);
    });

    it('poorer partner binds the resource factor', () => {
      // a is rich (100), b is at the resource floor (RESOURCE_MIN).
      // Couple resources = min(100, MIN) = MIN → resourceFactor = 0 → no birth.
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 100;
      b.resources = Variables.CHILDBIRTH_RESOURCE_MIN;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      expect(sim.getLiving().length).toBe(2);
    });

    it('older partner age drives the ageModifier', () => {
      // a is at peak age (26); b is far past peak — couple age = max should hit floor.
      // With AGE_FLOOR = 0.02, p ≤ 0.40 * 0.02 * happinessFactor ≈ 0.008–0.012.
      // alwaysPass=0 still fires (0 < tiny p), but rng = 0.05 should not.
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 100; b.resources = 100;
      a.age = 26;
      b.age = 70; // far past peak — ageModifier clamps to AGE_FLOOR
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(() => 0.05).execute(a, sim);

      expect(sim.getLiving().length).toBe(2);
    });
  });
});
