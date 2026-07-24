import SwiftUI

/// Top-level router: renders the screen for the current auth phase (GOV-1539).
///
/// signed-out → `SignInView`; awaiting-code → `CodeEntryView`; signed-in →
/// `SignedInView`. The model is created once (with the `.xcconfig`-injected origin
/// from `AppConfig`) and restores any existing Keychain session on launch.
struct RootView: View {
    @State private var model = AuthModel(client: AuthClient(baseURL: AppConfig.apiBaseURL))

    @ViewBuilder private var phaseContent: some View {
        switch model.phase {
        case .signedOut:
            SignInView(model: model)
        case .awaitingCode(let email):
            CodeEntryView(model: model, email: email)
        case .signedIn:
            SignedInView(model: model)
        }
    }

    #if DEBUG
    private var isDeletionScreenshot: Bool {
        ProcessInfo.processInfo.arguments.contains("deletion")
            && ProcessInfo.processInfo.arguments.contains("-GWUIPhase")
    }
    #endif

    var body: some View {
        NavigationStack {
            #if DEBUG
            if isDeletionScreenshot {
                AccountDeletionView(model: model)
            } else {
                phaseContent
            }
            #else
            phaseContent
            #endif
        }
        .onAppear {
            #if DEBUG
            // Deterministic screenshot support: `-GWUIPhase signIn|code|signedIn`.
            let args = ProcessInfo.processInfo.arguments
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
}

#Preview {
    RootView()
}
