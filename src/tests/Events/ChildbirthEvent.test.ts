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
      const [a, b] = makeCouple(sim);
      // `makeCouple` leaves stats at the Person constructor default of 0, which `Simulation.seed`
      // never produces — it draws founders from SEED_RANGES. Under ARD 037's constant anchor a
      // zero-stat couple still had a non-zero child, which masked that; under ARD 064 the child of
      // two zero-stat parents is correctly near zero. Give the parents the stats a real founder
      // would have, so this still guards what it was written to guard: that a newborn comes out
      // with real stats rather than the zeros of the original crash.
      a.intelligence = 6; b.intelligence = 6;
      a.intelligenceEndowment = 6; b.intelligenceEndowment = 6;
      a.constitution = 6; b.constitution = 6;
      a.constitutionEndowment = 6; b.constitutionEndowment = 6;
      a.charisma = 6; b.charisma = 6;

      new ChildbirthEvent(alwaysPass).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.intelligence).toBeGreaterThan(0);
      expect(child.constitution).toBeGreaterThan(0);
      expect(child.charisma).toBeGreaterThan(0);
    });

    /**
     * Set a trait and, for the three traits ARD 066 splits, its endowment too — i.e. describe a
     * person who expresses that value and was also born with it.
     *
     * @param p - the person
     * @param field - heritable field to set
     * @param value - value to set
     */
    function setTrait(p: Person, field: 'intelligence' | 'stealingIntent' | 'learningIntent', value: number): void {
      p[field] = value;
      if (field === 'intelligence') p.intelligenceEndowment = value;
      if (field === 'stealingIntent') p.stealingIntentEndowment = value;
    }

    /**
     * Fill the simulation with enough same-valued people to clear HERITABILITY_MIN_SAMPLE, so the
     * draw anchors to the population rather than falling back to the parents.
     *
     * @param sim - simulation to populate
     * @param field - heritable field to set
     * @param value - value every filler carries
     */
    function fillPopulation(sim: Simulation, field: 'intelligence' | 'stealingIntent', value: number): void {
      for (let i = 0; i < Variables.HERITABILITY_MIN_SAMPLE; i++) {
        const p = new Person([]);
        p.age = 30;
        setTrait(p, field, value);
        sim.add(p);
      }
    }

    // The draw takes two rng values per trait (Box-Muller), and cos(2*PI*0.25) is 0, so a second
    // value of 0.25 zeroes the residual and leaves the deterministic part on its own.
    const NO_NOISE = [0.5, 0.25];
    /** Gate roll, then a zero-noise pair for each of the seven heritable fields. */
    const zeroNoiseDraws = [0, ...Array(7).fill(NO_NOISE).flat()];

    it('child stats regress toward the LIVING POPULATION mean, not a constant (ARD 064)', () => {
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      fillPopulation(sim, 'intelligence', 2);
      setTrait(a, 'intelligence', 10); setTrait(b, 'intelligence', 10);

      new ChildbirthEvent(scriptedRng(zeroNoiseDraws)).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      // Population mean includes the two parents at 10 and MIN_SAMPLE fillers at 2.
      const n = Variables.HERITABILITY_MIN_SAMPLE;
      const popMean = (2 * 10 + n * 2) / (n + 2);
      const expected = popMean + (10 - popMean) * Variables.HERITABILITY_STAT_COEFFICIENT;
      expect(child.intelligence).toBeCloseTo(expected);
      // The decisive part: the anchor moved with the population it was measured in.
      expect(child.intelligence).toBeLessThan(10);
      expect(child.intelligence).toBeGreaterThan(popMean);
    });

    it('child stats regress UPWARD when parents sit below the population mean', () => {
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      fillPopulation(sim, 'intelligence', 9);
      setTrait(a, 'intelligence', 1); setTrait(b, 'intelligence', 1);

      new ChildbirthEvent(scriptedRng(zeroNoiseDraws)).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.intelligence).toBeGreaterThan(1);
    });

    it('child intents regress toward the population mean, NOT toward zero (reverses ARD 037)', () => {
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      fillPopulation(sim, 'stealingIntent', 0.2);
      setTrait(a, 'stealingIntent', 0.8); setTrait(b, 'stealingIntent', 0.8);

      new ChildbirthEvent(scriptedRng(zeroNoiseDraws)).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      const n = Variables.HERITABILITY_MIN_SAMPLE;
      const popMean = (2 * 0.8 + n * 0.2) / (n + 2);
      expect(child.stealingIntent).toBeCloseTo(popMean + (0.8 - popMean) * Variables.HERITABILITY_INTENT_COEFFICIENT);
      // Under ARD 037 this was 0.8 * coefficient = 0.2. It must now sit above the population mean,
      // because the child inherits part of its parents' elevation rather than losing all of it.
      expect(child.stealingIntent).toBeGreaterThan(popMean);
    });

    it('anchors to the parents when the population is too small to describe itself', () => {
      // Only the couple is alive, far below HERITABILITY_MIN_SAMPLE, so the population's mean and
      // spread are noise and the draw must not use them.
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      setTrait(a, 'stealingIntent', 0.8); setTrait(b, 'stealingIntent', 0.8);

      new ChildbirthEvent(scriptedRng(zeroNoiseDraws)).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      // anchor === parentMean makes the regression term vanish: the child sits at the parents.
      expect(child.stealingIntent).toBeCloseTo(0.8);
    });

    it('keeps a low-seeded intent low and a high-seeded one high across a generation', () => {
      // ARD 045's prosocial/antisocial asymmetry must survive without being hard-coded anywhere:
      // it should follow from each trait having its own population mean.
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      for (let i = 0; i < Variables.HERITABILITY_MIN_SAMPLE; i++) {
        const p = new Person([]);
        p.age = 30;
        p.killingIntent = 0.05;
        p.learningIntent = 0.5;
        sim.add(p);
      }
      a.killingIntent = 0.05; b.killingIntent = 0.05;
      a.learningIntent = 0.5; b.learningIntent = 0.5;

      new ChildbirthEvent(scriptedRng(zeroNoiseDraws)).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.killingIntent).toBeCloseTo(0.05);
      expect(child.learningIntent).toBeCloseTo(0.5);
      expect(child.killingIntent).toBeLessThan(child.learningIntent);
    });

    it('residual spread scales with the trait, so a zero-variance population breeds true', () => {
      // Every living person identical → sd 0 → residual 0 regardless of the rng draw.
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      fillPopulation(sim, 'intelligence', 7);
      setTrait(a, 'intelligence', 7); setTrait(b, 'intelligence', 7);

      // Deliberately noisy rng: it must not matter.
      new ChildbirthEvent(scriptedRng([0, ...Array(14).fill(0.9)])).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.intelligence).toBeCloseTo(7);
    });

    it('intent draws still clamp to [0, 1]', () => {
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      // A population straddling 0 for stealingIntent gives a real spread; parents at 0 plus a
      // strongly negative residual must not produce a negative intent.
      for (let i = 0; i < Variables.HERITABILITY_MIN_SAMPLE; i++) {
        const p = new Person([]);
        p.age = 30;
        setTrait(p, 'stealingIntent', i % 2 === 0 ? 0 : 0.3);
        sim.add(p);
      }
      setTrait(a, 'stealingIntent', 0); setTrait(b, 'stealingIntent', 0);

      // standardNormal takes u = 1 - rng(), so an rng near 1 makes u tiny and the magnitude large;
      // v = 0.5 puts cos at -1, so the residual is large and negative.
      new ChildbirthEvent(scriptedRng([0, ...Array(7).fill([0.999999, 0.5]).flat()])).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.stealingIntent).toBe(0);
    });

    it('inherits the parents ENDOWMENT, not what their life added to it (ARD 066)', () => {
      // The regression test for the defect ARD 064's measurement found: a population that has
      // learned its way to a cap must still produce children near the endowment mean.
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      for (let i = 0; i < Variables.HERITABILITY_MIN_SAMPLE; i++) {
        const p = new Person([]);
        p.age = 60;
        p.intelligenceEndowment = 6;      // born ordinary
        p.intelligence = Variables.INTELLIGENCE_MAX; // a lifetime of LearnEvent
        sim.add(p);
      }
      a.intelligenceEndowment = 6; b.intelligenceEndowment = 6;
      a.intelligence = Variables.INTELLIGENCE_MAX; b.intelligence = Variables.INTELLIGENCE_MAX;

      new ChildbirthEvent(scriptedRng(zeroNoiseDraws)).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.intelligence).toBeCloseTo(6);
      expect(child.intelligenceEndowment).toBeCloseTo(6);
      // Under ARD 064 alone this child would have been born at the cap.
      expect(child.intelligence).toBeLessThan(Variables.INTELLIGENCE_MAX);
    });

    it('the same holds for stealingIntent against ARD 036 emboldening', () => {
      const sim = new Simulation();
      const [a, b] = makeCouple(sim);
      for (let i = 0; i < Variables.HERITABILITY_MIN_SAMPLE; i++) {
        const p = new Person([]);
        p.age = 40;
        p.stealingIntentEndowment = 0.15;             // born at the founder mean
        p.stealingIntent = Variables.STEALING_INTENT_CAP; // emboldened to the cap
        sim.add(p);
      }
      a.stealingIntentEndowment = 0.15; b.stealingIntentEndowment = 0.15;
      a.stealingIntent = Variables.STEALING_INTENT_CAP; b.stealingIntent = Variables.STEALING_INTENT_CAP;

      new ChildbirthEvent(scriptedRng(zeroNoiseDraws)).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.stealingIntent).toBeCloseTo(0.15);
      expect(child.stealingIntent).toBeLessThan(Variables.STEALING_INTENT_CAP);
    });

    it('a newborn expresses exactly its endowment', () => {
      const sim = new Simulation();
      const [a] = makeCouple(sim);
      fillPopulation(sim, 'intelligence', 5);

      new ChildbirthEvent(scriptedRng([0, ...Array(14).fill(0.7)])).execute(a, sim);

      const child = sim.getLiving().find(p => p.childOf.length === 2)!;
      expect(child.intelligence).toBe(child.intelligenceEndowment);
      expect(child.constitution).toBe(child.constitutionEndowment);
      expect(child.stealingIntent).toBe(child.stealingIntentEndowment);
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

  describe('fertility window boundary (ARD 059)', () => {
    /**
     * Wire a healthy, well-resourced couple whose older partner is at `olderAge`.
     *
     * @param olderAge - age of the older partner; drives the childbirth ageModifier
     * @returns the simulation and the lower-indexed partner to execute against
     */
    function fertileCoupleAged(olderAge: number): { sim: Simulation; a: Person } {
      const sim = new Simulation();
      const a = new Person([]);
      const b = new Person([]);
      a.resources = 100; b.resources = 100;
      a.age = 26;
      b.age = olderAge;
      sim.add(a); sim.add(b);
      partner(a, b);
      return { sim, a };
    }

    // The window ends at PEAK + SCALE. Changing this is a biological claim, not a
    // calibration tweak — it needs a new ARD superseding 059.
    it('ends the fertile window at age 44', () => {
      expect(Variables.CHILDBIRTH_PEAK_AGE + Variables.CHILDBIRTH_AGE_SCALE).toBe(44);
    });

    // At 43 the modifier is 0.108, so p ≈ 0.6 * 0.108 * happinessFactor ≥ 0.065.
    // At 44+ it clamps to AGE_FLOOR (0.02), so p ≤ 0.6 * 0.02 * 1.5 ≈ 0.018.
    // rng = 0.03 therefore fires inside the window and not past it.
    it('a couple just inside the window conceives above the floor', () => {
      const { sim, a } = fertileCoupleAged(43);

      new ChildbirthEvent(() => 0.03).execute(a, sim);

      expect(sim.getLiving().length).toBe(3);
    });

    it('a couple at the window edge is pinned to the floor', () => {
      const { sim, a } = fertileCoupleAged(44);

      new ChildbirthEvent(() => 0.03).execute(a, sim);

      expect(sim.getLiving().length).toBe(2);
    });

    it('treats every age past the window edge identically', () => {
      const past = [44, 50, 70].map(age => {
        const { sim, a } = fertileCoupleAged(age);
        new ChildbirthEvent(() => 0.03).execute(a, sim);
        return sim.getLiving().length;
      });

      expect(past).toEqual([2, 2, 2]);
    });
  });
});
