import { TickSnapshot } from '../../App/Simulation';
import {
  buildTenYearSummary,
  classifyOutcome,
  formatDecadeSummary,
  formatSimulationHeader,
  formatEndReport,
} from '../../Helpers/Reporters';
import { TenYearSummary } from '../../Helpers/Types';

/**
 * @param tick - zero-based tick index
 * @param overrides - per-tick fields to override
 * @param prev - previous snapshot for cumulative counts
 * @returns a minimal TickSnapshot
 */
function makeSnapshot(
  tick: number,
  overrides: Partial<TickSnapshot> = {},
  prev?: TickSnapshot,
): TickSnapshot {
  const deaths = overrides.deaths ?? 0;
  const deathsByMurder = overrides.deathsByMurder ?? 0;
  const deathsByIllness = overrides.deathsByIllness ?? 0;
  const deathsByDisaster = overrides.deathsByDisaster ?? 0;
  const deathsBySuicide = overrides.deathsBySuicide ?? 0;
  const deathsByOldAge = overrides.deathsByOldAge ?? 0;

  return {
    tick,
    population: overrides.population ?? 100,
    deaths,
    deathsByMurder,
    deathsByIllness,
    deathsByDisaster,
    deathsBySuicide,
    deathsByOldAge,
    cumulativeDeaths: (prev?.cumulativeDeaths ?? 0) + deaths,
    cumulativeDeathsByMurder: (prev?.cumulativeDeathsByMurder ?? 0) + deathsByMurder,
    cumulativeDeathsByIllness: (prev?.cumulativeDeathsByIllness ?? 0) + deathsByIllness,
    cumulativeDeathsByDisaster: (prev?.cumulativeDeathsByDisaster ?? 0) + deathsByDisaster,
    cumulativeDeathsBySuicide: (prev?.cumulativeDeathsBySuicide ?? 0) + deathsBySuicide,
    cumulativeDeathsByOldAge: (prev?.cumulativeDeathsByOldAge ?? 0) + deathsByOldAge,
    averageResources: overrides.averageResources ?? 50,
    resourceGini: overrides.resourceGini ?? 0.3,
    averageHappiness: overrides.averageHappiness ?? 5.0,
    aggregateKillingIntent: 0,
    aggregateStealingIntent: 0,
    naturalResources: overrides.naturalResources ?? 8000,
  };
}

/**
 * @param overrides - per-tick overrides (index = tick within the window)
 * @returns a 10-snapshot window starting at tick 0
 */
function makeWindow(overrides: Array<Partial<TickSnapshot>> = []): TickSnapshot[] {
  const window: TickSnapshot[] = [];
  for (let i = 0; i < 10; i++) {
    const prev = window.length > 0 ? window[window.length - 1] : undefined;
    window.push(makeSnapshot(i, overrides[i] ?? {}, prev));
  }
  return window;
}

/**
 * @param prior - the preceding decade's window (for cumulative chaining)
 * @param overrides - per-tick overrides for the new window
 * @returns a 10-snapshot window immediately following the prior window
 */
function makeWindowAfter(prior: TickSnapshot[], overrides: Array<Partial<TickSnapshot>> = []): TickSnapshot[] {
  const window: TickSnapshot[] = [];
  let prev = prior[prior.length - 1];
  for (let i = 0; i < 10; i++) {
    const snap = makeSnapshot(prior.length + i, overrides[i] ?? {}, prev);
    window.push(snap);
    prev = snap;
  }
  return window;
}

describe('buildTenYearSummary', () => {
  it('sets endTick from the parameter', () => {
    const summary = buildTenYearSummary(makeWindow(), 10, 100);
    expect(summary.endTick).toBe(10);
  });

  it('sets endPopulation from the last snapshot', () => {
    const window = makeWindow();
    window[9] = makeSnapshot(9, { population: 87 }, window[8]);
    const summary = buildTenYearSummary(window, 10, 100);
    expect(summary.endPopulation).toBe(87);
  });

  it('computes populationDelta correctly', () => {
    const window = makeWindow();
    window[9] = makeSnapshot(9, { population: 95 }, window[8]);
    const summary = buildTenYearSummary(window, 10, 100);
    expect(summary.populationDelta).toBe(-5);
  });

  it('sums totalDeaths as delta for the decade', () => {
    // tick 0: 2 deaths, tick 5: 3 deaths — all in first decade window
    const window = makeWindow([
      { deaths: 2, deathsByIllness: 2 },
      {}, {}, {}, {},
      { deaths: 3, deathsByDisaster: 3 },
      {}, {}, {}, {},
    ]);
    const summary = buildTenYearSummary(window, 10, 100);
    expect(summary.totalDeaths).toBe(5);
    expect(summary.deathsByIllness).toBe(2);
    expect(summary.deathsByDisaster).toBe(3);
  });

  it('computes death deltas correctly for second decade', () => {
    const decade1 = makeWindow([
      { deaths: 4, deathsByIllness: 4 },
      {}, {}, {}, {}, {}, {}, {}, {}, {},
    ]);
    const decade2 = makeWindowAfter(decade1, [
      { deaths: 2, deathsBySuicide: 2 },
      {}, {}, {}, {}, {}, {}, {}, {}, {},
    ]);
    const summary = buildTenYearSummary(decade2, 20, 100);
    // Only decade2 deaths should count (not decade1's 4)
    expect(summary.totalDeaths).toBe(2);
    expect(summary.deathsBySuicide).toBe(2);
    expect(summary.deathsByIllness).toBe(0);
  });

  it('averages resourceGini across 10 ticks', () => {
    const window = makeWindow(
      Array.from({ length: 10 }, (_, i) => ({ resourceGini: i * 0.1 })),
    );
    const summary = buildTenYearSummary(window, 10, 100);
    // avg of 0.0, 0.1, … 0.9 = 0.45
    expect(summary.avgResourceGini).toBeCloseTo(0.45, 5);
  });

  it('identifies the peak Gini across the decade', () => {
    const window = makeWindow(
      Array.from({ length: 10 }, (_, i) => ({ resourceGini: i === 7 ? 0.99 : 0.3 })),
    );
    const summary = buildTenYearSummary(window, 10, 100);
    expect(summary.peakResourceGini).toBeCloseTo(0.99, 5);
  });

  it('averages naturalResources across 10 ticks', () => {
    const window = makeWindow(
      Array.from({ length: 10 }, (_, i) => ({ naturalResources: 1000 + i * 100 })),
    );
    const summary = buildTenYearSummary(window, 10, 100);
    // avg of 1000, 1100, … 1900 = 1450
    expect(summary.avgNaturalResources).toBeCloseTo(1450, 4);
  });
});

describe('formatSimulationHeader', () => {
  it('includes n, ticks, and seed', () => {
    const header = formatSimulationHeader(50, 200, 99);
    expect(header).toContain('50 persons');
    expect(header).toContain('200 ticks');
    expect(header).toContain('seed 99');
  });

  it('contains the column header line', () => {
    const header = formatSimulationHeader(100, 100, 42);
    expect(header).toContain('[Yr ---]');
    expect(header).toContain('Gini');
    expect(header).toContain('Deaths');
  });
});

describe('formatDecadeSummary', () => {
  const summary: TenYearSummary = {
    endTick: 10,
    endPopulation: 97,
    populationDelta: -3,
    totalDeaths: 4,
    deathsByOldAge: 0,
    deathsByIllness: 2,
    deathsBySuicide: 1,
    deathsByKilling: 0,
    deathsByDisaster: 1,
    avgResourceGini: 0.42,
    avgResources: 48.2,
    avgHappiness: 4.1,
    avgNaturalResources: 7500,
    peakResourceGini: 0.51,
  };

  it('includes formatted year', () => {
    expect(formatDecadeSummary(summary)).toContain('[Yr 010]');
  });

  it('includes population and delta', () => {
    const line = formatDecadeSummary(summary);
    expect(line).toContain('Pop: 97');
    expect(line).toContain('(-3)');
  });

  it('includes Gini and peak', () => {
    const line = formatDecadeSummary(summary);
    expect(line).toContain('Gini: 0.42');
    expect(line).toContain('peak 0.51');
  });

  it('includes death breakdown', () => {
    const line = formatDecadeSummary(summary);
    expect(line).toContain('ill:2');
    expect(line).toContain('sui:1');
    expect(line).toContain('kill:0');
    expect(line).toContain('dis:1');
    expect(line).toContain('age:0');
  });

  it('formats positive populationDelta with + sign', () => {
    const growthSummary = { ...summary, populationDelta: 5 };
    expect(formatDecadeSummary(growthSummary)).toContain('(+5)');
  });
});

describe('classifyOutcome', () => {
  const baseDecade: TenYearSummary = {
    endTick: 100,
    endPopulation: 90,
    populationDelta: -10,
    totalDeaths: 10,
    deathsByOldAge: 0,
    deathsByIllness: 5,
    deathsBySuicide: 3,
    deathsByKilling: 1,
    deathsByDisaster: 1,
    avgResourceGini: 0.35,
    avgResources: 40,
    avgHappiness: 5.0,
    avgNaturalResources: 5000,
    peakResourceGini: 0.40,
  };

  it('returns COLLAPSE when Gini >= 0.60', () => {
    expect(classifyOutcome({ ...baseDecade, avgResourceGini: 0.60 }, 100)).toBe('COLLAPSE');
    expect(classifyOutcome({ ...baseDecade, avgResourceGini: 0.75 }, 100)).toBe('COLLAPSE');
  });

  it('returns COLLAPSE when population < 20% of start', () => {
    expect(classifyOutcome({ ...baseDecade, endPopulation: 19 }, 100)).toBe('COLLAPSE');
  });

  it('returns THRIVING when Gini < 0.30 and happiness >= 6.0', () => {
    expect(classifyOutcome({ ...baseDecade, avgResourceGini: 0.25, avgHappiness: 6.5 }, 100)).toBe('THRIVING');
  });

  it('does not return THRIVING when Gini >= 0.30', () => {
    const result = classifyOutcome({ ...baseDecade, avgResourceGini: 0.30, avgHappiness: 7.0 }, 100);
    expect(result).not.toBe('THRIVING');
  });

  it('does not return THRIVING when happiness < 6.0', () => {
    const result = classifyOutcome({ ...baseDecade, avgResourceGini: 0.20, avgHappiness: 5.9 }, 100);
    expect(result).not.toBe('THRIVING');
  });

  it('returns STRUGGLING when Gini >= 0.45', () => {
    expect(classifyOutcome({ ...baseDecade, avgResourceGini: 0.45 }, 100)).toBe('STRUGGLING');
  });

  it('returns STRUGGLING when happiness < 3.0', () => {
    expect(classifyOutcome({ ...baseDecade, avgHappiness: 2.9 }, 100)).toBe('STRUGGLING');
  });

  it('returns STABLE otherwise', () => {
    expect(classifyOutcome(baseDecade, 100)).toBe('STABLE');
  });

  it('COLLAPSE takes priority over THRIVING conditions', () => {
    expect(
      classifyOutcome({ ...baseDecade, avgResourceGini: 0.65, avgHappiness: 7.0 }, 100),
    ).toBe('COLLAPSE');
  });
});

describe('formatEndReport', () => {
  it('returns short message when no decades', () => {
    const report = formatEndReport([], 5, 42, 100, 9000, 10000);
    expect(report).toContain('too short');
  });

  it('includes OUTCOME label', () => {
    const decade: TenYearSummary = {
      endTick: 10,
      endPopulation: 90,
      populationDelta: -10,
      totalDeaths: 10,
      deathsByOldAge: 2,
      deathsByIllness: 4,
      deathsBySuicide: 2,
      deathsByKilling: 1,
      deathsByDisaster: 1,
      avgResourceGini: 0.35,
      avgResources: 40,
      avgHappiness: 5.0,
      avgNaturalResources: 5000,
      peakResourceGini: 0.40,
    };
    const report = formatEndReport([decade], 10, 42, 100, 9000, 10000);
    expect(report).toContain('OUTCOME:');
    expect(report).toContain('POPULATION');
    expect(report).toContain('INEQUALITY');
    expect(report).toContain('RESOURCES');
    expect(report).toContain('HAPPINESS');
    expect(report).toContain('DECADE SUMMARY TABLE');
  });
});
