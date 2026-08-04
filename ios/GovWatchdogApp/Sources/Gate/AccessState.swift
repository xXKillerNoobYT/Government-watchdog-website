import Foundation

/// The six gated-beta access states (GOV-758 parity), leg 4c-4.
///
/// This is the **single source of truth** for the iOS app's access model, mirrored
/// VERBATIM from the website's `src/gate/access.ts` (GOV-758 / GOV-419). The wire
/// values (`rawValue`) and the per-state copy match the web front door exactly so a
/// resident sees the *same* words on phone and web — no state is invented here, and
/// no wording is paraphrased.
///
/// Rules this type encodes (identical to the web):
///   * There are exactly six states, ordered as the workflow lists them:
///     not-signed-in → waitlisted → pending-review → approved → denied → revoked.
///   * **Every non-`approved` state renders ZERO civic data** (spec §1 item 2 /
///     AC#3: "no pre-auth screen shows civic data"). The reviewer-internal list and
///     detail are reachable ONLY when `isApproved` is true.
///   * The waitlist / denial / revocation copy MUST NOT imply anything about a
///     person's civic standing — it is strictly about beta capacity and process.
enum AccessState: String, CaseIterable, Equatable {
    /// Not signed in (public visitor). No Keychain session present.
    case anonymous
    /// Request received, sitting in the intake queue.
    case waitlisted
    /// Pending review: a reviewer is actively evaluating. (Wire form: `pending`.)
    case pending
    /// Approved for the gated beta — the full reviewer-internal app unlocks.
    case approved
    /// Denied / needs more info (capacity / process only).
    case denied
    /// Access previously granted, now revoked / disabled / paused.
    case revoked

    /// The workflow display order (matches `ACCESS_STATES` in access.ts).
    static let ordered: [AccessState] = [
        .anonymous, .waitlisted, .pending, .approved, .denied, .revoked,
    ]

    /// Whether the full reviewer-internal app may render for this state.
    /// The ONLY affirmative state — mirrors `isApproved()` in access.ts.
    var isApproved: Bool { self == .approved }

    /// Resolve a backend-supplied access-state string, **fail-closed**.
    ///
    /// Returns the matching state only on an EXACT match to one of the six wire
    /// values; any missing, empty, or unrecognized value returns `nil` so the caller
    /// renders a neutral "access state unavailable" panel (zero civic data) rather
    /// than fabricating a specific standing. This is the same fail-closed discipline
    /// the frontend applies to `provenance_status` (only exact `grounded` passes).
    static func resolve(wire: String?) -> AccessState? {
        guard let wire, !wire.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return AccessState(rawValue: wire)
    }
}

/// The rendered content for one access state. Pure data — the SwiftUI lives in
/// `GatedStateView`. Mirrors `GatePanel` in access.ts (badge / title / message),
/// with the same verbatim copy.
struct GatePanel: Equatable {
    let state: AccessState
    /// Short status chip text, e.g. "Waitlisted".
    let badge: String
    let title: String
    let message: String
    /// Optional forward affordance label (e.g. "Request access again"). No civic
    /// data ever hides behind it.
    let actionLabel: String?

    /// Per-state panel copy — the single place gate wording is defined on iOS,
    /// copied verbatim from `gatePanelContent()` in access.ts.
    static func content(for state: AccessState) -> GatePanel {
        switch state {
        case .waitlisted:
            return GatePanel(
                state: state,
                badge: "Waitlisted",
                title: "You're on the waitlist",
                message: "Thanks — your request is in the queue. We admit beta access in small "
                    + "batches to keep source-review quality and moderation manageable, so there "
                    + "may be a wait. A reviewer will follow up by email; nothing more is needed "
                    + "from you right now.",
                actionLabel: nil)
        case .pending:
            return GatePanel(
                state: state,
                badge: "In review",
                title: "Your request is being reviewed",
                message: "A reviewer is looking at your beta request now. This is a routine "
                    + "capacity and access-review step — we'll email you the moment there's a "
                    + "decision. You don't need to do anything else.",
                actionLabel: nil)
        case .denied:
            // AC#5 — denial copy must NOT imply anything about civic standing.
            return GatePanel(
                state: state,
                badge: "Needs more info",
                title: "We need a bit more before we can grant access",
                message: "We couldn't approve this beta request yet. This is only about beta "
                    + "capacity and our access-review process — it does not reflect anything "
                    + "about you, your community, or your standing as a resident or citizen. "
                    + "You can request access again later.",
                actionLabel: nil)
        case .revoked:
            // AC#5 (extended to revoked) — revocation copy must NOT imply anything
            // about the person's civic standing.
            return GatePanel(
                state: state,
                badge: "Access ended",
                title: "Your beta access has ended",
                message: "Your gated-beta access has been turned off. Beta access is a "
                    + "controlled, revocable preview managed for capacity, quality, and "
                    + "moderation — it does not reflect anything about you, your community, or "
                    + "your standing as a resident or citizen. You can request access again.",
                actionLabel: "Request access again")
        case .approved:
            return GatePanel(
                state: state,
                badge: "Approved",
                title: "Access approved",
                message: "You're approved for the gated beta. Open the full Government Watchdog app.",
                actionLabel: "Open the full app")
        case .anonymous:
            return GatePanel(
                state: state,
                badge: "Not signed in",
                title: "Request beta access",
                message: "The full Government Watchdog app is in gated beta. Access is controlled "
                    + "to protect quality, safety, moderation, and source-review integrity. Sign "
                    + "in with your approved beta email; a reviewer will follow up if you're not "
                    + "yet admitted.",
                actionLabel: nil)
        }
    }
}
