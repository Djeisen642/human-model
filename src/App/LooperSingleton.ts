import Simulation from './Simulation';
import SeededRandom from '../Helpers/SeededRandom';
import EventFactory from '../Events/EventFactory';

export default class LooperSingleton {
  private static instance: LooperSingleton;

  /**
   * Seeds a population, runs the tick loop, and returns the completed simulation.
   *
   * @param n - initial population size
   * @param ticks - number of ticks to simulate
   * @param seed - PRNG seed for reproducibility
   * @returns the simulation after all ticks have run
   */
  public start(n = 100, ticks = 100, seed = 42): Simulation {
    const rng = new SeededRandom(seed).asRNG();
    const simulation = new Simulation();
    simulation.seed(n, rng);
    const factory = new EventFactory(rng);

    for (let t = 0; t < ticks; t++) {
      const living = simulation.getLiving();
      for (const person of living) {
        for (const event of factory.getEventsFor(person)) {
          if (person.causeOfDeath !== null) break;
          event.execute(person, simulation);
        }
      }
      simulation.snapshot();
    }

    return simulation;
  }

  /**
   * Get the singleton instance.
   *
   * @returns the singleton
   */
  static getInstance(): LooperSingleton {
    if (!LooperSingleton.instance) {
      LooperSingleton.instance = new LooperSingleton();
    }

    return LooperSingleton.instance;
  }
}
