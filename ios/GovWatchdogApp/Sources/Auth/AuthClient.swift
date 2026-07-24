import Foundation

/// Network client for the gated-beta sign-in surface.
///
/// Design constraints (GOV-1539, spec §1/§5):
///   * **HTTPS-only in Release.** The base URL comes from `AppConfig` (Release =
///     Phase-3 HTTPS origin; Debug = loopback e2e over the ATS-compliant
///     `NSAllowsLocalNetworking`). This client adds no ATS exceptions.
///   * **No on-disk cookie jar.** The session config sets `httpCookieStorage = nil`
///     and `httpShouldSetCookies = false`, so the session token is never persisted
///     by `URLSession` — the Keychain (`SessionStore`) is the single stored secret.
///   * **Enumeration-neutral.** The caller maps a rejected code to the same message
///     as any other failure; this client just reports typed outcomes.
///   * **No PII in logs.** Nothing here logs bodies, emails, codes, or tokens.
struct AuthClient {
    let baseURL: URL
    let session: URLSession

    init(baseURL: URL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil          // never persist Set-Cookie to disk
        config.httpShouldSetCookies = false      // do not auto-attach a cookie jar
        config.urlCache = nil                    // no response caching of gated calls
        config.timeoutIntervalForRequest = 20
        self.session = URLSession(configuration: config)
    }

    // MARK: - Outcomes

    /// Result of asking the backend to email a code. Neutral by design: a `200`
    /// never confirms the address is allow-listed.
    enum RequestOutcome: Equatable {
        case sent                 // neutral 200 — "if eligible, a code is on its way"
        case unavailable          // 404 — beta gate off (feature-unavailable)
        case failed(String)       // transport/other; message is pre-scrubbed
    }

    /// Result of consuming a code.
    enum ConsumeOutcome: Equatable {
        case signedIn             // 200 + session token captured
        case rejected             // single neutral 401 — bad/expired code or not eligible
        case unavailable          // 404 — beta gate off
        case failed(String)       // transport/other; message is pre-scrubbed
    }

    enum SignOutOutcome: Equatable {
        case signedOut            // server acknowledged (or session already gone)
        case failed(String)
    }

    /// Deletion-request outcome. `.routePending` distinguishes "no backend route
    /// exists yet" (honest, per AC #3) from a real submission acknowledgement.
    enum DeletionOutcome: Equatable {
        case submitted            // 200/202 — backend queued the deletion request
        case routePending         // 404 — no deletion route deployed yet
        case failed(String)
    }

    // MARK: - Calls

    func requestCode(email: String) async -> RequestOutcome {
        let body = ["email": email]
        do {
            let (_, http) = try await postJSON(BetaAPI.requestPath, body: body)
            switch http.statusCode {
            case 200: return .sent
            case 404: return .unavailable
            default:  return .failed("Unexpected server response (HTTP \(http.statusCode)).")
            }
        } catch {
            return .failed(LogRedaction.scrub(error.localizedDescription))
        }
    }

    /// Consume the code; on success the raw session token is returned so the caller
    /// can persist it in the Keychain. The token is never logged here.
    func consumeCode(email: String, code: String) async -> (ConsumeOutcome, token: String?) {
        let body = ["email": email, "code": code]
        do {
            let (_, http) = try await postJSON(BetaAPI.consumePath, body: body)
            switch http.statusCode {
            case 200:
                guard let token = sessionToken(fromSetCookieOn: http, url: http.url ?? baseURL) else {
                    // 200 without a session cookie is a contract violation — fail closed.
                    return (.failed("Sign-in response missing a session."), nil)
                }
                return (.signedIn, token)
            case 401: return (.rejected, nil)
            case 404: return (.unavailable, nil)
            default:  return (.failed("Unexpected server response (HTTP \(http.statusCode)).") , nil)
            }
        } catch {
            return (.failed(LogRedaction.scrub(error.localizedDescription)), nil)
        }
    }

    /// Sign out: tell the backend to revoke the session, presenting the token in the
    /// `Cookie` header (the route the delivered backend reads — see `BetaAPI`).
    /// Keychain destruction is the caller's responsibility and happens regardless of
    /// the network outcome, so a signed-out user is never left holding a live token.
    func signOut(token: String) async -> SignOutOutcome {
        var request = URLRequest(url: baseURL.appendingPathComponent(BetaAPI.signOutPath))
        request.httpMethod = "DELETE"
        request.setValue("\(BetaAPI.cookieName)=\(token)", forHTTPHeaderField: "Cookie")
        do {
            let (_, response) = try await session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            // 200 = revoked; 401/404 = already gone / gate off — both mean "no live
            // session remains", which is what sign-out guarantees.
            if status == 200 || status == 401 || status == 404 { return .signedOut }
            return .failed("Unexpected server response (HTTP \(status)).")
        } catch {
            return .failed(LogRedaction.scrub(error.localizedDescription))
        }
    }

    /// Submit an account-deletion request through the backend lifecycle (no
    /// client-side delete). Authenticated with the session token in `Cookie`.
    func requestAccountDeletion(token: String) async -> DeletionOutcome {
        var request = URLRequest(url: baseURL.appendingPathComponent(BetaAPI.deletionPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("\(BetaAPI.cookieName)=\(token)", forHTTPHeaderField: "Cookie")
        request.httpBody = Data("{}".utf8)
        do {
            let (_, response) = try await session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            switch status {
            case 200, 202: return .submitted
            case 404:      return .routePending
            default:       return .failed("Unexpected server response (HTTP \(status)).")
            }
        } catch {
            return .failed(LogRedaction.scrub(error.localizedDescription))
        }
    }

    // MARK: - Helpers

    private func postJSON(_ path: String, body: [String: String]) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        return (data, http)
    }
}
