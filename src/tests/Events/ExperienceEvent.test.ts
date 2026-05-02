import ExperienceEvent from '../../Events/ExperienceEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';
import { ageModifier } from '../../Helpers/AgeModifier';

describe('ExperienceEvent', () => {
  let event: ExperienceEvent;
  let simulation: Simulation;

  beforeEach(() => {
    event = new ExperienceEvent();
    simulation = new Simulation();
  });

  it('grows experience for a typical working-age adult with a job', () => {
    const person = new Person([]);
    person.age = 30;
    person.intelligence = 5;
    person.experience = 10;
    person.hasJob = true;

    event.execute(person, simulation);

    const fade = ageModifier(30, Variables.LEARNING_PEAK_AGE, Variables.LEARNING_AGE_SCALE, Variables.LEARNING_AGE_FLOOR);
    const expected = 10
      + Variables.BASE_EXPERIENCE_GROWTH
      + person.intelligence * Variables.INTELLIGENCE_EXPERIENCE_SCALAR * fade
      + Variables.EMPLOYMENT_EXPERIENCE_BONUS;
    expect(person.experience).toBeCloseTo(expected);
  });

  it('attenuates growth for children under EXPERIENCE_CHILDHOOD_AGE', () => {
    const person = new Person([]);
    person.age = 3;
    person.intelligence = 5;
    person.experience = 0;
    // no job, no education — but childhood attenuation applies before idleness
    // For age 3: no job, no education, age < EXPERIENCE_ELDERLY_AGE, so adult idleness decay applies
    // growth = BASE * CHILDHOOD_FACTOR + int*scalar*fade - ADULT_IDLENESS_DECAY

    event.execute(person, simulation);

    const fade = ageModifier(3, Variables.LEARNING_PEAK_AGE, Variables.LEARNING_AGE_SCALE, Variables.LEARNING_AGE_FLOOR);
    const base = Variables.BASE_EXPERIENCE_GROWTH * Variables.EXPERIENCE_CHILDHOOD_FACTOR;
    const expected = Math.max(
      0,
      base + person.intelligence * Variables.INTELLIGENCE_EXPERIENCE_SCALAR * fade - Variables.ADULT_IDLENESS_DECAY,
    );
    expect(person.experience).toBeCloseTo(expected);
  });

  it('gives education bonus when isWorkingOnEd is truthy', () => {
    const person = new Person([]);
    person.age = 20;
    person.intelligence = 5;
    person.experience = 5;
    person.isWorkingOnEd = 1; // any truthy education level

    event.execute(person, simulation);

    const fade = ageModifier(20, Variables.LEARNING_PEAK_AGE, Variables.LEARNING_AGE_SCALE, Variables.LEARNING_AGE_FLOOR);
    const expected = 5
      + Variables.BASE_EXPERIENCE_GROWTH
      + person.intelligence * Variables.INTELLIGENCE_EXPERIENCE_SCALAR * fade
      + Variables.EDUCATION_EXPERIENCE_BONUS;
    expect(person.experience).toBeCloseTo(expected);
  });

  it('prefers education bonus over employment bonus when both could apply', () => {
    const person = new Person([]);
    person.age = 25;
    person.intelligence = 5;
    person.experience = 5;
    person.isWorkingOnEd = 1;
    person.hasJob = true; // both set; education should win

    const beforeExercise = new ExperienceEvent();
    beforeExercise.execute(person, simulation);

    const fade = ageModifier(25, Variables.LEARNING_PEAK_AGE, Variables.LEARNING_AGE_SCALE, Variables.LEARNING_AGE_FLOOR);
    const expected = 5
      + Variables.BASE_EXPERIENCE_GROWTH
      + person.intelligence * Variables.INTELLIGENCE_EXPERIENCE_SCALAR * fade
      + Variables.EDUCATION_EXPERIENCE_BONUS;
    expect(person.experience).toBeCloseTo(expected);
  });

  it('applies adult idleness decay for unemployed working-age adult', () => {
    const person = new Person([]);
    person.age = 35;
    person.intelligence = 5;
    person.experience = 10;
    // no job, no education

    event.execute(person, simulation);

    const fade = ageModifier(35, Variables.LEARNING_PEAK_AGE, Variables.LEARNING_AGE_SCALE, Variables.LEARNING_AGE_FLOOR);
    const expected = 10
      + Variables.BASE_EXPERIENCE_GROWTH
      + person.intelligence * Variables.INTELLIGENCE_EXPERIENCE_SCALAR * fade
      - Variables.ADULT_IDLENESS_DECAY;
    expect(person.experience).toBeCloseTo(expected);
  });

  it('applies elderly idleness decay for person aged EXPERIENCE_ELDERLY_AGE or older', () => {
    const person = new Person([]);
    person.age = Variables.EXPERIENCE_ELDERLY_AGE;
    person.intelligence = 5;
    person.experience = 10;
    // no job, no education

    event.execute(person, simulation);

    const fade = ageModifier(Variables.EXPERIENCE_ELDERLY_AGE, Variables.LEARNING_PEAK_AGE, Variables.LEARNING_AGE_SCALE, Variables.LEARNING_AGE_FLOOR);
    const expected = 10
      + Variables.BASE_EXPERIENCE_GROWTH
      + person.intelligence * Variables.INTELLIGENCE_EXPERIENCE_SCALAR * fade
      - Variables.ELDERLY_IDLENESS_DECAY;
    expect(person.experience).toBeCloseTo(expected);
  });

  it('floors experience at 0', () => {
    const person = new Person([]);
    person.age = 35;
    person.intelligence = 0;
    person.experience = 0;
    // net growth: BASE - ADULT_DECAY = 1.0 - 0.5 = 0.5 normally, but let's force it negative
    // Override: set intelligence to 0 and decay forces a small positive, so manually pick constants
    // Use elderly age with very low intelligence so growth is less than decay
    // Actually with BASE=1 and ELDERLY_DECAY=0.2, growth is always positive for non-children.
    // Force floor by setting experience low and simulating multiple ticks conceptually via direct check:
    // The floor test needs experience to start at 0 and growth to be negative.
    // Childhood: BASE*FACTOR=0.2, int*scalar*fade ~ small, adult decay=0.5 → can go negative for int=0
    person.age = 3; // childhood
    person.intelligence = 0;
    person.experience = 0;

    event.execute(person, simulation);

    expect(person.experience).toBeGreaterThanOrEqual(0);
  });

  it('caps experience at EXPERIENCE_CAP', () => {
    const person = new Person([]);
    person.age = 30;
    person.intelligence = 10;
    person.experience = Variables.EXPERIENCE_CAP;
    person.hasJob = true;

    event.execute(person, simulation);

    expect(person.experience).toBe(Variables.EXPERIENCE_CAP);
  });

  it('intelligence fade reduces growth past learning peak', () => {
    const young = new Person([]);
    young.age = Variables.LEARNING_PEAK_AGE;
    young.intelligence = 10;
    young.experience = 10;
    young.hasJob = true;

    const old = new Person([]);
    old.age = 70;
    old.intelligence = 10;
    old.experience = 10;
    old.hasJob = true;

    const youngEvent = new ExperienceEvent();
    const oldEvent = new ExperienceEvent();
    youngEvent.execute(young, simulation);
    oldEvent.execute(old, simulation);

    expect(young.experience).toBeGreaterThan(old.experience);
  });
});
