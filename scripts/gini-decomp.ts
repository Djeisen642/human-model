/**
 * Diagnostic: how much of `resourceGini` is the dependent-child cohort's structural zeros?
 *
 * Prints Gini over all living persons alongside Gini over adults only, plus the child share, at a
 * few horizons. See docs/research-thriving-reachability.md.
 */
import LooperSingleton from '../src/App/LooperSingleton';
import Variables from '../src/Helpers/Variables';

/**
 * Gini of a numeric vector — same formula as `Simulation`'s private helper.
 * @param v - values to measure
 * @returns Gini coefficient in [0, 1)
 */
function gini(v: number[]): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  const n = s.length, total = s.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const w = s.reduce((sum, x, i) => sum + (i + 1) * x, 0);
  return (2 * w - (n + 1) * total) / (n * total);
}

(async () => {
  for (const ticks of [60, 120, 200]) {
    const sim = await LooperSingleton.getInstance().start(100, ticks, 1, () => {}, {});
    const living = sim.getLiving();
    if (living.length === 0) { console.log(`t=${ticks} extinct`); continue; }
    const all = living.map(p => p.resources);
    const adults = living.filter(p => p.age >= Variables.WORKING_AGE_MIN).map(p => p.resources);
    const kids = living.filter(p => p.age < Variables.WORKING_AGE_MIN);
    const kidShare = kids.length / living.length;
    const kidMean = kids.length ? kids.reduce((s, p) => s + p.resources, 0) / kids.length : 0;
    const adultMean = adults.length ? adults.reduce((s, x) => s + x, 0) / adults.length : 0;
    console.log(
      `t=${String(ticks).padStart(3)} n=${String(living.length).padStart(4)}  giniAll=${gini(all).toFixed(3)}  giniAdults=${gini(adults).toFixed(3)}` +
      `  childShare=${(kidShare * 100).toFixed(0)}%  meanChild=${kidMean.toFixed(1)}  meanAdult=${adultMean.toFixed(1)}`,
    );
  }
})();
