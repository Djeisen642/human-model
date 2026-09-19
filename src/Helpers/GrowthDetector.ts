/**
 * Exponential-growth detection over a time series — measurement tooling for the sweep harness.
 *
 * Answers the question the cycle detector cannot: is a series *running away*? A boom-bust
 * population grows exponentially inside every boom and that is normal, so "grew exponentially
 * somewhere" is not the alarm. The alarm is a series whose exponential growth never turns over —
 * a carrying capacity that ratchets without bound, an extraction productivity that parks at its
 * cap, a population still doubling when the clock stops. Those are the states where a long-horizon
 * result is really a statement about where the run was truncated.
 *
 * Two measurements, deliberately separate:
 *
 * - **Local**: a sliding log-linear regression. Windows whose fit is tight enough and whose slope
 *   is steep enough count as exponential; `share` is how much of the run sits inside one, `span`
 *   and `rate` describe the longest such stretch. In a healthy boom-bust regime `share` lands near
 *   the boom fraction of a cycle and means nothing is wrong.
 * - **Global**: one log-linear fit across the whole series. `trendRate` is the run's compounding
 *   rate end to end, which a cycling series drives to ≈0 however violent its booms are.
 *
 * `runaway` is the flag to read: sustained global growth, a large fold increase, and still growing
 * when the series ends. All three, because each alone has a benign reading.
 *
 * This is exploratory analysis only — it is NOT an outcome label and does not feed
 * `classifyOutcome`. Promoting it into one would warrant an ARD, exactly as `CycleDetector`'s
 * header said before ARD 063 did that. Pure and side-effect-free so it can be unit-tested.
 */

/** Growth measurements for one series. */
export interface GrowthMetrics {
  /** Per-tick log-growth rate of the longest sustained exponential stretch; 0 when there is none. */
  rate: number;
  /** Ticks to double at `rate`; Infinity when `rate` is 0. */
  doublingTime: number;
  /** Length in ticks of the longest sustained exponential stretch. */
  span: number;
  /** Index where the longest sustained stretch begins; -1 when there is none. */
  startIndex: number;
  /** Share of scored windows that qualified as exponential (0–1). */
  share: number;
  /** True when the final window of the series qualified as exponential. */
  ongoingAtEnd: boolean;
  /** Per-tick log-growth rate fitted across the whole series; ≈0 for a series that cycles. */
  trendRate: number;
  /** R² of that whole-series fit; low means the trend line does not describe the series. */
  trendFit: number;
  /** Series maximum ÷ first scored value; 1 when nothing could be scored. */
  foldGrowth: number;
  /** Sustained global growth, a large fold increase, and still growing at the end — all three. */
  runaway: boolean;
}

/** Tunable thresholds for growth detection. Defaults suit population and commons series. */
export interface GrowthOptions {
  /** Ticks per regression window. Keep below half a cycle period or booms are averaged away. */
  window?: number;
  /** Ticks between successive window starts; only affects resolution and cost. */
  step?: number;
  /** Minimum per-tick log slope for a window (or the whole-series trend) to count as exponential. */
  minRate?: number;
  /** Minimum R² for a log-linear fit to count as exponential rather than as noise. */
  minFit?: number;
  /** Values below this are treated as too small to fit; a window containing one is not scored. */
  minLevel?: number;
  /** Fold growth (max ÷ first scored value) at or above which a still-growing series is runaway. */
  runawayFold?: number;
}

const DEFAULTS: Required<GrowthOptions> = {
  window: 100,
  step: 10,
  // 0.002/tick doubles in ~347 ticks: slow enough to catch a ratchet that a single cycle hides,
  // steep enough that ordinary drift does not trip it.
  minRate: 0.002,
  minFit: 0.9,
  minLevel: 5,
  runawayFold: 10,
};

/**
 * Ordinary least squares of y on x, with the coefficient of determination.
 *
 * @param x - the independent values
 * @param y - the dependent values, same length as `x`
 * @returns the fitted slope and its R²; both 0 when the fit is undefined
 */
function ols(x: number[], y: number[]): { slope: number; r2: number } {
  const n = x.length;
  if (n < 2) return { slope: 0, r2: 0 };
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0) return { slope: 0, r2: 0 };
  const slope = sxy / sxx;
  // A series with no variance in y is a perfect fit to a zero slope, not an undefined one.
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, r2 };
}

/**
 * Log-linear fit over `series[from..to)`.
 *
 * @param series - the values
 * @param from - first index, inclusive
 * @param to - last index, exclusive
 * @param minLevel - values below this make the window unscorable
 * @returns the slope and R² of log(series) against index, or null when any value is below `minLevel`
 */
function fitLog(series: number[], from: number, to: number, minLevel: number): { slope: number; r2: number } | null {
  const xs: number[] = [], ys: number[] = [];
  for (let i = from; i < to; i++) {
    if (!(series[i] >= minLevel)) return null;
    xs.push(i); ys.push(Math.log(series[i]));
  }
  if (xs.length < 2) return null;
  return ols(xs, ys);
}

/**
 * Measures how exponentially a series grows, locally and end to end.
 *
 * @param series - the values, one per tick, in order
 * @param options - threshold overrides; see `GrowthOptions`
 * @returns the growth measurements for the series
 */
export function detectGrowth(series: number[], options: GrowthOptions = {}): GrowthMetrics {
  const o = { ...DEFAULTS, ...options };
  const empty: GrowthMetrics = {
    rate: 0, doublingTime: Infinity, span: 0, startIndex: -1, share: 0,
    ongoingAtEnd: false, trendRate: 0, trendFit: 0, foldGrowth: 1, runaway: false,
  };
  if (series.length < o.window) return empty;

  // --- local: sliding windows ---
  let scored = 0, qualified = 0;
  let bestSpan = 0, bestStart = -1, bestRate = 0;
  let runStart = -1, runEnd = -1, lastQualified = false;
  let sawFinalWindow = false;

  const closeRun = (): void => {
    if (runStart < 0) return;
    const span = runEnd - runStart;
    if (span > bestSpan) {
      bestSpan = span;
      bestStart = runStart;
      const fit = fitLog(series, runStart, runEnd, o.minLevel);
      bestRate = fit ? fit.slope : 0;
    }
    runStart = -1;
  };

  for (let start = 0; start + o.window <= series.length; start += o.step) {
    const end = start + o.window;
    const isFinal = start + o.step + o.window > series.length;
    const fit = fitLog(series, start, end, o.minLevel);
    if (fit === null) { closeRun(); lastQualified = false; if (isFinal) sawFinalWindow = true; continue; }
    scored++;
    const ok = fit.slope >= o.minRate && fit.r2 >= o.minFit;
    if (ok) {
      qualified++;
      if (runStart < 0) runStart = start;
      runEnd = end;
    } else {
      closeRun();
    }
    lastQualified = ok;
    if (isFinal) sawFinalWindow = true;
  }
  closeRun();

  // --- global: one fit across every value large enough to take a log of ---
  let first = -1, last = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i] >= o.minLevel) { if (first < 0) first = i; last = i; }
  }
  let trendRate = 0, trendFit = 0, foldGrowth = 1;
  if (first >= 0 && last > first) {
    const xs: number[] = [], ys: number[] = [];
    for (let i = first; i <= last; i++) {
      if (series[i] >= o.minLevel) { xs.push(i); ys.push(Math.log(series[i])); }
    }
    const fit = ols(xs, ys);
    trendRate = fit.slope;
    trendFit = fit.r2;
    // Loop rather than Math.max(...spread): a long run is a long series, and spreading 100k+
    // elements into an argument list overflows the stack. 8000-tick runs are already routine.
    let max = series[first];
    for (let i = first; i <= last; i++) if (series[i] > max) max = series[i];
    foldGrowth = max / series[first];
  }

  const ongoingAtEnd = sawFinalWindow && lastQualified;
  return {
    rate: bestRate,
    doublingTime: bestRate > 0 ? Math.LN2 / bestRate : Infinity,
    span: bestSpan,
    startIndex: bestStart,
    share: scored > 0 ? qualified / scored : 0,
    ongoingAtEnd,
    trendRate,
    trendFit,
    foldGrowth,
    runaway: trendRate >= o.minRate && trendFit >= o.minFit && foldGrowth >= o.runawayFold && ongoingAtEnd,
  };
}
