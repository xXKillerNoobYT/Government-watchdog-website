import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const guardUrl = new URL('../scripts/heartbeat-guard.mjs', import.meta.url);
const guardPath = fileURLToPath(guardUrl);
const errorCode = 'HEARTBEAT_GUARD_UNSUPPORTED_PLATFORM';

function windowsNode(source) {
  return spawnSync(process.execPath, ['--input-type=module', '-e',
    `Object.defineProperty(process, 'platform', { value: 'win32' });\n${source}`],
  { encoding: 'utf8', timeout: 10000, windowsHide: true });
}

test('Windows APIs reject process operations before spawn or state changes', () => {
  const result = windowsNode(`
    import assert from 'node:assert/strict';
    const g = await import(${JSON.stringify(guardUrl.href)});
    const expected = { code: ${JSON.stringify(errorCode)} };
    assert.equal(g.PROCESS_GROUPS_SUPPORTED, false);
    assert.throws(() => g.pgidAlive(process.pid), expected);
    assert.throws(() => g.pgidAlive(null), expected);
    assert.throws(() => g.spawnDetachedGroup('must-not-spawn'), expected);
    await assert.rejects(g.killProcessGroup(process.pid), expected);
    await assert.rejects(g.runBounded({ command: 'must-not-spawn', deadlineMs: 1 }), expected);
    await assert.rejects(g.recoverStale({ apply: true }), expected);
    assert.equal(g.isLeaseExpired({ deadlineEpochMs: 200 }, 100), false);
    assert.equal(g.denverLabel(Date.UTC(2026, 7, 16, 12, 16)), '2026-08-16 06:16:00 -06:00');
    const cadence = g.reconcileCadence({ lanes: ['a'], anchorEpochMs: 0,
      intervalMs: 1000, lastCompleted: {}, nowEpochMs: 1500 });
    assert.deepEqual(cadence.catchUp.map(x => x.lane), ['a']);
  `);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('Windows CLI preserves a live lease and never executes the supplied command', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heartbeat-platform-'));
  try {
    const leasePath = path.join(dir, 'lease.json');
    const sentinel = path.join(dir, 'spawned.txt');
    const lease = JSON.stringify({ runId: 'platform-check', pgid: process.pid,
      startEpochMs: Date.now(), deadlineEpochMs: Date.now() + 60000, ports: [] });
    fs.writeFileSync(leasePath, lease);
    const command = `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'spawned')`;
    const cases = [
      ['recover', '--apply', '--state-dir', dir],
      ['recover', '--state-dir', dir],
      ['run', '--apply', '--state-dir', dir, '--deadline-seconds', '1', '--', process.execPath, '-e', command],
      ['run', '--state-dir', dir, '--deadline-seconds', '1', '--', process.execPath, '-e', command],
      ['selfcheck'],
    ];
    for (const args of cases) {
      const result = windowsNode(`
        process.argv = [process.execPath, ${JSON.stringify(guardPath)}, ...${JSON.stringify(args)}];
        await import(${JSON.stringify(guardUrl.href)});
      `);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(JSON.parse(result.stdout).error, errorCode);
      assert.equal(fs.readFileSync(leasePath, 'utf8'), lease);
      assert.deepEqual(fs.readdirSync(dir), ['lease.json']);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
