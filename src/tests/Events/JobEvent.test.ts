import JobEvent from '../../Events/JobEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';
import Constants from '../../Helpers/Constants';
import { ageModifier } from '../../Helpers/AgeModifier';

describe('JobEvent', () => {
  let simulation: Simulation;

  beforeEach(() => {
    simulation = new Simulation();
  });

  describe('job gain (unemployed person)', () => {
    it('grants job when rng is below gain probability', () => {
      const person = new Person([]);
      person.age = 35;
      person.experience = 20;
      person.charisma = 5;
      simulation.add(person);

      const gainProb = (20 * Variables.JOB_GAIN_EXPERIENCE_SCALAR + 5 * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(35, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR);

      new JobEvent(() => gainProb - 0.001).execute(person, simulation);

      expect(person.hasJob).toBe(true);
    });

    it('does not grant job when rng is at or above gain probability', () => {
      const person = new Person([]);
      person.age = 35;
      person.experience = 20;
      person.charisma = 5;
      simulation.add(person);

      const gainProb = (20 * Variables.JOB_GAIN_EXPERIENCE_SCALAR + 5 * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(35, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR);

      new JobEvent(() => gainProb + 0.001).execute(person, simulation);

      expect(person.hasJob).toBe(false);
    });

    it('higher experience produces a higher gain threshold — person with low exp stays unemployed while high exp gains', () => {
      const age = 35;
      const charisma = 5;
      const expLow = 5;
      const expHigh = 40;

      const probLow = (expLow * Variables.JOB_GAIN_EXPERIENCE_SCALAR + charisma * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(age, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR);
      const probHigh = (expHigh * Variables.JOB_GAIN_EXPERIENCE_SCALAR + charisma * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(age, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR);

      const rngValue = (probLow + probHigh) / 2; // between the two thresholds

      const personLow = new Person([]);
      personLow.age = age;
      personLow.experience = expLow;
      personLow.charisma = charisma;
      simulation.add(personLow);
      new JobEvent(() => rngValue).execute(personLow, simulation);

      const personHigh = new Person([]);
      personHigh.age = age;
      personHigh.experience = expHigh;
      personHigh.charisma = charisma;
      simulation.add(personHigh);
      new JobEvent(() => rngValue).execute(personHigh, simulation);

      expect(personLow.hasJob).toBe(false);
      expect(personHigh.hasJob).toBe(true);
    });

    it('higher charisma produces a higher gain threshold — person with low charisma stays unemployed while high charisma gains', () => {
      const age = 35;
      const experience = 20;
      const charismaLow = 1;
      const charismaHigh = 9;

      const probLow = (experience * Variables.JOB_GAIN_EXPERIENCE_SCALAR + charismaLow * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(age, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR);
      const probHigh = (experience * Variables.JOB_GAIN_EXPERIENCE_SCALAR + charismaHigh * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(age, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR);

      const rngValue = (probLow + probHigh) / 2;

      const personLow = new Person([]);
      personLow.age = age;
      personLow.experience = experience;
      personLow.charisma = charismaLow;
      simulation.add(personLow);
      new JobEvent(() => rngValue).execute(personLow, simulation);

      const personHigh = new Person([]);
      personHigh.age = age;
      personHigh.experience = experience;
      personHigh.charisma = charismaHigh;
      simulation.add(personHigh);
      new JobEvent(() => rngValue).execute(personHigh, simulation);

      expect(personLow.hasJob).toBe(false);
      expect(personHigh.hasJob).toBe(true);
    });

    it('age modifier suppresses gain at extreme ages — prime-age person gains while child does not, given the same stats', () => {
      const experience = 20;
      const charisma = 5;

      const probPrime = (experience * Variables.JOB_GAIN_EXPERIENCE_SCALAR + charisma * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(35, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR);
      const probChild = (experience * Variables.JOB_GAIN_EXPERIENCE_SCALAR + charisma * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(5, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR);

      const rngValue = (probChild + probPrime) / 2; // above child threshold, below prime threshold

      const child = new Person([]);
      child.age = 5;
      child.experience = experience;
      child.charisma = charisma;
      simulation.add(child);
      new JobEvent(() => rngValue).execute(child, simulation);

      const adult = new Person([]);
      adult.age = 35;
      adult.experience = experience;
      adult.charisma = charisma;
      simulation.add(adult);
      new JobEvent(() => rngValue).execute(adult, simulation);

      expect(child.hasJob).toBe(false);
      expect(adult.hasJob).toBe(true);
    });

    it('person with zero experience and charisma never gains a job regardless of rng', () => {
      const person = new Person([]);
      person.age = 35;
      // experience=0, charisma=0 → gainProb=0
      simulation.add(person);

      new JobEvent(() => 0).execute(person, simulation);

      expect(person.hasJob).toBe(false);
    });
  });

  describe('job loss (employed person)', () => {
    it('removes job when rng is below loss probability', () => {
      const person = new Person([]);
      person.age = 35;
      person.experience = 5;
      person.charisma = 2;
      person.hasJob = true;
      simulation.add(person);

      const lossProb = Variables.JOB_LOSS_BASE
        + Variables.JOB_LOSS_STAT_SCALAR * (1 / (5 + 1)) * (1 / (2 + 1));

      new JobEvent(() => lossProb - 0.001).execute(person, simulation);

      expect(person.hasJob).toBe(false);
    });

    it('keeps job when rng is at or above loss probability', () => {
      const person = new Person([]);
      person.age = 35;
      person.experience = 5;
      person.charisma = 2;
      person.hasJob = true;
      simulation.add(person);

      const lossProb = Variables.JOB_LOSS_BASE
        + Variables.JOB_LOSS_STAT_SCALAR * (1 / (5 + 1)) * (1 / (2 + 1));

      new JobEvent(() => lossProb + 0.001).execute(person, simulation);

      expect(person.hasJob).toBe(true);
    });

    it('low-stat employed person loses job while high-stat person keeps it, given rng between their thresholds', () => {
      const lossLow = Variables.JOB_LOSS_BASE
        + Variables.JOB_LOSS_STAT_SCALAR * (1 / (1 + 1)) * (1 / (1 + 1));
      const lossHigh = Variables.JOB_LOSS_BASE
        + Variables.JOB_LOSS_STAT_SCALAR * (1 / (40 + 1)) * (1 / (9 + 1));

      const rngValue = (lossHigh + lossLow) / 2; // above high-stat threshold, below low-stat threshold

      const personLow = new Person([]);
      personLow.experience = 1;
      personLow.charisma = 1;
      personLow.hasJob = true;
      simulation.add(personLow);
      new JobEvent(() => rngValue).execute(personLow, simulation);

      const personHigh = new Person([]);
      personHigh.experience = 40;
      personHigh.charisma = 9;
      personHigh.hasJob = true;
      simulation.add(personHigh);
      new JobEvent(() => rngValue).execute(personHigh, simulation);

      expect(personLow.hasJob).toBe(false);
      expect(personHigh.hasJob).toBe(true);
    });

    it('even a maxed-out person faces a non-zero loss rate (flat base rate is always present)', () => {
      const lossMax = Variables.JOB_LOSS_BASE
        + Variables.JOB_LOSS_STAT_SCALAR * (1 / (Variables.EXPERIENCE_CAP + 1)) * (1 / (10 + 1));

      expect(lossMax).toBeGreaterThan(0);

      // Confirm the event actually triggers at that probability
      const person = new Person([]);
      person.experience = Variables.EXPERIENCE_CAP;
      person.charisma = 10;
      person.hasJob = true;
      simulation.add(person);

      new JobEvent(() => lossMax - 0.0001).execute(person, simulation);

      expect(person.hasJob).toBe(false);
    });
  });

  describe('education multiplier on gain (ARD 022)', () => {
    it('higher education produces a higher gain probability than no education, all else equal', () => {
      const age = 35;
      // Low enough stats so probBachelors stays below 1.0 and doesn't hit the Math.min cap
      const experience = 5;
      const charisma = 3;

      const probNone = (experience * Variables.JOB_GAIN_EXPERIENCE_SCALAR + charisma * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(age, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR)
        * (1 + Constants.EDUCATION.NONE * Variables.EDUCATION_JOB_GAIN_SCALAR);
      const probBachelors = (experience * Variables.JOB_GAIN_EXPERIENCE_SCALAR + charisma * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(age, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR)
        * (1 + Constants.EDUCATION.BACHELORS * Variables.EDUCATION_JOB_GAIN_SCALAR);

      const rngValue = (probNone + probBachelors) / 2;

      const personNone = new Person([]);
      personNone.age = age;
      personNone.experience = experience;
      personNone.charisma = charisma;
      personNone.education = Constants.EDUCATION.NONE;
      simulation.add(personNone);
      new JobEvent(() => rngValue).execute(personNone, simulation);

      const personBachelors = new Person([]);
      personBachelors.age = age;
      personBachelors.experience = experience;
      personBachelors.charisma = charisma;
      personBachelors.education = Constants.EDUCATION.BACHELORS;
      simulation.add(personBachelors);
      new JobEvent(() => rngValue).execute(personBachelors, simulation);

      expect(personNone.hasJob).toBe(false);
      expect(personBachelors.hasJob).toBe(true);
    });

    it('education = NONE produces a multiplier of 1.0 (no change from pre-ARD 022 formula)', () => {
      const person = new Person([]);
      person.age = 35;
      person.experience = 20;
      person.charisma = 5;
      person.education = Constants.EDUCATION.NONE;
      simulation.add(person);

      const expectedProb = (20 * Variables.JOB_GAIN_EXPERIENCE_SCALAR + 5 * Variables.JOB_GAIN_CHARISMA_SCALAR)
        * ageModifier(35, Variables.WORK_PEAK_AGE, Variables.WORK_AGE_SCALE, Variables.WORK_AGE_FLOOR);

      new JobEvent(() => expectedProb - 0.001).execute(person, simulation);
      expect(person.hasJob).toBe(true);
    });

    it('education multiplier does not affect job loss', () => {
      const person = new Person([]);
      person.age = 35;
      person.experience = 5;
      person.charisma = 2;
      person.education = Constants.EDUCATION.PHD;
      person.hasJob = true;
      simulation.add(person);

      const lossProb = Variables.JOB_LOSS_BASE
        + Variables.JOB_LOSS_STAT_SCALAR * (1 / (5 + 1)) * (1 / (2 + 1));

      new JobEvent(() => lossProb - 0.001).execute(person, simulation);
      expect(person.hasJob).toBe(false);
    });
  });

  describe('branch exclusion', () => {
    it('only calls rng once per execute — gain branch does not also evaluate loss', () => {
      let callCount = 0;
      const rng = () => { callCount++; return 0.5; };

      const person = new Person([]);
      person.hasJob = false;
      simulation.add(person);

      new JobEvent(rng).execute(person, simulation);

      expect(callCount).toBe(1);
    });

    it('only calls rng once per execute — loss branch does not also evaluate gain', () => {
      let callCount = 0;
      const rng = () => { callCount++; return 0.5; };

      const person = new Person([]);
      person.hasJob = true;
      simulation.add(person);

      new JobEvent(rng).execute(person, simulation);

      expect(callCount).toBe(1);
    });
  });
});
