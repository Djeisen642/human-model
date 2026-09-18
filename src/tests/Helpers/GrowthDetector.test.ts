import { detectGrowth } from '../../Helpers/GrowthDetector';

/**
 * Build a pure exponential series `start · e^(rate·i)`.
 *
 * @param n - number of samples
 * @param start - value at i = 0
 * @param rate - per-step log-growth rate
 * @returns the sampled series
 */
function exponential(n: number, start: number, rate: number): number[] {
  return Array.from({ length: n }, (_, i) => start * Math.exp(rate * i));
}

/**
 * Build a sampled sine oscillating in [mid-amp, mid+amp] over `cycles` periods across `n` points.
 *
 * @param n - number of samples
 * @param cycles - number of full periods across the series
 * @param mid - midline value
 * @param amp - amplitude
 * @returns the sampled series
 */
function sine(n: number, cycles: number, mid: number, amp: number): number[] {
  return Array.from({ length: n }, (_, i) => mid + amp * Math.sin((2 * Math.PI * cycles * i) / n));
}

describe('detectGrowth', () => {
  it('reports nothing for a series shorter than one window', () => {
    const m = detectGrowth([10, 20, 40, 80]);
    expect(m.span).toBe(0);
    expect(m.runaway).toBe(false);
    expect(m.doublingTime).toBe(Infinity);
  });

  it('recovers the rate and doubling time of a clean exponential', () => {
    const m = detectGrowth(exponential(600, 10, 0.02));
    expect(m.rate).toBeCloseTo(0.02, 4);
    expect(m.trendRate).toBeCloseTo(0.02, 4);
    expect(m.doublingTime).toBeCloseTo(Math.LN2 / 0.02, 2);
    expect(m.share).toBe(1);
    expect(m.ongoingAtEnd).toBe(true);
  });

  it('flags an unbounded exponential as a runaway', () => {
    // 600 steps at 0.02/tick is e^12 ≈ 163,000-fold, still climbing at the end.
    expect(detectGrowth(exponential(600, 10, 0.02)).runaway).toBe(true);
  });

  it('does not flag a flat series', () => {
    const m = detectGrowth(Array(500).fill(300));
    expect(m.runaway).toBe(false);
    expect(m.share).toBe(0);
    expect(m.trendRate).toBeCloseTo(0, 6);
  });

  it('does not call an oscillation a runaway, however violent its booms', () => {
    // Four booms of 50 → 950 and back. Each boom grows fast; the run as a whole goes nowhere.
    const m = detectGrowth(sine(1200, 4, 500, 450));
    expect(m.share).toBeGreaterThan(0);          // the booms are found
    expect(Math.abs(m.trendRate)).toBeLessThan(0.002); // the run is not
    expect(m.runaway).toBe(false);
  });

  it('does not call a decaying series a runaway', () => {
    const m = detectGrowth(exponential(600, 5000, -0.02));
    expect(m.trendRate).toBeCloseTo(-0.02, 4);
    expect(m.share).toBe(0);
    expect(m.runaway).toBe(false);
  });

  it('finds the longest exponential stretch when growth stops partway', () => {
    // Grows for 400 ticks, then holds flat for 400.
    const series = [...exponential(400, 10, 0.02), ...Array(400).fill(10 * Math.exp(0.02 * 399))];
    const m = detectGrowth(series);
    expect(m.startIndex).toBe(0);
    expect(m.span).toBeGreaterThan(300);
    expect(m.span).toBeLessThan(500);
    expect(m.ongoingAtEnd).toBe(false);
    expect(m.runaway).toBe(false); // large fold growth, but it turned over
  });

  it('ignores values below minLevel rather than taking the log of a crash', () => {
    // A population that dies has zeros at the end; they must not poison the fit.
    const series = [...exponential(300, 20, 0.01), ...Array(300).fill(0)];
    const m = detectGrowth(series);
    expect(Number.isFinite(m.trendRate)).toBe(true);
    expect(m.trendRate).toBeCloseTo(0.01, 3);
    expect(m.ongoingAtEnd).toBe(false);
  });

  it('honours threshold overrides', () => {
    // 1200 steps at 0.003/tick is e^3.6 ≈ 36-fold: over the default 10× fold bar, under 100×.
    const slow = exponential(1200, 10, 0.003);
    expect(detectGrowth(slow).runaway).toBe(true);
    // Demand a steeper slope than the series has and it stops qualifying.
    expect(detectGrowth(slow, { minRate: 0.01 }).runaway).toBe(false);
    // Demand more fold growth than it achieved and it stops qualifying.
    expect(detectGrowth(slow, { runawayFold: 100 }).runaway).toBe(false);
  });

  it('measures fold growth from the first scorable value to the series maximum', () => {
    const m = detectGrowth(exponential(300, 10, 0.01));
    expect(m.foldGrowth).toBeCloseTo(Math.exp(0.01 * 299), 0);
  });
});
