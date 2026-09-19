import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  etaSeconds, formatDuration, formatProgress, formatRows, readProgress, writeProgress,
  ProgressSnapshot,
} from '../../Helpers/RunProgress';

/**
 * @param over - fields to override on the base snapshot
 * @returns a snapshot for testing
 */
function snap(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    pid: 4242, tool: 'sweep', label: '24 jobs, 8000 ticks, 300 persons',
    startedAtMs: 1_000_000, updatedAtMs: 1_000_000,
    total: 24, completed: 0, inFlight: 0, done: false, rows: [],
    ...over,
  };
}

describe('etaSeconds', () => {
  it('extrapolates from the average rate so far', () => {
    // 6 of 24 done in 60s -> 10s/job -> 18 jobs left -> 180s.
    expect(etaSeconds(6, 24, 60_000)).toBe(180);
  });

  it('is null before any job lands, since there is no rate yet', () => {
    expect(etaSeconds(0, 24, 60_000)).toBeNull();
  });

  it('is null once every job is done', () => {
    expect(etaSeconds(24, 24, 60_000)).toBeNull();
  });

  it('is null when no time has elapsed, rather than dividing by zero', () => {
    expect(etaSeconds(3, 24, 0)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('uses the coarsest readable unit', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(720)).toBe('12m');
    expect(formatDuration(4920)).toBe('1h22m');
  });
});

describe('formatProgress', () => {
  it('reports completion, percentage and eta mid-run', () => {
    const out = formatProgress(snap({ completed: 6, inFlight: 4, updatedAtMs: 1_060_000 }), 1_060_000);
    expect(out).toContain('sweep (pid 4242)');
    expect(out).toContain('6/24 jobs (25%)');
    expect(out).toContain('4 in flight');
    expect(out).toContain('eta ~3m');
  });

  it('shows work in flight when nothing has completed, so slow is not mistaken for wedged', () => {
    const out = formatProgress(snap({ completed: 0, inFlight: 4, updatedAtMs: 1_060_000 }), 1_060_000);
    expect(out).toContain('0/24 jobs (0%)');
    expect(out).toContain('4 in flight');
  });

  it('marks a finished run and omits the eta', () => {
    const out = formatProgress(snap({ completed: 24, done: true, updatedAtMs: 1_060_000 }), 1_060_000);
    expect(out).toContain('finished');
    expect(out).not.toContain('eta');
  });

  it('surfaces staleness, so a wedged run is visible as one', () => {
    const out = formatProgress(snap({ completed: 6, updatedAtMs: 1_060_000 }), 1_960_000);
    expect(out).toContain('last update 15m ago');
  });

  it('includes finished rows', () => {
    const out = formatProgress(snap({ completed: 1, rows: [{ seed: 3, outcome: 'CYCLICAL' }] }), 1_010_000);
    expect(out).toContain('CYCLICAL');
  });
});

describe('formatRows', () => {
  it('aligns columns taken from the first row', () => {
    const table = formatRows([
      { seed: 1, outcome: 'EXTINCTION', endPop: 0 },
      { seed: 12, outcome: 'CYCLICAL', endPop: 462 },
    ]);
    const lines = table.split('\n');
    expect(lines[0]).toContain('seed');
    expect(lines).toHaveLength(4);
    // Every rendered line shares a width, which is what makes the table readable.
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });

  it('returns empty for no rows', () => {
    expect(formatRows([])).toBe('');
  });
});

describe('writeProgress / readProgress', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('round-trips a snapshot', () => {
    const file = path.join(dir, 'p.json');
    const s = snap({ completed: 3, rows: [{ seed: 1, outcome: 'STABLE' }] });
    writeProgress(file, s);
    expect(readProgress(file)).toEqual(s);
  });

  it('leaves no temp file behind, so a reader never sees a half-written snapshot', () => {
    const file = path.join(dir, 'p.json');
    writeProgress(file, snap());
    expect(fs.readdirSync(dir)).toEqual(['p.json']);
  });

  it('creates missing parent directories', () => {
    const file = path.join(dir, 'nested', 'deeper', 'p.json');
    writeProgress(file, snap());
    expect(readProgress(file)).not.toBeNull();
  });

  it('returns null rather than throwing when the file is absent', () => {
    expect(readProgress(path.join(dir, 'nope.json'))).toBeNull();
  });

  it('returns null rather than throwing on malformed JSON', () => {
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, '{not json');
    expect(readProgress(file)).toBeNull();
  });

  it('swallows write failures, since observability must not kill a healthy run', () => {
    // A directory where the file should go: the write cannot succeed, but must not throw.
    const file = path.join(dir, 'blocked');
    fs.mkdirSync(file);
    expect(() => writeProgress(file, snap())).not.toThrow();
  });
});
