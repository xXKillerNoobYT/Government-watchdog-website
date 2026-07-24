import SwiftUI

/// Signed-in home (GOV-1539). This leg (4c-3) delivers the *authenticated shell* —
/// the signed state, sign-out, and the account-deletion entry point. The gated data
/// views (reviewer-internal list/detail, six access states, notification panel) are
/// **leg 4c-4** and are intentionally not here yet; this screen says so honestly and
/// shows no civic data / makes no verification claims.
struct SignedInView: View {
    @Bindable var model: AuthModel
    @State private var showSignOutConfirm = false

    var body: some View {
        List {
            Section {
                Label("Signed in", systemImage: "checkmark.seal")
                    .font(.headline)
                Text("Your session is stored securely in the iOS Keychain on this device only.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Beta") {
                Text("Gated civic views arrive in the next update (leg 4c-4). "
                     + "This build proves sign-in, secure session storage, sign-out, "
                     + "and the account-deletion request.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section("Account") {
                NavigationLink {
                    AccountDeletionView(model: model)
                } label: {
                    Label("Request account deletion", systemImage: "trash")
                }

                Button(role: .destructive) {
                    showSignOutConfirm = true
                } label: {
                    HStack {
                        if model.isBusy { ProgressView() }
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
                .disabled(model.isBusy)
            }
        }
        .navigationTitle("Government Watchdog")
        .confirmationDialog("Sign out of Government Watchdog?",
                            isPresented: $showSignOutConfirm, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await model.signOut() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your session token will be removed from this device.")
        }
    }
}
