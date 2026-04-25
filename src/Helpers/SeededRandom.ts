import { RNG } from './Types';

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
    return (this.seed >>> 0) / 0xFFFFFFFF;
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
