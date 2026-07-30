# AUTO GO — Metrics (Government Watchdog website)

One row per iteration. Read by the weekly `loop-self-improve` pass.

| date | iteration | area | check | status | findings | fixes_applied | tests_added | duration_sec | meta_checks_fired |
|---|---|---|---|---|---|---|---|---|---|
| 2026-07-28 | 1 | build-guards | C8 | in_progress | 4 | 3 | 25 | 1980 | github-issues-sync (global), first-run tracker seeding |
| 2026-07-28 | 1b | ci-tooling | C5 | done | 1 | 1 | 0 | 1500 | unplanned — CI-blocked follow-through on #59 |

## Findings this iteration

1. **Backlog dependency fan** — ten P0/P1 MOTY issues are unstartable until PR #68 merges.
2. **Exposure guard was port-enumerating** — `http://127.0.0.1:8787/read`, a form the repo's
   own `.env.example` documented, passed the check. Fixed (#55 AC1).
3. **`dist/` after `build:all` is a clean-looking unsafe package** — `dist/public` passes every
   content check while `dist/client` sits beside it. Fixed (#55 AC6).
5. **CI timeout flake (#59)** — PR #96 went red on a pre-existing non-deterministic timeout in two route-integration files. Isolated by A/B on clean `main` and fixed in PR #98; PR #96 stacked on it and now green.
4. **`.env.example` documented a form the guard now rejects**, and `VITE_READ_API_URL` is no
   longer read by `readConfig` at all. Comment corrected; the dead-key drift filed separately.
