# GOV-1523 iOS Companion App Scoping Spec (Phase 4a — GOV-1530)

**Program:** GOV-1523 Option C — pinned backend web-artifact contract (accepted plan
revision `07bce814-3dc1-4737-8244-b4982f093c86`, Isaac card `ca9b16ce`, 2026-07-21).
**Status:** Planning-only scoping spec. No Xcode project, no code, no App Store
Connect actions were taken for this document. Phase 4c implements against it after
Phase 4b (owner steps) completes.
**Companion contracts:** backend `Docs/gov1523-artifact-contract-spec.md` (Phase 1a)
and website `docs/gov1527-build-integration.md` (Phase 1c). The app consumes those
contracts verbatim — nothing here forks them.
**Standing boundaries (all GOV-1523 legs):** TestFlight only — no public App Store
release. No domain/DNS/hosting spend (GOV-420 modified hold; the Phase-3 Isaac
deploy card owns that decision). Raw registry/corpus data is local/vault-only and
never reaches a device. No secrets committed. Both repos stay private (proprietary
LICENSE, GOV-1529).

---

## 1. App scope

### What the app is

A **SwiftUI iOS companion app** (iOS 17+, iPhone-first) for the gated beta. It is a
native client of the **same** `/api` surface the website uses — the Phase-1 artifact
service behind the same-origin proxy. It talks to exactly one HTTPS base URL (the
deployed website origin from the Phase-3 deploy card) and calls only endpoints that
already exist in the Phase-1 contract:

| Endpoint | Contract source | App use |
|---|---|---|
| `GET /api/health` | 1a §1 service entrypoint | reachability / version check |
| `GET /api/reviewer-internal` | 1a §1 (frozen 8-clause `reviewer_internal_records` gate) | the gated data views |
| `GET /api/notifications` | 1a §6 (flag-gated; constant `404` while off) | notification panel parity with GOV-758 |
| magic-link account endpoints | 1a §1 packages `scripts/accounts/`; HTTP routes are a named 4c backend leg (see §5, leg 4c-2) | sign-in |

**Auth model:** the service authorizes with `Authorization: Bearer` (see
`docs/gov1527-build-integration.md`, known integration notes). The web front door
issues a session **cookie**, which is why a cookie→bearer bridge is an open web
follow-up — but a native app does not need that bridge: it uses the bearer session
directly. Flow: user enters their approved beta email → service sends a magic
link/code via the (Phase-3-gated, F2-fixed) email adapter → user completes sign-in
→ app stores the bearer session token in the **iOS Keychain**
(`kSecAttrAccessibleAfterFirstUnlock`, non-synchronizable). Because universal-link
handling requires an `apple-app-site-association` file on the production domain
(which does not exist until Phase 3 lands), **v1 uses a 6-digit code entry
fallback** delivered in the same email as the link; tap-to-open universal links are
a post-v1 enhancement.

### v1 feature floor

1. **Sign-in:** email entry → magic-link/code consume → bearer session in Keychain.
   Enumeration-neutral responses, matching the GOV-804 web behavior.
2. **Gated access states:** the same six states the website shows (GOV-758): not
   signed in, waitlisted, pending review, approved, denied/needs info,
   revoked/disabled. No civic data on any pre-auth screen.
3. **Gated data views (approved sessions only):** read-only list + detail rendering
   of `reviewer_internal` rows with all evidence-workflow labels visible
   (verification status, publication state, correction status, source trail). Visual
   polish must never imply verification — same rule as the website.
4. **Notification panel** parity (renders the flag-gated endpoint's states honestly,
   including "off" → 404 → feature-unavailable state).
5. **Sign out** (destroys the Keychain token) and an **account-deletion request**
   screen (required by App Store Review Guideline 5.1.1(v) — see §2; routes through
   the same backend account lifecycle, no client-side deletes).

### Explicit non-goals for v1

- No public App Store release (own future owner card — §3).
- No push notifications (needs APNs entitlements + server work; post-v1).
- No offline persistence of gated rows — gated data lives in memory only; nothing
  written to disk except the Keychain session token.
- No new backend endpoints beyond the Phase-1 contract plus the already-named
  accounts-route wiring (leg 4c-2). The app never re-implements a gate.
- No iPad-optimized layout, no Android, no widgets, no Sign in with Apple (no
  third-party login is offered, so Apple's SIWA mandate is not triggered).
- No analytics/tracking SDKs of any kind.
- No content creation, commenting, or community features.

---

## 2. App Store / TestFlight rules for an invite-only gated-beta app

Facts Phase 4b/4c planning relies on (App Store Connect behavior as of July 2026):

1. **Internal testing (recommended v1 posture):** up to **100 internal testers**,
   who must be members of the App Store Connect team (Account Holder, Admin, App
   Manager, Developer, or Marketing role). **No Beta App Review is required** —
   builds are testable minutes after upload. This fits a beta whose only initial
   tester is Isaac.
2. **External testing (only if the beta expands):** up to **10,000 external
   testers** by email invite or public link. The **first build (and significantly
   changed builds) must pass Beta App Review**, which applies App Store Review
   Guidelines. Do not enable external testing in v1 without a CTO check of the
   items below.
3. **Demo account rule:** any review (Beta App Review or App Review) of a
   sign-in-required app requires **working demo credentials** in the review notes.
   For us that means a **seeded reviewer demo account** whose session sees
   demo/sample-lane rows — never a real user's account. This is a 4c deliverable
   only if/when external testing is enabled.
4. **Account deletion — Guideline 5.1.1(v):** apps that support account creation
   must let users **initiate account deletion inside the app**. Our accounts are
   backend-approved (waitlist), but the signup request originates in-app, so v1
   ships the deletion-request screen regardless of tier — it is cheap and removes
   a future review blocker.
5. **Sign-in-required apps are acceptable** when core functionality genuinely
   requires it (Guideline 5.1.1) — a gated civic beta qualifies; the app must not
   demand personal data beyond what the account function needs (we ask for email
   only).
6. **TestFlight limits:** builds expire after **90 days**; testers get update
   notices through the TestFlight app. TestFlight may not be used to distribute a
   finished product for compensation or to bypass App Review for public release.
7. **Privacy declarations still apply:** App Store Connect requires App Privacy
   answers even for TestFlight-only apps with external testers. Ours: contact
   info (email) collected, linked to identity, used for app functionality only; no
   tracking. Bearer-session traffic is HTTPS-only (default ATS; no ATS exceptions
   permitted in this project).

---

## 3. Distribution posture

- **TestFlight only, under Isaac's existing Apple Developer Program membership**
  (individual account). Start with **Internal Testing** (no Beta App Review, Isaac
  as the only tester). External TestFlight is a deliberate later step with its own
  CTO checklist (§2 items 2–3).
- **Public App Store release is explicitly out of scope** for GOV-1523. If wanted
  later, it is its own owner card + risk review (publication gates, GOV-420
  successor decision, App Review readiness) — nothing in Phase 4 pre-authorizes it.
- No ad-hoc `.ipa` distribution, no enterprise distribution, no sideloading paths.
- The app's API base URL points only at the Phase-3-selected hosting origin over
  HTTPS. **TestFlight testers cannot reach `127.0.0.1`**, so distributing any
  build to a device presupposes the Phase-3 deploy card is accepted and executed.
  Simulator/dev builds use the existing local e2e stack (`npm run e2e:local` with
  `GW_KEEP_UP=1`) and need no hosting.

---

## 4. Owner-step inventory (App Store Connect) — becomes the Phase-4b "click Done" issue verbatim

> **Isaac:** these are your steps, in order, ~20–30 minutes total, done in a web
> browser at `developer.apple.com` and `appstoreconnect.apple.com` plus your
> iPhone. Steps 2, 3 and 8 ask you to paste something back as a comment on the
> board issue. When every step is finished, click **Done** on the issue.

1. **Verify your membership is active.** Sign in at `developer.apple.com/account`.
   Confirm the page shows an active **Apple Developer Program** membership (not
   expired, not pending). If it expires within 60 days, renew it now.
2. **Record your Team ID.** On the same Account page, open **Membership details**
   and copy the 10-character **Team ID**. Paste it as a comment on this board
   issue.
3. **Confirm the bundle ID.** Our proposal is `com.isaac4alpine.govwatchdog`
   (reverse-DNS of your owner-held `isaac4alpine.com` domain). Comment either
   "use com.isaac4alpine.govwatchdog" or the ID you prefer — it cannot be changed
   after the app record is created.
4. **Register the App ID.** Go to
   `developer.apple.com/account/resources/identifiers` → click **+** → choose
   **App IDs** → **App** → Description: `Government Watchdog Beta` → Bundle ID:
   **Explicit**, enter the ID from step 3 → leave all capability checkboxes at
   their defaults → **Continue** → **Register**.
5. **Create the app record.** Go to `appstoreconnect.apple.com` → **My Apps** →
   **+** → **New App** → Platform: **iOS**; Name: `Government Watchdog Beta` (if
   Apple says the name is taken, append ` by Isaac4Alpine`); Primary Language:
   **English (U.S.)**; Bundle ID: select the one registered in step 4; SKU:
   `govwatchdog-beta-001`; User Access: **Full Access** → **Create**.
6. **Check agreements.** In App Store Connect open **Business** (Agreements, Tax,
   and Banking). Confirm the **Apple Developer Program License Agreement** is
   accepted and the **free-app** agreement shows **Active**. (Free apps need no
   bank or tax forms.) Accept anything pending.
7. **Set up internal TestFlight.** In App Store Connect open your new app → the
   **TestFlight** tab → under **Internal Testing** click **+** → group name:
   `GW Internal` → keep **automatic distribution** enabled → add yourself as the
   tester (as Account Holder you already qualify).
8. **Create an upload API key** (lets engineering upload builds without your
   password). App Store Connect → **Users and Access** → **Integrations** →
   **App Store Connect API** → **Team Keys** → **+** → Name:
   `GW TestFlight upload`; Access: **App Manager** → **Generate**. Click
   **Download API Key** — this works **once only**; keep the `.p8` file. Also copy
   the **Key ID** and the **Issuer ID** shown on that page. Comment on the board
   issue that the key exists and paste **only** the Key ID and Issuer ID — **never
   paste or commit the `.p8` file contents anywhere**. Keep the `.p8` on this Mac
   (the 4c issue will name the exact local drop location; outside any git repo).
9. **Install TestFlight on your iPhone** from the App Store (free, by Apple).
10. **Click Done on this issue.**

---

## 5. Phase-4c implementation-leg breakdown proposal

Phase 4c is **blocked by**: 4a (this spec), 4b (owner steps above), Phase 1
(done — artifact contract merged), **and, for any on-device/TestFlight
distribution, the Phase-3 deploy card outcome** (a reachable HTTPS origin).
Legs 4c-1..4c-3 can run against the local e2e stack in the simulator before
Phase 3 resolves; 4c-6 cannot.

| Leg | Scope | Suggested owner | Notes |
|---|---|---|---|
| **4c-1** | Xcode project scaffold in the website repo under `ios/GovWatchdogApp/` — SwiftUI, iOS 17+, API base URL via `.xcconfig` (never hardcoded), CI-free local build to start | FrontendTimelineEngineer (flag to CEO: no dedicated iOS specialist exists; keep in-repo per the no-duplicate-repos rule, escalate if a separate repo is preferred) | no secrets in project files |
| **4c-2** | Backend: wire magic-link request/consume + bearer-session issuance routes into `service/run.py`'s router (the already-documented 1c follow-up) + 6-digit code variant; enumeration-neutral; flags stay fail-closed | BackendCrawlerEngineer | this is the only backend change Phase 4 needs; contract addendum to 1a §1, not a fork |
| **4c-3** | On-device auth: email entry → code consume → bearer token in Keychain (`AfterFirstUnlock`, non-sync); sign-out; account-deletion request screen (§2 item 4) | FrontendTimelineEngineer | no cookie bridge needed — native uses bearer directly |
| **4c-4** | Gated views: six access states (GOV-758 parity), reviewer-internal list/detail with all evidence labels, notification panel; gated rows in memory only | FrontendTimelineEngineer | UI verification: iPhone viewport class; desktop/tablet floor does not apply to a phone-only app, but closeout must say so explicitly per the viewport rule |
| **4c-5** | Single SecurityPrivacy review leg (chain cap): Keychain storage, no PII logging, ATS/TLS posture, no raw data on device, gated rows only post-auth, deletion-request path honest | SecurityPrivacyAgent | one review leg total, per risk-based review policy |
| **4c-6** | TestFlight upload using the 4b API key (`xcrun altool`/`notarytool` successor: App Store Connect API upload), internal-group distribution, Isaac install-and-sign-in smoke test | CTO + Isaac | **blocked on 4b + Phase-3 hosted origin**; demo review account only becomes a deliverable if external testing is later enabled |

**Privacy notes binding all legs:** the device stores exactly one secret (the
bearer session token, Keychain-only). Email addresses appear only in the sign-in
form and in transit over TLS; logs on device must never contain email, token, or
row contents. The app receives only rows that already passed the frozen 8-clause
gate — the same data a browser session sees, nothing wider. F1/F2 pre-activation
fixes (session-cookie SameSite, real email adapter + hash-only logging) remain
mandatory inside the Phase-3 deploy chain before any real user email flows —
the app adds no path around them.

---

**What CEO may now create from this doc:** the Phase-4b click-Done owner issue
(paste §4 verbatim) and the Phase-4c legs (§5 table) with blockers
4a + 4b + Phase-3-origin as stated.
