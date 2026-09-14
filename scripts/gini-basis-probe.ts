/**
 * Measurement probe for the Gini-basis ARD: records all-living vs adults-only Gini per tick,
 * without touching src/ (wraps Simulation.prototype.snapshot).
 */
import LooperSingleton from '../src/App/LooperSingleton';
import Simulation from '../src/App/Simulation';
import Variables from '../src/Helpers/Variables';

/**
 * Gini of a numeric vector — same formula as Simulation's private helper.
 * @param v
 */
function gini(v: number[]): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  const n = s.length;
  const total = s.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const w = s.reduce((sum, x, i) => sum + (i + 1) * x, 0);
  return (2 * w - (n + 1) * total) / (n * total);
}

interface Sample { all: number; adult: number; childShare: number; pop: number }
let samples: Sample[] = [];

const original = Simulation.prototype.snapshot;
 
Simulation.prototype.snapshot = function (this: Simulation) {
  const living = this.getLiving();
  const adults = living.filter(p => p.age >= Variables.WORKING_AGE_MIN);
  samples.push({
    all: gini(living.map(p => p.resources)),
    adult: gini(adults.map(p => p.resources)),
    childShare: living.length ? 1 - adults.length / living.length : 0,
    pop: living.length,
  });
  return original.call(this);
};

const args = process.argv.slice(2);
const sets: string[] = [];
let ticks = 800;
let seedCount = 8;
let label = 'default';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set') sets.push(args[++i]);
  else if (args[i] === '--ticks') ticks = Number(args[++i]);
  else if (args[i] === '--seeds') seedCount = Number(args[++i]);
  else if (args[i] === '--label') label = args[++i];
}
for (const pair of sets) {
  const [k, v] = pair.split('=');
  (Variables as unknown as Record<string, unknown>)[k] = Number(v);
}

(async () => {
  for (let seed = 1; seed <= seedCount; seed++) {
    samples = [];
    await LooperSingleton.getInstance().start(100, ticks, seed, () => {}, {});
    // decade averages, matching buildTenYearSummary's windowing
    for (let start = 0; start < samples.length; start += 10) {
      const w = samples.slice(start, start + 10);
      if (w.length === 0) continue;
      const mean = (f: (s: Sample) => number) => w.reduce((a, s) => a + f(s), 0) / w.length;
      const pop = w[w.length - 1].pop;
      if (pop === 0) continue; // extinct decades carry no information
      console.log(
        `${label}\t${seed}\t${start + w.length}\t${pop}\t` +
        `${mean(s => s.all).toFixed(4)}\t${mean(s => s.adult).toFixed(4)}\t${mean(s => s.childShare).toFixed(4)}`,
      );
    }
  }
})();
