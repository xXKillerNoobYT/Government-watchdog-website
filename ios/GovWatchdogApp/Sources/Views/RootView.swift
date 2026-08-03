import SwiftUI

/// Top-level router: renders the screen for the current auth phase.
///
/// signed-out → `SignInView`; awaiting-code → `CodeEntryView`; signed-in →
/// `GatedAppView` (leg 4c-4 — the three-tab gated app: Records, Alerts, Account). The
/// pre-auth screens carry their own `NavigationStack`; the signed-in `GatedAppView`
/// owns a per-tab `NavigationStack`, so it is rendered WITHOUT an outer stack to avoid
/// nested navigation bars. The model is created once (with the `.xcconfig`-injected
/// origin) and restores any existing Keychain session on launch.
struct RootView: View {
    @State private var model = AuthModel(client: AuthClient(baseURL: AppConfig.apiBaseURL))

    var body: some View {
        routed
            .onAppear(perform: applyLaunchState)
    }

    @ViewBuilder private var routed: some View {
        #if DEBUG
        if isDeletionScreenshot {
            NavigationStack { AccountDeletionView(model: model) }
        } else {
            phaseRouted
        }
        #else
        phaseRouted
        #endif
    }

    @ViewBuilder private var phaseRouted: some View {
        switch model.phase {
        case .signedOut:
            NavigationStack { SignInView(model: model) }
        case .awaitingCode(let email):
            NavigationStack { CodeEntryView(model: model, email: email) }
        case .signedIn:
            // Owns per-tab navigation — no outer NavigationStack.
            GatedAppView(auth: model)
        }
    }

    #if DEBUG
    private var isDeletionScreenshot: Bool {
        ProcessInfo.processInfo.arguments.contains("deletion")
            && ProcessInfo.processInfo.arguments.contains("-GWUIPhase")
    }
    #endif

    private func applyLaunchState() {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        // Deterministic gated-state screenshots (leg 4c-4): `-GWGateState <state>`
        // forces the signed-in phase so `GatedAppView` renders, and `GatedModel` reads
        // the same arg to force the access state. No network, no Keychain, no data.
        if args.contains("-GWGateState") {
            model.debugForcePhase(.signedIn)
            return
        }
        // Deterministic auth-phase screenshots (leg 4c-3): `-GWUIPhase signIn|code|signedIn`.
        if let i = args.firstIndex(of: "-GWUIPhase"), i + 1 < args.count {
            switch args[i + 1] {
            case "code":     model.debugForcePhase(.awaitingCode(email: "resident@example.com"))
            case "signedIn": model.debugForcePhase(.signedIn)
            default:         model.debugForcePhase(.signedOut)
            }
            return
        }
        #endif
        model.bootstrap()
    }
}

#Preview {
    RootView()
}
