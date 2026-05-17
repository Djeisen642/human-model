import Simulation from './Simulation';
import SeededRandom from '../Helpers/SeededRandom';
import EventFactory from '../Events/EventFactory';
import DisasterEvent from '../Events/DisasterEvent';
import { buildTenYearSummary, formatDecadeSummary, formatSimulationHeader } from '../Helpers/Reporters';
import { PersonTypes, RNG } from '../Helpers/Types';

export default class LooperSingleton {
  private static instance: LooperSingleton;

  /**
   * Seeds a population, runs the tick loop, and returns the completed simulation.
   *
   * @param n - initial population size
   * @param ticks - number of ticks to simulate
   * @param seed - PRNG seed for reproducibility
   * @param logger - output function for progress lines; defaults to console.log
   * @param personTypes - optional ARD-030 type definitions; defaults to no types
   * @returns the simulation after all ticks have run
   */
  public start(
    n = 100,
    ticks = 100,
    seed = 42,
    // eslint-disable-next-line no-console
    logger: (msg: string) => void = console.log,
    personTypes: PersonTypes = {},
  ): Simulation {
    const rng = new SeededRandom(seed).asRNG();
    const simulation = new Simulation();
    simulation.seed(n, rng, personTypes);
    const factory = new EventFactory(rng);
    const disaster = new DisasterEvent(rng);

    logger(formatSimulationHeader(n, ticks, seed));

    let startPopulation = n;
    for (let t = 0; t < ticks; t++) {
      simulation.regenerate();
      disaster.execute(simulation);
      const living = simulation.getLiving();
      shuffleInPlace(living, rng);
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

    // Partial-decade summary at run end: when ticks isn't a multiple of 10, the
    // trailing N (<10) snapshots are unsummarized. Append one summary over the
    // remaining window so the end report's "final decade" reflects actual end state.
    // ARD 031.
    const remainder = ticks % 10;
    if (remainder !== 0) {
      const window = simulation.history.slice(ticks - remainder, ticks);
      const partial = buildTenYearSummary(window, ticks, startPopulation);
      simulation.decadeHistory.push(partial);
      logger(formatDecadeSummary(partial));
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

/**
 * Fisher-Yates in-place shuffle using the seeded RNG so extraction order
 * doesn't systematically favour persons added earliest to the population.
 *
 * @param arr - array to shuffle in place
 * @param rng - seeded random number source
 */
function shuffleInPlace<T>(arr: T[], rng: RNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
