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

/**
 * Run every job across a pool of forked copies of `file`, resolving with results in job order.
 *
 * @param jobs - the work items, serialised over IPC so they must be plain JSON-safe data
 * @param workerCount - maximum processes to fork; capped at the job count and floored at 1
 * @param file - the calling script's `__filename`; forked with `--worker` to serve jobs
 * @returns each job's result, in the order the jobs were given
 */
export function dispatch<J, R>(jobs: J[], workerCount: number, file: string): Promise<R[]> {
  return new Promise((resolve, reject) => {
    const results: R[] = new Array(jobs.length);
    const nWorkers = Math.max(1, Math.min(workerCount, jobs.length));
    const children: ReturnType<typeof fork>[] = [];
    let next = 0;
    let remaining = jobs.length;
    let settled = false;

    if (jobs.length === 0) { resolve(results); return; }

    const finish = (): void => {
      if (settled) return;
      settled = true;
      // Tell every worker to exit so their IPC channels close and the parent can terminate.
      for (const c of children) if (c.connected) c.send({ type: 'done' });
      resolve(results);
    };

    for (let w = 0; w < nWorkers; w++) {
      const child = fork(file, ['--worker'], {
        execArgv: ['-r', 'ts-node/register/transpile-only'],
      });
      children.push(child);
      const pump = (): void => {
        if (settled) return;
        if (next < jobs.length) child.send({ type: 'job', index: next, job: jobs[next++] });
        else child.send({ type: 'done' });
      };
      child.on('message', (msg: { type: string; index?: number; result?: R }) => {
        if (msg.type === 'result' && msg.index !== undefined) {
          results[msg.index] = msg.result as R;
          remaining--;
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
