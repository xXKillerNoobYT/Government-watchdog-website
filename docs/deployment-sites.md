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

## Owner login and private access

The hosted beta does **not** implement its own email magic-link service. Sites
is the authentication boundary. Its `custom` access policy admits the approved
owner account before the owner-only static root and assets are available. The
static build contains a `gw-sites-private-beta=owner-only` marker; browser code
accepts it only on the exact production hostname and uses it solely to route an
already-admitted owner past the obsolete duplicate login panel.

For requests Sites dispatches through `dist/server/index.js`, the worker adds a
second fail-closed check: it reads the platform-provided
`oai-authenticated-user-email` header only on the server and compares it with
the comma-separated hosted runtime value `GW_APPROVED_REVIEWER_EMAILS`. It can
inject only a boolean `approved` marker; the email address is never added to the
page or browser bundle. Missing configuration returns `503`; missing or
non-allowlisted identity returns the same non-enumerating `403`; worker
responses are private/no-store and noindex. The worker check is defense in
depth; the Sites `custom` access policy remains the static-asset boundary.

For the current owner-only beta:

1. keep Sites access at `custom` and keep only the approved owner in its access
   list;
2. set `GW_APPROVED_REVIEWER_EMAILS` through Sites runtime environment settings,
   never through source, `.env`, or `.openai/hosting.json`;
3. keep the Sites access list and runtime allowlist synchronized whenever an
   owner/reviewer is added or removed;
4. deploy privately; and
5. confirm the stable root URL opens Home directly for the approved owner.

Being signed into Gmail in another tab does not authenticate the site. The
browser must complete the Sites/ChatGPT sign-in as the approved account. The
local landing's “Send magic link” control is intentionally only a UI scaffold
and must never be used as production-login evidence.

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
- `dist/server/index.js`, the fail-closed owner-authorization fallback worker;
  and
- `dist/.openai/hosting.json`, copied from the existing project binding.

The build script copies the reviewed worker source. When Sites dispatches an
HTML fallback through it, the worker rewrites the document's runtime origin so
metadata uses the deployed host rather than localhost. Release verification
must also confirm that Sites access is still custom/owner-only and that an
unauthorized browser cannot fetch the app assets.

## Save and deploy with Sites

Use the installed Sites plugin (`@sites`) from this repository and tell it to
update the existing project from the verified GitHub `main` commit. The release
operator should:

1. read and reuse `.openai/hosting.json`;
2. read the Sites custom access list and set the secret runtime value
   `GW_APPROVED_REVIEWER_EMAILS` to that reviewed owner/reviewer allowlist;
3. read the environment back and confirm the key exists before saving a version
   (do not print or persist its value); environment revisions take effect on the
   subsequent saved-version deployment;
4. create a short-lived source-repository credential;
5. push exact `HEAD` to the managed Sites `main` branch without saving the token;
6. package the verified `dist/` output with the Sites packaging helper;
7. save a Sites version using the same exact commit SHA;
8. deploy that saved version with the access-appropriate deployment action so
   the saved source and the new environment revision activate together;
9. poll until the deployment is `succeeded`;
10. confirm the hosted runtime allowlist and the Sites custom access list still
   agree; and
11. open the stable production URL as the approved owner and smoke-test direct
   Home entry, Fast Agenda, Timeline, both modes, and a mobile-width view.

For the current owner-only/private beta, use the private deployment action. If
the access policy is shared or public, Sites requires the open-world deployment
action and explicit owner approval.

## Public-release gate

The Sites project supports public access, but **this build is not a public
product yet**. Its worker now protects every asset with an explicit owner
allowlist, but the browser bundle still contains a local `?reviewer=1`
walkthrough path plus reviewer/synthetic projection modules. Simply changing
the Sites access policy would still not create a reviewed public-data lane.

Before changing Sites access from `custom` to `public`, all of these must be
true:

- a separately reviewed public authorization/data path replaces the private
  owner-only worker policy;
- production builds cannot enable `?reviewer=1` or `VITE_REVIEWER_BYPASS`;
- the private-beta host marker and its automatic Home entry are removed;
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
