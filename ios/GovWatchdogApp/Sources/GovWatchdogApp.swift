import SwiftUI

/// App entry point (SwiftUI lifecycle, iOS 17+, iPhone-first).
///
/// GOV-1537 / GOV-1523 Phase 4c leg 1 — scaffold only. Sign-in (4c-3), gated
/// access states, and reviewer-internal views (4c-4) are later legs and are not
/// present yet. No civic data is fetched or displayed by this scaffold.
@main
struct GovWatchdogApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
