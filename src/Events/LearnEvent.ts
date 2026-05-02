import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';

/** Intent-gated event: studying or learning improves intelligence by 1. */
export default class LearnEvent implements IEvent {
  /**
   * Increment the person's intelligence by 1.
   *
   * @param person - person learning
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    void simulation;
    person.intelligence += 1;
  }
}
