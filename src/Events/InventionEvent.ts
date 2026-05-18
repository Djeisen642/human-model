import Person from '../App/Person';
import Simulation from '../App/Simulation';
import IEvent from './IEvent';
import Variables from '../Helpers/Variables';
import { RNG } from '../Helpers/Types';

/**
 * Intelligence-gated event: inventor produces one of three outcomes via
 * weighted random draw. May raise productivity (tech boom — more output and
 * faster pool drain), lower productivity (austerity tech — less output and
 * slower pool drain), or grow the resource ceiling. Net effect on
 * civilizational health is emergent. `extractionProductivity` is floored at
 * `EXTRACTION_PRODUCTIVITY_FLOOR`. See ARD 007 and ARD 039.
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
      simulation.extractionProductivity = Math.max(
        Variables.EXTRACTION_PRODUCTIVITY_FLOOR,
        simulation.extractionProductivity * (1 + delta),
      );
      simulation.inventionFasterCount++;
    } else if (roll < Variables.INVENTION_DEPLETION_FASTER_WEIGHT + Variables.INVENTION_DEPLETION_SLOWER_WEIGHT) {
      simulation.extractionProductivity = Math.max(
        Variables.EXTRACTION_PRODUCTIVITY_FLOOR,
        simulation.extractionProductivity * (1 - delta),
      );
      simulation.inventionSlowerCount++;
    } else {
      simulation.naturalResourceCeiling += delta * simulation.naturalResourceCeiling;
      simulation.inventionCeilingCount++;
    }
  }
}
