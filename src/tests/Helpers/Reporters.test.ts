import { TickSnapshot } from '../../App/Simulation';
import {
  buildTenYearSummary,
  classifyOutcome,
  explainOutcome,
  formatDecadeSummary,
  formatSimulationHeader,
  formatEndReport,
  formatSurvivorSection,
  share,
  summarizeSurvivors,
} from '../../Helpers/Reporters';
import { TenYearSummary } from '../../Helpers/Types';
import Constants from '../../Helpers/Constants';
import Person from '../../App/Person';
import DeathRecord from '../../Records/DeathRecord';
import { CycleMetrics } from '../../Helpers/CycleDetector';

/** No confirmed cycle — the default for tests that don't exercise the CYCLICAL dimension. */
const NOT_CYCLING: CycleMetrics = { numCycles: 0, period: 0, amplitude: 1, troughTrend: 1, stableCycle: false, extinct: false, troughValues: [] };
/** A confirmed, non-ratcheting boom-bust cycle. */
const CYCLING: CycleMetrics = { numCycles: 3, period: 250, amplitude: 2, troughTrend: 0.9, stableCycle: true, extinct: false, troughValues: [100, 95, 90] };
/** An oscillation whose troughs ratchet down — not a stable cycle (ARD 063's `stableCycle` gate). */
const DECAYING_CYCLE: CycleMetrics = { numCycles: 3, period: 250, amplitude: 2, troughTrend: 0.3, stableCycle: false, extinct: false, troughValues: [100, 55, 30] };

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
  const births = overrides.births ?? 0;

  return {
    tick,
    population: overrides.population ?? 100,
    deaths,
    deathsByMurder,
    deathsByIllness,
    deathsByDisaster,
    deathsBySuicide,
    cumulativeDeaths: (prev?.cumulativeDeaths ?? 0) + deaths,
    cumulativeDeathsByMurder: (prev?.cumulativeDeathsByMurder ?? 0) + deathsByMurder,
    cumulativeDeathsByIllness: (prev?.cumulativeDeathsByIllness ?? 0) + deathsByIllness,
    cumulativeDeathsByDisaster: (prev?.cumulativeDeathsByDisaster ?? 0) + deathsByDisaster,
    cumulativeDeathsBySuicide: (prev?.cumulativeDeathsBySuicide ?? 0) + deathsBySuicide,
    averageResources: overrides.averageResources ?? 50,
    resourceGini: overrides.resourceGini ?? 0.3,
    averageHappiness: overrides.averageHappiness ?? 5.0,
    aggregateKillingIntent: 0,
    aggregateStealingIntent: 0,
    naturalResources: overrides.naturalResources ?? 8000,
    extractionProductivity: overrides.extractionProductivity ?? 1.0,
    naturalResourceCeiling: overrides.naturalResourceCeiling ?? 10000,
    births,
    cumulativeBirths: (prev?.cumulativeBirths ?? 0) + births,
    communityPool: overrides.communityPool ?? 0,
    averageIllness: overrides.averageIllness ?? 0,
    employmentRate: overrides.employmentRate ?? 0,
    stealsCommitted: overrides.stealsCommitted ?? 0,
    jailedPopulation: overrides.jailedPopulation ?? 0,
    totalCoupleCount: overrides.totalCoupleCount ?? 0,
    fertileCoupleCount: overrides.fertileCoupleCount ?? 0,
    averageAge: overrides.averageAge ?? 35,
    medianAge: overrides.medianAge ?? 35,
    totalConsumption: overrides.totalConsumption ?? 0,
    educationCounts: overrides.educationCounts ?? [0, 0, 0, 0, 0, 0],
    childPopulation: overrides.childPopulation ?? 0,
    orphanCount: overrides.orphanCount ?? 0,
    welfareRecipients: overrides.welfareRecipients ?? 0,
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

  it('averages orphan and child counts across the window', () => {
    const window = makeWindow([
      { orphanCount: 2, childPopulation: 10 },
      { orphanCount: 4, childPopulation: 10 },
      { orphanCount: 0, childPopulation: 20 },
      {}, {}, {}, {}, {}, {}, {},
    ]);
    const summary = buildTenYearSummary(window, 10, 100);
    expect(summary.avgOrphanCount).toBeCloseTo(6 / 10, 5);
    expect(summary.avgChildPopulation).toBeCloseTo(40 / 10, 5);
  });

  it('averages welfare recipients and population across the window', () => {
    const window = makeWindow([
      { welfareRecipients: 10, population: 100 },
      { welfareRecipients: 30, population: 100 },
      {}, {}, {}, {}, {}, {}, {}, {},
    ]);
    const summary = buildTenYearSummary(window, 10, 100);
    expect(summary.avgWelfareRecipients).toBeCloseTo(40 / 10, 5);
    expect(summary.avgPopulation).toBeCloseTo(100, 5);
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

  it('computes births delta from cumulativeBirths (ARD 033)', () => {
    const window = makeWindow([
      { births: 2 }, {}, { births: 1 }, {}, {}, {}, { births: 3 }, {}, {}, {},
    ]);
    const summary = buildTenYearSummary(window, 10, 100);
    expect(summary.births).toBe(6);
  });

  it('computes correct births delta in second decade', () => {
    const decade1 = makeWindow([
      { births: 5 }, {}, {}, {}, {}, {}, {}, {}, {}, {},
    ]);
    const decade2 = makeWindowAfter(decade1, [
      { births: 2 }, {}, {}, {}, {}, {}, {}, {}, {}, {},
    ]);
    const summary = buildTenYearSummary(decade2, 20, 100);
    expect(summary.births).toBe(2);
  });

  it('accepts a partial window (length < 10) for ARD 031 trailing summary', () => {
    const prior = makeWindow([
      { deaths: 3, deathsByIllness: 3 }, {}, {}, {}, {}, {}, {}, {}, {}, {},
    ]);
    const lastFull = prior[prior.length - 1];
    const partial: TickSnapshot[] = [];
    let prev = lastFull;
    for (let i = 0; i < 5; i++) {
      const snap = makeSnapshot(10 + i, { deaths: 1, deathsByIllness: 1, births: 1 }, prev);
      partial.push(snap);
      prev = snap;
    }
    const summary = buildTenYearSummary(partial, 15, lastFull.population);
    expect(summary.endTick).toBe(15);
    expect(summary.totalDeaths).toBe(5);
    expect(summary.deathsByIllness).toBe(5);
    expect(summary.births).toBe(5);
  });
});

describe('formatSimulationHeader', () => {
  it('includes n, ticks, and seed', () => {
    const header = formatSimulationHeader(50, 200, 99);
    expect(header).toContain('50 persons');
    expect(header).toContain('200 ticks');
    expect(header).toContain('seed 99');
  });


});

describe('formatDecadeSummary', () => {
  const summary: TenYearSummary = {
    endTick: 10,
    endPopulation: 97,
    populationDelta: -3,
    totalDeaths: 4,
    deathsByIllness: 2,
    deathsBySuicide: 1,
    deathsByKilling: 0,
    deathsByDisaster: 1,
    avgResourceGini: 0.42,
    avgResources: 48.2,
    avgHappiness: 4.1,
    avgNaturalResources: 7500, avgNaturalResourceCeiling: 10000,
    peakResourceGini: 0.51,
    births: 2,
    avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
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

  it('includes the decade-average orphan count', () => {
    expect(formatDecadeSummary(summary)).toContain('Orphans: 2.0');
  });

  it('includes death breakdown', () => {
    const line = formatDecadeSummary(summary);
    expect(line).toContain('ill:2');
    expect(line).toContain('sui:1');
    expect(line).toContain('kill:0');
    expect(line).toContain('dis:1');
  });

  it('formats positive populationDelta with + sign', () => {
    const growthSummary = { ...summary, populationDelta: 5 };
    expect(formatDecadeSummary(growthSummary)).toContain('(+5)');
  });
});

describe('classifyOutcome (multi-dimensional, ARD 051)', () => {
  // A healthy decade at peak population with a half-full commons: gini and happiness in the
  // middle band, so it reads STABLE on its own and isolates each dimension under test.
  const baseDecade: TenYearSummary = {
    endTick: 100,
    endPopulation: 100,
    populationDelta: 0,
    totalDeaths: 10,
    deathsByIllness: 5,
    deathsBySuicide: 3,
    deathsByKilling: 1,
    deathsByDisaster: 1,
    avgResourceGini: 0.35,
    avgResources: 40,
    avgHappiness: 5.0,
    avgNaturalResources: 5000,
    avgNaturalResourceCeiling: 10000,
    peakResourceGini: 0.40,
    births: 0,
    avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
  };

  /**
   * Classify a single final decade against a starting population (the common case).
   *
   * @param d - the final decade summary
   * @param start - starting population
   * @param cycles - cycle metrics for the run; defaults to no confirmed cycle
   * @returns the outcome label
   */
  const one = (d: TenYearSummary, start = 100, cycles: CycleMetrics = NOT_CYCLING): string =>
    classifyOutcome([d], start, cycles);

  it('returns COLLAPSE when Gini >= 0.60', () => {
    expect(one({ ...baseDecade, avgResourceGini: 0.60 })).toBe('COLLAPSE');
    expect(one({ ...baseDecade, avgResourceGini: 0.75 })).toBe('COLLAPSE');
  });

  it('returns COLLAPSE on severe decline from peak even when end exceeds start', () => {
    // Peak 400, final 150 → 62% decline. Final (150) is still above start (100), so the old
    // start-relative check read this as healthy; peak-relative catches it.
    const peak = { ...baseDecade, endTick: 50, endPopulation: 400 };
    const final = { ...baseDecade, endPopulation: 150 };
    expect(classifyOutcome([peak, final], 100, NOT_CYCLING)).toBe('COLLAPSE');
  });

  it('returns STRUGGLING when Gini >= 0.45', () => {
    expect(one({ ...baseDecade, avgResourceGini: 0.45 })).toBe('STRUGGLING');
  });

  it('returns STRUGGLING when happiness < 3.0', () => {
    expect(one({ ...baseDecade, avgHappiness: 2.9 })).toBe('STRUGGLING');
  });

  it('returns STRUGGLING on moderate decline from peak (>= 25%, < 50%)', () => {
    const peak = { ...baseDecade, endTick: 50, endPopulation: 200 };
    const final = { ...baseDecade, endPopulation: 150 };
    expect(classifyOutcome([peak, final], 100, NOT_CYCLING)).toBe('STRUGGLING');
  });

  it('returns STRUGGLING when the commons is exhausted (< 10% of ceiling)', () => {
    expect(one({ ...baseDecade, avgNaturalResources: 500 })).toBe('STRUGGLING');
  });

  it('returns STABLE otherwise', () => {
    expect(one(baseDecade)).toBe('STABLE');
  });

  it('returns EXTINCTION when endPopulation is 0 (ARD 031)', () => {
    expect(one({ ...baseDecade, endPopulation: 0 })).toBe('EXTINCTION');
  });

  it('EXTINCTION takes priority over COLLAPSE conditions', () => {
    expect(one({ ...baseDecade, endPopulation: 0, avgResourceGini: 0.75 })).toBe('EXTINCTION');
  });

  it('endPopulation 1 stays COLLAPSE (boundary), not EXTINCTION', () => {
    const result = one({ ...baseDecade, endPopulation: 1 });
    expect(result).toBe('COLLAPSE');
    expect(result).not.toBe('EXTINCTION');
  });

  describe('CYCLICAL (ARD 063)', () => {
    it('returns CYCLICAL for a confirmed stable cycle with acceptable Gini/happiness/commons, even deep in peak-relative decline', () => {
      // Same shape as the COLLAPSE-by-decline case above (62% down from peak), but confirmed cycling.
      const peak = { ...baseDecade, endTick: 50, endPopulation: 400 };
      const final = { ...baseDecade, endPopulation: 150 };
      expect(classifyOutcome([peak, final], 100, CYCLING)).toBe('CYCLICAL');
    });

    it('COLLAPSE by inequality overrides a confirmed stable cycle', () => {
      expect(one({ ...baseDecade, avgResourceGini: 0.65 }, 100, CYCLING)).toBe('COLLAPSE');
    });

    it('STRUGGLING by low happiness overrides a confirmed stable cycle', () => {
      expect(one({ ...baseDecade, avgHappiness: 2.9 }, 100, CYCLING)).toBe('STRUGGLING');
    });

    it('STRUGGLING by depleted commons overrides a confirmed stable cycle', () => {
      expect(one({ ...baseDecade, avgNaturalResources: 500 }, 100, CYCLING)).toBe('STRUGGLING');
    });

    it('peak-decline still applies when cycles are too few to confirm a stable cycle', () => {
      const peak = { ...baseDecade, endTick: 50, endPopulation: 400 };
      const final = { ...baseDecade, endPopulation: 150 };
      expect(classifyOutcome([peak, final], 100, NOT_CYCLING)).toBe('COLLAPSE');
    });

    it('a decaying-envelope oscillation (ratcheting troughs) is read as decline, not CYCLICAL', () => {
      const peak = { ...baseDecade, endTick: 50, endPopulation: 400 };
      const final = { ...baseDecade, endPopulation: 150 };
      expect(classifyOutcome([peak, final], 100, DECAYING_CYCLE)).toBe('COLLAPSE');
    });
  });
});

describe('explainOutcome', () => {
  const base: TenYearSummary = {
    endTick: 100, endPopulation: 90, populationDelta: -10, totalDeaths: 10,
    deathsByIllness: 5, deathsBySuicide: 3,
    deathsByKilling: 1, deathsByDisaster: 1,
    avgResourceGini: 0.35, avgResources: 40, avgHappiness: 5.0,
    avgNaturalResources: 5000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.40, births: 0,
    avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
  };

  it('EXTINCTION cites population 0', () => {
    expect(explainOutcome([{ ...base, endPopulation: 0 }], 100, 'EXTINCTION', NOT_CYCLING)).toContain('Population');
  });

  it('COLLAPSE by Gini cites the Gini value', () => {
    expect(explainOutcome([{ ...base, avgResourceGini: 0.65 }], 100, 'COLLAPSE', NOT_CYCLING)).toContain('Gini');
  });

  it('COLLAPSE by peak decline cites the population drop', () => {
    const peak = { ...base, endTick: 50, endPopulation: 400 };
    const final = { ...base, endPopulation: 100 };
    expect(explainOutcome([peak, final], 100, 'COLLAPSE', NOT_CYCLING)).toMatch(/Population.*from peak/);
  });

  it('CYCLICAL cites cycle count and trough trend', () => {
    expect(explainOutcome([{ ...base, avgResourceGini: 0.2, avgHappiness: 7 }], 100, 'CYCLICAL', CYCLING))
      .toMatch(/cycles.*trough trend/);
  });

  it('STRUGGLING by exhausted commons cites ecological strain', () => {
    expect(explainOutcome([{ ...base, avgNaturalResources: 200 }], 100, 'STRUGGLING', NOT_CYCLING))
      .toMatch(/commons|ecological/i);
  });
});

describe('share', () => {
  it('divides the part by the whole', () => {
    expect(share(3, 12)).toBeCloseTo(0.25, 5);
  });

  it('returns 0 when the cohort is empty', () => {
    expect(share(0, 0)).toBe(0);
  });
});

describe('summarizeSurvivors (ARD 031)', () => {
  /**
   * @param overrides - partial Person fields
   * @returns Person with given fields
   */
  function makePerson(overrides: Partial<Person>): Person {
    const p = new Person([]);
    Object.assign(p, overrides);
    return p;
  }

  it('returns zeros for empty population', () => {
    const s = summarizeSurvivors([]);
    expect(s.total).toBe(0);
    expect(s.children).toBe(0);
    expect(s.working).toBe(0);
    expect(s.elderly).toBe(0);
    expect(s.avgIllness).toBe(0);
  });

  it('classifies age into child/working/elderly buckets', () => {
    const s = summarizeSurvivors([
      makePerson({ age: 10 }),
      makePerson({ age: 17 }),
      makePerson({ age: 18 }),
      makePerson({ age: 65 }),
      makePerson({ age: 66 }),
      makePerson({ age: 80 }),
    ]);
    expect(s.children).toBe(2);
    expect(s.working).toBe(2);
    expect(s.elderly).toBe(2);
  });

  it('counts education levels and currently enrolled', () => {
    const s = summarizeSurvivors([
      makePerson({ age: 30, education: Constants.EDUCATION.NONE }),
      makePerson({ age: 30, education: Constants.EDUCATION.HIGH_SCHOOL }),
      makePerson({ age: 30, education: Constants.EDUCATION.BACHELORS }),
      makePerson({ age: 30, education: Constants.EDUCATION.PHD }),
      makePerson({ age: 20, isWorkingOnEd: Constants.EDUCATION.BACHELORS }),
    ]);
    expect(s.educationCounts[Constants.EDUCATION.NONE]).toBe(2);
    expect(s.educationCounts[Constants.EDUCATION.HIGH_SCHOOL]).toBe(1);
    expect(s.educationCounts[Constants.EDUCATION.BACHELORS]).toBe(1);
    expect(s.educationCounts[Constants.EDUCATION.PHD]).toBe(1);
    expect(s.enrolled).toBe(1);
  });

  it('counts employed only within working-age band', () => {
    const s = summarizeSurvivors([
      makePerson({ age: 30, hasJob: true }),
      makePerson({ age: 70, hasJob: true }),     // elderly: excluded from employed count
      makePerson({ age: 10, hasJob: true }),     // child: excluded from employed count
      makePerson({ age: 40, hasJob: false }),
    ]);
    expect(s.employed).toBe(1);
    expect(s.working).toBe(2);
  });

  it('buckets illness severity correctly', () => {
    const s = summarizeSurvivors([
      makePerson({ age: 30, illness: 0 }),
      makePerson({ age: 30, illness: 0.05 }),
      makePerson({ age: 30, illness: 0.1 }),
      makePerson({ age: 30, illness: 0.3 }),
      makePerson({ age: 30, illness: 0.5 }),
      makePerson({ age: 30, illness: 0.9 }),
    ]);
    expect(s.healthWell).toBe(2);
    expect(s.healthMild).toBe(2);
    expect(s.healthSevere).toBe(2);
    expect(s.avgIllness).toBeCloseTo((0 + 0.05 + 0.1 + 0.3 + 0.5 + 0.9) / 6, 5);
  });

  it('counts family/relationships', () => {
    const a = makePerson({ age: 30 });
    const b = makePerson({ age: 30 });
    a.isInRelationshipWith = b;
    b.isInRelationshipWith = a;
    const c = makePerson({ age: 30 });
    c.hasChildren.push(new Person([]));
    const s = summarizeSurvivors([a, b, c]);
    expect(s.partnered).toBe(2);
    expect(s.withChildren).toBe(1);
  });

  it('counts orphans as children with no living parent', () => {
    const livingParent = makePerson({ age: 40 });
    const deadParent = makePerson({ age: 40 });
    deadParent.causeOfDeath = new DeathRecord(Constants.CAUSE_OF_DEATH.ILLNESS);

    const parented = new Person([livingParent]);
    parented.age = 5;
    const bereaved = new Person([deadParent]);
    bereaved.age = 5;
    const neverParented = makePerson({ age: 5 });
    const parentlessAdult = makePerson({ age: 30 });

    const s = summarizeSurvivors([livingParent, parented, bereaved, neverParented, parentlessAdult]);
    expect(s.orphans).toBe(2);
    expect(s.children).toBe(3);
  });
});

describe('formatSurvivorSection (ARD 031)', () => {
  it('renders SURVIVORS header with total', () => {
    const s = summarizeSurvivors([new Person([])]);
    const lines = formatSurvivorSection(s);
    expect(lines[0]).toBe('SURVIVORS (1)');
  });

  it('renders the orphan count and its share of children', () => {
    const deadParent = new Person([]);
    deadParent.age = 40;
    deadParent.causeOfDeath = new DeathRecord(Constants.CAUSE_OF_DEATH.ILLNESS);
    const orphaned = new Person([deadParent]);
    orphaned.age = 5;
    const parented = new Person([new Person([])]);
    parented.age = 5;

    const lines = formatSurvivorSection(summarizeSurvivors([orphaned, parented]));
    const familyLine = lines.find(l => l.includes('Family'));
    expect(familyLine).toContain('orphans 1 of 2 children (50.0%)');
  });

  it('renders the orphan share without NaN when no children survive', () => {
    const adult = new Person([]);
    adult.age = 40;
    const lines = formatSurvivorSection(summarizeSurvivors([adult]));
    const familyLine = lines.find(l => l.includes('Family'));
    expect(familyLine).toContain('orphans 0');
    expect(familyLine).not.toMatch(/NaN/);
  });

  it('handles zero working-age band without producing NaN', () => {
    const p = new Person([]);
    p.age = 10;
    const lines = formatSurvivorSection(summarizeSurvivors([p]));
    const employmentLine = lines.find(l => l.includes('Employment'));
    expect(employmentLine).toBeDefined();
    expect(employmentLine).not.toMatch(/NaN/);
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
      deathsByIllness: 4,
      deathsBySuicide: 2,
      deathsByKilling: 1,
      deathsByDisaster: 1,
      avgResourceGini: 0.35,
      avgResources: 40,
      avgHappiness: 5.0,
      avgNaturalResources: 5000, avgNaturalResourceCeiling: 10000,
      peakResourceGini: 0.40,
      births: 0,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const report = formatEndReport([decade], 10, 42, 100, 9000, 10000);
    expect(report).toContain('OUTCOME:');
    expect(report).toContain('POPULATION');
    expect(report).toContain('INEQUALITY');
    expect(report).toContain('RESOURCES');
    expect(report).toContain('HAPPINESS');
    expect(report).toContain('DECADE SUMMARY TABLE');
  });

  it('omits COHORT SURVIVAL section when no personTypes (ARD 030)', () => {
    const decade: TenYearSummary = {
      endTick: 10, endPopulation: 90, populationDelta: -10, totalDeaths: 10,
      deathsByIllness: 4, deathsBySuicide: 2,
      deathsByKilling: 1, deathsByDisaster: 1,
      avgResourceGini: 0.35, avgResources: 40, avgHappiness: 5.0,
      avgNaturalResources: 5000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.40, births: 0,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const report = formatEndReport([decade], 10, 42, 100, 9000, 10000);
    expect(report).not.toContain('COHORT SURVIVAL');
  });

  it('includes Reason line below OUTCOME (ARD 016 / ARD 031)', () => {
    const decade: TenYearSummary = {
      endTick: 100, endPopulation: 90, populationDelta: -10, totalDeaths: 10,
      deathsByIllness: 4, deathsBySuicide: 2,
      deathsByKilling: 1, deathsByDisaster: 1,
      avgResourceGini: 0.35, avgResources: 40, avgHappiness: 5.0,
      avgNaturalResources: 5000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.40, births: 5,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const report = formatEndReport([decade], 100, 42, 100, 9000, 10000);
    expect(report).toMatch(/Reason: /);
  });

  it('shows EXTINCTION outcome with extinct-as-of callout when population reaches 0 (ARD 031)', () => {
    const decade: TenYearSummary = {
      endTick: 50, endPopulation: 0, populationDelta: -100, totalDeaths: 100,
      deathsByIllness: 50, deathsBySuicide: 20,
      deathsByKilling: 15, deathsByDisaster: 10,
      avgResourceGini: 0.40, avgResources: 5, avgHappiness: 1.0,
      avgNaturalResources: 8000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.55, births: 0,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const report = formatEndReport(
      [decade], 50, 42, 100, 9000, 10000, {}, {}, [], 42,
    );
    expect(report).toContain('OUTCOME: EXTINCTION');
    expect(report).toContain('Extinct as of Yr 042');
  });

  it('omits SURVIVORS section when no living persons (ARD 031)', () => {
    const decade: TenYearSummary = {
      endTick: 50, endPopulation: 0, populationDelta: -100, totalDeaths: 100,
      deathsByIllness: 50, deathsBySuicide: 20,
      deathsByKilling: 15, deathsByDisaster: 10,
      avgResourceGini: 0.40, avgResources: 5, avgHappiness: 1.0,
      avgNaturalResources: 8000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.55, births: 0,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const report = formatEndReport([decade], 50, 42, 100, 9000, 10000, {}, {}, []);
    expect(report).not.toContain('SURVIVORS');
  });

  it('includes SURVIVORS section when there are living persons (ARD 031)', () => {
    const decade: TenYearSummary = {
      endTick: 100, endPopulation: 1, populationDelta: -99, totalDeaths: 99,
      deathsByIllness: 50, deathsBySuicide: 20,
      deathsByKilling: 19, deathsByDisaster: 10,
      avgResourceGini: 0.30, avgResources: 30, avgHappiness: 5.0,
      avgNaturalResources: 5000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.40, births: 0,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const p = new Person([]);
    p.age = 30;
    p.education = Constants.EDUCATION.BACHELORS;
    p.hasJob = true;
    const report = formatEndReport([decade], 100, 42, 100, 9000, 10000, {}, {}, [p]);
    expect(report).toContain('SURVIVORS (1)');
    expect(report).toContain('working');
  });

  it('includes Inventions line in RESOURCES section (ARD 032)', () => {
    const decade: TenYearSummary = {
      endTick: 100, endPopulation: 80, populationDelta: -20, totalDeaths: 20,
      deathsByIllness: 10, deathsBySuicide: 2,
      deathsByKilling: 2, deathsByDisaster: 1,
      avgResourceGini: 0.30, avgResources: 40, avgHappiness: 5.0,
      avgNaturalResources: 7000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.40, births: 5,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const report = formatEndReport(
      [decade], 100, 42, 100, 7000, 10500, {}, {}, [], undefined, 0.85,
      { faster: 3, slower: 5, ceiling: 2 },
    );
    expect(report).toContain('Inventions: 3 faster  5 slower  2 ceiling');
    expect(report).toContain('final efficiency: 0.85');
  });

  it('includes Births and net in POPULATION section (ARD 033)', () => {
    const decade: TenYearSummary = {
      endTick: 100, endPopulation: 95, populationDelta: -5, totalDeaths: 25,
      deathsByIllness: 10, deathsBySuicide: 5,
      deathsByKilling: 3, deathsByDisaster: 2,
      avgResourceGini: 0.30, avgResources: 40, avgHappiness: 5.0,
      avgNaturalResources: 5000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.40, births: 20,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const report = formatEndReport([decade], 100, 42, 100, 9000, 10000);
    expect(report).toContain('Births: 20');
    expect(report).toContain('Deaths: 25');
    expect(report).toContain('net: -5');
  });

  it('includes Births column in DECADE SUMMARY TABLE (ARD 033)', () => {
    const decade: TenYearSummary = {
      endTick: 10, endPopulation: 100, populationDelta: 0, totalDeaths: 3,
      deathsByIllness: 2, deathsBySuicide: 0,
      deathsByKilling: 1, deathsByDisaster: 0,
      avgResourceGini: 0.30, avgResources: 50, avgHappiness: 5.0,
      avgNaturalResources: 8000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.35, births: 3,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const report = formatEndReport([decade], 10, 42, 100, 9000, 10000);
    expect(report).toContain('Births');
  });

  it('includes an Orphans trend line in POPULATION and a column in the decade table', () => {
    const first: TenYearSummary = {
      endTick: 10, endPopulation: 100, populationDelta: 0, totalDeaths: 3,
      deathsByIllness: 2, deathsBySuicide: 0,
      deathsByKilling: 1, deathsByDisaster: 0,
      avgResourceGini: 0.30, avgResources: 50, avgHappiness: 5.0,
      avgNaturalResources: 8000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.35, births: 3,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 1,
      avgWelfareRecipients: 10, avgPopulation: 100,
    };
    const last: TenYearSummary = { ...first, endTick: 20, avgChildPopulation: 20, avgOrphanCount: 5 };
    const report = formatEndReport([first, last], 20, 42, 100, 9000, 10000);
    expect(report).toContain('Orphans: 1.0 (5%) → 5.0 (25%)');
    expect(report).toContain('peak 5.0 (Yr 020)');
    expect(report).toMatch(/Yr\s+Pop\s+ΔPop\s+Births\s+Orphans/);
  });

  it('includes an On welfare trend line in RESOURCES and a column in the decade table', () => {
    const first: TenYearSummary = {
      endTick: 10, endPopulation: 100, populationDelta: 0, totalDeaths: 3,
      deathsByIllness: 2, deathsBySuicide: 0,
      deathsByKilling: 1, deathsByDisaster: 0,
      avgResourceGini: 0.30, avgResources: 50, avgHappiness: 5.0,
      avgNaturalResources: 8000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.35, births: 3,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 1,
      avgWelfareRecipients: 12, avgPopulation: 100,
    };
    const last: TenYearSummary = { ...first, endTick: 20, avgWelfareRecipients: 45, avgPopulation: 90 };
    const report = formatEndReport([first, last], 20, 42, 100, 9000, 10000);
    expect(report).toContain('On welfare: 12.0 (12%) → 45.0 (50%)');
    expect(report).toContain('peak 45.0 (Yr 020)');
    expect(report).toMatch(/Orphans\s+Welfare\s+Gini/);
  });

  it('reports a 0% orphan share rather than NaN when no children exist', () => {
    const decade: TenYearSummary = {
      endTick: 10, endPopulation: 100, populationDelta: 0, totalDeaths: 0,
      deathsByIllness: 0, deathsBySuicide: 0,
      deathsByKilling: 0, deathsByDisaster: 0,
      avgResourceGini: 0.30, avgResources: 50, avgHappiness: 5.0,
      avgNaturalResources: 8000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.35, births: 0,
      avgCommunityPool: 0, avgChildPopulation: 0, avgOrphanCount: 0,
      avgWelfareRecipients: 0, avgPopulation: 0,
    };
    const report = formatEndReport([decade], 10, 42, 100, 9000, 10000);
    expect(report).toContain('Orphans: 0.0 (0%)');
    expect(report).not.toMatch(/NaN/);
  });

  it('includes COHORT SURVIVAL section when personTypes are supplied (ARD 030)', () => {
    const decade: TenYearSummary = {
      endTick: 10, endPopulation: 90, populationDelta: -10, totalDeaths: 10,
      deathsByIllness: 4, deathsBySuicide: 2,
      deathsByKilling: 1, deathsByDisaster: 1,
      avgResourceGini: 0.35, avgResources: 40, avgHappiness: 5.0,
      avgNaturalResources: 5000, avgNaturalResourceCeiling: 10000, peakResourceGini: 0.40, births: 0,
      avgCommunityPool: 0, avgChildPopulation: 20, avgOrphanCount: 2, avgWelfareRecipients: 10, avgPopulation: 100,
    };
    // 5 engineers seeded (intelligence in [7,11)), 3 alive at end
    /**
     * @returns a person with intelligence 8 (within engineer range)
     */
    const makeEngineer = (): Person => {
      const p = new Person([]);
      p.intelligence = 8;
      return p;
    };
    const living = [makeEngineer(), makeEngineer(), makeEngineer()];
    const personTypes = {
      engineer: { percentage: 0.05, ranges: { intelligence: [7, 11] as [number, number] } },
    };
    const report = formatEndReport(
      [decade], 10, 42, 100, 9000, 10000,
      personTypes, { engineer: 5 }, living,
    );
    expect(report).toContain('COHORT SURVIVAL');
    expect(report).toContain('engineer');
    expect(report).toContain('5');
    expect(report).toContain('3');
    expect(report).toMatch(/-2/);
  });
});
