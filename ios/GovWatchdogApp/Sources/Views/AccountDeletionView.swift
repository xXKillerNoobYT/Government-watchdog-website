import SwiftUI

/// Account-deletion request screen — App Store Review Guideline 5.1.1(v)
/// (GOV-1539, spec §2 item 4).
///
/// The app **never deletes anything client-side**: this screen submits a request
/// that routes through the backend account lifecycle. Because the beta accounts are
/// waitlist-approved by the owner, deletion is a *request* that the backend
/// processes — the screen states that plainly and renders an honest state for every
/// outcome, including the current reality that the backend deletion route may not be
/// deployed yet (`.routePending`).
struct AccountDeletionView: View {
    @Bindable var model: AuthModel

    var body: some View {
        Form {
            Section {
                Text("Delete your account")
                    .font(.headline)
                Text("This sends a deletion request to the Government Watchdog team. "
                     + "Your account and associated beta data will be removed through our "
                     + "backend process. Nothing is deleted on this device alone.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section {
                switch model.deletion {
                case .idle, .failed:
                    Button(role: .destructive) {
                        Task { await model.requestAccountDeletion() }
                    } label: {
                        Label("Request account deletion", systemImage: "trash")
                    }
                case .submitting:
                    HStack { ProgressView(); Text("Submitting…") }
                case .submitted, .routePending:
                    EmptyView()
                }
            } footer: {
                deletionFooter
            }

            if case .signedIn = model.phase {
                Section {
                    Text("After deletion is processed you’ll be signed out on all devices "
                         + "and your beta access will end.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Delete account")
        .onDisappear { model.resetDeletionState() }
    }

    @ViewBuilder
    private var deletionFooter: some View {
        switch model.deletion {
        case .idle:
            Text("You can request deletion at any time.")
        case .submitting:
            EmptyView()
        case .submitted:
            Label("Request received. The team will process your deletion.",
                  systemImage: "checkmark.circle")
                .foregroundStyle(.green)
        case .routePending:
            // Honest state: no backend deletion route is deployed yet (leg 4c-2
            // addendum). We do NOT fake success.
            Label("Deletion requests aren’t being accepted in this build yet. "
                  + "Please contact the team to delete your account.",
                  systemImage: "exclamationmark.triangle")
                .foregroundStyle(.orange)
        case .failed(let message):
            Label("Couldn’t submit your request. \(message)",
                  systemImage: "xmark.octagon")
                .foregroundStyle(.red)
        }
    }
}
