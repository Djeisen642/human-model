import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Intelligence-gated event: inventor produces one of three outcomes via
 * weighted random draw. May accelerate depletion, reduce it, or grow the
 * resource ceiling. Net effect on civilizational health is emergent.
 * `extractionEfficiency` is floored at 0.01.
 * See ARD 007.
 */
export default class InventionEvent implements IEvent {
  /** @param rng - random number source injected at construction */
  constructor(private rng: RNG) {}

  /**
   * Apply one randomly selected invention outcome to the simulation's
   * resource pool. Delta scales with the inventor's intelligence.
   *
   * @param person - the inventor
   * @param simulation - current simulation state
   */
  execute(person: Person, simulation: Simulation): void {
    const delta = person.intelligence * Variables.INVENTION_MAGNITUDE_SCALAR;

    const totalWeight = Variables.INVENTION_DEPLETION_FASTER_WEIGHT
      + Variables.INVENTION_DEPLETION_SLOWER_WEIGHT
      + Variables.INVENTION_CEILING_GROWTH_WEIGHT;

    const roll = this.rng() * totalWeight;

    if (roll < Variables.INVENTION_DEPLETION_FASTER_WEIGHT) {
      // Math.max floor is unreachable here: (1 + delta) with delta >= 0 never decreases a positive value.
      // Kept for defensive symmetry with the slower branch.
      simulation.extractionEfficiency = Math.max(
        0.01,
        simulation.extractionEfficiency * (1 + delta),
      );
    } else if (roll < Variables.INVENTION_DEPLETION_FASTER_WEIGHT + Variables.INVENTION_DEPLETION_SLOWER_WEIGHT) {
      simulation.extractionEfficiency = Math.max(
        0.01,
        simulation.extractionEfficiency * (1 - delta),
      );
    } else {
      simulation.naturalResourceCeiling += delta * simulation.naturalResourceCeiling;
    }
  }
}
