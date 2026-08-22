#!/usr/bin/env node

/**
 * Privacy boundary for the public post-merge cleanup workflow (#218).
 *
 * The backend cleanup tool deliberately reports exact repository and worktree
 * paths so an operator can make a safe deletion decision. Those paths are useful
 * private evidence, but they are not safe to print or upload from this PUBLIC
 * repository's Actions run. This helper extracts only aggregate counts and makes
 * the raw artifact publishable only when every string is free of machine-absolute
 * path shapes.
 *
 * The CLI writes only fixed keys, integer counts, and a relative artifact path to
 * GITHUB_OUTPUT. It never prints the report or an offending value.
 */

import { appendFileSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const COUNT_FIELDS = [
  'total_candidates',
  'would_remove_branches',
  'would_remove_worktrees',
  'preserved_count',
  'failed_count',
];

const POSIX_PRIVATE_ROOT = /(?:^|[\s"'`(=])\/(?:Users|home|private|tmp|var|Volumes|opt|srv|mnt|root|etc|run|workspace|github|runner)(?:\/|\b)/;
const WINDOWS_DRIVE_PATH = /(?:^|[\s"'`(=])[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH = /(?:^|[\s"'`(=])\\\\[^\\\s]+\\[^\\\s]+/;
const FILE_URL = /\bfile:\/\//i;

export class InvalidCleanupReport extends Error {}

/** Return true without exposing which value matched. */
export function containsPrivateAbsolutePath(value) {
  return FILE_URL.test(value)
    || POSIX_PRIVATE_ROOT.test(value)
    || WINDOWS_DRIVE_PATH.test(value)
    || WINDOWS_UNC_PATH.test(value);
}

function stringsIn(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...stringsIn(child)]);
  }
  return [];
}

export function inspectCleanupReport(report) {
  if (report === null || Array.isArray(report) || typeof report !== 'object') {
    throw new InvalidCleanupReport('Cleanup report must be a JSON object');
  }

  const counts = {};
  for (const field of COUNT_FIELDS) {
    const value = report[field];
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InvalidCleanupReport(`Cleanup report has an invalid ${field}`);
    }
    counts[field] = value;
  }

  return {
    counts,
    publishable: !stringsIn(report).some(containsPrivateAbsolutePath),
  };
}

function outputLines({ counts, publishable }, artifactPath) {
  const lines = COUNT_FIELDS.map((field) => `${field}=${counts[field]}`);
  lines.push(`report_status=${publishable ? 'publishable' : 'withheld'}`);
  if (publishable) lines.push(`artifact=${artifactPath}`);
  return `${lines.join('\n')}\n`;
}

function safeRelativeArtifactPath(value) {
  return !isAbsolute(value)
    && !value.includes('\\')
    && /^Logs\/post-merge-cleanup-\d{8}T\d{6}Z\.json$/.test(value);
}

export function prepareCleanupReport(report, artifactPath) {
  if (!safeRelativeArtifactPath(artifactPath)) {
    throw new InvalidCleanupReport('Cleanup artifact path must be the expected relative Logs path');
  }
  return {
    ...inspectCleanupReport(report),
    artifactPath,
  };
}

function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.length !== 1 || !env.GITHUB_OUTPUT) {
    throw new InvalidCleanupReport('Usage or Actions output destination is invalid');
  }

  const artifactPath = argv[0];
  let report;
  try {
    report = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch {
    throw new InvalidCleanupReport('Cleanup report is not valid JSON');
  }

  const prepared = prepareCleanupReport(report, artifactPath);
  appendFileSync(env.GITHUB_OUTPUT, outputLines(prepared, artifactPath), { encoding: 'utf8' });
  return prepared.publishable ? 0 : 2;
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
