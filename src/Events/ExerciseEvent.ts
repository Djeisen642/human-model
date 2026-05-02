import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';

/** Intent-gated event: physical exercise improves constitution by 1. */
export default class ExerciseEvent implements IEvent {
  /**
   * Increment the person's constitution by 1.
   *
   * @param person - person exercising
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;
    person.constitution += 1;
  }
}
