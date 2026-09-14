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
import ChildbirthEvent from './ChildbirthEvent';
import HelpEvent from './HelpEvent';
import StealEvent from './StealEvent';
import KillEvent from './KillEvent';
import WindfallEvent from './WindfallEvent';
import InventionEvent from './InventionEvent';
import JailEvent from './JailEvent';
import StatDecayEvent from './StatDecayEvent';
import { ageModifier } from '../Helpers/AgeModifier';
import Variables from '../Helpers/Variables';
import Constants from '../Helpers/Constants';
import { RNG } from '../Helpers/Types';

/**
 * Maps a person's intent values to the events they participate in each tick.
 * Unconditional events always fire; intent-gated events are appended when
 * rng() < intent * ageModifier(...) passes.
 * While jailed (jailedTicksRemaining > 0), only AgeEvent, IllnessEvent, and JailEvent run.
 * See ARD 035.
 */
export default class EventFactory {
  /**
   * Event instances, built once and reused for every person on every tick. Events hold no
   * per-execution state — the only thing they carry is the injected RNG — so a shared instance
   * behaves identically to a fresh one while dropping the ~15 allocations per person-tick that
   * constructing them cost. An event that ever gains mutable state must stop being shared.
   */
  private readonly age = new AgeEvent();
  private readonly experience = new ExperienceEvent();
  private readonly illness: IllnessEvent;
  private readonly gather = new GatherResourcesEvent();
  private readonly consumption = new ConsumptionEvent();
  private readonly job: JobEvent;
  private readonly relationship: RelationshipEvent;
  private readonly childbirth: ChildbirthEvent;
  private readonly kill: KillEvent;
  private readonly misfortune: MisfortuneEvent;
  private readonly jail = new JailEvent();
  private readonly statDecay: StatDecayEvent;
  private readonly exercise = new ExerciseEvent();
  private readonly learn = new LearnEvent();
  private readonly enrollment = new EnrollmentEvent();
  private readonly graduation = new GraduationEvent();
  private readonly windfall: WindfallEvent;
  private readonly invention: InventionEvent;
  private readonly help: HelpEvent;
  private readonly steal: StealEvent;

  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {
    this.illness = new IllnessEvent(rng);
    this.job = new JobEvent(rng);
    this.relationship = new RelationshipEvent(rng);
    this.childbirth = new ChildbirthEvent(rng);
    this.kill = new KillEvent(rng);
    this.misfortune = new MisfortuneEvent(rng);
    this.statDecay = new StatDecayEvent(rng);
    this.windfall = new WindfallEvent(rng);
    this.invention = new InventionEvent(rng);
    this.help = new HelpEvent(rng);
    this.steal = new StealEvent(rng);
  }

  /**
   * Returns the ordered list of events this person participates in this tick.
   * Jailed persons receive only [AgeEvent, IllnessEvent, JailEvent].
   * Free persons: unconditional order AgeEvent → ExperienceEvent → IllnessEvent →
   * GatherResourcesEvent → ConsumptionEvent → JobEvent → RelationshipEvent →
   * KillEvent → MisfortuneEvent, plus intent-gated events appended after
   * (HelpEvent, ExerciseEvent, LearnEvent, StealEvent and others).
   *
   * @param person - person whose intents determine event selection
   * @returns events to execute for this tick
   */
  getEventsFor(person: Person): IEvent[] {
    if (person.jailedTicksRemaining > 0) {
      return [this.age, this.illness, this.jail, this.statDecay, this.misfortune];
    }

    const events: IEvent[] = [
      this.age,
      this.experience,
      this.illness,
      this.gather,
      this.consumption,
      this.job,
      this.relationship,
      this.childbirth,
      this.kill,
      this.misfortune,
    ];

    if (this.rng() < person.exerciseIntent * ageModifier(person.age, Variables.EXERCISE_PEAK_AGE, Variables.EXERCISE_AGE_SCALE, Variables.EXERCISE_AGE_FLOOR)) {
      events.push(this.exercise);
    }

    if (this.rng() < person.learningIntent * ageModifier(person.age, Variables.LEARNING_PEAK_AGE, Variables.LEARNING_AGE_SCALE, Variables.LEARNING_AGE_FLOOR)) {
      events.push(this.learn);
    }

    if (person.isWorkingOnEd === Constants.EDUCATION.NONE
      && person.education < Constants.EDUCATION.PHD
      && this.rng() < Variables.BASE_ENROLLMENT_RATE
        * person.learningIntent
        * ageModifier(person.age, Variables.ENROLLMENT_PEAK_AGE, Variables.ENROLLMENT_AGE_SCALE, Variables.ENROLLMENT_AGE_FLOOR)) {
      events.push(this.enrollment);
    }

    if (person.isWorkingOnEd !== Constants.EDUCATION.NONE
      && this.rng() < Variables.BASE_GRADUATION_RATE
        * ageModifier(person.age, Variables.GRADUATION_PEAK_AGE, Variables.GRADUATION_AGE_SCALE, Variables.GRADUATION_AGE_FLOOR)) {
      events.push(this.graduation);
    }

    if (this.rng() < Variables.BASE_WINDFALL_RATE
      * ageModifier(person.age, Variables.WINDFALL_PEAK_AGE, Variables.WINDFALL_AGE_SCALE, Variables.WINDFALL_AGE_FLOOR)) {
      events.push(this.windfall);
    }

    if (this.rng() < Variables.BASE_INVENTION_RATE
      * person.intelligence
      * ageModifier(person.age, Variables.INVENTION_PEAK_AGE, Variables.INVENTION_AGE_SCALE, Variables.INVENTION_AGE_FLOOR)) {
      events.push(this.invention);
    }

    const helpProb = person.helpingIntent
      * (1 + person.charisma * Variables.HELP_CHARISMA_SCALAR)
      * ageModifier(person.age, Variables.HELP_PEAK_AGE, Variables.HELP_AGE_SCALE, Variables.HELP_AGE_FLOOR);
    if (this.rng() < helpProb) {
      events.push(this.help);
    }

    const resourcePressure = Math.max(
      0,
      1 - person.resources / Variables.SITUATIONAL_STEAL_RESOURCE_THRESHOLD,
    );
    const stealProb = person.stealingIntent
      * (1 + person.charisma * Variables.STEAL_CHARISMA_SCALAR)
      * ageModifier(person.age, Variables.STEALING_PEAK_AGE, Variables.STEALING_AGE_SCALE, Variables.STEALING_AGE_FLOOR)
      * (1 + resourcePressure * Variables.SITUATIONAL_STEAL_SCALAR);
    if (this.rng() < stealProb) {
      events.push(this.steal);
    }

    events.push(this.statDecay);

    return events;
  }
}
