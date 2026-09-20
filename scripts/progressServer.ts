/**
 * Serves a run's live snapshot over HTTP, so a long sweep can be queried from outside the shell
 * that started it.
 *
 * This is the companion to the status file, not a replacement. The file is the durable record: it
 * outlives the process, which is exactly what matters when a run is killed after an hour of work.
 * The port is the opposite trade — always current, never stale, and gone the moment the process
 * is. A run does both because they answer different questions.
 *
 * Server plumbing lives in `scripts/` rather than beside the snapshot helpers in `src/Helpers/`
 * because `src/` is the model plus the pure, unit-tested helpers around it. A TCP listener is
 * harness machinery and belongs with the harness.
 */

import * as http from 'http';
import { formatProgress, ProgressSnapshot } from '../src/Helpers/RunProgress';

/**
 * Bind a localhost HTTP server reporting the current snapshot.
 *
 * Binding is opt-in (`--port`) because two concurrent sweeps on one machine would fight over the
 * same port, and a harness that refuses to run because a port is busy is a worse tool than one
 * that quietly falls back to the status file. A bind failure is therefore reported and ignored.
 *
 * Routes: `/` and `/text` render the human block; `/json` returns the raw snapshot.
 *
 * @param port - TCP port to bind on 127.0.0.1
 * @param read - supplies the snapshot at request time, so responses are never stale
 * @returns a function that closes the server
 */
export function serveProgressOverHttp(port: number, read: () => ProgressSnapshot): () => void {
  const server = http.createServer((req, res) => {
    const snapshot = read();
    if ((req.url ?? '/').startsWith('/json')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(snapshot, null, 2));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`${formatProgress(snapshot, Date.now())}\n`);
  });
  server.on('error', (err: Error) => {
    console.error(`progress server not listening on ${port}: ${err.message}`);
  });
  server.listen(port, '127.0.0.1');
  // Never let the server hold the process open past the run it reports on.
  server.unref();
  return () => server.close();
}
