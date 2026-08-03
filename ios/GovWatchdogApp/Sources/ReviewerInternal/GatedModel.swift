import Foundation
import Observation

/// Observable state for the gated views (leg 4c-4): the access-state resolution, the
/// reviewer-internal records, and the notification panel.
///
/// Invariants this model guarantees for the whole gated surface:
///   * **Civic data exists only in `.approved`.** Every other `ViewState` carries a
///     gate panel or an honest status and renders ZERO records (AC#3).
///   * **Nothing is fabricated.** There is no fixture fallback, no sample row, no
///     synthesized notification. An unknown backend value fails closed to a
///     non-committal state, never to invented content (F1/F9).
///   * **Gated rows are memory-only** — held on this `@MainActor` object, backed by
///     `URLSession.ephemeral` (no disk cache, no cookie jar). Nothing is persisted.
@Observable
@MainActor
final class GatedModel {

    /// The reviewer-internal surface state. Only `.approved` shows civic data.
    enum ViewState: Equatable {
        case loading
        case approved([ReviewerRecord])
        case gated(GatePanel)     // a recognized non-approved access state
        case indeterminate        // signed in but state unknown — fail-closed, zero data
        case unavailable          // gate off (404)
        case signedOut            // session invalid (401)
        case error(String)
    }

    /// The notification panel state. `.unavailable` is the honest flag-off (404) case.
    enum NotificationsState: Equatable {
        case loading
        case loaded(NotificationResponse)
        case unavailable          // flag off (404) — "feature unavailable", not an error
        case error(String)
    }

    private(set) var state: ViewState = .loading
    private(set) var notifications: NotificationsState = .loading

    private let reviewer: ReviewerClient
    private let notifier: NotificationClient
    private let store: SessionStore

    init(baseURL: URL, store: SessionStore = .live) {
        self.reviewer = ReviewerClient(baseURL: baseURL)
        self.notifier = NotificationClient(baseURL: baseURL)
        self.store = store
    }

    // MARK: - Reviewer-internal records

    func load() async {
        #if DEBUG
        if let forced = Self.debugForcedState {
            state = forced.isApproved ? .approved([]) : .gated(GatePanel.content(for: forced))
            return
        }
        #endif
        state = .loading
        guard let token = try? store.load() else {
            state = .signedOut
            return
        }
        switch await reviewer.load(token: token) {
        case .approved(let records): state = .approved(records)
        case .gated(let s):          state = .gated(GatePanel.content(for: s))
        case .indeterminate:         state = .indeterminate
        case .unavailable:           state = .unavailable
        case .signedOut:             state = .signedOut
        case .failed(let message):   state = .error(message)
        }
    }

    // MARK: - Notifications

    func loadNotifications() async {
        #if DEBUG
        if Self.debugForcedState != nil {
            // In a forced-state screenshot run, keep the panel in its honest flag-off
            // state rather than hitting the network — no fabricated notifications.
            notifications = .unavailable
            return
        }
        #endif
        notifications = .loading
        guard let token = try? store.load() else {
            notifications = .unavailable
            return
        }
        switch await notifier.load(token: token) {
        case .loaded(let env):     notifications = .loaded(env)
        case .unavailable:         notifications = .unavailable
        case .signedOut:           notifications = .error("Your session has expired. Sign in again.")
        case .failed(let message): notifications = .error(message)
        }
    }

    // MARK: - DEBUG screenshot override

    #if DEBUG
    /// Deterministic six-state override for screenshots/UI review, mirroring the web's
    /// `?gate=` param and the existing `-GWUIPhase` auth-phase override in `RootView`.
    /// Launch arg: `-GWGateState anonymous|waitlisted|pending|approved|denied|revoked`.
    /// The `approved` case shows an EMPTY reviewer list (no fabricated civic rows) —
    /// the override demonstrates the *chrome* of each state, never invented data.
    static var debugForcedState: AccessState? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-GWGateState"), i + 1 < args.count else { return nil }
        return AccessState(rawValue: args[i + 1])
    }
    #endif
}
