import XCTest
@testable import GovWatchdogApp

/// Leg 4c-4 — web-safe record decoding. Pins that a well-formed reviewer-internal
/// payload decodes with labels intact, that a raw/private key can never surface, and
/// that a malformed or partial row fails closed (nil fields, empty evidence) instead of
/// aborting the whole list or fabricating a value.
final class ReviewerRecordDecodingTests: XCTestCase {

    private func decodeRecord(_ json: String) throws -> ReviewerRecord {
        try JSONDecoder().decode(ReviewerRecord.self, from: Data(json.utf8))
    }

    func testDecodesAllLabelFieldsVerbatim() throws {
        let json = """
        {
          "statement_id": "stmt_1",
          "statement_text": "The council voted to approve the budget.",
          "ui_status": "source-backed",
          "verification_status": "human_verified",
          "correction_status": "none",
          "produced_by": "human",
          "provenance_status": "grounded",
          "publication_state": "publishable",
          "is_verbatim": 1,
          "speaker_label": "Council Member, Alpine",
          "evidence": [
            { "source_type": "Meeting minutes", "published_by": "Town of Alpine",
              "archive_url": "https://archive.example/x", "verification_status": "reviewed_source_linked" }
          ]
        }
        """
        let r = try decodeRecord(json)
        XCTAssertEqual(r.statementID, "stmt_1")
        XCTAssertEqual(r.uiStatus, "source-backed")
        XCTAssertEqual(r.verificationStatus, "human_verified")
        XCTAssertEqual(r.provenanceStatus, "grounded")
        XCTAssertTrue(r.isVerbatim)
        XCTAssertFalse(r.isAIProduced)
        XCTAssertEqual(r.evidence.count, 1)
        XCTAssertEqual(r.evidence.first?.publishedBy, "Town of Alpine")
        XCTAssertEqual(r.evidence.first?.archiveURL, "https://archive.example/x")
    }

    func testRawOrPrivateKeysAreNeverSurfaced() throws {
        // Even if a payload smuggles raw/private keys, the allowlist-based decoder has
        // no field to put them in — they simply vanish. This mirrors the web-safe
        // denylist guarantee for the client.
        let json = """
        {
          "statement_id": "stmt_2",
          "transcript_path": "/vault/raw/secret.json",
          "raw_sha256": "deadbeef",
          "owner_agent": "someone",
          "review_state": "internal-only",
          "evidence": []
        }
        """
        let r = try decodeRecord(json)
        XCTAssertEqual(r.statementID, "stmt_2")
        // Nothing in the model can hold those keys — assert the surface stays clean.
        let mirror = Mirror(reflecting: r)
        let names = mirror.children.compactMap { $0.label }
        for forbidden in ["transcriptPath", "rawSha256", "ownerAgent", "reviewState", "note"] {
            XCTAssertFalse(names.contains(forbidden), "\(forbidden) must not exist on the record")
        }
    }

    func testMissingOptionalFieldsFailClosedToNil() throws {
        let r = try decodeRecord(#"{ "statement_id": "stmt_3" }"#)
        XCTAssertEqual(r.statementID, "stmt_3")
        XCTAssertNil(r.uiStatus)
        XCTAssertNil(r.verificationStatus)
        XCTAssertNil(r.producedBy)
        XCTAssertFalse(r.isVerbatim)          // absent → false, never a fabricated true
        XCTAssertTrue(r.evidence.isEmpty)
    }

    func testRecordWithoutStatementIdIsRejected() {
        XCTAssertThrowsError(try decodeRecord(#"{ "ui_status": "source-backed" }"#),
                             "a row with no statement_id is not a record")
    }

    func testFlexibleVerbatimAcceptsBoolIntString() throws {
        XCTAssertTrue(try decodeRecord(#"{"statement_id":"a","is_verbatim":true}"#).isVerbatim)
        XCTAssertTrue(try decodeRecord(#"{"statement_id":"a","is_verbatim":1}"#).isVerbatim)
        XCTAssertTrue(try decodeRecord(#"{"statement_id":"a","is_verbatim":"1"}"#).isVerbatim)
        XCTAssertFalse(try decodeRecord(#"{"statement_id":"a","is_verbatim":0}"#).isVerbatim)
        XCTAssertFalse(try decodeRecord(#"{"statement_id":"a","is_verbatim":"nope"}"#).isVerbatim)
    }

    func testResponseEnvelopeCarriesAccessStateAndRows() throws {
        let json = """
        { "access_state": "approved",
          "records": [ { "statement_id": "s1", "evidence": [] } ] }
        """
        let env = try JSONDecoder().decode(ReviewerResponse.self, from: Data(json.utf8))
        XCTAssertEqual(env.accessState, "approved")
        XCTAssertEqual(env.records.count, 1)
        XCTAssertEqual(AccessState.resolve(wire: env.accessState), .approved)
    }

    func testNotificationDecodingIsCopyFromData() throws {
        let json = """
        { "unread_count": 2,
          "notifications": [
            { "id": "ntf_1", "kind": "account_approved", "title": "You're approved",
              "body": "Welcome to the beta.", "created_utc": "2026-08-03T00:00:00Z", "read": false }
          ] }
        """
        let env = try JSONDecoder().decode(NotificationResponse.self, from: Data(json.utf8))
        XCTAssertEqual(env.unreadCount, 2)
        XCTAssertEqual(env.notifications.first?.title, "You're approved")   // verbatim
        XCTAssertEqual(env.notifications.first?.kind, .accountApproved)
        XCTAssertFalse(env.notifications.first!.read)
    }

    func testUnknownNotificationKindStillDecodesVerbatim() throws {
        let json = """
        { "unread_count": 0,
          "notifications": [ { "id": "n", "kind": "brand_new_event", "title": "T", "body": "B", "read": true } ] }
        """
        let env = try JSONDecoder().decode(NotificationResponse.self, from: Data(json.utf8))
        XCTAssertEqual(env.notifications.first?.kindRaw, "brand_new_event")
        XCTAssertNil(env.notifications.first?.kind)   // unmapped, but not dropped
        XCTAssertEqual(env.notifications.first?.title, "T")
    }
}
