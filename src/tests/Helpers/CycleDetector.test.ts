import { detectCycles } from '../../Helpers/CycleDetector';

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

describe('detectCycles', () => {
  it('returns no cycles and not extinct for an empty or tiny series', () => {
    const m = detectCycles([]);
    expect(m.numCycles).toBe(0);
    expect(m.stableCycle).toBe(false);
    expect(m.extinct).toBe(false);
  });

  it('detects a sustained oscillation as a stable cycle', () => {
    // Three full periods around 300 ± 150, troughs hold at ~150 → stable.
    const m = detectCycles(sine(300, 3, 300, 150));
    expect(m.numCycles).toBeGreaterThanOrEqual(2);
    expect(m.stableCycle).toBe(true);
    expect(m.troughTrend).toBeGreaterThan(0.8);
    expect(m.extinct).toBe(false);
  });

  it('reports a flat (non-oscillating) survivor as no cycle', () => {
    const m = detectCycles(Array(200).fill(250));
    expect(m.numCycles).toBe(0);
    expect(m.stableCycle).toBe(false); // a stable equilibrium is not a stable *cycle*
  });

  it('does not call a single boom-bust a stable cycle', () => {
    // Rise 100→500 then fall to near zero, once.
    const up = Array.from({ length: 50 }, (_, i) => 100 + (400 * i) / 49);
    const down = Array.from({ length: 50 }, (_, i) => 500 - (495 * i) / 49);
    const m = detectCycles([...up, ...down]);
    expect(m.numCycles).toBeLessThan(2);
    expect(m.stableCycle).toBe(false);
  });

  it('flags a terminal crash as extinct and not a stable cycle', () => {
    const series = [...sine(100, 1, 300, 150).slice(0, 80), ...Array(20).fill(0)];
    const m = detectCycles(series);
    expect(m.extinct).toBe(true);
    expect(m.stableCycle).toBe(false);
  });

  it('treats a damped oscillation ratcheting toward extinction as not stable', () => {
    // Baseline (and so each trough) decays toward zero: troughs = 180·decay, 180 → 36.
    const n = 300;
    const series = Array.from({ length: n }, (_, i) => {
      const decay = 1 - (0.8 * i) / n; // 1 → 0.2
      return 300 * decay + 120 * decay * Math.sin((2 * Math.PI * 4 * i) / n);
    });
    const m = detectCycles(series);
    expect(m.troughTrend).toBeLessThan(0.5); // troughs march downward
    expect(m.stableCycle).toBe(false);
  });

  it('reports a growing oscillation as not extinct with rising troughs', () => {
    const n = 300;
    const series = Array.from({ length: n }, (_, i) => {
      const grow = 1 + i / n; // 1 → 2
      return 200 * grow + 80 * Math.sin((2 * Math.PI * 4 * i) / n);
    });
    const m = detectCycles(series);
    expect(m.troughTrend).toBeGreaterThan(1);
    expect(m.extinct).toBe(false);
  });

  it('reports a plausible period for a known oscillation', () => {
    // 4 periods over 400 ticks → period ≈ 100 ticks between successive peaks.
    const m = detectCycles(sine(400, 4, 300, 150));
    expect(m.period).toBeGreaterThan(80);
    expect(m.period).toBeLessThan(120);
  });
});
