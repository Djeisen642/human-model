/**
 * Cycle detection over a population time series — measurement tooling for the sweep harness.
 *
 * Distinguishes a *stable cycle* (a sustained, self-repeating boom-bust oscillation whose troughs
 * hold above zero — HANDY's "cycles of prosperity and collapse" that persist) from a *single
 * boom-bust* or a *slow ratchet to extinction* (oscillation whose troughs march downward). The
 * discriminator is the trough envelope: in a stable cycle successive trough minima stay roughly
 * level; in a damped collapse each trough is lower than the last.
 *
 * This is exploratory analysis only — it is NOT (yet) an outcome label. If the harness shows the
 * model actually produces stable cycles, promoting this into a `classifyOutcome` label would
 * warrant an ARD. Pure and side-effect-free so it can be unit-tested and reused.
 */

/** Aggregate cycle measurements for one population series. */
export interface CycleMetrics {
  /** Number of complete oscillation periods detected (each ≈ two turning points). */
  numCycles: number;
  /** Average ticks between successive same-kind turning points; 0 if fewer than two. */
  period: number;
  /** Average peak-to-adjacent-trough ratio across cycles; 1 if no cycles. */
  amplitude: number;
  /** Last trough ÷ first trough: ≈1 troughs hold, <1 ratcheting toward extinction, >1 rising; 1 if <2 troughs. */
  troughTrend: number;
  /** True when the series sustains a non-collapsing oscillation (survives, ≥ minCycles, troughs hold). */
  stableCycle: boolean;
  /** True when the series ends extinct (final value 0). */
  extinct: boolean;
}

/** Tunable thresholds for cycle detection. Defaults suit boom-bust population series. */
export interface CycleOptions {
  /** Centered moving-average window applied before detection, to damp single-tick jitter. */
  smoothingWindow?: number;
  /** Minimum relative swing (fraction) from the running extreme to confirm a turning point. */
  reversalThreshold?: number;
  /** Minimum complete cycles required to call the series a stable cycle. */
  minCycles?: number;
  /** Minimum troughTrend (last/first trough) to count the trough envelope as non-collapsing. */
  troughHoldFraction?: number;
}

const DEFAULTS: Required<CycleOptions> = {
  smoothingWindow: 5,
  reversalThreshold: 0.2,
  minCycles: 2,
  troughHoldFraction: 0.5,
};

/** A confirmed turning point in the smoothed series. */
interface Pivot {
  /** Index of the extreme within the series. */
  idx: number;
  /** Value at the extreme. */
  val: number;
  /** Whether this turning point is a local maximum or minimum. */
  kind: 'peak' | 'trough';
}

/**
 * Centered moving average; the window shrinks at the edges.
 *
 * @param series - input values
 * @param window - averaging window width (≤1 returns a copy unchanged)
 * @returns the smoothed series
 */
function smooth(series: number[], window: number): number[] {
  if (window <= 1 || series.length === 0) return series.slice();
  const half = Math.floor(window / 2);
  return series.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(series.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += series[j];
    return sum / (hi - lo + 1);
  });
}

/**
 * Relative distance |a − b| / |b|; a move from 0 is treated as infinite unless a is also 0.
 *
 * @param a - current value
 * @param b - reference (extreme) value
 * @returns the relative distance
 */
function rel(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs(a - b) / Math.abs(b);
}

/**
 * Zigzag turning-point detector: walks the series tracking running extremes and confirms a pivot
 * only once the series retraces by `theta` from that extreme, so sub-threshold wiggles are ignored.
 * Returns strictly alternating peaks and troughs.
 *
 * @param s - the (smoothed) series
 * @param theta - minimum relative retrace to confirm a turning point
 * @returns the confirmed pivots in order
 */
function zigzag(s: number[], theta: number): Pivot[] {
  const pivots: Pivot[] = [];
  if (s.length < 2) return pivots;

  let maxIdx = 0, maxVal = s[0];
  let minIdx = 0, minVal = s[0];
  let dir: 'peak' | 'trough' | null = null; // the kind of the NEXT pivot we expect

  for (let i = 1; i < s.length; i++) {
    const v = s[i];
    if (v > maxVal) { maxVal = v; maxIdx = i; }
    if (v < minVal) { minVal = v; minIdx = i; }

    if (dir === null) {
      // No direction yet: the first θ move off the start only fixes direction. The start point
      // itself is not a confirmed turning point (we never observed it reverse), so don't emit it —
      // emitting it would plant a false trough/peak at the series boundary and skew troughTrend.
      if (v > minVal && rel(v, minVal) >= theta) {
        dir = 'peak'; maxVal = v; maxIdx = i;
      } else if (v < maxVal && rel(v, maxVal) >= theta) {
        dir = 'trough'; minVal = v; minIdx = i;
      }
    } else if (dir === 'peak') {
      if (v < maxVal && rel(v, maxVal) >= theta) {
        pivots.push({ idx: maxIdx, val: maxVal, kind: 'peak' });
        dir = 'trough'; minVal = v; minIdx = i;
      }
    } else {
      if (v > minVal && rel(v, minVal) >= theta) {
        pivots.push({ idx: minIdx, val: minVal, kind: 'trough' });
        dir = 'peak'; maxVal = v; maxIdx = i;
      }
    }
  }
  return pivots;
}

/**
 * Mean of consecutive differences in an index list; 0 if fewer than two.
 *
 * @param idx - sorted indices
 * @returns the average gap between successive indices
 */
function meanGap(idx: number[]): number {
  if (idx.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < idx.length; i++) sum += idx[i] - idx[i - 1];
  return sum / (idx.length - 1);
}

/**
 * Measures oscillation in a population series and judges whether it is a sustained, non-collapsing
 * (stable) cycle. See the module header for the definition and intended use.
 *
 * @param series - per-tick population values in tick order
 * @param options - optional detection thresholds (see CycleOptions; sensible defaults applied)
 * @returns the cycle metrics for the series
 */
export function detectCycles(series: number[], options: CycleOptions = {}): CycleMetrics {
  const opts = { ...DEFAULTS, ...options };
  const extinct = series.length > 0 && series[series.length - 1] === 0;

  const pivots = zigzag(smooth(series, opts.smoothingWindow), opts.reversalThreshold);
  const peaks = pivots.filter(p => p.kind === 'peak');
  const troughs = pivots.filter(p => p.kind === 'trough');

  const numCycles = Math.max(0, Math.floor((pivots.length - 1) / 2));
  const period = peaks.length >= 2 ? meanGap(peaks.map(p => p.idx)) : meanGap(troughs.map(t => t.idx));

  // Amplitude: each peak against the trough immediately preceding it.
  let ampSum = 0, ampN = 0;
  for (let i = 1; i < pivots.length; i++) {
    if (pivots[i].kind === 'peak' && pivots[i - 1].kind === 'trough') {
      ampSum += pivots[i].val / Math.max(1, pivots[i - 1].val);
      ampN++;
    }
  }
  const amplitude = ampN > 0 ? ampSum / ampN : 1;

  const troughTrend = troughs.length >= 2
    ? troughs[troughs.length - 1].val / Math.max(1, troughs[0].val)
    : 1;

  const stableCycle = !extinct
    && numCycles >= opts.minCycles
    && troughTrend >= opts.troughHoldFraction;

  return { numCycles, period, amplitude, troughTrend, stableCycle, extinct };
}
