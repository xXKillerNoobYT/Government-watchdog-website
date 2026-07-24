import { describe, expect, it } from 'vitest';
import {
  PUBLIC_LOCAL_MODULES,
  publicRepositoryModulePath,
} from '../vite.config';

describe('public build module-graph boundary', () => {
  it('allows only the reviewed local modules used by the anonymous entry', () => {
    for (const allowed of PUBLIC_LOCAL_MODULES) {
      expect(publicRepositoryModulePath(`/repo${allowed}`, '/repo'), allowed).toBe(allowed);
    }

    expect(PUBLIC_LOCAL_MODULES.has(publicRepositoryModulePath('/repo/src/main.ts', '/repo')!))
      .toBe(false);
    expect(PUBLIC_LOCAL_MODULES.has(
      publicRepositoryModulePath('/repo/src/data/client.ts', '/repo')!,
    )).toBe(false);
    expect(PUBLIC_LOCAL_MODULES.has(
      publicRepositoryModulePath('/repo/design/private-review.png', '/repo')!,
    )).toBe(false);
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
