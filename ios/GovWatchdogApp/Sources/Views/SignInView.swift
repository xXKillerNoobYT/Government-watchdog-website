import SwiftUI

/// Step 1 of native sign-in: email entry (GOV-1539, spec §1 feature floor #1).
///
/// Enumeration-neutral: submitting always advances to the code screen with the same
/// neutral copy, whether or not the address is approved. No civic data appears here
/// (spec §1: "No civic data on any pre-auth screen").
struct SignInView: View {
    @Bindable var model: AuthModel
    @State private var email = ""
    @FocusState private var emailFocused: Bool

    var body: some View {
        Form {
            Section {
                Text("Government Watchdog — Beta")
                    .font(.headline)
                Text("Sign in with the email you were approved with. We’ll send a 6-digit code.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section("Email") {
                TextField("you@example.com", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($emailFocused)
                    .submitLabel(.send)
                    .onSubmit { Task { await model.requestCode(email: email) } }
            }

            Section {
                Button {
                    emailFocused = false
                    Task { await model.requestCode(email: email) }
                } label: {
                    HStack {
                        if model.isBusy { ProgressView() }
                        Text("Send code")
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(model.isBusy || !AuthModel.isPlausibleEmail(email))
            }

            if let message = model.statusMessage {
                Section { StatusLine(message) }
            }

            Section {
                Text("Invite-only beta. HTTPS only. We store only your email (in transit) "
                     + "and a single encrypted session token on this device.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Sign in")
        .onAppear { emailFocused = true }
    }
}

/// Small neutral status line reused across the auth screens.
struct StatusLine: View {
    let message: String
    init(_ message: String) { self.message = message }
    var body: some View {
        Text(message)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
