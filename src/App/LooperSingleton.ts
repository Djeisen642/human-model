import Simulation from './Simulation';
import SeededRandom from '../Helpers/SeededRandom';
import EventFactory from '../Events/EventFactory';
import DisasterEvent from '../Events/DisasterEvent';
import { buildTenYearSummary, formatDecadeSummary, formatSimulationHeader } from '../Helpers/Reporters';

export default class LooperSingleton {
  private static instance: LooperSingleton;

  /**
   * Seeds a population, runs the tick loop, and returns the completed simulation.
   *
   * @param n - initial population size
   * @param ticks - number of ticks to simulate
   * @param seed - PRNG seed for reproducibility
   * @param logger - output function for progress lines; defaults to console.log
   * @returns the simulation after all ticks have run
   */
  // eslint-disable-next-line no-console
  public start(n = 100, ticks = 100, seed = 42, logger: (msg: string) => void = console.log): Simulation {
    const rng = new SeededRandom(seed).asRNG();
    const simulation = new Simulation();
    simulation.seed(n, rng);
    const factory = new EventFactory(rng);
    const disaster = new DisasterEvent(rng);

    logger(formatSimulationHeader(n, ticks, seed));

    let startPopulation = n;
    for (let t = 0; t < ticks; t++) {
      simulation.regenerate();
      disaster.execute(simulation);
      const living = simulation.getLiving();
      for (const person of living) {
        for (const event of factory.getEventsFor(person)) {
          if (person.causeOfDeath !== null) break;
          event.execute(person, simulation);
        }
      }
      simulation.snapshot();

      if (t % 10 === 9) {
        const window = simulation.history.slice(t - 9, t + 1);
        const summary = buildTenYearSummary(window, t + 1, startPopulation);
        simulation.decadeHistory.push(summary);
        logger(formatDecadeSummary(summary));
        startPopulation = summary.endPopulation;
      }
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
