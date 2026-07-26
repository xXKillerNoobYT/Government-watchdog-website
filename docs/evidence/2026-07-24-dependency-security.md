# Website dependency security evidence — 2026-07-24

## Scope

This stacked change addresses
[Government-watchdog-website issue #48](https://github.com/xXKillerNoobYT/Government-watchdog-website/issues/48)
without changing application source, civic-data handling, access rules, or the
public/private entry graphs.

The lockfile resolves:

| Package | Resolved version | Security floor |
| --- | ---: | ---: |
| `vite` | `6.4.3` | `>= 6.4.3` |
| `vitest` | `3.2.7` | `>= 3.2.6` |
| `form-data` | `4.0.6` | `>= 4.0.6` |
| `esbuild` | `0.25.12` | `>= 0.25.0` |
| `postcss` | `8.5.18` | `>= 8.5.18` |

The update is intentionally bounded to the patched Vite 6 / Vitest 3 toolchain.
No `npm audit fix --force` or unrelated source migration was used.

The PostCSS floor was added on 2026-07-25 after
`GHSA-r28c-9q8g-f849` disclosed a high-severity source-map path traversal in
versions through 8.5.17. PostCSS is a development-only transitive dependency;
the override prevents the vulnerable build-tool version from being installed.

## Verification

- Clean `npm ci --no-audit --no-fund`: passed after the PostCSS override.
- Separate live `npm audit --audit-level=high --json`: passed with `0`
  vulnerabilities at every severity.
- TypeScript typecheck: passed.
- Full Vitest suite: `50` files and `796` tests passed.
- Integration smoke suite: `5` tests passed.
- Public build: passed with `17` transformed modules.
- Public module-graph allowlist and compiled-bundle marker scan: passed.
- Private-beta build: passed with `70` transformed modules.
- Direct service-exposure scan: passed in both build lanes.
- `git diff --check`: passed.

The large private chunk warning remains a performance follow-up, not a failed
security or correctness gate.

## Release state

This evidence supports a draft pull request stacked on the P0 safe public-lane
branch. It does not authorize a Sites save or production deployment.
