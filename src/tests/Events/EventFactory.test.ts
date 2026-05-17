import EventFactory from '../../Events/EventFactory';
import AgeEvent from '../../Events/AgeEvent';
import ExperienceEvent from '../../Events/ExperienceEvent';
import IllnessEvent from '../../Events/IllnessEvent';
import GatherResourcesEvent from '../../Events/GatherResourcesEvent';
import ConsumptionEvent from '../../Events/ConsumptionEvent';
import MisfortuneEvent from '../../Events/MisfortuneEvent';
import JobEvent from '../../Events/JobEvent';
import ExerciseEvent from '../../Events/ExerciseEvent';
import LearnEvent from '../../Events/LearnEvent';
import StealEvent from '../../Events/StealEvent';
import KillEvent from '../../Events/KillEvent';
import Person from '../../App/Person';

describe('EventFactory', () => {
  it('always includes AgeEvent first', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events[0]).toBeInstanceOf(AgeEvent);
  });

  it('places ExperienceEvent second, IllnessEvent third, GatherResourcesEvent fourth, ConsumptionEvent fifth', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events[1]).toBeInstanceOf(ExperienceEvent);
    expect(events[2]).toBeInstanceOf(IllnessEvent);
    expect(events[3]).toBeInstanceOf(GatherResourcesEvent);
    expect(events[4]).toBeInstanceOf(ConsumptionEvent);
  });

  it('always includes GatherResourcesEvent', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events.some(e => e instanceof GatherResourcesEvent)).toBe(true);
  });

  it('always includes MisfortuneEvent', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events.some(e => e instanceof MisfortuneEvent)).toBe(true);
  });

  it('always includes JobEvent', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events.some(e => e instanceof JobEvent)).toBe(true);
  });

  it('returns only unconditional events when all intents are zero', () => {
    // new Person has all intents=0; intent-gated events never fire
    // Unconditional list: AgeEvent, ExperienceEvent, IllnessEvent, GatherResourcesEvent, ConsumptionEvent, JobEvent, RelationshipEvent, ChildbirthEvent, KillEvent, MisfortuneEvent
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    expect(factory.getEventsFor(person).length).toBe(10);
  });

  it('appends ExerciseEvent when exerciseIntent gate passes', () => {
    // rng=0 ensures gate passes: 0 < exerciseIntent * ageModifier (which is > 0 when intent > 0)
    const factory = new EventFactory(() => 0);
    const person = new Person([]);
    person.exerciseIntent = 1.0;
    person.age = 24; // peak exercise age → ageModifier = 1.0

    const events = factory.getEventsFor(person);

    expect(events.some(e => e instanceof ExerciseEvent)).toBe(true);
  });

  it('does not append ExerciseEvent when exerciseIntent is zero', () => {
    const factory = new EventFactory(() => 0);
    const person = new Person([]);
    // exerciseIntent = 0 (default); gate: 0 < 0 * ageModifier = false regardless of rng

    const events = factory.getEventsFor(person);

    expect(events.some(e => e instanceof ExerciseEvent)).toBe(false);
  });

  it('appends LearnEvent when learningIntent gate passes', () => {
    // rng=0 ensures gate passes
    const factory = new EventFactory(() => 0);
    const person = new Person([]);
    person.learningIntent = 1.0;
    person.age = 18; // peak learning age → ageModifier = 1.0

    const events = factory.getEventsFor(person);

    expect(events.some(e => e instanceof LearnEvent)).toBe(true);
  });

  it('does not append LearnEvent when learningIntent is zero', () => {
    const factory = new EventFactory(() => 0);
    const person = new Person([]);
    // learningIntent = 0 (default)

    const events = factory.getEventsFor(person);

    expect(events.some(e => e instanceof LearnEvent)).toBe(false);
  });

  it('appends both ExerciseEvent and LearnEvent when both gates pass', () => {
    const factory = new EventFactory(() => 0);
    const person = new Person([]);
    person.exerciseIntent = 1.0;
    person.learningIntent = 1.0;

    const events = factory.getEventsFor(person);

    expect(events.some(e => e instanceof ExerciseEvent)).toBe(true);
    expect(events.some(e => e instanceof LearnEvent)).toBe(true);
    expect(events.length).toBe(14); // 10 unconditional + ExerciseEvent + LearnEvent + EnrollmentEvent + WindfallEvent
  });

  it('always includes KillEvent', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events.some(e => e instanceof KillEvent)).toBe(true);
  });

  describe('StealEvent gate', () => {
    it('does not append StealEvent when stealingIntent is zero', () => {
      const factory = new EventFactory(() => 0);
      const person = new Person([]);
      // stealingIntent defaults to 0; gate: 0 < 0 * ... = false regardless of rng

      const events = factory.getEventsFor(person);

      expect(events.some(e => e instanceof StealEvent)).toBe(false);
    });

    it('appends StealEvent at high frequency when stealingIntent is 1 and charisma is 10 at peak age', () => {
      // rng=0 always passes the gate; verify StealEvent is included
      const factory = new EventFactory(() => 0);
      const person = new Person([]);
      person.stealingIntent = 1.0;
      person.charisma = 10;
      person.age = 24; // STEALING_PEAK_AGE → ageModifier near 1.0

      const events = factory.getEventsFor(person);

      expect(events.some(e => e instanceof StealEvent)).toBe(true);
    });
  });
});
