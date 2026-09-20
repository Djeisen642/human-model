/**
 * Fork-based worker pool shared by the sweep and compare harnesses.
 *
 * Both tools run the same shape of work: a list of independent simulation jobs, each of which
 * mutates the static `Variables` class before running. That mutation is why the pool forks
 * processes rather than using threads or `Promise.all` — every job needs its own copy of
 * `Variables`, and process isolation is the only thing that guarantees one job's overrides cannot
 * leak into another's run.
 *
 * A script using this pool is both parent and worker: it re-forks its own file with `--worker`,
 * and the forked copy serves jobs instead of running `main()`. Results come back in job order, so
 * the parallelism is invisible to the caller.
 */

import { fork } from 'child_process';

/** How long an aborted dispatch waits for workers to exit on their own before killing them. */
const ABORT_GRACE_MS = 2000;

/** A job dispatched to a worker, tagged with its position in the caller's job list. */
interface JobMsg<J> { type: 'job'; index: number; job: J }
/** Instruction for a worker to exit. */
interface DoneMsg { type: 'done' }
type ParentMsg<J> = JobMsg<J> | DoneMsg;

/** Whether this process was forked as a worker rather than invoked directly. */
export function isWorkerProcess(): boolean {
  return process.argv.includes('--worker');
}

/**
 * Serve jobs forever in a forked worker: run each one and post the result back to the parent.
 *
 * @param run - executes one job; rejections exit the worker non-zero so the parent fails loudly
 */
export function serveWorker<J, R>(run: (job: J) => Promise<R>): void {
  process.on('message', (msg: ParentMsg<J>) => {
    if (msg.type === 'done') { process.exit(0); }
    run(msg.job).then((result) => {
      process.send!({ type: 'result', index: msg.index, result });
    }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });
  process.send!({ type: 'ready' });
}

/** Optional hooks for observing or stopping a dispatch mid-flight. */
export interface DispatchOptions<R> {
  /** Called as each job lands, so a caller can report progress before the run completes. */
  onProgress?: (completed: number, total: number, index: number, result: R) => void;
  /** Called when a job is handed to a worker, so a caller can report work in flight. */
  onDispatch?: (inFlight: number, index: number) => void;
  /**
   * Requests a graceful stop. In-flight jobs are allowed to finish, no further jobs are
   * dispatched, and the promise resolves with a sparse array holding whatever completed. This is
   * what makes an interrupted run salvageable rather than a total loss.
   */
  signal?: { aborted: boolean; addEventListener: (type: 'abort', listener: () => void) => void };
}

/**
 * Run every job across a pool of forked copies of `file`, resolving with results in job order.
 *
 * Entries are undefined only when `options.signal` aborted the run before that job finished; an
 * uninterrupted dispatch always fills every slot.
 *
 * @param jobs - the work items, serialised over IPC so they must be plain JSON-safe data
 * @param workerCount - maximum processes to fork; capped at the job count and floored at 1
 * @param file - the calling script's `__filename`; forked with `--worker` to serve jobs
 * @param options - progress and cancellation hooks
 * @returns each job's result in the order the jobs were given, sparse if aborted
 */
export function dispatch<J, R>(
  jobs: J[], workerCount: number, file: string, options: DispatchOptions<R> = {},
): Promise<(R | undefined)[]> {
  return new Promise((resolve, reject) => {
    const results: (R | undefined)[] = new Array(jobs.length);
    const nWorkers = Math.max(1, Math.min(workerCount, jobs.length));
    const children: ReturnType<typeof fork>[] = [];
    let next = 0;
    let remaining = jobs.length;
    let settled = false;
    let completed = 0;
    let inFlight = 0;
    let aborted = options.signal?.aborted ?? false;

    if (jobs.length === 0) { resolve(results); return; }

    const finish = (): void => {
      if (settled) return;
      settled = true;
      // Tell every worker to exit so their IPC channels close and the parent can terminate.
      for (const c of children) if (c.connected) c.send({ type: 'done' });
      if (aborted) {
        // A worker only reads `done` between jobs, and a run is usually aborted precisely because
        // a job is not coming back — a runaway config can hold one for hours. Asking politely then
        // waiting means the parent hangs on the open IPC channels while the workers keep burning
        // CPU, which is the opposite of stopping. Their results are discarded anyway, so give them
        // a moment to leave on their own and then take them down.
        const grace = setTimeout(() => {
          for (const c of children) if (!c.killed) c.kill('SIGKILL');
        }, ABORT_GRACE_MS);
        grace.unref();
      }
      resolve(results);
    };

    // An abort stops new work but never discards finished work: the results array is resolved as
    // it stands, so the caller reports a partial run instead of losing an hour of completed jobs.
    options.signal?.addEventListener('abort', () => {
      aborted = true;
      if (remaining > 0) finish();
    });
    if (aborted) { finish(); return; }

    for (let w = 0; w < nWorkers; w++) {
      const child = fork(file, ['--worker'], {
        execArgv: ['-r', 'ts-node/register/transpile-only'],
      });
      children.push(child);
      const pump = (): void => {
        if (settled) return;
        if (!aborted && next < jobs.length) {
          const index = next++;
          inFlight++;
          child.send({ type: 'job', index, job: jobs[index] });
          options.onDispatch?.(inFlight, index);
        } else child.send({ type: 'done' });
      };
      child.on('message', (msg: { type: string; index?: number; result?: R }) => {
        if (msg.type === 'result' && msg.index !== undefined) {
          results[msg.index] = msg.result as R;
          remaining--;
          completed++;
          inFlight--;
          options.onProgress?.(completed, jobs.length, msg.index, msg.result as R);
        }
        if (remaining === 0) finish();
        else pump();
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code && code !== 0 && !settled) reject(new Error(`worker exited with code ${code}`));
      });
    }
  });
}
