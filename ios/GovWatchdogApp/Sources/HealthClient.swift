import Foundation

/// Minimal reachability probe against `GET /api/health` (Phase-1 contract 1a §1).
///
/// Scaffold scope only: this proves the `.xcconfig`-injected base URL is wired
/// end-to-end and that the app can reach the configured origin. It sends **no**
/// credentials and touches **no** gated data — `/api/health` is the public
/// reachability/version endpoint. Auth (leg 4c-3) and gated views (leg 4c-4) are
/// separate legs and are intentionally absent here.
struct HealthClient {
    let baseURL: URL

    enum Result: Equatable {
        case ok(status: Int, body: String)
        case unreachable(String)
    }

    func check() async -> Result {
        let url = baseURL.appendingPathComponent("api/health")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 10
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            // Truncate defensively; /api/health returns small non-sensitive JSON.
            let body = String(data: data.prefix(512), encoding: .utf8) ?? "<non-utf8>"
            return .ok(status: status, body: body)
        } catch {
            return .unreachable(error.localizedDescription)
        }
    }
}
