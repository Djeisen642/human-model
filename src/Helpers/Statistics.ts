import { RNG } from './Types';

/**
 * Pure significance-testing helpers for comparing two sweep configurations.
 *
 * Every function here is deterministic given its inputs (randomised procedures take an explicit
 * `RNG`), side-effect free, and unit-tested against known values in `src/tests/Helpers/Statistics.test.ts`.
 *
 * **Why paired tests are the default.** `scripts/sweep.ts` runs the *same seed set* through every
 * arm, so run `i` of the baseline and run `i` of the treatment share an initial population and RNG
 * stream. That makes the arms paired, not independent. Pairing removes seed-level variance — a seed
 * that collapses early does so in both arms — and is substantially more sensitive than comparing two
 * medians. Use the unpaired entry points only when the two arms genuinely used different seeds.
 *
 * No external dependency is available (this project ships zero production dependencies), so the
 * distributions below are computed exactly by enumeration or approximated by documented formulas.
 */

/**
 * Natural log of n!, computed by summation; exact enough for the table sizes used here.
 *
 * @param n - non-negative integer whose factorial log is wanted
 * @returns ln(n!)
 */
function lnFactorial(n: number): number {
  let sum = 0;
  for (let i = 2; i <= n; i++) sum += Math.log(i);
  return sum;
}

/**
 * Probability of one specific 2x2 table under the hypergeometric distribution with fixed margins.
 *
 * @param a - count in row 1, column 1
 * @param b - count in row 1, column 2
 * @param c - count in row 2, column 1
 * @param d - count in row 2, column 2
 * @returns probability of exactly this table given the row and column totals
 */
function hypergeometricProbability(a: number, b: number, c: number, d: number): number {
  return Math.exp(
    lnFactorial(a + b) + lnFactorial(c + d) + lnFactorial(a + c) + lnFactorial(b + d)
      - lnFactorial(a) - lnFactorial(b) - lnFactorial(c) - lnFactorial(d) - lnFactorial(a + b + c + d),
  );
}

/**
 * Two-tailed Fisher exact test on a 2x2 table — for two arms run on *different* seeds.
 *
 * Sums the probability of every table with the same margins that is at least as extreme as the one
 * observed. Exact, with no sample-size assumptions, which matters because sweep arms are routinely
 * small and often have zero cells.
 *
 * @param a - count in row 1, column 1 (e.g. baseline runs that went extinct)
 * @param b - count in row 1, column 2 (e.g. baseline runs that survived)
 * @param c - count in row 2, column 1 (e.g. treatment runs that went extinct)
 * @param d - count in row 2, column 2 (e.g. treatment runs that survived)
 * @returns the two-tailed probability of a table this extreme or more, when the arms truly match
 */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  const observed = hypergeometricProbability(a, b, c, d);
  const n = a + b + c + d;
  const rowOne = a + b;
  const colOne = a + c;
  let total = 0;
  for (let i = Math.max(0, colOne - (n - rowOne)); i <= Math.min(rowOne, colOne); i++) {
    const p = hypergeometricProbability(i, rowOne - i, colOne - i, n - rowOne - colOne + i);
    // Tolerance guards against a same-probability table being dropped by floating-point noise.
    if (p <= observed * (1 + 1e-9)) total += p;
  }
  return Math.min(1, total);
}

/**
 * Two-tailed exact McNemar test — the paired counterpart of Fisher, for yes/no outcomes.
 *
 * Only the runs where the two arms *disagree* carry information: if a seed goes extinct in both
 * arms, or survives in both, it says nothing about which arm is better. Under the hypothesis that
 * the arms are equivalent, each disagreement is a coin flip, so this is an exact binomial test on
 * the discordant runs.
 *
 * @param onlyBaseline - runs where the baseline showed the outcome and the treatment did not
 * @param onlyTreatment - runs where the treatment showed the outcome and the baseline did not
 * @returns the two-tailed probability of a split this lopsided or more, when the arms truly match
 */
export function mcnemarExact(onlyBaseline: number, onlyTreatment: number): number {
  const discordant = onlyBaseline + onlyTreatment;
  if (discordant === 0) return 1;
  const smaller = Math.min(onlyBaseline, onlyTreatment);
  let tail = 0;
  for (let i = 0; i <= smaller; i++) {
    tail += Math.exp(lnFactorial(discordant) - lnFactorial(i) - lnFactorial(discordant - i) - discordant * Math.LN2);
  }
  return Math.min(1, 2 * tail);
}

/**
 * Median of a numeric array; returns NaN for an empty input.
 *
 * @param values - the numbers to summarise
 * @returns the middle value, averaging the two middle values for an even count
 */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Arithmetic mean of a numeric array; returns NaN for an empty input.
 *
 * @param values - the numbers to summarise
 * @returns the arithmetic mean
 */
export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Paired sign-flip permutation test for a measured quantity (peak population, trough depth, ...).
 *
 * Takes the per-seed differences and asks how often a random re-signing of those differences
 * produces an average at least as large as the one observed. Assumes only that, if the change does
 * nothing, a difference is equally likely to fall either way — no normality, no equal variances,
 * which suits the heavy-tailed, often bimodal quantities this model produces.
 *
 * @param baseline - per-seed values for the baseline arm
 * @param treatment - per-seed values for the treatment arm, in the same seed order
 * @param rng - seeded random source, so a reported result can be reproduced exactly
 * @param iterations - permutations to draw; 10000 gives a resolution of about 0.0001
 * @returns the two-tailed probability of a shift this large or larger, when the change does nothing
 */
export function pairedPermutationTest(
  baseline: number[], treatment: number[], rng: RNG, iterations = 10_000,
): number {
  if (baseline.length !== treatment.length) throw new Error('paired test needs equal-length arms');
  const differences = treatment.map((value, i) => value - baseline[i]);
  const nonZero = differences.filter((d) => d !== 0);
  if (nonZero.length === 0) return 1;
  const observed = Math.abs(mean(nonZero));
  let atLeastAsExtreme = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    let sum = 0;
    for (const d of nonZero) sum += rng() < 0.5 ? -d : d;
    if (Math.abs(sum / nonZero.length) >= observed * (1 - 1e-12)) atLeastAsExtreme++;
  }
  // Add-one keeps the result strictly positive: with finite permutations, "never seen" is not "impossible".
  return (atLeastAsExtreme + 1) / (iterations + 1);
}

/** A range of plausible values for an effect, with the point estimate that anchors it. */
export interface Interval {
  /** Best single estimate of the change (treatment minus baseline). */
  estimate: number;
  /** Bottom of the plausible range. */
  low: number;
  /** Top of the plausible range. */
  high: number;
}

/**
 * Bootstrap range for the typical per-seed change, by resampling whole seed pairs.
 *
 * Answers "how big is the change, and how precisely do we know that" — which a p-value alone never
 * says. A range spanning zero means the direction of the change is not pinned down.
 *
 * @param baseline - per-seed values for the baseline arm
 * @param treatment - per-seed values for the treatment arm, in the same seed order
 * @param rng - seeded random source, so a reported range can be reproduced exactly
 * @param iterations - resamples to draw
 * @param coverage - share of the range to report, e.g. 0.95
 * @returns the median per-seed change and the range it plausibly lies in
 */
export function bootstrapPairedDifference(
  baseline: number[], treatment: number[], rng: RNG, iterations = 10_000, coverage = 0.95,
): Interval {
  if (baseline.length !== treatment.length) throw new Error('paired bootstrap needs equal-length arms');
  const differences = treatment.map((value, i) => value - baseline[i]);
  const resampledMedians: number[] = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const sample: number[] = [];
    for (let i = 0; i < differences.length; i++) sample.push(differences[Math.floor(rng() * differences.length)]);
    resampledMedians.push(median(sample));
  }
  resampledMedians.sort((x, y) => x - y);
  const tail = (1 - coverage) / 2;
  return {
    estimate: median(differences),
    low: resampledMedians[Math.floor(tail * (resampledMedians.length - 1))],
    high: resampledMedians[Math.ceil((1 - tail) * (resampledMedians.length - 1))],
  };
}

/**
 * Standard normal cumulative distribution, via the Abramowitz & Stegun 7.1.26 error-function approximation.
 *
 * @param z - standard deviations from the mean
 * @returns share of the distribution at or below `z`
 */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

/**
 * Inverse standard normal, found by bisection on `normalCdf`; ample precision for sizing a sweep.
 *
 * @param p - cumulative probability in (0, 1)
 * @returns the z for which `normalCdf(z)` equals `p`
 */
function normalQuantile(p: number): number {
  let low = -10;
  let high = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (normalCdf(mid) < p) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

/**
 * How many seeds per arm are needed to reliably detect a change in a yes/no rate.
 *
 * Use this *before* running a sweep. The recurring failure in this project's history is reading a
 * difference off too few seeds; this says up front whether the planned run could see the effect at
 * all, so a null result can be reported as "too small to tell" rather than "no effect".
 *
 * @param baselineRate - the rate in the baseline arm, e.g. 0.96 for 46 of 48 runs extinct
 * @param treatmentRate - the rate worth detecting in the treatment arm
 * @param falseAlarmRate - tolerated chance of calling a difference that is not there (0.05 is usual)
 * @param detectionRate - required chance of catching the difference when it is real (0.8 is usual)
 * @returns seeds needed per arm, rounded up; Infinity when the two rates are equal
 */
export function seedsNeededForRateChange(
  baselineRate: number, treatmentRate: number, falseAlarmRate = 0.05, detectionRate = 0.8,
): number {
  const gap = Math.abs(treatmentRate - baselineRate);
  if (gap === 0) return Infinity;
  const zAlpha = normalQuantile(1 - falseAlarmRate / 2);
  const zBeta = normalQuantile(detectionRate);
  const variance = baselineRate * (1 - baselineRate) + treatmentRate * (1 - treatmentRate);
  return Math.ceil(((zAlpha + zBeta) ** 2 * variance) / gap ** 2);
}

/** The five-number summary plus the fences a box plot draws. */
export interface FiveNumber {
  /** Smallest value that is not an outlier (the lower whisker end). */
  whiskerLow: number;
  /** 25th percentile. */
  q1: number;
  /** 50th percentile. */
  median: number;
  /** 75th percentile. */
  q3: number;
  /** Largest value that is not an outlier (the upper whisker end). */
  whiskerHigh: number;
  /** Smallest value in the sample, outliers included. */
  min: number;
  /** Largest value in the sample, outliers included. */
  max: number;
  /** Count of values outside 1.5 × IQR of the quartiles. */
  outliers: number;
  /** Sample size. */
  n: number;
}

/**
 * Five-number summary with Tukey fences, for box-and-whisker rendering.
 *
 * Quartiles use linear interpolation between order statistics (the "type 7" definition, which is
 * what R, NumPy and Excel default to), so a small sample does not snap its quartiles to whichever
 * element happens to sit at the index.
 *
 * @param values - the sample; order does not matter and the input is not mutated
 * @returns the five-number summary, or all zeros with `n: 0` for an empty sample
 */
export function fiveNumberSummary(values: number[]): FiveNumber {
  if (values.length === 0) {
    return { whiskerLow: 0, q1: 0, median: 0, q3: 0, whiskerHigh: 0, min: 0, max: 0, outliers: 0, n: 0 };
  }
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number): number => {
    const h = (s.length - 1) * p;
    const lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  };
  const q1 = q(0.25), med = q(0.5), q3 = q(0.75);
  const iqr = q3 - q1;
  const loFence = q1 - 1.5 * iqr, hiFence = q3 + 1.5 * iqr;
  let whiskerLow = s[s.length - 1], whiskerHigh = s[0], outliers = 0;
  for (const v of s) {
    if (v < loFence || v > hiFence) { outliers++; continue; }
    if (v < whiskerLow) whiskerLow = v;
    if (v > whiskerHigh) whiskerHigh = v;
  }
  // Every value an outlier (possible for a degenerate sample) leaves the whiskers crossed; fall
  // back to the quartiles rather than emitting an inverted box.
  if (whiskerLow > whiskerHigh) { whiskerLow = q1; whiskerHigh = q3; }
  return { whiskerLow, q1, median: med, q3, whiskerHigh, min: s[0], max: s[s.length - 1], outliers, n: s.length };
}
