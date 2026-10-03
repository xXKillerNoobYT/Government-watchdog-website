import { describe, expect, it } from 'vitest';
// The guard is an executable build-time JavaScript module, not app code.
// @ts-expect-error No declaration file is needed for this build-time module.
import { scanRepo, scanText } from '../scripts/check-no-frozen-memory-writes.mjs';

/**
 * GOV-2258 — the frozen-memory write guard.
 *
 * Memory authority (docs/company-os/memory-authority-runbook.md): Notion is the
 * sole current Government Watchdog memory destination; the Obsidian vault is
 * frozen read-only; Omi is never written by automation. No active routine may
 * write/move/rename/quarantine/conflict-copy inside either store.
 *
 * These are the "dry-run / no-write" proofs the acceptance criteria require:
 *   - the versioned automation surface currently contains no such step, and
 *   - the detector actually fires when one is (re)introduced — so the invariant
 *     cannot silently rot. All fixtures are synthetic literals (no real path;
 *     this repo is PUBLIC).
 */
describe('GOV-2258 frozen-memory write guard', () => {
  it('flags a vault conflict-copy quarantine sweep step', () => {
    // Synthetic reproduction of the class of step the audit found: a per-beat
    // routine line that sweeps conflict copies out of the Obsidian vault.
    const found = scanText('- Vault conflict sweep: run sweep_conflict_copies.py against the Obsidian vault');
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(1);
  });

  it('flags an explicit write / move / rename into the vault or Omi', () => {
    expect(scanText('write the daily note into the Obsidian vault')).toHaveLength(1);
    expect(scanText('mv "conflicted copy.md" into 99_trash')).toHaveLength(1);
    expect(scanText('rename the Omi export and overwrite the prior one')).toHaveLength(1);
    expect(scanText('create a new memory in Omi')).toHaveLength(1);
  });

  it('flags every mutating line and ignores the surrounding prose', () => {
    const routine = [
      '## Each beat',
      '- Sweep all three companies via the local API.',
      '- Vault conflict sweep: quarantine conflict copies in the Obsidian vault.',
      '- Post the status line.',
    ].join('\n');
    const found = scanText(routine);
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(3);
  });

  it('does NOT flag a read-only / dry-run / report-only vault step', () => {
    expect(
      scanText('- Vault conflict sweep (READ-ONLY, dry-run): report conflict copies in the Obsidian vault, never move them'),
    ).toEqual([]);
    expect(scanText('the routine must not write, move, or quarantine anything in the Obsidian vault')).toEqual([]);
    expect(scanText('report-only audit of the Obsidian vault; fail closed on any mutation')).toEqual([]);
  });

  it('does NOT flag the frozen-store denylist / prohibition prose', () => {
    // e.g. src/data/web-safe.ts denylist, or this runbook naming the rule.
    expect(scanText("denylist: 'Obsidian Vault' — reject any raw vault path on the wire")).toEqual([]);
    expect(scanText('Obsidian is frozen; write new canon to Notion instead')).toEqual([]);
    expect(scanText('the Obsidian vault is supporting reference material only')).toEqual([]);
  });

  it('does not flag a benign automation line', () => {
    expect(scanText('- Append a dated entry to the Notion live-state page')).toEqual([]);
    expect(scanText('git fetch && read HEAD..origin/main before repo work')).toEqual([]);
  });

  it('the versioned automation surface is currently clean', () => {
    // The live invariant: no committed GW automation writes to a frozen store.
    // If this ever fails, a routine reintroduced the exact GOV-2258 violation.
    expect(scanRepo()).toEqual([]);
  });
});
