// @vitest-environment jsdom
//
// GOV-49 (1a) — the shipped fixture is web-safe, asserted directly.
//
// `src/data/client.ts` sweeps `alpine-sample.json` with `assertWebSafe` at MODULE SCOPE. That
// makes the import side-effecting and pins 198 KB of JSON into every build, so GOV-49 tried
// moving the sweep into the `useFixtures` branch. **That was reverted** — it also let the
// bundler drop the fixture from builds that genuinely need it (`VITE_USE_FIXTURES=true`
// produced a bundle with zero fixture data). See the plan for the measurements.
//
// This file survives the revert because the property it asserts is worth holding directly
// either way. The module-scope call is currently the ONLY import-time enforcement, and it is
// exactly what GOV-49 step 1b will remove. When that lands, this test is what keeps the
// safety property from leaving with it.
//
// Worth recording precisely, because the red proof corrected a wrong belief: three suites
// (`gov1570-supplied-files`, `gov1571-supersede-view`, `gov1634-provenance-note`) do call
// `expect(() => assertWebSafe(FIXTURE)).not.toThrow()`, and it is tempting to count them as
// covering this. They do not — their `FIXTURE` is a local constant declared in the test file,
// not the export from `src/data/client`. Planting an absolute vault path in the real sample
// left all 44 of their tests green.
import { describe, expect, it } from 'vitest';
import { FIXTURE } from '../src/data/client';
import { assertWebSafe } from '../src/data/web-safe';

describe('GOV-49 — the shipped fixture stays web-safe without a module-scope sweep', () => {
  it('carries no raw path, vault path, or denylisted locator key', () => {
    expect(() => assertWebSafe(FIXTURE)).not.toThrow();
  });

  it('is the real sample, not an empty object that would pass vacuously', () => {
    // Without this, deleting the fixture's contents would make the assertion above
    // meaningless while staying green — the failure mode that makes a guard decoration.
    expect(FIXTURE.records?.length ?? 0).toBeGreaterThan(0);
    expect(JSON.stringify(FIXTURE).length).toBeGreaterThan(50_000);
  });
});
