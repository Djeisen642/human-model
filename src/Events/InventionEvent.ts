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
 * civilizational health is emergent. Productivity is a bounded multiplicative
 * random walk: faster and slower are exact inverses (`× (1+delta)` /
 * `÷ (1+delta)`) so paired outcomes cancel, clamped to
 * `[EXTRACTION_PRODUCTIVITY_FLOOR, MAX_EXTRACTION_PRODUCTIVITY]`. Ceiling
 * growth is clamped at `MAX_NATURAL_RESOURCE_CEILING`. See ARD 007, ARD 039,
 * and ARD 047.
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
      simulation.extractionProductivity = Math.min(
        Variables.MAX_EXTRACTION_PRODUCTIVITY,
        simulation.extractionProductivity * (1 + delta),
      );
      simulation.inventionFasterCount++;
    } else if (roll < Variables.INVENTION_DEPLETION_FASTER_WEIGHT + Variables.INVENTION_DEPLETION_SLOWER_WEIGHT) {
      // Exact inverse of the faster branch so a faster/slower pair cancels (no drift toward floor). See ARD 047.
      simulation.extractionProductivity = Math.max(
        Variables.EXTRACTION_PRODUCTIVITY_FLOOR,
        simulation.extractionProductivity / (1 + delta),
      );
      simulation.inventionSlowerCount++;
    } else {
      simulation.naturalResourceCeiling = Math.min(
        Variables.MAX_NATURAL_RESOURCE_CEILING,
        simulation.naturalResourceCeiling + delta * simulation.naturalResourceCeiling,
      );
      simulation.inventionCeilingCount++;
    }
  }
}
