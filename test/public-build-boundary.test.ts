import { describe, expect, it } from 'vitest';
import {
  PUBLIC_LOCAL_MODULES,
  publicModuleBoundary,
  publicRepositoryModulePath,
} from '../vite.config';

// The hooks are plain methods on the returned plugin object; Vite's Plugin type
// wraps them in ObjectHook unions, so the harness narrows them once here rather
// than casting inside every test.
type ConfigResolvedHook = (config: { root: string }) => void;
type ModuleParsedHook = (this: { error(message: string): never }, info: { id: string }) => void;

/**
 * Boot the boundary plugin exactly as a build would: configResolved with the
 * build root, then feed module ids through moduleParsed under a context whose
 * `error` throws — Rollup's `this.error` never returns, and the guard's whole
 * contract is that a disallowed module becomes a build failure, not a warning.
 */
function bootedBoundary(root: string) {
  const plugin = publicModuleBoundary();
  (plugin.configResolved as unknown as ConfigResolvedHook)({ root });
  const errors: string[] = [];
  const context = {
    error(message: string): never {
      errors.push(message);
      throw new Error(message);
    },
  };
  const parse = (id: string): void =>
    (plugin.moduleParsed as unknown as ModuleParsedHook).call(context, { id });
  return { parse, errors };
}

describe('public build module-graph boundary', () => {
  it('allows only the reviewed local modules used by the anonymous entry', () => {
    for (const allowed of PUBLIC_LOCAL_MODULES) {
      expect(publicRepositoryModulePath(`/repo${allowed}`, '/repo'), allowed).toBe(allowed);
    }

    const privateModules = [
      '/src/main.ts',
      '/src/data/api.ts',
      '/src/data/client.ts',
      '/src/data/notifications.ts',
      '/src/data/notifications-demo.ts',
      '/src/data/reviewer-normalize.ts',
      '/src/state/reviewer-context.ts',
      '/src/ui/home.ts',
      '/src/ui/explainer.ts',
      '/src/ui/notification-panel.ts',
      '/src/ui/private-info-note.ts',
      '/src/ui/private-info-note-definitions.ts',
      '/src/ui/reviewer-context-state.ts',
      '/src/types/notification.ts',
      '/src/fixtures/notifications.sample.json',
      '/src/fixtures/concept-graph-real.json',
      '/src/assets/government-watchdog-explainer.mp4',
      '/src/assets/government-watchdog-explainer-poster.jpg',
      '/design/private-review.png',
    ];
    for (const privateModule of privateModules) {
      expect(
        PUBLIC_LOCAL_MODULES.has(
          publicRepositoryModulePath(`/repo${privateModule}`, '/repo')!,
        ),
        privateModule,
      ).toBe(false);
    }
  });

  it('ignores external packages and Vite virtual modules', () => {
    expect(publicRepositoryModulePath(
      '/repo/node_modules/@fontsource/public-sans/latin-400.css',
      '/repo',
    ))
      .toBeNull();
    expect(publicRepositoryModulePath('\0vite/modulepreload-polyfill.js', '/repo')).toBeNull();
    expect(publicRepositoryModulePath('/other/src/main.ts', '/repo')).toBeNull();
  });
});

// The plugin itself — not just its path helper — is the fourth guard in the
// CLAUDE.md table, and its decision fires inside a Rollup hook. These tests
// drive that hook directly so the guard's verdict is pinned, not inferred from
// the helper it happens to call today.
describe('publicModuleBoundary plugin hook (the guard decision itself)', () => {
  it('fails the build the moment a disallowed local module is parsed', () => {
    const { parse, errors } = bootedBoundary('/repo/public-entry');
    expect(() => parse('/repo/src/main.ts')).toThrowError();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Public build discovered disallowed local module /src/main.ts');
    expect(errors[0]).toContain('do not import private application modules');
  });

  it('parses every reviewed public module without objection', () => {
    const { parse, errors } = bootedBoundary('/repo/public-entry');
    for (const allowed of PUBLIC_LOCAL_MODULES) {
      expect(() => parse(`/repo${allowed}`), allowed).not.toThrow();
    }
    expect(errors).toHaveLength(0);
  });

  it('leaves external, virtual, and off-root modules to the other guards', () => {
    const { parse, errors } = bootedBoundary('/repo/public-entry');
    parse('/repo/node_modules/@fontsource/public-sans/latin-400.css');
    parse('\0vite/modulepreload-polyfill.js');
    parse('/other/src/main.ts');
    expect(errors).toHaveLength(0);
  });

  it('resolves the repository root whether or not config.root is the public entry', () => {
    // The public build's root is `<repo>/public-entry`; configResolved trims the
    // suffix so module ids (repo-absolute) still resolve. A root without the
    // suffix must behave identically rather than silently mis-rooting the scan.
    for (const root of ['/repo/public-entry', '/repo']) {
      const { parse, errors } = bootedBoundary(root);
      expect(() => parse('/repo/src/fixtures/alpine-sample.json'), root).toThrowError();
      expect(errors[0], root).toContain('/src/fixtures/alpine-sample.json');
    }
  });

  it('applies only to builds, never to the dev server', () => {
    expect(publicModuleBoundary().apply).toBe('build');
  });
});
