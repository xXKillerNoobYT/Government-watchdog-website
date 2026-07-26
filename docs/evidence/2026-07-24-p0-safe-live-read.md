# P0 safe public/private asset lanes — verification evidence

Date: 2026-07-24

Branch: `codex/p0-safe-live-read`

Baseline: `808f48b3a942955f6f2ed44b078f424b905d692f`

## Scope

This slice separates the honest public Free preview from the reviewer/private-beta
application before the bundler discovers application modules. It also:

- defaults first-time users to the Simple presentation;
- keeps Simple/Advanced presentation separate from plan, geography, and record access;
- adds reusable, keyboard-accessible `?` information notes;
- removes automatic `reviewer=1` propagation from generated navigation links;
- reports live read-model failures as errors instead of substituting reviewer fixtures;
- removes the timeline's fixture fallback on live load failure; and
- enforces an allowlisted public Rollup module graph plus a compiled-artifact scan;
- scans the public HTML root for direct loopback-service exposure; and
- cleans the full output root before every standalone public build.

This evidence confirms the implementation and its local verification. It is not
production deployment approval.

## Automated verification

The following command completed successfully from the repository root:

```sh
npm run typecheck && npm test && npm run build:all && git diff --check
```

Results:

- TypeScript typecheck: passed.
- Vitest: 40 test files passed; 561 tests passed.
- Public build: passed; 17 modules; JavaScript 32.18 kB (10.33 kB gzip).
- Public module provenance boundary: passed; no disallowed repository module or
  local asset entered the Rollup graph.
- Public compiled-artifact boundary: passed; no protected markers found in
  `dist/public`.
- Private-beta build: passed; 56 modules; JavaScript 657.84 kB (129.61 kB gzip).
- Direct loopback exposure checks: passed for both build lanes.
- Standalone-public cleanup probe: passed; a planted stale `dist/client` marker
  and directory were removed before the public artifact was built.
- Whitespace/conflict-marker check: passed.

## Browser and accessibility verification

The public preview was exercised at 320, 390, 768, and 1440 CSS pixels:

- no horizontal document overflow at any tested width;
- no civic record cards rendered in the honest-empty public preview;
- nine information-note triggers produced nine unique panel IDs;
- no duplicate document IDs;
- visible links and buttons met the 44-by-44-pixel minimum target;
- the mobile information-note sheet remained inside the viewport; and
- Escape closed the sheet and restored focus to its trigger.

The private-beta shell was exercised at 390 CSS pixels:

- the MOTY-derived Simple layout remained intact;
- there was one main landmark and no horizontal overflow;
- visible interactive targets met the 44-by-44-pixel minimum; and
- searching for `water rates & fees` navigated to
  `#/timeline?search=water%20rates%20%26%20fees` without adding `reviewer=1`.

## Remaining release gates

These items are deliberately outside this frontend slice and must remain visible
as blockers:

1. The backend magic-link cookie must be connected to reviewer authorization
   without weakening bearer-token, expiry, revocation, or ambiguity handling.
2. The backend artifact publication workflow must stop force-moving tags and
   overwriting immutable release assets.
3. Canonical backend release authority and the Node/Python gate-parity contract
   must be resolved.
4. The supplied Sites project ID and the checked-in Sites project ID differ.
   Opaque project identifiers must not be guessed or substituted.
5. A public server-authoritative civic projection is not available yet, so the
   public lane intentionally renders explanatory empty slots rather than private
   fixtures or invented reviewed records.
