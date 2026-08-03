import SwiftUI

/// The signed-in root (leg 4c-4). A three-tab shell: **Records** (the gated
/// reviewer-internal surface), **Alerts** (the notification panel), and **Account**
/// (sign-out + account-deletion request, carried over from leg 4c-3).
///
/// Civic data lives only in the Records tab's `.approved` branch; every other access
/// state renders a gate panel there. Each tab owns its own `NavigationStack`.
struct GatedAppView: View {
    @Bindable var auth: AuthModel
    @State private var gated = GatedModel(baseURL: AppConfig.apiBaseURL)

    var body: some View {
        TabView {
            RecordsTabView(gated: gated)
                .tabItem { Label("Records", systemImage: "doc.text.magnifyingglass") }

            NotificationPanelView(gated: gated)
                .tabItem { Label("Alerts", systemImage: "bell") }

            AccountTabView(auth: auth)
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}

/// The Records tab: resolves the access state, then shows the reviewer list
/// (approved only) or the appropriate gate panel / honest status.
struct RecordsTabView: View {
    @Bindable var gated: GatedModel

    var body: some View {
        NavigationStack {
            content
        }
        .task { await gated.load() }
    }

    @ViewBuilder private var content: some View {
        switch gated.state {
        case .loading:
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)

        case .approved(let records):
            ReviewerListView(records: records)

        case .gated(let panel):
            GatedStateView(panel: panel)

        case .indeterminate:
            GatedStateView(
                panel: GatedStateView.failClosed(
                    title: "We couldn't confirm your access",
                    message: "Your access status isn't available right now, so no records are "
                        + "shown. This is shown fail-closed — nothing is hidden or implied about "
                        + "your standing. Try again shortly."),
                footnote: "No civic data is loaded in this state.")

        case .unavailable:
            GatedStateView(
                panel: GatedStateView.failClosed(
                    title: "The beta isn't available right now",
                    message: "The gated beta service isn't reachable for this build. No records "
                        + "are shown."),
                footnote: "No civic data is loaded in this state.")

        case .signedOut:
            GatedStateView(
                panel: GatePanel.content(for: .anonymous),
                footnote: "Your session has ended. Use the Account tab to sign in again.")

        case .error(let message):
            ContentUnavailableView {
                Label("Couldn't load records", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await gated.load() } }
                    .frame(minHeight: 44)
            }
        }
    }
}

/// The Account tab: signed-in confirmation, account-deletion request, and sign-out.
/// Carried over verbatim from leg 4c-3's `SignedInView`; shows no civic data.
struct AccountTabView: View {
    @Bindable var auth: AuthModel
    @State private var showSignOutConfirm = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label("Signed in", systemImage: "checkmark.seal")
                        .font(.headline)
                    Text("Your session is stored securely in the iOS Keychain on this device only.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Account") {
                    NavigationLink {
                        AccountDeletionView(model: auth)
                    } label: {
                        Label("Request account deletion", systemImage: "trash")
                            .frame(minHeight: 44)
                    }

                    Button(role: .destructive) {
                        showSignOutConfirm = true
                    } label: {
                        HStack {
                            if auth.isBusy { ProgressView() }
                            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                        .frame(minHeight: 44)
                    }
                    .disabled(auth.isBusy)
                }
            }
            .navigationTitle("Account")
            .confirmationDialog("Sign out of Government Watchdog?",
                                isPresented: $showSignOutConfirm, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { Task { await auth.signOut() } }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your session token will be removed from this device.")
            }
        }
    }
}
