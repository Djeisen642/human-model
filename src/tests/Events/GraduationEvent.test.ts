import GraduationEvent from '../../Events/GraduationEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Constants from '../../Helpers/Constants';
import Variables from '../../Helpers/Variables';
import { ageModifier } from '../../Helpers/AgeModifier';

describe('GraduationEvent', () => {
  let simulation: Simulation;

  beforeEach(() => {
    simulation = new Simulation();
  });

  describe('execute', () => {
    it('sets education to the prior isWorkingOnEd value', () => {
      const person = new Person([]);
      person.isWorkingOnEd = Constants.EDUCATION.HIGH_SCHOOL;

      new GraduationEvent().execute(person, simulation);

      expect(person.education).toBe(Constants.EDUCATION.HIGH_SCHOOL);
    });

    it('resets isWorkingOnEd to NONE after graduation', () => {
      const person = new Person([]);
      person.isWorkingOnEd = Constants.EDUCATION.BACHELORS;

      new GraduationEvent().execute(person, simulation);

      expect(person.isWorkingOnEd).toBe(Constants.EDUCATION.NONE);
    });

    it('increments intelligence by 1', () => {
      const person = new Person([]);
      person.isWorkingOnEd = Constants.EDUCATION.BACHELORS;
      person.intelligence = 5;

      new GraduationEvent().execute(person, simulation);

      expect(person.intelligence).toBe(6);
    });

    it('graduates correctly from each education level', () => {
      const levels = [
        Constants.EDUCATION.HIGH_SCHOOL,
        Constants.EDUCATION.TRADE_SCHOOL,
        Constants.EDUCATION.BACHELORS,
        Constants.EDUCATION.MASTERS,
        Constants.EDUCATION.PHD,
      ];
      for (const level of levels) {
        const person = new Person([]);
        person.isWorkingOnEd = level;
        person.intelligence = 3;
        new GraduationEvent().execute(person, simulation);
        expect(person.education).toBe(level);
        expect(person.isWorkingOnEd).toBe(Constants.EDUCATION.NONE);
        expect(person.intelligence).toBe(4);
      }
    });
  });

  describe('EventFactory graduation gate', () => {
    it('graduation probability is higher at peak age than at extreme age', () => {
      const peakProb = Variables.BASE_GRADUATION_RATE
        * ageModifier(Variables.GRADUATION_PEAK_AGE, Variables.GRADUATION_PEAK_AGE, Variables.GRADUATION_AGE_SCALE, Variables.GRADUATION_AGE_FLOOR);
      const elderlyProb = Variables.BASE_GRADUATION_RATE
        * ageModifier(80, Variables.GRADUATION_PEAK_AGE, Variables.GRADUATION_AGE_SCALE, Variables.GRADUATION_AGE_FLOOR);

      expect(peakProb).toBeGreaterThan(elderlyProb);
    });

    it('graduation probability floor is non-zero at extreme ages', () => {
      const floorProb = Variables.BASE_GRADUATION_RATE
        * ageModifier(80, Variables.GRADUATION_PEAK_AGE, Variables.GRADUATION_AGE_SCALE, Variables.GRADUATION_AGE_FLOOR);

      expect(floorProb).toBeGreaterThan(0);
    });
  });
});
