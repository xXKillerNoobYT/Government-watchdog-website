import Foundation

/// In-app notification contract (leg 4c-4), mirrored from the website's
/// `src/types/notification.ts` (GOV-758 / GOV-754). Rendering is copy-from-data: the
/// panel shows the server-authored `title`/`body` VERBATIM and never fabricates a
/// notification. The five kinds mirror the leg-2 writer's enumerated events; an
/// unknown kind still renders (it is carried verbatim) rather than being dropped.

/// The events the backend writes an in-app notification for (GOV-754 #3 / AC-6).
enum NotificationKind: String, Decodable, CaseIterable {
    case accountApproved = "account_approved"
    case accountRevoked = "account_revoked"
    case cohortAdvanced = "cohort_advanced"
    case consentRecorded = "consent_recorded"
    case unsubscribeConfirmed = "unsubscribe_confirmed"

    /// SF Symbol for the kind. Neutral iconography — it conveys the event category,
    /// never a civic-trust claim.
    var symbol: String {
        switch self {
        case .accountApproved:     return "checkmark.seal"
        case .accountRevoked:      return "xmark.seal"
        case .cohortAdvanced:      return "arrow.forward.circle"
        case .consentRecorded:     return "hand.raised"
        case .unsubscribeConfirmed: return "envelope.badge"
        }
    }
}

/// One in-app notification row as the query endpoint returns it. All display text is
/// server-authored and rendered verbatim.
struct NotificationItem: Decodable, Equatable, Identifiable {
    let id: String
    /// Raw kind string, retained verbatim so an unknown value is never lost.
    let kindRaw: String
    let title: String
    let body: String
    let createdUTC: String?
    let read: Bool

    var kind: NotificationKind? { NotificationKind(rawValue: kindRaw) }

    private enum CodingKeys: String, CodingKey {
        case id, title, body, read
        case kindRaw = "kind"
        case createdUTC = "created_utc"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kindRaw = (try? c.decodeIfPresent(String.self, forKey: .kindRaw)) ?? ""
        title = (try? c.decodeIfPresent(String.self, forKey: .title)) ?? ""
        body = (try? c.decodeIfPresent(String.self, forKey: .body)) ?? ""
        createdUTC = try? c.decodeIfPresent(String.self, forKey: .createdUTC)
        read = (try? c.decodeIfPresent(Bool.self, forKey: .read)) ?? false
    }
}

/// The `GET /api/notifications` envelope (session-scoped). `unread_count` is the
/// server's authority — the panel never recomputes it.
struct NotificationResponse: Decodable, Equatable {
    let notifications: [NotificationItem]
    let unreadCount: Int

    private enum CodingKeys: String, CodingKey {
        case notifications
        case unreadCount = "unread_count"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        notifications = (try? c.decodeIfPresent([NotificationItem].self, forKey: .notifications)) ?? []
        unreadCount = (try? c.decodeIfPresent(Int.self, forKey: .unreadCount)) ?? 0
    }
}
