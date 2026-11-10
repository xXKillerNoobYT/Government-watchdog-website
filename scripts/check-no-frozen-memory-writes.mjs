/**
 * GOV-2258 — frozen-memory write guard.
 *
 * Memory authority (2026-07-26 decision, restated in the repo runbook
 * `docs/company-os/memory-authority-runbook.md`):
 *   - Notion is the SOLE current Government Watchdog memory destination.
 *   - The Obsidian vault is FROZEN read-only history.
 *   - Omi is never written by automation.
 *
 * This check FAILS THE BUILD if any *versioned* Government Watchdog automation
 * definition (build/guard scripts, GitHub workflows, and the auto-go / company-os
 * runbooks) contains a WRITE-CAPABLE step against a frozen memory store — a
 * write, move, rename, quarantine, conflict-copy sweep, delete, or `--apply`
 * against the Obsidian vault or Omi. A frozen-store reference is only allowed
 * when the same statement is explicitly READ-ONLY (read-only, dry-run,
 * report-only, "never move", "must not write", a denylist token, …).
 *
 * Two modes:
 *   (default)        Scan the versioned repo surfaces above. Any finding is a
 *                    build failure (exit 1). This is the CI-enforced invariant.
 *   --audit-local    ALSO scan the machine-local scheduled-routine store
 *                    ($HOME/.claude/scheduled-tasks/<name>/SKILL.md) READ-ONLY
 *                    and REPORT any live drift. Report-only by design: those
 *                    files are owner-owned and are not this repo's to mutate —
 *                    a finding there is escalated to the owner, not auto-fixed.
 *                    Exits 0 unless --strict-local is also passed.
 *
 * The scan itself never writes, moves, or deletes anything — it is a pure
 * read. `$HOME` is resolved at runtime; no contributor path is ever hard-coded
 * (this repo is PUBLIC — see test/no-user-specific-paths.test.ts).
 *
 * Pure + side-effect-free decision layer (`scanText`) is exported and unit
 * tested by test/gov2258-frozen-memory-guard.test.ts; the filesystem walk is
 * kept separate per the repo's guard split (CLAUDE.md §4).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Frozen memory stores. A reference to one of these is the necessary (not
 * sufficient) half of a finding. Matched by shape, case-insensitive. Kept as
 * literal tokens — none is a contributor path, so this file stays web-safe. */
export const FROZEN_STORE = [
  /obsidian\s*vault/i,
  /\bobsidian\b/i,
  /\bomi\b/i,
  /sweep_conflict_copies/i,
  /99_trash/i,
  /conflict[- ]?cop(?:y|ies)/i,
];

/** Write-capable mutation verbs. The other necessary half of a finding. */
export const MUTATION_VERB = [
  /\bwrite(?:s|n|-back)?\b/i,
  /\bmove(?:s|d)?\b/i,
  /\bmv\b/i,
  /\brename(?:s|d)?\b/i,
  /\bquarantin(?:e|es|ed|ing)\b/i,
  /\bsweep(?:s|ing)?\b/i,
  /\bmkdir\b/i,
  /\brm\b/i,
  /\bdelete(?:s|d)?\b/i,
  /\bcreate(?:s|d)?\b/i,
  /\bappend(?:s|ed)?\b/i,
  /\boverwrite(?:s|n)?\b/i,
  /--apply\b/i,
];

/** If any of these appears in the same statement, the frozen-store reference is
 * a documented READ-ONLY / prohibition / denylist mention, not a live mutation,
 * and is NOT a finding. This is what lets the runbook and the web-safe denylist
 * name the vault without tripping their own guard. */
export const READ_ONLY_MARKER = [
  /read[-\s]?only/i,
  /dry[-\s]?run/i,
  /report[-\s]?only/i,
  /no[-\s]?write/i,
  /never\s+(?:move|write|mutate|touch)/i,
  /(?:do|must|will)\s+not\s+(?:move|write|mutate|touch)/i,
  /must\s+not/i,
  /fail[-\s]?clos/i,
  /forbidden|prohibited|denylist|deny-list|reject(?:s|ed)?/i,
  /assertWebSafe|RawPathLeak/,
  /\bfrozen\b/i,
  /supersede|superseded/i,
];

const any = (patterns, line) => patterns.some((re) => re.test(line));

/**
 * Pure decision layer. Given a file's text, return one finding per line that
 * references a frozen store AND expresses a mutation verb AND is not neutralized
 * by a read-only marker. No I/O, no state.
 *
 * @param {string} text
 * @returns {{line:number, store:boolean, verb:boolean, excerpt:string}[]}
 */
export function scanText(text) {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!any(FROZEN_STORE, line)) continue;
    if (!any(MUTATION_VERB, line)) continue;
    if (any(READ_ONLY_MARKER, line)) continue;
    findings.push({
      line: i + 1,
      store: true,
      verb: true,
      excerpt: line.trim().slice(0, 200),
    });
  }
  return findings;
}

/** Versioned automation surfaces this guard is responsible for. Files, or
 * directories walked for the listed extensions. Kept narrow: this is the
 * *automation* surface, not product source. */
const VERSIONED_TARGETS = [
  { path: 'scripts', exts: ['.mjs', '.js', '.sh', '.cjs'] },
  { path: '.github/workflows', exts: ['.yml', '.yaml'] },
  { path: 'docs/company-os', exts: ['.md'] },
  // auto-go-*.md live at docs/ root
  { path: 'docs', exts: ['.md'], onlyBasename: /^auto-go-.*\.md$/ },
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.vite']);

/** The two files that DEFINE the rule necessarily enumerate the forbidden
 * verbs and stores, so they would flag themselves. Excluded from the walk,
 * exactly as test/no-user-specific-paths.test.ts excludes its own SELF. Both
 * are reviewed prose/definition, not an executable automation step. */
const SELF_EXCLUDE = new Set([
  'scripts/check-no-frozen-memory-writes.mjs',
  'docs/company-os/memory-authority-runbook.md',
]);

function* walk(root, exts, onlyBasename) {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(root, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(full, exts, onlyBasename);
    } else if (exts.some((e) => name.endsWith(e))) {
      if (onlyBasename && !onlyBasename.test(name)) continue;
      yield full;
    }
  }
}

/** Walk the versioned targets and return {file, findings[]} for any hit. */
export function scanRepo(repoRoot = REPO_ROOT) {
  const hits = [];
  for (const t of VERSIONED_TARGETS) {
    const base = join(repoRoot, t.path);
    // A single-file target (basename filter) or a directory walk.
    for (const file of walk(base, t.exts, t.onlyBasename)) {
      const rel = relative(repoRoot, file);
      if (SELF_EXCLUDE.has(rel)) continue;
      const findings = scanText(readFileSync(file, 'utf8'));
      if (findings.length) hits.push({ file: rel, findings });
    }
  }
  return hits;
}

/** READ-ONLY audit of the machine-local scheduled-routine store. Never mutates.
 * $HOME is resolved at runtime so no contributor path is compiled in. */
export function scanLocalRoutines(home = homedir()) {
  const root = join(home, '.claude', 'scheduled-tasks');
  const hits = [];
  if (!existsSync(root)) return hits;
  for (const name of readdirSync(root)) {
    const skill = join(root, name, 'SKILL.md');
    if (!existsSync(skill)) continue;
    const findings = scanText(readFileSync(skill, 'utf8'));
    if (findings.length) hits.push({ file: join('~/.claude/scheduled-tasks', name, 'SKILL.md'), findings });
  }
  return hits;
}

function printHits(hits, label) {
  for (const { file, findings } of hits) {
    for (const f of findings) {
      console.error(`  ${label} ${file}:${f.line}  ${f.excerpt}`);
    }
  }
}

// -------- CLI --------
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  const argv = process.argv.slice(2);
  const auditLocal = argv.includes('--audit-local');
  const strictLocal = argv.includes('--strict-local');

  const repoHits = scanRepo();
  if (repoHits.length) {
    console.error(
      '\n✗ frozen-memory write step found in versioned Government Watchdog automation.\n' +
        '  Notion is the sole current memory destination; the Obsidian vault and Omi are frozen.\n' +
        '  Make the step read-only/dry-run and fail-closed, or remove it. See\n' +
        '  docs/company-os/memory-authority-runbook.md\n',
    );
    printHits(repoHits, '[FAIL]');
  } else {
    console.log('✓ versioned Government Watchdog automation contains no frozen-memory write step.');
  }

  let localHits = [];
  if (auditLocal) {
    localHits = scanLocalRoutines();
    if (localHits.length) {
      console.error(
        '\n⚠ machine-local scheduled routines still carry frozen-memory write steps (READ-ONLY audit).\n' +
          '  These files are owner-owned and are NOT changed by this repo. Escalate to the owner\n' +
          '  with the runbook fail-closed replacement; do not silently patch the live routine.\n',
      );
      printHits(localHits, '[LOCAL]');
    } else {
      console.log('✓ machine-local scheduled routines: no frozen-memory write step found.');
    }
  }

  const fail = repoHits.length > 0 || (strictLocal && localHits.length > 0);
  process.exit(fail ? 1 : 0);
}
