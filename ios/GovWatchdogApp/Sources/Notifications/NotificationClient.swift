import Foundation

/// Network client for the notification panel (leg 4c-4).
///
/// Talks to `GET /api/notifications` (Phase-1 contract 1a §6). This endpoint is
/// **flag-gated**: while the notifications feature flag is off, the backend answers a
/// constant `404`. The AC (spec §5 item 4) requires the panel render that honestly as
/// a "feature unavailable" state — never an error, never a fabricated empty inbox that
/// implies the feature is live. Same no-cookie-jar / no-cache / no-PII-in-logs
/// discipline as the other clients.
struct NotificationClient {
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

    enum Load: Equatable {
        case loaded(NotificationResponse)   // 200 — server-authored rows (may be empty inbox)
        case unavailable                    // 404 — flag off → honest "feature unavailable"
        case signedOut                      // 401 — session invalid
        case failed(String)                 // transport/other; message pre-scrubbed
    }

    static let path = "api/notifications"

    func load(token: String) async -> Load {
        var request = URLRequest(url: baseURL.appendingPathComponent(Self.path))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("\(BetaAPI.cookieName)=\(token)", forHTTPHeaderField: "Cookie")
        do {
            let (data, response) = try await session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            switch status {
            case 200:
                guard let env = try? JSONDecoder().decode(NotificationResponse.self, from: data) else {
                    return .failed("Couldn't read notifications.")
                }
                return .loaded(env)
            case 401: return .signedOut
            case 404: return .unavailable
            default:  return .failed("Unexpected server response (HTTP \(status)).")
            }
        } catch {
            return .failed(LogRedaction.scrub(error.localizedDescription))
        }
    }
}
