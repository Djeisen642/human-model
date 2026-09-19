import { RNG } from './Types';

/**
 * A draw from the standard normal distribution, built from two uniform draws (Box–Muller).
 *
 * ARD 064 needs Gaussian residuals for newborn traits; the LCG below is uniform. Kept as a free
 * function taking an `RNG` so it stays deterministic under the same seed and testable with a
 * stubbed source. Consumes exactly two values from `rng` per call, which matters because every
 * result in this project is reproducible only if the draw sequence is stable.
 *
 * @param rng - uniform source on [0, 1)
 * @returns a draw from N(0, 1)
 */
export function standardNormal(rng: RNG): number {
  // rng() is [0, 1) and Math.log(0) is -Infinity, so take 1 - rng() to land in (0, 1]. Retrying
  // on a zero would be the obvious alternative and is a latent hang: a source that returns 0
  // repeatedly — an exhausted scripted rng in a test, or an unlucky LCG state — never escapes.
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export default class SeededRandom {
  /**
   * @param seed - initial seed value
   */
  constructor(private seed: number) {}

  /**
   * Advances the seed and returns the next pseudorandom value in [0, 1).
   *
   * @returns next random number
   */
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.seed >>> 0) / 0x100000000;
  }

  /**
   * Returns a bound RNG function suitable for injection.
   *
   * @returns RNG function
   */
  asRNG(): RNG {
    return () => this.next();
  }
}
