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

The update is intentionally bounded to the patched Vite 6 / Vitest 3 toolchain.
No `npm audit fix --force` or unrelated source migration was used.

## Verification

- Clean `npm ci`: passed; npm reported `found 0 vulnerabilities`.
- TypeScript typecheck: passed.
- Full Vitest suite: `40` files and `561` tests passed.
- Integration smoke suite: `5` tests passed.
- Public build: passed with `17` transformed modules.
- Public module-graph allowlist and compiled-bundle marker scan: passed.
- Private-beta build: passed with `56` transformed modules.
- Direct service-exposure scan: passed in both build lanes.
- `git diff --check`: passed.

The large private chunk warning remains a performance follow-up, not a failed
security or correctness gate.

## Release state

This evidence supports a draft pull request stacked on the P0 safe public-lane
branch. It does not authorize a Sites save or production deployment.
