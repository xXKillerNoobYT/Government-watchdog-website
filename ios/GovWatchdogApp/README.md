# GovWatchdogApp (iOS)

SwiftUI companion app for the Government Watchdog gated beta. The scaffold
(GOV-1537 / Phase 4c leg 1) stood up the Xcode project, build-time config, and a
launch screen. **Leg 4c-3 (GOV-1539)** adds the native on-device auth flow:
email → 6-digit code → session token in the iOS Keychain, sign-out, and an
account-deletion request screen. Gated reviewer-internal views remain a **later
leg** (4c-4) and are intentionally absent.

- **Platform:** iOS 17+ deployment target, iPhone-first (no iPad/Android layout).
- **UI:** SwiftUI, `@Observable` state machine (`AuthModel`) routing
  signed-out → awaiting-code → signed-in.
- **Networking:** talks only to one HTTPS/loopback origin, injected from build
  settings (never hardcoded). Endpoints: the public `GET /api/health` probe and the
  gated-beta account routes (`/api/beta/magic-link/request`, `/consume`,
  `DELETE /api/beta/sessions/current`).
- **Single stored secret:** the session token, in the Keychain
  (`kSecAttrAccessibleAfterFirstUnlock`, non-synchronizable). No email, code, or
  gated row is ever written to disk; the app emits **no logs** at all.

### Auth flow ↔ delivered backend contract (leg 4c-2, GOV-1538)

The 4a spec §1 envisioned a *bearer* token returned in the body ("native uses
bearer directly"). The backend that actually shipped (GOV-1538) reuses the existing
**cookie** session: `POST /api/beta/magic-link/consume {email, code}` returns
`200` with the session only in a `Set-Cookie: gw_beta_session=…` header (or one
neutral `401`; `404` while the beta flag is off). This client therefore extracts
the raw token from `Set-Cookie`, stores it as the single Keychain secret (never in
`URLSession`'s on-disk cookie jar, which is disabled), and replays it in the
`Cookie` header — the header the delivered sign-out route reads. This is a
client-side adaptation, **not** a contract fork; switching to
`Authorization: Bearer` is a one-line change in `BetaAPI`/`AuthClient` if a later
4c-2 addendum adds a bearer route. See the GOV-1539 issue thread for the escalation.

> **Account deletion (App Store 5.1.1(v)):** the screen submits a request to
> `POST /api/beta/account/deletion-request` and routes through the backend account
> lifecycle — **no client-side deletes**. That HTTP route is not deployed yet; until
> it is, the screen renders an honest "not accepted in this build" state rather than
> faking success.

Authoritative scope: `docs/gov1523-ios-app-scoping-spec.md` (website `main`). This
app consumes the Phase-1 artifact contract verbatim and forks nothing.

---

## Prerequisites

- **macOS + Xcode 17+** (built and verified with Xcode 26.6).
- **XcodeGen** — only needed if you change project *structure* and must regenerate
  the `.xcodeproj`. Install with `brew install xcodegen`. A plain build does **not**
  need it: the generated `GovWatchdogApp.xcodeproj` is committed.

## Build & run (iOS simulator) — fresh clone

```bash
# from the repo root
open ios/GovWatchdogApp/GovWatchdogApp.xcodeproj
```

In Xcode: select the **GovWatchdogApp** scheme and any **iPhone** simulator, then
press **⌘R**. No signing team is required for a simulator build.

Command-line equivalent (no Xcode UI):

```bash
cd ios/GovWatchdogApp
xcodebuild \
  -project GovWatchdogApp.xcodeproj \
  -scheme GovWatchdogApp \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  build

# install + launch on a booted simulator:
xcrun simctl install booted \
  "$(xcodebuild -project GovWatchdogApp.xcodeproj -scheme GovWatchdogApp \
      -configuration Debug -sdk iphonesimulator -showBuildSettings \
      | awk -F' = ' '/ TARGET_BUILD_DIR =/{d=$2} /FULL_PRODUCT_NAME =/{p=$2} END{print d"/"p}')"
xcrun simctl launch booted com.isaac4alpine.govwatchdog
```

> **Deployment target vs. runtime:** the project targets iOS **17.0** (the
> compatibility floor). It runs on any iOS 17+ simulator; on a Mac that only has
> newer runtimes installed (e.g. iOS 26.x) it builds and runs there — the 17.0
> target guarantees 17-compatibility regardless of the installed runtime.

### Pointing the simulator at live data (optional)

The Debug build targets the website repo's local end-to-end stack. To have the
`Check /api/health` button succeed, start it first and leave it running:

```bash
# from the repo root
GW_KEEP_UP=1 npm run e2e:local
```

That serves the site + same-origin `/api` proxy at `127.0.0.1:4173`. The iOS
**simulator** shares the Mac's loopback, so it can reach `127.0.0.1`. A physical
device cannot — on-device builds use the Release origin (see below) and presuppose
Phase 3.

## Configuration (API base URL)

The API base URL is the app's single piece of environment configuration and is
**never hardcoded**. It flows:

```
Config/<Config>.xcconfig  →  GW_API_BASE_URL (build setting)
        →  Resources/Info*.plist  key GWAPIBaseURL = $(GW_API_BASE_URL)
        →  AppConfig.apiBaseURL (Sources/AppConfig.swift, the only reader)
```

| Configuration | File | Origin |
|---|---|---|
| **Debug** (simulator/dev) | `Config/Debug.xcconfig` | `http://127.0.0.1:4173` (local e2e) |
| **Release** (device/TestFlight) | `Config/Release.xcconfig` | `https://watchdog.isaac4alpine.com` (Phase-3-owned) |

To change an origin, edit the relevant `.xcconfig` — nothing else.

> **`.xcconfig` `//` gotcha:** `.xcconfig` treats `//` as a comment, so
> `http://host` truncates to `http:`. The files use the `$()` empty-variable escape
> (`http:/$()/127.0.0.1:4173`) to keep the `//` literal. **Do not remove the
> `$()`** — it will silently break the URL. Verify the effective value with:
> `xcodebuild ... -showBuildSettings | grep GW_API_BASE_URL`.

### App Transport Security (ATS)

- **Release** (`Resources/Info.plist`) carries **no** `NSAppTransportSecurity`
  keys → full default ATS; all traffic must be HTTPS/TLS. No ATS exceptions are
  permitted in shipped builds (spec §2 item 7).
- **Debug** (`Resources/Info-Debug.plist`) adds `NSAllowsLocalNetworking = true`
  so the simulator can reach the loopback e2e stack over http. This is **not** an
  ATS-weakening exception — Apple documents it as ATS-compliant (it permits only
  local/`.local`/loopback addresses; all non-local traffic still requires TLS).
  The per-config plist is selected in `project.yml`.

## Project layout

```
ios/GovWatchdogApp/
├── project.yml                  # XcodeGen source of truth for the .xcodeproj
├── GovWatchdogApp.xcodeproj/     # generated (committed) — open this to build
├── Config/
│   ├── Base.xcconfig             # shared settings (version, deployment target)
│   ├── Debug.xcconfig            # GW_API_BASE_URL → local e2e loopback
│   ├── Release.xcconfig          # GW_API_BASE_URL → Phase-3 HTTPS origin
│   └── GovWatchdogApp.entitlements # keychain-access-group (session store)
├── Sources/
│   ├── GovWatchdogApp.swift      # @main App entry (renders RootView)
│   ├── AppConfig.swift           # the ONLY reader of the injected base URL
│   ├── ContentView.swift         # scaffold health-probe screen (retained)
│   ├── HealthClient.swift        # minimal GET /api/health probe (no auth, no PII)
│   ├── Auth/
│   │   ├── BetaAPI.swift         # route constants + Set-Cookie/PII-redaction helpers
│   │   ├── SessionStore.swift    # Keychain wrapper (the one stored secret)
│   │   ├── AuthClient.swift      # request/consume/sign-out/deletion network calls
│   │   └── AuthModel.swift       # @Observable auth state machine
│   └── Views/
│       ├── RootView.swift        # phase router (signed-out/awaiting-code/signed-in)
│       ├── SignInView.swift      # email entry
│       ├── CodeEntryView.swift   # 6-digit code entry
│       ├── SignedInView.swift    # signed-in shell + sign-out
│       └── AccountDeletionView.swift # deletion-request screen (5.1.1(v))
├── Tests/GovWatchdogAppTests/    # Keychain attrs (AC #2), cookie parse, redaction
├── Resources/
│   ├── Info.plist                # Release: full ATS
│   ├── Info-Debug.plist          # Debug: + NSAllowsLocalNetworking
│   └── Assets.xcassets/          # AppIcon + AccentColor placeholders
├── docs/screenshots/             # simulator captures of each auth state
└── README.md
```

## Tests

```bash
cd ios/GovWatchdogApp
xcodebuild test -project GovWatchdogApp.xcodeproj -scheme GovWatchdogApp \
  -destination 'platform=iOS Simulator,name=<an iPhone sim>' \
  CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=YES
```

The Keychain tests need the app's `keychain-access-group` entitlement, so the test
run **ad-hoc signs** the app (identity `-`, no Apple team required). On device /
TestFlight the provisioning profile grants the group automatically.

### Regenerating the project

After editing `project.yml` (structural changes — new files, settings), regenerate
and commit both `project.yml` and the resulting `.xcodeproj`:

```bash
cd ios/GovWatchdogApp && xcodegen generate
```

## Security & program boundaries (binding)

- **No secrets in the tree.** No tokens, API keys, `.p8` App Store Connect keys,
  provisioning profiles, or PII are committed. `.gitignore` blocks `*.p8`/`*.p12`/
  `*.mobileprovision` as defense in depth. The 4b upload `.p8` lives outside any
  git repo (spec §4 step 8).
- **TestFlight internal-testing only** — no public App Store release
  (spec §3). On-device/TestFlight distribution is leg **4c-6**, blocked on Phase-4b
  owner steps + the Phase-3 hosted origin.
- **No raw registry/corpus data on device.** This scaffold fetches none; later
  gated views receive only rows that already passed the frozen 8-clause gate, held
  in memory only.
- **No analytics/tracking SDKs.**
