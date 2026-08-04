import XCTest
@testable import GovWatchdogApp

/// Leg 4c-4 — the six gated access states (GOV-758 parity). These pin the wire values,
/// the fail-closed resolver, the "only approved shows data" invariant, and the verbatim
/// copy carried over from the website's `access.ts`.
final class AccessStateTests: XCTestCase {

    func testAllSixStatesExistInWorkflowOrder() {
        XCTAssertEqual(
            AccessState.ordered,
            [.anonymous, .waitlisted, .pending, .approved, .denied, .revoked])
        XCTAssertEqual(AccessState.allCases.count, 6)
    }

    func testWireValuesMatchTheWebContract() {
        XCTAssertEqual(AccessState.anonymous.rawValue, "anonymous")
        XCTAssertEqual(AccessState.waitlisted.rawValue, "waitlisted")
        XCTAssertEqual(AccessState.pending.rawValue, "pending")
        XCTAssertEqual(AccessState.approved.rawValue, "approved")
        XCTAssertEqual(AccessState.denied.rawValue, "denied")
        XCTAssertEqual(AccessState.revoked.rawValue, "revoked")
    }

    func testOnlyApprovedIsApproved() {
        for state in AccessState.allCases {
            XCTAssertEqual(state.isApproved, state == .approved,
                           "\(state) approval must match the single affirmative state")
        }
    }

    func testResolveFailsClosedOnUnknownOrMissing() {
        XCTAssertEqual(AccessState.resolve(wire: "approved"), .approved)
        XCTAssertEqual(AccessState.resolve(wire: "waitlisted"), .waitlisted)
        // Anything not an exact match → nil (caller renders a neutral, no-data panel).
        XCTAssertNil(AccessState.resolve(wire: "APPROVED"))     // case-sensitive on purpose
        XCTAssertNil(AccessState.resolve(wire: "granted"))      // unknown value
        XCTAssertNil(AccessState.resolve(wire: ""))
        XCTAssertNil(AccessState.resolve(wire: "  "))
        XCTAssertNil(AccessState.resolve(wire: nil))
    }

    func testEveryStateHasNonEmptyVerbatimCopy() {
        for state in AccessState.allCases {
            let panel = GatePanel.content(for: state)
            XCTAssertEqual(panel.state, state)
            XCTAssertFalse(panel.badge.isEmpty, "\(state) needs a badge")
            XCTAssertFalse(panel.title.isEmpty, "\(state) needs a title")
            XCTAssertFalse(panel.message.isEmpty, "\(state) needs a message")
        }
    }

    func testBadgeTextMatchesTheWebVerbatim() {
        // These strings are copied verbatim from access.ts and must not drift.
        XCTAssertEqual(GatePanel.content(for: .anonymous).badge, "Not signed in")
        XCTAssertEqual(GatePanel.content(for: .waitlisted).badge, "Waitlisted")
        XCTAssertEqual(GatePanel.content(for: .pending).badge, "In review")
        XCTAssertEqual(GatePanel.content(for: .approved).badge, "Approved")
        XCTAssertEqual(GatePanel.content(for: .denied).badge, "Needs more info")
        XCTAssertEqual(GatePanel.content(for: .revoked).badge, "Access ended")
    }

    func testDenialAndRevocationCopyDoesNotImplyCivicStanding() {
        // AC#5 — the exact reassurance clause must be present in both.
        let clause = "your standing as a resident or citizen"
        XCTAssertTrue(GatePanel.content(for: .denied).message.contains(clause))
        XCTAssertTrue(GatePanel.content(for: .revoked).message.contains(clause))
    }
}
