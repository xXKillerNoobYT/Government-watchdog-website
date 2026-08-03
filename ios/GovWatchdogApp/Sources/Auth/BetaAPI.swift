import Foundation

/// Route + wire-format constants for the gated-beta account surface.
///
/// These mirror the **delivered** backend contract verbatim (GOV-1538 / leg 4c-2,
/// `scripts/beta/http_api.py` + `service.py` @ backend `001c6ed`):
///
///   * `POST /api/beta/magic-link/request`  `{email}`        → neutral `200` (always)
///   * `POST /api/beta/magic-link/consume`  `{email, code}`  → `200` + `Set-Cookie:
///        gw_beta_session=<token>` **or** one neutral `401 {"error":"invalid_code"}`;
///        constant `404` while the beta flag is off.
///   * `DELETE /api/beta/sessions/current`  (auth via session) → `200` (sign-out)
///
/// **Contract note (escalated to CTO — see the issue thread).** Spec §1 envisioned a
/// *bearer* session returned in the body ("native uses bearer directly"). The
/// backend that actually shipped reuses the existing cookie session: the token is
/// delivered only in the `Set-Cookie` header, and the sign-out route reads it from
/// the `Cookie` header. This client therefore extracts the raw token from
/// `Set-Cookie`, stores it as the single Keychain secret, and replays it in the
/// `Cookie` header. It never relies on `URLSession`'s on-disk cookie jar (that would
/// violate the "Keychain is the only stored secret" rule); the jar is disabled in
/// `AuthClient`. Switching to `Authorization: Bearer` is a one-line change here if a
/// later 4c-2 addendum adds a bearer route.
enum BetaAPI {
    static let cookieName = "gw_beta_session"

    static let requestPath = "api/beta/magic-link/request"
    static let consumePath = "api/beta/magic-link/consume"
    static let signOutPath = "api/beta/sessions/current"

    /// Account-deletion request (App Store Guideline 5.1.1(v)). **Delivered** by
    /// GOV-1565 (backend `main` @ `ae04c8b`, PR #199): `POST` here, authed via the
    /// same `gw_beta_session` cookie this client replays, queues the request and
    /// answers `200`/`202`, which `AuthClient.requestAccountDeletion` maps to
    /// `.submitted` — so the deletion screen shows the honest "Request received"
    /// state against the merged backend. The `.routePending` branch is retained as a
    /// fail-closed fallback: a `404` (e.g. the beta flag is off, or an older backend
    /// pin) still renders an honest "backend route pending" state rather than faking
    /// success (AC #3 = *honest* state, never a client-side delete).
    static let deletionPath = "api/beta/account/deletion-request"
}

/// Redaction helpers so nothing sensitive can reach a device log by accident.
///
/// Spec §5: "logs on device must never contain email, token, or row contents." The
/// app does not log request/response bodies at all; these helpers exist so any
/// *diagnostic* string the UI or a test surfaces is scrubbed first.
enum LogRedaction {
    /// Collapse any email-shaped substring to `<redacted-email>`.
    static func scrub(_ text: String) -> String {
        guard let regex = try? NSRegularExpression(
            pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"
        ) else { return text }
        let range = NSRange(text.startIndex..., in: text)
        return regex.stringByReplacingMatches(
            in: text, range: range, withTemplate: "<redacted-email>"
        )
    }
}

/// Extract the raw `gw_beta_session` value from a response's `Set-Cookie` header(s).
///
/// `HTTPURLResponse` folds multiple `Set-Cookie` headers into one comma-joined
/// string, which is ambiguous to split by hand (cookie `Expires` values also
/// contain commas). Foundation's `HTTPCookie.cookies(withResponseHeaderFields:)`
/// parses it correctly, so we lean on it — without ever installing the cookie into
/// a persistent jar.
func sessionToken(fromSetCookieOn response: HTTPURLResponse, url: URL) -> String? {
    let fields = response.allHeaderFields.reduce(into: [String: String]()) { acc, kv in
        if let k = kv.key as? String, let v = kv.value as? String { acc[k] = v }
    }
    let cookies = HTTPCookie.cookies(withResponseHeaderFields: fields, for: url)
    return cookies.first(where: { $0.name == BetaAPI.cookieName })?.value
}
