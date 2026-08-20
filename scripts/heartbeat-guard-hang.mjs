/**
 * GOV-2135 / website#229 — synthetic uncancellable browser-audit stand-in.
 *
 * This is the sanitized reproduction of the website#229 hang. It reproduces the
 * two properties that defeated the old timeout WITHOUT any browser, credential,
 * provider payload, local path, or civic record:
 *
 *   1. It IGNORES cooperative cancellation — a SIGTERM handler that does nothing,
 *      standing in for a viewport-emulation call that never resolves and never
 *      honours its 90s tool timeout.
 *   2. It spawns a CHILD "server" that binds a loopback port — the Vite-child
 *      stand-in that survived the owning call in the incident.
 *
 * Both the parent and the child live in one process group, so only a
 * group-directed SIGKILL (what `heartbeat-guard.mjs` escalates to) frees the port
 * and reaps the tree. Used only by `test/heartbeat-guard.test.ts`, the
 * `selfcheck` subcommand, and the runbook's sanitized reproduction — never by any
 * real heartbeat lane.
 *
 * Usage: node scripts/heartbeat-guard-hang.mjs <port>   (0 = OS-assigned)
 */

import net from 'node:net';
import process from 'node:process';

// (1) Ignore cooperative cancellation. A real hung audit behaves this way.
process.on('SIGTERM', () => {
  /* deliberately does nothing — the only way out is a hard, group-directed kill */
});
process.on('SIGINT', () => {
  /* likewise ignored */
});

const port = Number(process.env.HANG_PORT || process.argv[2] || 0);

// (2) The Vite-child stand-in: a real listening socket that must be reaped.
const server = net.createServer((sock) => sock.end());
server.on('error', (err) => {
  process.stderr.write(`hang: could not bind port ${port}: ${err.message}\n`);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`hang: listening ${server.address().port}\n`);
});

// Occupy the "heartbeat" forever. Nothing here ever resolves.
setInterval(() => {}, 1 << 30);
