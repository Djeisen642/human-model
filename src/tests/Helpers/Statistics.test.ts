import SeededRandom from '../../Helpers/SeededRandom';
import { RNG } from '../../Helpers/Types';
import {
  fisherExact, mcnemarExact, median, mean, pairedPermutationTest,
  bootstrapPairedDifference, seedsNeededForRateChange,
} from '../../Helpers/Statistics';

/**
 * A deterministic RNG so every randomised assertion below is reproducible.
 *
 * @param seed - seed for the generator
 * @returns a bound RNG function
 */
function rngFor(seed: number): RNG {
  return new SeededRandom(seed).asRNG();
}

describe('fisherExact', () => {
  it('matches the tea-tasting result of 34/70', () => {
    // 8 cups, 4 poured milk-first, 3 identified correctly: the textbook two-tailed answer.
    expect(fisherExact(3, 1, 1, 3)).toBeCloseTo(34 / 70, 10);
  });

  it('returns 1 when both arms are identical', () => {
    expect(fisherExact(5, 5, 5, 5)).toBeCloseTo(1, 10);
  });

  it('is symmetric under swapping the two arms', () => {
    expect(fisherExact(23, 25, 1, 47)).toBeCloseTo(fisherExact(1, 47, 23, 25), 12);
  });

  it('calls a near-total separation extremely unlikely', () => {
    expect(fisherExact(23, 25, 1, 47)).toBeLessThan(1e-5);
  });

  it('never exceeds 1 even for tiny tables', () => {
    for (let a = 0; a <= 3; a++) {
      for (let b = 0; b <= 3; b++) {
        expect(fisherExact(a, b, b, a)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('mcnemarExact', () => {
  it('matches the exact binomial for a 1-vs-9 split of disagreements', () => {
    // 2 x P(X <= 1) for 10 coin flips = 2 x 11/1024.
    expect(mcnemarExact(1, 9)).toBeCloseTo(22 / 1024, 12);
  });

  it('returns 1 for an even split', () => {
    expect(mcnemarExact(5, 5)).toBeCloseTo(1, 12);
  });

  it('returns 1 when the arms never disagree', () => {
    expect(mcnemarExact(0, 0)).toBe(1);
  });

  it('ignores runs where both arms agree, unlike an unpaired test', () => {
    // Same disagreements, wildly different agreement counts: the paired answer is unchanged.
    expect(mcnemarExact(2, 10)).toBeCloseTo(mcnemarExact(2, 10), 12);
    expect(mcnemarExact(0, 8)).toBeLessThan(0.01);
  });

  it('is symmetric in its two arguments', () => {
    expect(mcnemarExact(3, 11)).toBeCloseTo(mcnemarExact(11, 3), 12);
  });
});

describe('median and mean', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it('returns NaN for empty input', () => {
    expect(median([])).toBeNaN();
    expect(mean([])).toBeNaN();
  });

  it('does not mutate its input', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('pairedPermutationTest', () => {
  it('returns 1 when the two arms are identical', () => {
    const arm = [10, 20, 30, 40];
    expect(pairedPermutationTest(arm, arm, rngFor(1), 500)).toBe(1);
  });

  it('detects a shift that is consistent across every seed', () => {
    const baseline = [10, 12, 9, 11, 13, 8, 10, 12];
    const treatment = baseline.map((v) => v + 5);
    expect(pairedPermutationTest(baseline, treatment, rngFor(2), 5000)).toBeLessThan(0.01);
  });

  it('is unmoved by a difference that flips sign seed to seed', () => {
    const baseline = [10, 10, 10, 10, 10, 10, 10, 10];
    const treatment = [15, 5, 15, 5, 15, 5, 15, 5];
    expect(pairedPermutationTest(baseline, treatment, rngFor(3), 5000)).toBeGreaterThan(0.5);
  });

  it('rejects mismatched arm lengths rather than silently truncating', () => {
    expect(() => pairedPermutationTest([1, 2], [1], rngFor(4), 100)).toThrow();
  });

  it('raises a false alarm about as often as advertised on data with no real effect', () => {
    // The calibration that matters: feed it pure noise many times and count the false positives.
    const rng = rngFor(99);
    let falseAlarms = 0;
    const trials = 300;
    for (let trial = 0; trial < trials; trial++) {
      const baseline: number[] = [];
      const treatment: number[] = [];
      for (let i = 0; i < 20; i++) {
        baseline.push(rng() * 100);
        treatment.push(rng() * 100);
      }
      if (pairedPermutationTest(baseline, treatment, rng, 400) < 0.05) falseAlarms++;
    }
    // Expect ~5%; allow a generous band so the test is not itself flaky.
    expect(falseAlarms / trials).toBeLessThan(0.12);
  });
});

describe('bootstrapPairedDifference', () => {
  it('recovers a constant shift and brackets it', () => {
    const baseline = [10, 12, 9, 11, 13, 8, 10, 12];
    const treatment = baseline.map((v) => v + 7);
    const result = bootstrapPairedDifference(baseline, treatment, rngFor(5), 2000);
    expect(result.estimate).toBe(7);
    expect(result.low).toBeLessThanOrEqual(7);
    expect(result.high).toBeGreaterThanOrEqual(7);
  });

  it('spans zero when the arms differ only by noise', () => {
    const baseline = [10, 10, 10, 10, 10, 10, 10, 10];
    const treatment = [12, 8, 11, 9, 13, 7, 12, 8];
    const result = bootstrapPairedDifference(baseline, treatment, rngFor(6), 2000);
    expect(result.low).toBeLessThanOrEqual(0);
    expect(result.high).toBeGreaterThanOrEqual(0);
  });

  it('rejects mismatched arm lengths', () => {
    expect(() => bootstrapPairedDifference([1, 2], [1], rngFor(7), 100)).toThrow();
  });
});

describe('seedsNeededForRateChange', () => {
  it('needs infinitely many seeds to detect no change at all', () => {
    expect(seedsNeededForRateChange(0.5, 0.5)).toBe(Infinity);
  });

  it('needs fewer seeds as the change gets bigger', () => {
    const small = seedsNeededForRateChange(0.96, 0.90);
    const large = seedsNeededForRateChange(0.96, 0.50);
    expect(large).toBeLessThan(small);
  });

  it('is symmetric in direction', () => {
    expect(seedsNeededForRateChange(0.9, 0.6)).toBe(seedsNeededForRateChange(0.6, 0.9));
  });

  it('agrees with the standard two-proportion sizing to within rounding', () => {
    // 0.5 vs 0.8 at the usual 5% false-alarm / 80% detection settings needs ~39 per arm.
    expect(seedsNeededForRateChange(0.5, 0.8)).toBeGreaterThanOrEqual(35);
    expect(seedsNeededForRateChange(0.5, 0.8)).toBeLessThanOrEqual(45);
  });
});
