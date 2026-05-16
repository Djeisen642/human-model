import EnrollmentEvent from '../../Events/EnrollmentEvent';
import GraduationEvent from '../../Events/GraduationEvent';
import EventFactory from '../../Events/EventFactory';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Constants from '../../Helpers/Constants';
import Variables from '../../Helpers/Variables';

describe('EnrollmentEvent', () => {
  let simulation: Simulation;

  beforeEach(() => {
    simulation = new Simulation();
  });

  describe('execute', () => {
    it('sets isWorkingOnEd to education + 1', () => {
      const person = new Person([]);
      person.education = Constants.EDUCATION.HIGH_SCHOOL;

      new EnrollmentEvent().execute(person, simulation);

      expect(person.isWorkingOnEd).toBe(Constants.EDUCATION.HIGH_SCHOOL + 1);
    });

    it('person with education = NONE enrolls in HIGH_SCHOOL', () => {
      const person = new Person([]);
      person.education = Constants.EDUCATION.NONE;

      new EnrollmentEvent().execute(person, simulation);

      expect(person.isWorkingOnEd).toBe(Constants.EDUCATION.HIGH_SCHOOL);
    });

    it('advances correctly from each education level', () => {
      const progressions: [number, number][] = [
        [Constants.EDUCATION.NONE, Constants.EDUCATION.HIGH_SCHOOL],
        [Constants.EDUCATION.HIGH_SCHOOL, Constants.EDUCATION.TRADE_SCHOOL],
        [Constants.EDUCATION.TRADE_SCHOOL, Constants.EDUCATION.BACHELORS],
        [Constants.EDUCATION.BACHELORS, Constants.EDUCATION.MASTERS],
        [Constants.EDUCATION.MASTERS, Constants.EDUCATION.PHD],
      ];
      for (const [from, to] of progressions) {
        const person = new Person([]);
        person.education = from;
        new EnrollmentEvent().execute(person, simulation);
        expect(person.isWorkingOnEd).toBe(to);
      }
    });
  });

  describe('EventFactory gate', () => {
    it('already-enrolled person never receives EnrollmentEvent', () => {
      const person = new Person([]);
      person.education = Constants.EDUCATION.NONE;
      person.isWorkingOnEd = Constants.EDUCATION.HIGH_SCHOOL;
      person.learningIntent = 1;
      person.age = 22;

      const events = new EventFactory(() => 0).getEventsFor(person);

      expect(events.some(e => e instanceof EnrollmentEvent)).toBe(false);
    });

    it('PHD holder never receives EnrollmentEvent', () => {
      const person = new Person([]);
      person.education = Constants.EDUCATION.PHD;
      person.isWorkingOnEd = Constants.EDUCATION.NONE;
      person.learningIntent = 1;
      person.age = 22;

      const events = new EventFactory(() => 0).getEventsFor(person);

      expect(events.some(e => e instanceof EnrollmentEvent)).toBe(false);
    });

    it('non-enrolled person below PHD receives EnrollmentEvent when roll passes', () => {
      const person = new Person([]);
      person.education = Constants.EDUCATION.NONE;
      person.isWorkingOnEd = Constants.EDUCATION.NONE;
      person.learningIntent = 1;
      person.age = Variables.ENROLLMENT_PEAK_AGE;

      // rng always 0 — below any positive threshold
      const events = new EventFactory(() => 0).getEventsFor(person);

      expect(events.some(e => e instanceof EnrollmentEvent)).toBe(true);
    });

    it('non-enrolled person does not receive EnrollmentEvent when roll fails', () => {
      const person = new Person([]);
      person.education = Constants.EDUCATION.NONE;
      person.isWorkingOnEd = Constants.EDUCATION.NONE;
      person.learningIntent = 1;
      person.age = Variables.ENROLLMENT_PEAK_AGE;

      // rng always 1 — above any threshold <= 1
      const events = new EventFactory(() => 1).getEventsFor(person);

      expect(events.some(e => e instanceof EnrollmentEvent)).toBe(false);
    });

    it('person with learningIntent = 0 never receives EnrollmentEvent', () => {
      const person = new Person([]);
      person.education = Constants.EDUCATION.NONE;
      person.isWorkingOnEd = Constants.EDUCATION.NONE;
      person.learningIntent = 0;
      person.age = Variables.ENROLLMENT_PEAK_AGE;

      const events = new EventFactory(() => 0).getEventsFor(person);

      expect(events.some(e => e instanceof EnrollmentEvent)).toBe(false);
    });

    it('employed person can still receive EnrollmentEvent', () => {
      const person = new Person([]);
      person.education = Constants.EDUCATION.NONE;
      person.isWorkingOnEd = Constants.EDUCATION.NONE;
      person.hasJob = true;
      person.learningIntent = 1;
      person.age = Variables.ENROLLMENT_PEAK_AGE;

      const events = new EventFactory(() => 0).getEventsFor(person);

      expect(events.some(e => e instanceof EnrollmentEvent)).toBe(true);
    });

    it('enrollment and graduation are mutually exclusive in the same tick', () => {
      // Enrolled person: graduation eligible, enrollment not
      const enrolled = new Person([]);
      enrolled.isWorkingOnEd = Constants.EDUCATION.HIGH_SCHOOL;
      enrolled.education = Constants.EDUCATION.NONE;
      enrolled.learningIntent = 1;
      enrolled.age = 22;

      const enrolledEvents = new EventFactory(() => 0).getEventsFor(enrolled);
      expect(enrolledEvents.some(e => e instanceof EnrollmentEvent)).toBe(false);
      expect(enrolledEvents.some(e => e instanceof GraduationEvent)).toBe(true);

      // Non-enrolled person: enrollment eligible, graduation not
      const notEnrolled = new Person([]);
      notEnrolled.isWorkingOnEd = Constants.EDUCATION.NONE;
      notEnrolled.education = Constants.EDUCATION.NONE;
      notEnrolled.learningIntent = 1;
      notEnrolled.age = 22;

      const notEnrolledEvents = new EventFactory(() => 0).getEventsFor(notEnrolled);
      expect(notEnrolledEvents.some(e => e instanceof EnrollmentEvent)).toBe(true);
      expect(notEnrolledEvents.some(e => e instanceof GraduationEvent)).toBe(false);
    });
  });
});
