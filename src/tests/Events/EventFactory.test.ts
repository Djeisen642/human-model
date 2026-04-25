import EventFactory from '../../Events/EventFactory';
import AgeEvent from '../../Events/AgeEvent';
import Person from '../../App/Person';

describe('EventFactory', () => {
  it('always includes AgeEvent', () => {
    const factory = new EventFactory(() => 0.5);
    const person = new Person([]);

    const events = factory.getEventsFor(person);

    expect(events[0]).toBeInstanceOf(AgeEvent);
  });

  it('returns at least one event per person', () => {
    const factory = new EventFactory(() => 0);
    const person = new Person([]);

    expect(factory.getEventsFor(person).length).toBeGreaterThan(0);
  });
});
