import SwiftUI

/// Scaffold landing screen (GOV-1537).
///
/// Deliberately minimal: it confirms the app builds/runs and that the API base URL
/// is resolved *only* from build settings. It shows the configured origin and an
/// optional `/api/health` reachability probe. It renders **no** civic data and
/// makes **no** verification claims — later legs add sign-in and gated views.
struct ContentView: View {
    @State private var healthLine: String = "Not checked yet."
    @State private var isChecking = false

    var body: some View {
        NavigationStack {
            List {
                Section("Government Watchdog — Beta (scaffold)") {
                    LabeledContent("Status", value: "Scaffold build")
                    LabeledContent("Issue", value: "GOV-1537 · Phase 4c-1")
                    LabeledContent("Platform", value: "iOS 17+ · iPhone")
                }

                Section("Configured API origin") {
                    Text(AppConfig.displayOrigin)
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)
                    Text("Injected from the active .xcconfig (GW_API_BASE_URL). Never hardcoded.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Reachability probe (GET /api/health)") {
                    Button {
                        Task { await runHealthCheck() }
                    } label: {
                        if isChecking {
                            ProgressView()
                        } else {
                            Text("Check /api/health")
                        }
                    }
                    .disabled(isChecking)

                    Text(healthLine)
                        .font(.system(.footnote, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }

                Section {
                    Text("This scaffold shows no civic data and makes no verification claims. "
                         + "Sign-in and gated views arrive in later legs (4c-3, 4c-4).")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Gov Watchdog")
        }
    }

    private func runHealthCheck() async {
        isChecking = true
        defer { isChecking = false }
        let result = await HealthClient(baseURL: AppConfig.apiBaseURL).check()
        switch result {
        case let .ok(status, body):
            healthLine = "HTTP \(status)\n\(body)"
        case let .unreachable(message):
            healthLine = "Unreachable: \(message)\n(Is `npm run e2e:local` running with GW_KEEP_UP=1?)"
        }
    }
}

#Preview {
    ContentView()
}
