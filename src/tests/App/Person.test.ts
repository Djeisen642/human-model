import Person from '../../App/Person';
import Variables from '../../Helpers/Variables';
import DeathRecord from '../../Records/DeathRecord';
import Constants from '../../Helpers/Constants';

describe('Person', () => {
  it('should create a Person', () => {
    const person = new Person([]);

    expect(person).toBeTruthy();
    expect(person.age).toBe(0);
  });

  it('Should create a Person with parents', () => {
    const parent1 = new Person([]);
    const parent2 = new Person([]);
    const parents = [parent1, parent2];
    const person = new Person(parents);

    expect(person).toBeTruthy();
    expect(person.childOf).toBe(parents);
  });

  describe('happiness', () => {
    it('adds 5 for having a job, subtracts 3 for not having one', () => {
      const withJob = new Person([]);
      withJob.hasJob = true;
      withJob.resources = 50;
      withJob.age = 30;

      const withoutJob = new Person([]);
      withoutJob.hasJob = false;
      withoutJob.resources = 50;
      withoutJob.age = 30;

      expect(withJob.happiness).toBeGreaterThan(withoutJob.happiness);
    });

    it('penalises critical resources (< 10) by 5', () => {
      const rich = new Person([]);
      rich.hasJob = true;
      rich.resources = 50;
      rich.age = 30;

      const poor = new Person([]);
      poor.hasJob = true;
      poor.resources = 5;
      poor.age = 30;

      expect(rich.happiness - poor.happiness).toBe(5);
    });

    it('penalises low resources (< 30) by 2', () => {
      const neutral = new Person([]);
      neutral.hasJob = true;
      neutral.resources = 50;
      neutral.age = 30;

      const low = new Person([]);
      low.hasJob = true;
      low.resources = 20;
      low.age = 30;

      expect(neutral.happiness - low.happiness).toBe(2);
    });

    it('adds 3 for comfortable resources (>= 70)', () => {
      const neutral = new Person([]);
      neutral.hasJob = true;
      neutral.resources = 50;
      neutral.age = 30;

      const comfortable = new Person([]);
      comfortable.hasJob = true;
      comfortable.resources = 80;
      comfortable.age = 30;

      expect(comfortable.happiness - neutral.happiness).toBe(3);
    });

    it('adds 3 for being in a relationship', () => {
      const partner = new Person([]);
      const single = new Person([]);
      single.hasJob = true;
      single.resources = 50;
      single.age = 30;

      const coupled = new Person([]);
      coupled.hasJob = true;
      coupled.resources = 50;
      coupled.age = 30;
      coupled.isInRelationshipWith = partner;

      expect(coupled.happiness - single.happiness).toBe(3);
    });

    it('no age penalty for children (< 18)', () => {
      const adult = new Person([]);
      adult.hasJob = true;
      adult.resources = 50;
      adult.age = 25;

      const youth = new Person([]);
      youth.hasJob = true;
      youth.resources = 50;
      youth.age = 15;

      expect(adult.happiness).toBe(youth.happiness);
    });

    it('penalises age > 65 by 1', () => {
      const adult = new Person([]);
      adult.hasJob = true;
      adult.resources = 50;
      adult.age = 40;

      const elder = new Person([]);
      elder.hasJob = true;
      elder.resources = 50;
      elder.age = 70;

      expect(adult.happiness - elder.happiness).toBe(1);
    });

    it('no job penalty for children or elderly outside working age', () => {
      // Difference should be exactly 5 (job bonus only), not 8 (bonus + penalty swing)
      const unemployedYouth = new Person([]);
      unemployedYouth.hasJob = false;
      unemployedYouth.resources = 50;
      unemployedYouth.age = 15;

      const employedYouth = new Person([]);
      employedYouth.hasJob = true;
      employedYouth.resources = 50;
      employedYouth.age = 15;

      // Use resources=120 for elderly so neither hits the happiness floor
      const unemployedElder = new Person([]);
      unemployedElder.hasJob = false;
      unemployedElder.resources = 120;
      unemployedElder.age = 70;

      const employedElder = new Person([]);
      employedElder.hasJob = true;
      employedElder.resources = 120;
      employedElder.age = 70;

      expect(employedYouth.happiness - unemployedYouth.happiness).toBe(5);
      expect(employedElder.happiness - unemployedElder.happiness).toBe(5);
    });

    it('children use average living parents resources for happiness', () => {
      const parent1 = new Person([]);
      parent1.resources = 80;
      const parent2 = new Person([]);
      parent2.resources = 80;

      const childWealthyParents = new Person([parent1, parent2]);
      childWealthyParents.age = 10;
      childWealthyParents.resources = 0;

      const childPoorParents = new Person([]);
      childPoorParents.age = 10;
      childPoorParents.resources = 0;

      // Child with wealthy parents should be happier (uses parents' 80 avg vs own 0)
      expect(childWealthyParents.happiness).toBeGreaterThan(childPoorParents.happiness);
    });

    it('orphaned child falls back to own resources', () => {
      const deadParent1 = new Person([]);
      deadParent1.resources = 1000;
      deadParent1.causeOfDeath = new DeathRecord(Constants.CAUSE_OF_DEATH.ILLNESS);

      const deadParent2 = new Person([]);
      deadParent2.resources = 1000;
      deadParent2.causeOfDeath = new DeathRecord(Constants.CAUSE_OF_DEATH.ILLNESS);

      const orphan = new Person([deadParent1, deadParent2]);
      orphan.age = 10;
      orphan.resources = 5;

      const noParentsChild = new Person([]);
      noParentsChild.age = 10;
      noParentsChild.resources = 5;

      // Both use own resources since no living parents — should score the same
      expect(orphan.happiness).toBe(noParentsChild.happiness);
    });

    it('elderly use higher resource thresholds (critical >= 20, comfortable >= 100)', () => {
      const adultBorderline = new Person([]);
      adultBorderline.hasJob = true;
      adultBorderline.age = 40;
      adultBorderline.resources = 15; // above adult critical (10), below elder critical (20)

      const elderBorderline = new Person([]);
      elderBorderline.hasJob = true;
      elderBorderline.age = 70;
      elderBorderline.resources = 15; // below elder critical (20), so penalised -5

      // Elder hits critical threshold at 15 resources; adult only hits low threshold
      expect(adultBorderline.happiness).toBeGreaterThan(elderBorderline.happiness);
    });

    it('reduces happiness proportionally to illness', () => {
      const healthy = new Person([]);
      healthy.hasJob = true;
      healthy.resources = 50;
      healthy.age = 30;
      healthy.illness = 0;

      const ill = new Person([]);
      ill.hasJob = true;
      ill.resources = 50;
      ill.age = 30;
      ill.illness = 1;

      expect(healthy.happiness - ill.happiness).toBe(5);
    });

    it('never goes below 0', () => {
      const worst = new Person([]);
      worst.hasJob = false;
      worst.resources = 0;
      worst.age = 70;
      worst.illness = 1;

      expect(worst.happiness).toBe(0);
    });
  });

  describe('ageMortalityModifier', () => {
    it('is 1 at PRIME_AGE (U-curve minimum)', () => {
      const person = new Person([]);
      person.age = Variables.PRIME_AGE;
      expect(person.ageMortalityModifier).toBe(1);
    });

    it('is greater than 1 in infancy', () => {
      const person = new Person([]);
      person.age = 0;
      expect(person.ageMortalityModifier).toBeGreaterThan(1);
    });

    it('is greater than 1 in old age', () => {
      const person = new Person([]);
      person.age = 70;
      expect(person.ageMortalityModifier).toBeGreaterThan(1);
    });

    it('is higher at age 70 than at age 0', () => {
      const infant = new Person([]);
      infant.age = 0;
      const elder = new Person([]);
      elder.age = 70;
      expect(elder.ageMortalityModifier).toBeGreaterThan(infant.ageMortalityModifier);
    });

    it('is symmetric: same deviation above and below PRIME_AGE yields equal modifier', () => {
      const younger = new Person([]);
      younger.age = Variables.PRIME_AGE - 10;
      const older = new Person([]);
      older.age = Variables.PRIME_AGE + 10;
      expect(younger.ageMortalityModifier).toBeCloseTo(older.ageMortalityModifier);
    });
  });
});
