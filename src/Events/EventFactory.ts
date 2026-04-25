import Person from '../App/Person';
import IEvent from './IEvent';
import AgeEvent from './AgeEvent';
import { RNG } from '../Helpers/Types';

/**
 * Maps a person's intent values to the events they participate in each tick.
 * Events that always fire are added unconditionally; probabilistic events are
 * gated by comparing an rng draw against the relevant intent.
 */
export default class EventFactory {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Returns the ordered list of events this person participates in this tick.
   * AgeEvent always fires first.
   *
   * @param person - person whose intents determine event selection
   * @returns events to execute for this tick
   */
  getEventsFor(person: Person): IEvent[] {
    const events: IEvent[] = [new AgeEvent()];
    // GatherResourcesEvent and intent-gated events added as they are implemented
    void person;
    return events;
  }
}
