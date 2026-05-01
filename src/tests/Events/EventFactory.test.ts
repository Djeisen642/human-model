import EventFactory from '../../Events/EventFactory';
import AgeEvent from '../../Events/AgeEvent';
import GatherResourcesEvent from '../../Events/GatherResourcesEvent';
import MisfortuneEvent from '../../Events/MisfortuneEvent';
import Person from '../../App/Person';

describe('EventFactory', () => {
  it('always includes AgeEvent first', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events[0]).toBeInstanceOf(AgeEvent);
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

  it('returns exactly three unconditional events per person', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    expect(factory.getEventsFor(person).length).toBe(3);
  });
});
