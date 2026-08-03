import Foundation

/// Network client for the gated reviewer-internal read surface (leg 4c-4).
///
/// Talks to `GET /api/reviewer-internal` (Phase-1 contract 1a §1, the frozen 8-clause
/// `reviewer_internal_records` gate). Design constraints, identical to `AuthClient`:
///   * **No on-disk cookie jar / no response cache** — the session config disables
///     both, so gated rows are never written to disk (spec §5: "gated rows live in
///     memory only; nothing written to disk except the Keychain session token").
///   * **Session presented in the `Cookie` header** (the delivered backend reads the
///     `gw_beta_session` cookie — same adaptation `AuthClient` documents).
///   * **No PII in logs** — nothing here logs bodies, tokens, or row contents.
///   * **Fail-closed** — reaching the gated endpoint with `200` is the approval
///     signal; every other outcome renders zero civic data.
struct ReviewerClient {
    let baseURL: URL
    let session: URLSession

    init(baseURL: URL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.urlCache = nil
        config.timeoutIntervalForRequest = 20
        self.session = URLSession(configuration: config)
    }

    /// Outcome of loading the reviewer-internal lane. Only `.approved` ever carries
    /// civic data; every other case renders a gate panel or an honest error.
    enum Load: Equatable {
        case approved([ReviewerRecord])   // reached the gated endpoint → records (may be empty)
        case gated(AccessState)           // backend named a recognized non-approved state
        case indeterminate                // signed in but state unknown → fail-closed, zero data
        case unavailable                  // 404 — gate off / feature unavailable
        case signedOut                    // 401 — session invalid, sign back in
        case failed(String)               // transport/other; message pre-scrubbed
    }

    static let path = "api/reviewer-internal"

    func load(token: String) async -> Load {
        var request = URLRequest(url: baseURL.appendingPathComponent(Self.path))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("\(BetaAPI.cookieName)=\(token)", forHTTPHeaderField: "Cookie")
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                return .failed("Unexpected server response.")
            }
            switch http.statusCode {
            case 200:
                let env = try? JSONDecoder().decode(ReviewerResponse.self, from: data)
                // A recognized *non-approved* state from the backend wins even on 200.
                if let wire = env?.accessState,
                   let state = AccessState.resolve(wire: wire),
                   !state.isApproved {
                    return .gated(state)
                }
                // Reaching the gated endpoint with 200 == approved (rows may be empty).
                return .approved(env?.records ?? [])
            case 401:
                return .signedOut
            case 403:
                // Not approved. Honor a recognized state; otherwise fail closed.
                let env = try? JSONDecoder().decode(ReviewerResponse.self, from: data)
                if let state = AccessState.resolve(wire: env?.accessState) { return .gated(state) }
                return .indeterminate
            case 404:
                return .unavailable
            default:
                return .failed("Unexpected server response (HTTP \(http.statusCode)).")
            }
        } catch {
            return .failed(LogRedaction.scrub(error.localizedDescription))
        }
    }
}
