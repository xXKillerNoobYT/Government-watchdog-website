# Government Watchdog Sites deployment

This is the operational handoff for building, updating, deploying, and
eventually publishing the Alpine Government Watchdog frontend.

## Site identity

| Item | Value |
|---|---|
| Sites title | `Government Watchdog — Alpine` |
| Sites slug | `alpine-government-watchdog-beta` |
| Production URL | `https://alpine-government-watchdog-beta.weirdtoocompany.chatgpt.site/` |
| Sites project binding | `.openai/hosting.json` |
| Current access | `custom` / private beta |
| Custom domain | none |
| Canonical product source | GitHub `xXKillerNoobYT/Government-watchdog-website`, branch `main` |
| Sites source branch | managed Sites repository, branch `main` |

`https://www.alpinewy.gov` is an official civic-data source for backend testing.
It is not this application's deployment domain and must not be configured as one
without the Town's authorization and the required DNS control.

The project ID in `.openai/hosting.json` is an opaque binding. Reuse it; never
create a second Sites project for this app. Repository write credentials and
Sites bypass tokens are short-lived secrets and must never be committed.

## Release-source rule

GitHub `main` is the release source of truth. A production deployment must point
to one exact commit which is:

1. committed and present on `origin/main`;
2. verified locally from a clean worktree;
3. pushed unchanged to the managed Sites repository's `main` branch; and
4. used as the `commit_sha` for the saved Sites version and its build archive.

Sites does not currently auto-deploy GitHub pushes. “Tied to main” means the
release operator mirrors and deploys the exact verified `origin/main` commit;
it does not mean a feature-branch working tree may be deployed as if it were
main.

## Verify a release

From the repository root:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git status --short
npm ci
npm run typecheck
npm test
npm run build
```

`git status --short` must be empty before packaging. The production build must
contain all three Sites pieces:

- `dist/client/index.html` and static assets;
- `dist/server/index.js`, the assets/fallback worker; and
- `dist/.openai/hosting.json`, copied from the existing project binding.

The build script rewrites the document's runtime origin through the worker so
metadata and route fallbacks use the deployed host rather than localhost.

## Save and deploy with Sites

Use the installed Sites plugin (`@sites`) from this repository and tell it to
update the existing project from the verified GitHub `main` commit. The release
operator should:

1. read and reuse `.openai/hosting.json`;
2. create a short-lived source-repository credential;
3. push exact `HEAD` to the managed Sites `main` branch without saving the token;
4. package the verified `dist/` output with the Sites packaging helper;
5. save a Sites version using the same exact commit SHA;
6. deploy that saved version with the access-appropriate deployment action;
7. poll until the deployment is `succeeded`; and
8. open the stable production URL and smoke-test the landing, reviewer gate,
   Fast Agenda, Timeline, both modes, and a mobile-width view.

For the current owner-only/private beta, use the private deployment action. If
the access policy is shared or public, Sites requires the open-world deployment
action and explicit owner approval.

## Public-release gate

The Sites project supports public access, but **this build is not safe to make
public yet**. It still has a client-side `?reviewer=1` walkthrough bypass and
ships reviewer/synthetic projection modules in the browser bundle. Changing
only the Sites access policy would let an unauthenticated visitor retrieve data
that is currently protected by the private beta boundary.

Before changing Sites access from `custom` to `public`, all of these must be
true:

- real server-side authentication and authorization replace the query bypass;
- production builds cannot enable `?reviewer=1` or `VITE_REVIEWER_BYPASS`;
- reviewer-only and synthetic data are excluded from public assets, not merely
  hidden in the DOM;
- the backend exposes a separately authorized, web-safe public projection;
- public-lane and raw/private-field tests pass against the production build;
- the owner explicitly approves the exact version for public access; and
- an anonymous/incognito smoke test proves protected routes and assets remain
  inaccessible.

After those gates pass, use Sites access controls to change this existing
project to `public`, deploy the already-saved approved version, wait for success,
and verify the stable URL anonymously. Do not create a replacement project just
to change visibility.

## Rollback

Sites versions are immutable release points. If a deployment regresses:

1. select the last known-good saved version for this same project;
2. deploy it with the current access policy;
3. verify the stable production URL; and
4. fix forward on GitHub `main`, then repeat the exact-commit release process.

Rolling back Sites does not rewrite GitHub history.
