import Foundation
import Observation

/// Observable state machine for the native sign-in flow (GOV-1539).
///
/// Holds the whole auth lifecycle: signed-out → awaiting-code → signed-in, plus the
/// account-deletion request. The email and code live **only** here, in memory
/// (spec §5: "email addresses appear only in the sign-in form and in transit"); the
/// only value that touches disk is the session token, via `SessionStore`.
///
/// The model is transport-agnostic: it takes an `AuthClient` and a `SessionStore`,
/// so tests can drive the state machine without a network or a real Keychain.
@Observable
@MainActor
final class AuthModel {
    enum Phase: Equatable {
        case signedOut
        case awaitingCode(email: String)   // code emailed; entering the 6 digits
        case signedIn
    }

    private(set) var phase: Phase = .signedOut
    private(set) var isBusy = false

    /// A single, enumeration-neutral status line shown under the active form. It is
    /// pre-scrubbed of PII and never reveals whether an address is eligible.
    private(set) var statusMessage: String?

    /// Deletion-request UI state (only meaningful while `signedIn`).
    enum DeletionState: Equatable {
        case idle
        case submitting
        case submitted
        case routePending   // honest: backend deletion route not deployed yet
        case failed(String)
    }
    private(set) var deletion: DeletionState = .idle

    private let client: AuthClient
    private let store: SessionStore

    init(client: AuthClient, store: SessionStore = .live) {
        self.client = client
        self.store = store
    }

    /// Restore the signed-in state on launch if a token is already in the Keychain.
    /// (Validation of that token happens lazily on the first gated call — leg 4c-4.)
    func bootstrap() {
        if store.hasSession() { phase = .signedIn }
    }

    // MARK: - Sign-in

    /// Basic client-side email shape check — format-only, exactly like the web
    /// front door (GOV-804). It never implies the address is registered.
    nonisolated static func isPlausibleEmail(_ email: String) -> Bool {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let regex = try? NSRegularExpression(
            pattern: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        ) else { return false }
        return regex.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)) != nil
    }

    nonisolated static func isSixDigitCode(_ code: String) -> Bool {
        code.count == 6 && code.allSatisfy(\.isNumber)
    }

    func requestCode(email rawEmail: String) async {
        let email = rawEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.isPlausibleEmail(email) else {
            statusMessage = "Enter a valid email address."
            return
        }
        isBusy = true; statusMessage = nil
        defer { isBusy = false }

        switch await client.requestCode(email: email) {
        case .sent:
            phase = .awaitingCode(email: email)
            // Neutral copy: identical whether or not the address is eligible.
            statusMessage = "If that email is approved for the beta, a 6-digit code is on its way."
        case .unavailable:
            statusMessage = "The beta sign-in isn’t available right now."
        case .failed(let message):
            statusMessage = "Couldn’t reach the server. \(message)"
        }
    }

    func submitCode(_ rawCode: String) async {
        guard case let .awaitingCode(email) = phase else { return }
        let code = rawCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.isSixDigitCode(code) else {
            statusMessage = "Enter the 6-digit code from your email."
            return
        }
        isBusy = true; statusMessage = nil
        defer { isBusy = false }

        let (outcome, token) = await client.consumeCode(email: email, code: code)
        switch outcome {
        case .signedIn:
            guard let token else { statusMessage = "Sign-in failed. Try again."; return }
            do {
                try store.save(token)
                phase = .signedIn
                statusMessage = nil
            } catch {
                // Do not surface the underlying keychain status verbatim.
                statusMessage = "Couldn’t securely store your session. Try again."
            }
        case .rejected:
            // One neutral message for wrong/expired code or non-eligible email.
            statusMessage = "That code didn’t work. Check it and try again, or request a new one."
        case .unavailable:
            statusMessage = "The beta sign-in isn’t available right now."
        case .failed(let message):
            statusMessage = "Couldn’t reach the server. \(message)"
        }
    }

    /// Go back to the email step (e.g. "use a different email" / "resend").
    func restartSignIn() {
        phase = .signedOut
        statusMessage = nil
    }

    // MARK: - Sign-out

    /// Destroy the local session unconditionally, then best-effort revoke it
    /// server-side. Keychain deletion happens even if the network call fails, so the
    /// user is never left signed-in locally with a token we tried to discard.
    func signOut() async {
        isBusy = true
        defer { isBusy = false }

        let token = try? store.load()
        try? store.delete()
        phase = .signedOut
        deletion = .idle
        statusMessage = nil

        if let token, case .failed = await client.signOut(token: token) {
            // Local sign-out already succeeded; a failed server revoke is non-fatal
            // and not surfaced as an error to the user.
        }
    }

    // MARK: - Account deletion request

    /// Submit a deletion request through the backend account lifecycle. Never
    /// deletes anything client-side; renders an honest state for every outcome.
    func requestAccountDeletion() async {
        guard let token = try? store.load() else {
            deletion = .failed("You’re not signed in.")
            return
        }
        deletion = .submitting
        switch await client.requestAccountDeletion(token: token) {
        case .submitted:
            deletion = .submitted
        case .routePending:
            deletion = .routePending
        case .failed(let message):
            deletion = .failed(message)
        }
    }

    func resetDeletionState() { deletion = .idle }

    #if DEBUG
    /// Force a starting phase for deterministic screenshotting (fastlane-snapshot
    /// pattern). DEBUG-only and driven by a launch argument in `RootView`; it never
    /// ships in a Release build and touches no network or Keychain.
    func debugForcePhase(_ phase: Phase) { self.phase = phase }
    #endif
}
