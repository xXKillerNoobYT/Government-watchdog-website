import { describe, expect, it } from 'vitest';

import packageJson from '../package.json';
import dockerfile from '../Dockerfile?raw';

// The production checker is an executable JavaScript module rather than app code.
// @ts-expect-error No declaration file is needed for this build-time module.
import * as publicBundleModule from '../scripts/check-public-bundle.mjs';

const { privateSiblingLanes, publicBundleCommand, publicPackageRemediation } = publicBundleModule;

/**
 * Issue #55, final acceptance criterion: a public deployment package must fail
 * validation if it contains a sibling private client artifact.
 *
 * `vite.config.ts` writes `dist/public` and `dist/client`, so a full `build:all`
 * leaves both under one `dist/`. Every existing marker check reads only
 * `dist/public` and would still pass — yet deploying the parent directory would
 * publish the private-beta client.
 *
 * Only the pure decision is exercised here; the filesystem walk that feeds it is
 * build-time code, and this repository intentionally carries no `@types/node`.
 */

const PUBLIC_INDEX = [
  '<!doctype html><html><head>',
  '<meta name="gw-build-lane" content="public-free">',
  '<title>Government Watchdog — Alpine Free Preview</title>',
  '</head><body></body></html>',
].join('');

const PRIVATE_INDEX = [
  '<!doctype html><html><head>',
  '<meta name="gw-build-lane" content="private-beta">',
  '<title>Government Watchdog</title>',
  '</head><body></body></html>',
].join('');

describe('public deployment package isolation (#55)', () => {
  it('passes when the public lane is the only browser artifact in the directory', () => {
    expect(privateSiblingLanes([])).toEqual([]);
  });

  it('rejects a directory holding the private client beside the public lane', () => {
    expect(privateSiblingLanes([{ name: 'client', indexHtml: PRIVATE_INDEX }]))
      .toEqual(['client']);
  });

  it('detects a private lane that was renamed away from "client"', () => {
    // A name-based check would miss this; the absent lane marker is the evidence.
    expect(privateSiblingLanes([{ name: 'reviewer-preview', indexHtml: PRIVATE_INDEX }]))
      .toEqual(['reviewer-preview']);
  });

  it('treats an unmarked browser artifact as private', () => {
    // A lane that carries no marker at all has not been declared public-free.
    expect(privateSiblingLanes([{ name: 'legacy', indexHtml: '<!doctype html><html></html>' }]))
      .toEqual(['legacy']);
  });

  it('ignores siblings that are not browser artifacts', () => {
    // `dist/server` holds the Sites worker and `dist/.openai` the hosting
    // metadata. Neither has an index.html, so neither is a deployable lane.
    expect(privateSiblingLanes([
      { name: 'server', indexHtml: null },
      { name: '.openai', indexHtml: null },
    ])).toEqual([]);
  });

  it('does not treat a second public-free lane as private', () => {
    expect(privateSiblingLanes([{ name: 'public-mirror', indexHtml: PUBLIC_INDEX }]))
      .toEqual([]);
  });

  it('reports every private sibling, not just the first', () => {
    expect(privateSiblingLanes([
      { name: 'client', indexHtml: PRIVATE_INDEX },
      { name: 'public-mirror', indexHtml: PUBLIC_INDEX },
      { name: 'reviewer-preview', indexHtml: PRIVATE_INDEX },
      { name: 'server', indexHtml: null },
    ])).toEqual(['client', 'reviewer-preview']);
  });
});

describe('where the package assertion is enforced (#55)', () => {
  const scripts = packageJson.scripts as Record<string, string>;

  it('makes the default artifact the dedicated Sites public package (#54)', () => {
    expect(scripts.build).toBe('npm run build:sites-public');
    expect(scripts['build:sites-public']).not.toContain('build:private-beta');
    expect(scripts['build:sites-public']).not.toContain('build:all');
  });

  it('builds and scans the public graph in the final Sites client directory', () => {
    const sitesBuild = scripts['build:sites-public'];
    const build = 'vite build --mode public --outDir ../dist/client';
    const exposure = '--emitted dist/client';
    const publicPackage = '--package --sites-client';
    const prepare = 'node scripts/prepare-sites-build.mjs';

    expect(sitesBuild).toContain('prepare-sites-build.mjs --clean');
    expect(sitesBuild).toContain(build);
    expect(sitesBuild).toContain(exposure);
    expect(sitesBuild).toContain(publicPackage);
    expect(sitesBuild.indexOf(build)).toBeLessThan(sitesBuild.indexOf(exposure));
    expect(sitesBuild.indexOf(exposure)).toBeLessThan(sitesBuild.indexOf(publicPackage));
    expect(sitesBuild.indexOf(publicPackage)).toBeLessThan(sitesBuild.lastIndexOf(prepare));
  });

  it('selects the final Sites path explicitly and rejects unknown checker flags', () => {
    expect(publicBundleCommand([])).toEqual({ asPackage: false, target: 'public' });
    expect(publicBundleCommand(['--package'])).toEqual({ asPackage: true, target: 'public' });
    expect(publicBundleCommand(['--sites-client', '--package'])).toEqual({
      asPackage: true,
      target: 'sites-client',
    });
    expect(() => publicBundleCommand(['--publci'])).toThrow(/unknown argument/);
  });

  it('never tells a Sites operator to package dist/client without its worker and binding', () => {
    const remediation = publicPackageRemediation('sites-client', 'dist/client');
    expect(remediation).toContain('package the verified full dist/ tree');
    expect(remediation).not.toContain('Deploy dist/client itself');
  });

  it('keeps artifact-backed reviewer integration on the explicit private build', () => {
    expect(scripts['build:integrated']).toBe(
      'npm run fetch:artifact && node scripts/prepare-sites-build.mjs --clean && npm run build:private-beta',
    );
    expect(dockerfile).toMatch(/^RUN npm run build:private-beta$/m);
    expect(dockerfile).not.toMatch(/^RUN npm run build$/m);
  });

  it('runs the package form at the end of the public build', () => {
    // `build:public` cleans `dist/` first, so the public lane is alone there and
    // the sibling assertion is meaningful. This is the enforcement point; losing
    // the flag would silently drop the acceptance criterion.
    expect(scripts['build:public']).toContain('check-public-bundle.mjs --package');
  });

  it('offers the package validator as its own entry point for a deploy path', () => {
    expect(scripts['check:public-package']).toContain('--package');
    expect(scripts['check:sites-public-package']).toContain('--package --sites-client');
  });

  it('keeps the content-only check available for the combined verification workspace', () => {
    // `build:all` leaves `dist/public` beside `dist/client` on purpose. CI checks
    // the public lane's *contents* there; asserting package shape would be wrong.
    expect(scripts['check:public-bundle']).not.toContain('--package');
  });
});
