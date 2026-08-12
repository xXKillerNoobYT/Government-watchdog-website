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
| Observed access (2026-08-11) | `public` — release blocked by website issue #54 |
| Custom domain | none |
| Canonical product source | GitHub `xXKillerNoobYT/Government-watchdog-website`, branch `main` |
| Sites source branch | managed Sites repository, branch `main` |

`https://www.alpinewy.gov` is an official civic-data source for backend testing.
It is not this application's deployment domain and must not be configured as one
without the Town's authorization and the required DNS control.

The project ID in `.openai/hosting.json` is an opaque binding. Reuse it; never
create a second Sites project for this app. Repository write credentials and
Sites bypass tokens are short-lived secrets and must never be committed.
Re-read provider access before every release; this dated row is evidence, not
permission to preserve or change visibility.

## Owner login and private access

The hosted beta does **not** implement its own email magic-link service. A
private beta requires Sites `custom` access to admit the approved owner before
the static root and assets are available. The private build marker is only a
UI-routing acknowledgement after that admission; it is not authentication.

For requests Sites dispatches through `dist/server/index.js`, the worker adds a
second fail-closed check: it reads the platform-provided
`oai-authenticated-user-email` header only on the server and compares it with
the comma-separated hosted runtime value `GW_APPROVED_REVIEWER_EMAILS`. It can
inject only a boolean `approved` marker; the email address is never added to the
page or browser bundle. Missing configuration returns `503`; missing or
non-allowlisted identity returns the same non-enumerating `403`; worker
responses are private/no-store and noindex. The worker check is defense in
depth for dispatched requests. Anonymous 200 responses for live v9's hashed
client asset proved it does not gate static files in the current public topology.

For any future owner-only beta:

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
npm run check:sites-public-package
```

`git status --short` must be empty before packaging. The production build must
contain all three Sites pieces:

- `dist/client/index.html` and static assets containing the `public-free` lane
  marker and the Alpine Free title, with no private media or fixture modules;
- `dist/server/index.js`, the fail-closed owner-authorization fallback worker;
  and
- `dist/.openai/hosting.json`, copied from the existing project binding.

The build script copies the reviewed worker source. When Sites dispatches an
HTML fallback through it, the worker rewrites the document's runtime origin so
metadata uses the deployed host rather than localhost. Release verification
must compare the intended lane with fresh provider access. The explicit
`npm run build:private-beta` command is for local/private verification only and
must not be saved or deployed while access is public.

## Save and deploy with Sites

Changing the default package does not save, deploy, or alter access. Any future
release still requires explicit approval for the exact commit and archive,
deployment of that saved version, and lane-appropriate post-deploy probes. Do
not combine this containment change with an access mutation.

### Public-free containment procedure (default build)

For the current default artifact, leave the existing access policy and runtime
environment unchanged. After exact-version approval only:

1. reuse `.openai/hosting.json` and verify the clean exact `origin/main` commit;
2. run the release checks above and record final `dist/client`, worker, and
   hosting-config hashes;
3. package the full verified `dist/` tree, save it against that same commit,
   deploy only the saved version, and poll it to `succeeded`;
4. anonymously require `/`, its referenced hashed JavaScript/CSS, `robots.txt`,
   and `sitemap.xml` to return 200; verify the index marker/title and run the
   public-byte guards over the exact downloaded assets; and
5. require private app/API/data/media paths and source maps to remain denied or
   absent, with no reviewer fixture or private media in the downloadable graph.

The public-free shell has no reviewer Home, eight-tab shell, Alerts account bell,
or Newsletter-detail surface. Those are not acceptance criteria for this lane,
and an authorized-browser smoke adds no distinct public-free proof.

### Future custom/private-beta procedure only

The following procedure applies only after `custom` owner-only access is restored
and verified. It does not apply to the current default public-free package.

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
   Home entry, the eight-tab navigation plus the header Alerts chip, Fast Agenda, Timeline,
   both modes, the single shell-owned mode switch, and a mobile-width view;
12. confirm Newsletter opens the reviewed archive with an explicit unavailable
   current-edition slot, and that a supplied digest ID opens detail; and
13. confirm the reviewer chip says `REVIEWER ACCESS / private beta` without an
   email or identity claim, while the account-notification bell remains
   distinct from the civic Alerts page.

For owner-login smoke testing, read the exact approved address from the Sites
custom access list and confirm the same address is represented in the hosted
`GW_APPROVED_REVIEWER_EMAILS` runtime setting. Do not print or commit that
runtime value. An approved session must enter Home directly and must not render
the obsolete local magic-link scaffold. Test a signed-out/incognito request
separately and confirm the protected app and static assets remain unavailable.

Use the action appropriate to the freshly read access policy. Public/shared
access requires the open-world action and explicit owner approval; custom
owner-only access requires the private action. Neither is authorized by a build.

## Public-release gate

The default Sites artifact is now the civic-data-empty Anonymous Free shell.
That can remove private client bytes from a future exact deployment, but it is
not a public-product launch and does not close #54's revocable private-session
requirements. The reviewer client still contains private walkthrough and
synthetic projection modules and remains unsafe under public access.

Before treating a public-access deployment as a product launch—or authorizing
a future `custom` to `public` change—all of these must be true:

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

After those gates pass and only with owner approval, reuse this existing project,
deploy the already-saved approved version, wait for success, and verify the stable
URL anonymously. If access is already public, do not churn visibility merely to
perform the release. Never create a replacement project just to change access.

## Rollback

Sites versions are immutable release points. If a deployment regresses:

1. select the last known-good saved version for this same project;
2. deploy it with the current access policy;
3. verify the stable production URL; and
4. fix forward on GitHub `main`, then repeat the exact-commit release process.

Rolling back Sites does not rewrite GitHub history.
Saved v8 and v9 are private-lane archives: redeploying either while access is
public can restore the exposure. A rollback target must therefore be checked
against its embedded lane and the current access policy, not its version number.
