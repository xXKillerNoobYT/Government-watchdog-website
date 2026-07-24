# GovWatchdogApp (iOS)

SwiftUI companion app for the Government Watchdog gated beta — **scaffold only**
(GOV-1537 / GOV-1523 Phase 4c leg 1). This leg stands up the Xcode project, the
build-time configuration plumbing, and a minimal launch screen. Sign-in, gated
access states, and reviewer-internal views are **later legs** (4c-3, 4c-4) and are
intentionally absent here.

- **Platform:** iOS 17+ deployment target, iPhone-first (no iPad/Android layout).
- **UI:** SwiftUI, single screen.
- **Networking:** talks only to one HTTPS/loopback origin, injected from build
  settings (never hardcoded). The only endpoint this scaffold calls is the public
  `GET /api/health` reachability probe.

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
│   └── Release.xcconfig          # GW_API_BASE_URL → Phase-3 HTTPS origin
├── Sources/
│   ├── GovWatchdogApp.swift      # @main App entry
│   ├── ContentView.swift         # scaffold landing screen
│   ├── AppConfig.swift           # the ONLY reader of the injected base URL
│   └── HealthClient.swift        # minimal GET /api/health probe (no auth, no PII)
├── Resources/
│   ├── Info.plist                # Release: full ATS
│   ├── Info-Debug.plist          # Debug: + NSAllowsLocalNetworking
│   └── Assets.xcassets/          # AppIcon + AccentColor placeholders
└── README.md
```

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
