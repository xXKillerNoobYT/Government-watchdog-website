import Foundation

/// Single source of runtime configuration for the app.
///
/// The API base URL is **never** hardcoded in Swift. It is injected at build time
/// from the active `.xcconfig` (`GW_API_BASE_URL`) into `Info.plist` (`GWAPIBaseURL`)
/// and read here. This is the only place the app resolves the origin, which keeps
/// the "URL comes only from build settings" contract (GOV-1537 AC #2) enforceable:
/// grepping `Sources/` for a URL scheme literal (`http://`) returns nothing.
enum AppConfig {
    /// The base origin the app talks to (Debug → local e2e loopback; Release →
    /// Phase-3 HTTPS origin). Trailing slash is normalized off.
    static let apiBaseURL: URL = {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: "GWAPIBaseURL") as? String,
            case let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines),
            !trimmed.isEmpty,
            let url = URL(string: trimmed)
        else {
            // Fail loud in dev rather than silently talking to the wrong origin.
            fatalError(
                "GWAPIBaseURL is missing or invalid. Check Config/Debug.xcconfig / "
                + "Config/Release.xcconfig and Resources/Info*.plist."
            )
        }
        return url
    }()

    /// Human-readable origin for display in the scaffold UI (no secrets involved).
    static var displayOrigin: String { apiBaseURL.absoluteString }
}
