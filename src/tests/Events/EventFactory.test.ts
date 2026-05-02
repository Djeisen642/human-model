import EventFactory from '../../Events/EventFactory';
import AgeEvent from '../../Events/AgeEvent';
import ExperienceEvent from '../../Events/ExperienceEvent';
import GatherResourcesEvent from '../../Events/GatherResourcesEvent';
import MisfortuneEvent from '../../Events/MisfortuneEvent';
import ExerciseEvent from '../../Events/ExerciseEvent';
import LearnEvent from '../../Events/LearnEvent';
import Person from '../../App/Person';

describe('EventFactory', () => {
  it('always includes AgeEvent first', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events[0]).toBeInstanceOf(AgeEvent);
  });

  it('places ExperienceEvent second (after AgeEvent, before GatherResourcesEvent)', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events[1]).toBeInstanceOf(ExperienceEvent);
    expect(events[2]).toBeInstanceOf(GatherResourcesEvent);
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

  it('returns only unconditional events when all intents are zero', () => {
    // new Person has exerciseIntent=0 and learningIntent=0; gates always fail
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    expect(factory.getEventsFor(person).length).toBe(4);
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
    expect(events.length).toBe(6);
  });
});
