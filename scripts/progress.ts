/**
 * Query — or gracefully stop — a sweep or compare run that is still going.
 *
 * `sweep.ts` and `compare.ts` print nothing until their last job lands, so before this existed an
 * operator watching a long run had two bad options: wait blind, or kill it and lose every finished
 * job. Worse, killing meant `pkill -f sweep.ts`, which matches the operator's own shell as readily
 * as the run — a mistake made twice in one session before this script was written.
 *
 * Both problems come from the same gap: nothing published the run's state. The harnesses now write
 * a JSON snapshot after every job (see `src/Helpers/RunProgress.ts`), and this reads it.
 *
 * Usage:
 *   npm run progress                  # what is running, how far along, rows finished so far
 *   npm run progress -- --stop        # ask it to stop and report what it has
 *   npm run progress -- --file P      # read a non-default status file
 *
 * `--stop` sends SIGINT to the pid named in the file, which the harnesses handle by finishing
 * in-flight jobs, printing a partial table, and exiting zero. It signals one exact process id, so
 * it cannot take out the shell that invoked it.
 */

import {
  DEFAULT_PROGRESS_FILE, formatProgress, isProcessAlive, readProgress,
} from '../src/Helpers/RunProgress';

/**
 * Parse `--file PATH` and the `--stop` flag from argv.
 *
 * @param argv - arguments after the script name
 * @returns the status-file path and whether a stop was requested
 */
function parseArgs(argv: string[]): { file: string; stop: boolean } {
  let file = DEFAULT_PROGRESS_FILE;
  let stop = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--stop') stop = true;
    else if (argv[i] === '--file') file = argv[++i] ?? file;
  }
  return { file, stop };
}

/**
 * Report on, and optionally stop, the run described by the status file.
 *
 * @returns process exit code: 0 on success, 1 when there is no readable status file
 */
function main(): number {
  const { file, stop } = parseArgs(process.argv.slice(2));
  const snapshot = readProgress(file);
  if (!snapshot) {
    console.error(`No status file at ${file}. A run writes one as soon as it starts.`);
    return 1;
  }

  const alive = snapshot.done ? undefined : isProcessAlive(snapshot.pid);
  console.log(formatProgress(snapshot, Date.now(), alive));

  if (!stop) return 0;
  if (snapshot.done) {
    console.log('\nRun already finished; nothing to stop.');
    return 0;
  }
  if (!alive) {
    console.log('\nNothing to stop — that process is already gone.');
    return 0;
  }

  process.kill(snapshot.pid, 'SIGINT');
  console.log(`\nSent SIGINT to ${snapshot.pid}. It will finish in-flight jobs, print a partial table, and exit.`);
  return 0;
}

process.exitCode = main();
