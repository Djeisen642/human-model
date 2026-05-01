import Person from '../App/Person';
import IEvent from './IEvent';
import AgeEvent from './AgeEvent';
import GatherResourcesEvent from './GatherResourcesEvent';
import MisfortuneEvent from './MisfortuneEvent';
import { RNG } from '../Helpers/Types';

/**
 * Maps a person's intent values to the events they participate in each tick.
 * Unconditional events always fire; intent-gated events are appended when
 * rng() < intent * ageModifier(...) passes.
 */
export default class EventFactory {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Returns the ordered list of events this person participates in this tick.
   * Always starts with three unconditional events: AgeEvent, GatherResourcesEvent,
   * MisfortuneEvent. Intent-gated events are appended after as they are implemented.
   *
   * @param person - person whose intents determine event selection
   * @returns events to execute for this tick
   */
  getEventsFor(person: Person): IEvent[] {
    void person;
    return [
      new AgeEvent(),
      new GatherResourcesEvent(),
      new MisfortuneEvent(this.rng),
    ];
  }
}
