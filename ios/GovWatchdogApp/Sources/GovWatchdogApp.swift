import SwiftUI

/// App entry point (SwiftUI lifecycle, iOS 17+, iPhone-first).
///
/// GOV-1537 scaffold (leg 4c-1) established the shell; GOV-1539 (leg 4c-3) adds the
/// native auth flow. `RootView` routes the sign-in → signed-in → sign-out lifecycle.
/// Gated civic views (leg 4c-4) are still absent; no civic data is displayed yet.
@main
struct GovWatchdogApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
