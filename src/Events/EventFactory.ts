import Person from '../App/Person';
import IEvent from './IEvent';
import AgeEvent from './AgeEvent';
import GatherResourcesEvent from './GatherResourcesEvent';
import MisfortuneEvent from './MisfortuneEvent';
import ExerciseEvent from './ExerciseEvent';
import LearnEvent from './LearnEvent';
import { ageModifier } from '../Helpers/AgeModifier';
import Variables from '../Helpers/Variables';
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
   * MisfortuneEvent. Intent-gated events are appended based on intent × age modifier.
   *
   * @param person - person whose intents determine event selection
   * @returns events to execute for this tick
   */
  getEventsFor(person: Person): IEvent[] {
    const events: IEvent[] = [
      new AgeEvent(),
      new GatherResourcesEvent(),
      new MisfortuneEvent(this.rng),
    ];

    if (this.rng() < person.exerciseIntent * ageModifier(person.age, Variables.EXERCISE_PEAK_AGE, Variables.EXERCISE_AGE_SCALE, Variables.EXERCISE_AGE_FLOOR)) {
      events.push(new ExerciseEvent());
    }

    if (this.rng() < person.learningIntent * ageModifier(person.age, Variables.LEARNING_PEAK_AGE, Variables.LEARNING_AGE_SCALE, Variables.LEARNING_AGE_FLOOR)) {
      events.push(new LearnEvent());
    }

    return events;
  }
}
