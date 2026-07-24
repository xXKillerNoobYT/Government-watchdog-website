import SwiftUI

/// Step 2 of native sign-in: 6-digit code entry (GOV-1539, spec §1 #1).
///
/// The code is the universal-link fallback (spec §1: v1 has no AASA file until
/// Phase 3, so the same email carries a 6-digit code). One neutral message covers a
/// wrong/expired code or a non-eligible email — no enumeration signal.
struct CodeEntryView: View {
    @Bindable var model: AuthModel
    let email: String
    @State private var code = ""
    @FocusState private var codeFocused: Bool

    var body: some View {
        Form {
            Section {
                Text("Enter your code")
                    .font(.headline)
                Text("We sent a 6-digit code to your email. Enter it to finish signing in.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section("6-digit code") {
                TextField("123456", text: $code)
                    .textContentType(.oneTimeCode)
                    .keyboardType(.numberPad)
                    .font(.system(.title2, design: .monospaced))
                    .focused($codeFocused)
                    .onChange(of: code) { _, newValue in
                        // Keep only digits, cap at 6 — the field can't hold junk.
                        let digits = newValue.filter(\.isNumber)
                        code = String(digits.prefix(6))
                    }
            }

            Section {
                Button {
                    codeFocused = false
                    Task { await model.submitCode(code) }
                } label: {
                    HStack {
                        if model.isBusy { ProgressView() }
                        Text("Verify and sign in")
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(model.isBusy || !AuthModel.isSixDigitCode(code))
            }

            if let message = model.statusMessage {
                Section { StatusLine(message) }
            }

            Section {
                Button("Use a different email") { model.restartSignIn() }
                    .disabled(model.isBusy)
            }
        }
        .navigationTitle("Verify")
        .onAppear { codeFocused = true }
    }
}
