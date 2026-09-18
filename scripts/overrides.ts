/**
 * Shared `Variables` override plumbing for the calibration scripts.
 *
 * `applyOverrides` lived in both `sweep.ts` and `compare.ts` as a verbatim copy, which is how the
 * double-override restore bug (fixed 2026-09-18) had to be found and fixed twice. One copy now.
 */

import Variables from '../src/Helpers/Variables';

/**
 * Apply `KEY=VALUE` pairs to the static `Variables` class.
 *
 * @param pairs - overrides in `KEY=VALUE` form; a key may repeat and the last one wins
 * @returns a closure that restores every touched key to the value it held before this call
 * @throws {Error} when a key is unknown, is not a numeric constant, or the value is not a number
 */
export function applyOverrides(pairs: string[]): () => void {
  const saved: [string, unknown][] = [];
  for (const pair of pairs) {
    const [key, raw] = pair.split('=');
    if (!(key in Variables)) throw new Error(`Unknown Variables constant: ${key}`);
    if (typeof (Variables as unknown as Record<string, unknown>)[key] !== 'number') {
      throw new Error(`Not a Variables constant: ${key}`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`Non-numeric override: ${pair}`);
    // Save only the first sighting of a key. A key can legitimately appear twice (compare.ts
    // composes `--both` then `--a`/`--b`, sweep.ts `--set` then `--sweep`), and the later one
    // wins — but saving both would make restore() replay them in order and leave the
    // intermediate value behind instead of the original.
    if (!saved.some(([k]) => k === key)) {
      saved.push([key, (Variables as unknown as Record<string, unknown>)[key]]);
    }
    (Variables as unknown as Record<string, unknown>)[key] = value;
  }
  Variables.validate();
  return () => {
    for (const [key, value] of saved) (Variables as unknown as Record<string, unknown>)[key] = value;
  };
}

/**
 * Parse a seed specification into the seed list.
 *
 * @param spec - a comma list (`42,7,1`) or a single `N` meaning seeds 1..N
 * @param fallback - seeds to use when `spec` is absent
 * @returns the seed list
 */
export function parseSeeds(spec: string | undefined, fallback: number[]): number[] {
  if (!spec) return fallback;
  if (spec.includes(',')) return spec.split(',').map((s) => Number(s.trim()));
  return Array.from({ length: Number(spec) }, (_, i) => i + 1);
}
