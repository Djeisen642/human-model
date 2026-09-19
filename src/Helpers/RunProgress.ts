/**
 * Live progress reporting for the long-running `scripts/` harnesses.
 *
 * `sweep.ts` and `compare.ts` buffer every row until the last job lands, so a run that is killed
 * — by a shell timeout, by Ctrl-C, or by an operator who has waited long enough — produces nothing
 * at all, however many jobs it had already finished. An 80-minute sweep that dies at minute 79 is
 * a total loss. That is the problem this file exists to fix.
 *
 * The mechanism is a status file rather than a signal handler or a socket: a plain JSON snapshot
 * rewritten after every completed job. A file can be read by anything, at any time, with no
 * cooperation from the running process, and — the part that matters — it *survives the process*.
 * Kill the run and the last snapshot is still on disk with every row it had finished. A SIGUSR1
 * handler that dumped to stdout would have neither property, since the output of a backgrounded
 * run is exactly what is hard to reach.
 *
 * Writes are atomic (temp file plus rename) because a reader may `cat` the file at any instant,
 * including mid-write. Lives in `src/Helpers/` rather than `scripts/` for the reason given in
 * `HarnessOverrides.ts`: harness support that is still worth unit-testing, and `tsconfig`'s
 * `rootDir` will not let a test import across into `scripts/`.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Default status-file path, relative to the repo root. Gitignored. */
export const DEFAULT_PROGRESS_FILE = '.run-progress.json';

/** One completed job's summary, as the calling tool chooses to describe it. */
export type ProgressRow = Record<string, string | number | boolean | null>;

/** A point-in-time snapshot of a harness run, as written to the status file. */
export interface ProgressSnapshot {
  /** Process id of the parent harness process — the one to signal to stop the run. */
  pid: number;
  /** Which harness is running, e.g. 'sweep' or 'compare'. */
  tool: string;
  /** One-line description of the run's configuration, for an operator reading the file cold. */
  label: string;
  /** Epoch milliseconds when the run started. */
  startedAtMs: number;
  /** Epoch milliseconds when this snapshot was written. */
  updatedAtMs: number;
  /** Total jobs the run will dispatch. */
  total: number;
  /** Jobs finished so far. */
  completed: number;
  /** Jobs dispatched to a worker but not yet returned. Distinguishes a slow run from a wedged one. */
  inFlight: number;
  /** Whether the run has stopped (finished normally or was asked to stop). */
  done: boolean;
  /** Summaries of the jobs finished so far, in completion order. */
  rows: ProgressRow[];
}

/**
 * Projected seconds remaining, assuming jobs complete at the average rate observed so far.
 *
 * Returns null before the first job lands, since there is no rate to extrapolate from. The
 * estimate is deliberately naive: sweep jobs are not equal-cost (a config that sustains a large
 * population runs far slower than one that goes extinct early), so this is a floor on the wait,
 * not a promise. An operator wants "minutes or hours", which a mean rate answers well enough.
 *
 * @param completed - jobs finished so far
 * @param total - jobs in the run
 * @param elapsedMs - milliseconds since the run started
 * @returns projected seconds until the last job lands, or null when not yet estimable
 */
export function etaSeconds(completed: number, total: number, elapsedMs: number): number | null {
  if (completed <= 0 || completed >= total || elapsedMs <= 0) return null;
  const msPerJob = elapsedMs / completed;
  return Math.round((msPerJob * (total - completed)) / 1000);
}

/**
 * Render a snapshot as the block an operator reads when they ask what a run is doing.
 *
 * @param snapshot - the snapshot to render
 * @param nowMs - current epoch milliseconds, supplied so the output is testable
 * @returns a multi-line human-readable status block
 */
export function formatProgress(snapshot: ProgressSnapshot, nowMs: number): string {
  const elapsedMs = Math.max(0, nowMs - snapshot.startedAtMs);
  const eta = etaSeconds(snapshot.completed, snapshot.total, elapsedMs);
  const pct = snapshot.total > 0 ? Math.floor((100 * snapshot.completed) / snapshot.total) : 0;
  const staleSec = Math.round((nowMs - snapshot.updatedAtMs) / 1000);

  const lines = [
    `${snapshot.tool} (pid ${snapshot.pid})${snapshot.done ? ' — finished' : ''}`,
    `  ${snapshot.label}`,
    `  ${snapshot.completed}/${snapshot.total} jobs (${pct}%)` +
      (snapshot.done ? '' : `, ${snapshot.inFlight} in flight`) +
      `   elapsed ${formatDuration(Math.round(elapsedMs / 1000))}` +
      (eta === null ? '' : `   eta ~${formatDuration(eta)}`),
  ];
  if (!snapshot.done && staleSec > 0) lines.push(`  last update ${formatDuration(staleSec)} ago`);
  if (snapshot.rows.length > 0) {
    lines.push('');
    lines.push(formatRows(snapshot.rows));
  }
  return lines.join('\n');
}

/**
 * Render completed-job rows as a fixed-width table, columns taken from the first row's keys.
 *
 * @param rows - completed job summaries
 * @returns an aligned table, header included
 */
export function formatRows(rows: ProgressRow[]): string {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const width = (key: string): number => Math.max(
    key.length,
    ...rows.map((r) => String(r[key] ?? '').length),
  );
  const widths = columns.map(width);
  const line = (cells: string[]): string =>
    '  ' + cells.map((c, i) => c.padStart(widths[i])).join('  ');
  return [
    line(columns),
    '  ' + '-'.repeat(widths.reduce((a, b) => a + b, 0) + 2 * (widths.length - 1)),
    ...rows.map((r) => line(columns.map((c) => String(r[c] ?? '')))),
  ].join('\n');
}

/**
 * Format a second count as the coarsest readable unit — an operator wants magnitude, not precision.
 *
 * @param seconds - duration in seconds
 * @returns e.g. '45s', '12m', '1h22m'
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

/**
 * Write a snapshot atomically, so a reader never sees a half-written file.
 *
 * Failures are swallowed: progress reporting is an observability aid, and a full disk or a
 * read-only path must never take down a simulation run that is otherwise healthy.
 *
 * @param filePath - destination path
 * @param snapshot - the snapshot to persist
 */
export function writeProgress(filePath: string, snapshot: ProgressSnapshot): void {
  const temp = `${filePath}.${process.pid}.tmp`;
  try {
    fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(snapshot, null, 2));
    fs.renameSync(temp, filePath);
  } catch {
    try { fs.unlinkSync(temp); } catch { /* nothing left to clean up */ }
  }
}

/**
 * Read a snapshot written by `writeProgress`.
 *
 * @param filePath - path to the status file
 * @returns the snapshot, or null when the file is absent or unreadable
 */
export function readProgress(filePath: string): ProgressSnapshot | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ProgressSnapshot;
  } catch {
    return null;
  }
}
