#!/usr/bin/env node

/**
 * Privacy boundary for the public post-merge cleanup workflow (#218).
 *
 * The backend cleanup tool deliberately reports exact repository and worktree
 * paths so an operator can make a safe deletion decision. Those paths are useful
 * private evidence, but they are not safe to print or upload from this PUBLIC
 * repository's Actions run. This helper never republishes the raw object. It
 * creates a new artifact from an exact aggregate-field allowlist, so arbitrary
 * current or future backend strings remain private by construction.
 *
 * The CLI writes only fixed keys, integer counts, and a relative artifact path to
 * GITHUB_OUTPUT. It never prints the report or an offending value.
 */

import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const COUNT_FIELDS = [
  'total_candidates',
  'would_remove_branches',
  'would_remove_worktrees',
  'preserved_count',
  'failed_count',
];

export class InvalidCleanupReport extends Error {}

/**
 * Build a new public artifact from an exact allowlist. Nothing from a branch,
 * path, gate detail, error, candidate, repository, or future backend field can
 * cross this boundary because those values are never copied.
 */
export function aggregateCleanupReport(report) {
  if (report === null || Array.isArray(report) || typeof report !== 'object') {
    throw new InvalidCleanupReport('Cleanup report must be a JSON object');
  }

  const aggregate = {
    report_format_version: 1,
    privacy_status: 'aggregate-only',
  };
  for (const field of COUNT_FIELDS) {
    const value = report[field];
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InvalidCleanupReport(`Cleanup report has an invalid ${field}`);
    }
    aggregate[field] = value;
  }
  return aggregate;
}

function outputLines(aggregate, artifactPath) {
  const lines = COUNT_FIELDS.map((field) => `${field}=${aggregate[field]}`);
  lines.push('report_status=aggregate-only');
  lines.push(`artifact=${artifactPath}`);
  return `${lines.join('\n')}\n`;
}

function safeRelativeArtifactPath(value) {
  return !isAbsolute(value)
    && !value.includes('\\')
    && /^Logs\/post-merge-cleanup-\d{8}T\d{6}Z\.json$/.test(value);
}

export function prepareCleanupReport(report, rawArtifactPath) {
  if (!safeRelativeArtifactPath(rawArtifactPath)) {
    throw new InvalidCleanupReport('Cleanup artifact path must be the expected relative Logs path');
  }
  const artifactPath = rawArtifactPath.replace(/\.json$/, '-summary.json');
  return {
    aggregate: aggregateCleanupReport(report),
    artifactPath,
  };
}

export function removeRawReport(
  rawArtifactPath,
  { unlinkFile = unlinkSync, fileExists = existsSync } = {},
) {
  try {
    unlinkFile(rawArtifactPath);
  } catch {
    if (fileExists(rawArtifactPath)) {
      throw new InvalidCleanupReport('Raw cleanup report could not be deleted');
    }
  }
}

function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.length !== 1 || !env.GITHUB_OUTPUT) {
    throw new InvalidCleanupReport('Usage or Actions output destination is invalid');
  }

  const rawArtifactPath = argv[0];
  try {
    let report;
    try {
      report = JSON.parse(readFileSync(rawArtifactPath, 'utf8'));
    } catch {
      throw new InvalidCleanupReport('Cleanup report is not valid JSON');
    }

    const prepared = prepareCleanupReport(report, rawArtifactPath);
    writeFileSync(
      prepared.artifactPath,
      `${JSON.stringify(prepared.aggregate, null, 2)}\n`,
      { encoding: 'utf8' },
    );
    appendFileSync(
      env.GITHUB_OUTPUT,
      outputLines(prepared.aggregate, prepared.artifactPath),
      { encoding: 'utf8' },
    );
    return 0;
  } finally {
    // Raw operational evidence is private-by-construction. Delete it on every
    // path, including malformed input and output-write failure.
    removeRawReport(rawArtifactPath);
  }
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  try {
    process.exitCode = main();
  } catch {
    // A public Actions log may report the failure class, never the raw JSON,
    // path argument, parser detail, or offending value.
    console.error('Cleanup report validation failed; raw output withheld.');
    process.exitCode = 1;
  }
}
