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
      // p ≈ 0.6 * 1.0 * 0.2 * 1.0 * 1.0 = 0.12 → rng=0.9 > 0.12 → no birth
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

    it('successful birth records the birth on the simulation (ARD 033)', () => {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 50; b.resources = 50;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);

      new ChildbirthEvent(alwaysPass).execute(a, sim);
      const snap = sim.snapshot();

      expect(snap.births).toBe(1);
      expect(snap.cumulativeBirths).toBe(1);
    });

    it('no-op execute does not record a birth (ARD 033)', () => {
      const sim = new Simulation();
      const lonely = new Person([]);
      lonely.resources = 50;
      lonely.age = 26;
      sim.add(lonely);

      new ChildbirthEvent(alwaysPass).execute(lonely, sim);
      const snap = sim.snapshot();

      expect(snap.births).toBe(0);
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
      // p = 0.6 * 1.0 * 1.0 * 1.0 * happinessFactor; happinessFactor ≥ 1 so p ≥ 0.6.
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
      // p = 0.6 * 1.0 * 0.6 * 1.0 * happinessFactor.
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

  describe('newborn stat seeding (ARD 037)', () => {
    /**
     * Build an rng that returns the given sequence, then 0 forever.
     * First call is consumed by the probability gate; the rest seed the child.
     *
     * @param values - sequence of rng return values
     * @returns rng function
     */
    function scriptedRng(values: number[]): () => number {
      let i = 0;
      return () => (i < values.length ? values[i++] : 0);
    }

    /**
     * Wire two persons as a peak-age, well-resourced couple ready to fire a birth.
     *
     * @param sim - simulation
     * @returns the two parents
     */
    function makeCouple(sim: Simulation): [Person, Person] {
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 100; b.resources = 100;
      a.age = 26; b.age = 26;
      sim.add(a); sim.add(b);
      partner(a, b);
      return [a, b];
    }

    it('child stats are no longer 0 after birth (crash fix)', () => {
      const sim = new Simulation();
      const [a] = makeCouple(sim);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.intelligence).toBeGreaterThan(0);
      expect(child.constitution).toBeGreaterThan(0);
      expect(child.charisma).toBeGreaterThan(0);
    });

    it('child stats regress toward parental mean', () => {
      // rng=0.5 → noise = 0, so child = popMean + (parentMean - popMean) * coefficient.
      // First rng call is the probability gate (0 forces birth); next three are stat draws.
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      a.intelligence = 10; b.intelligence = 10;
      a.constitution = 10; b.constitution = 10;
      a.charisma = 10; b.charisma = 10;

      new ChildbirthEvent(scriptedRng([0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      const expected = Variables.NEWBORN_STAT_POPULATION_MEAN
        + (10 - Variables.NEWBORN_STAT_POPULATION_MEAN) * Variables.HERITABILITY_STAT_COEFFICIENT;
      expect(child.intelligence).toBeCloseTo(expected);
      expect(child.constitution).toBeCloseTo(expected);
      expect(child.charisma).toBeCloseTo(expected);
    });

    it('child stats regress upward from low-stat parents (toward population mean)', () => {
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      a.intelligence = 1; b.intelligence = 1;
      a.constitution = 1; b.constitution = 1;
      a.charisma = 1; b.charisma = 1;

      new ChildbirthEvent(scriptedRng([0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      // Child should be higher than the parents but below population mean.
      expect(child.intelligence).toBeGreaterThan(1);
      expect(child.intelligence).toBeLessThan(Variables.NEWBORN_STAT_POPULATION_MEAN);
    });

    it('child intents regress toward zero (target = 0, not population mean)', () => {
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      a.stealingIntent = 0.8; b.stealingIntent = 0.8;
      a.killingIntent = 0.5; b.killingIntent = 0.5;

      new ChildbirthEvent(scriptedRng([0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      // With noise=0: child = parentMean * coefficient.
      expect(child.stealingIntent).toBeCloseTo(0.8 * Variables.HERITABILITY_INTENT_COEFFICIENT);
      expect(child.killingIntent).toBeCloseTo(0.5 * Variables.HERITABILITY_INTENT_COEFFICIENT);
      // And meaningfully lower than parents.
      expect(child.stealingIntent).toBeLessThan(0.8);
      expect(child.killingIntent).toBeLessThan(0.5);
    });

    it('intent draws clamp to [0, 1] when noise would push negative', () => {
      // Clean lineage (intent=0) + maximum-negative noise (rng=0) → raw = -NOISE_RANGE → clamped to 0.
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      a.stealingIntent = 0; b.stealingIntent = 0;

      new ChildbirthEvent(scriptedRng([0, 0.5, 0.5, 0.5, 0.5, 0.5, 0, 0.5, 0.5])).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.stealingIntent).toBe(0);
    });

    it('different rng sequences produce different children (noise creates sibling variance)', () => {
      const sim1 = new Simulation();
      const [a1] = makeCouple(sim1);
      a1.intelligence = 5; (a1.isInRelationshipWith as Person).intelligence = 5;
      new ChildbirthEvent(scriptedRng([0, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).execute(a1, sim1);
      const child1 = sim1.getLiving().find(p => p.childOf.length === 2)!;

      const sim2 = new Simulation();
      const [a2] = makeCouple(sim2);
      a2.intelligence = 5; (a2.isInRelationshipWith as Person).intelligence = 5;
      new ChildbirthEvent(scriptedRng([0, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).execute(a2, sim2);
      const child2 = sim2.getLiving().find(p => p.childOf.length === 2)!;

      expect(child1.intelligence).not.toBeCloseTo(child2.intelligence);
    });

    it('child non-inherited fields stay at constructor defaults', () => {
      const sim = new Simulation();
      const [a] = makeCouple(sim);

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.age).toBe(0);
      expect(child.resources).toBe(0);
      expect(child.experience).toBe(0);
      expect(child.illness).toBe(0);
      expect(child.isInRelationshipWith).toBeNull();
      expect(child.hasChildren.length).toBe(0);
    });
  });

  describe('couple aggregation', () => {
    it('partner illness blocks the couple even when person is healthy', () => {
      // a (lower-index) is fully healthy; b (partner) is fully ill.
      // Couple illness = max(0, 1) = 1 → illnessFactor = 1 - 0.8 = 0.2.
      // p ≈ 0.6 * 1.0 * 0.2 * 1.0 * happinessFactor ≈ 0.12–0.18.
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
      // With AGE_FLOOR = 0.02, p ≤ 0.6 * 0.02 * happinessFactor ≈ 0.012–0.018.
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
