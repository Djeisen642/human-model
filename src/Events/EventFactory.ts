import Person from '../App/Person';
import IEvent from './IEvent';
import AgeEvent from './AgeEvent';
import ExperienceEvent from './ExperienceEvent';
import IllnessEvent from './IllnessEvent';
import GatherResourcesEvent from './GatherResourcesEvent';
import ConsumptionEvent from './ConsumptionEvent';
import MisfortuneEvent from './MisfortuneEvent';
import JobEvent from './JobEvent';
import ExerciseEvent from './ExerciseEvent';
import LearnEvent from './LearnEvent';
import GraduationEvent from './GraduationEvent';
import EnrollmentEvent from './EnrollmentEvent';
import RelationshipEvent from './RelationshipEvent';
import StealEvent from './StealEvent';
import KillEvent from './KillEvent';
import WindfallEvent from './WindfallEvent';
import { ageModifier } from '../Helpers/AgeModifier';
import Variables from '../Helpers/Variables';
import Constants from '../Helpers/Constants';
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
   * Unconditional order: AgeEvent → ExperienceEvent → IllnessEvent → GatherResourcesEvent → ConsumptionEvent → JobEvent → RelationshipEvent → KillEvent → MisfortuneEvent.
   * Intent-gated events are appended based on intent × age modifier.
   *
   * @param person - person whose intents determine event selection
   * @returns events to execute for this tick
   */
  getEventsFor(person: Person): IEvent[] {
    const events: IEvent[] = [
      new AgeEvent(),
      new ExperienceEvent(),
      new IllnessEvent(this.rng),
      new GatherResourcesEvent(),
      new ConsumptionEvent(),
      new JobEvent(this.rng),
      new RelationshipEvent(this.rng),
      new KillEvent(this.rng),
      new MisfortuneEvent(this.rng),
    ];

    if (this.rng() < person.exerciseIntent * ageModifier(person.age, Variables.EXERCISE_PEAK_AGE, Variables.EXERCISE_AGE_SCALE, Variables.EXERCISE_AGE_FLOOR)) {
      events.push(new ExerciseEvent());
    }

    if (this.rng() < person.learningIntent * ageModifier(person.age, Variables.LEARNING_PEAK_AGE, Variables.LEARNING_AGE_SCALE, Variables.LEARNING_AGE_FLOOR)) {
      events.push(new LearnEvent());
    }

    if (person.isWorkingOnEd === Constants.EDUCATION.NONE
      && person.education < Constants.EDUCATION.PHD
      && this.rng() < Variables.BASE_ENROLLMENT_RATE
        * person.learningIntent
        * ageModifier(person.age, Variables.ENROLLMENT_PEAK_AGE, Variables.ENROLLMENT_AGE_SCALE, Variables.ENROLLMENT_AGE_FLOOR)) {
      events.push(new EnrollmentEvent());
    }

    if (person.isWorkingOnEd !== Constants.EDUCATION.NONE
      && this.rng() < Variables.BASE_GRADUATION_RATE
        * ageModifier(person.age, Variables.GRADUATION_PEAK_AGE, Variables.GRADUATION_AGE_SCALE, Variables.GRADUATION_AGE_FLOOR)) {
      events.push(new GraduationEvent());
    }

    if (this.rng() < Variables.BASE_WINDFALL_RATE
      * ageModifier(person.age, Variables.WINDFALL_PEAK_AGE, Variables.WINDFALL_AGE_SCALE, Variables.WINDFALL_AGE_FLOOR)) {
      events.push(new WindfallEvent(this.rng));
    }

    const stealProb = person.stealingIntent
      * (1 + person.charisma * Variables.STEAL_CHARISMA_SCALAR)
      * ageModifier(person.age, Variables.STEALING_PEAK_AGE, Variables.STEALING_AGE_SCALE, Variables.STEALING_AGE_FLOOR);
    if (this.rng() < stealProb) {
      events.push(new StealEvent(this.rng));
    }

    return events;
  }
}
