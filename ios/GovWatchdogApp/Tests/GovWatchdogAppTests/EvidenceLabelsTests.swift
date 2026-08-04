import XCTest
@testable import GovWatchdogApp

/// Leg 4c-4 — evidence-workflow labels. These pin that every label is the VERBATIM web
/// string, that unknown/missing values fail closed (never upgraded to a higher trust),
/// and that the AI/provenance labels behave exactly like the website.
final class EvidenceLabelsTests: XCTestCase {

    func testUIStatusLabelsAreVerbatim() {
        XCTAssertEqual(EvidenceLabels.uiStatus("source-backed"), "Source-backed")
        XCTAssertEqual(EvidenceLabels.uiStatus("archived-source-backed"), "Source-backed (archived)")
        XCTAssertEqual(EvidenceLabels.uiStatus("corrected"), "Corrected")
        XCTAssertEqual(EvidenceLabels.uiStatus("pending-review"), "Pending review")
        XCTAssertEqual(EvidenceLabels.uiStatus("unverified"), "Unverified")
        XCTAssertEqual(EvidenceLabels.uiStatus("needs-clarification"), "Needs clarification")
        XCTAssertEqual(EvidenceLabels.uiStatus("source-changed"), "Source changed")
        XCTAssertEqual(EvidenceLabels.uiStatus("source-missing"), "Source missing")
        XCTAssertEqual(EvidenceLabels.uiStatus("disputed"), "Disputed")
        XCTAssertEqual(EvidenceLabels.uiStatus("do-not-publish"), "Do not publish")
    }

    func testUIStatusFailsClosedOnMissing() {
        // Absent → least-trust "Unverified", never assumed source-backed.
        XCTAssertEqual(EvidenceLabels.uiStatus(nil), "Unverified")
    }

    func testUIStatusUnknownRendersVerbatimTitleCasedNotDropped() {
        // A future backend status still renders (never dropped, never upgraded).
        XCTAssertEqual(EvidenceLabels.uiStatus("brand-new-status"), "Brand new status")
    }

    func testVerificationLabelsAreVerbatim() {
        XCTAssertEqual(EvidenceLabels.verification("source_recorded"), "Source recorded")
        XCTAssertEqual(EvidenceLabels.verification("machine_extracted_unreviewed"), "Machine-extracted — unreviewed")
        XCTAssertEqual(EvidenceLabels.verification("reviewed_source_linked"), "Reviewed — source-linked")
        XCTAssertEqual(EvidenceLabels.verification("human_verified"), "Human-verified")
        XCTAssertEqual(EvidenceLabels.verification("disputed"), "Disputed")
        XCTAssertEqual(EvidenceLabels.verification("do_not_publish"), "Do not publish")
        XCTAssertNil(EvidenceLabels.verification(nil))
        XCTAssertNil(EvidenceLabels.verification(""))
    }

    func testCorrectionLabels() {
        XCTAssertEqual(EvidenceLabels.correction("none"), "No corrections")
        XCTAssertEqual(EvidenceLabels.correction("superseded_by_correction"), "Superseded by correction")
        XCTAssertNil(EvidenceLabels.correction(nil))
        XCTAssertNil(EvidenceLabels.correction(""))
    }

    func testProducedByFailsClosedToUnavailable() {
        XCTAssertEqual(EvidenceLabels.producedBy("ai"), "ai")
        XCTAssertEqual(EvidenceLabels.producedBy("human"), "human")
        XCTAssertEqual(EvidenceLabels.producedBy(nil), "unavailable")   // never assumed human
        XCTAssertEqual(EvidenceLabels.producedBy(""), "unavailable")
    }

    func testVerbatimHandoffLine() {
        XCTAssertEqual(EvidenceLabels.verbatim(producedBy: "ai", isVerbatim: true), "AI — verbatim quote")
        XCTAssertEqual(EvidenceLabels.verbatim(producedBy: "ai", isVerbatim: false), "AI — paraphrased")
        XCTAssertEqual(EvidenceLabels.verbatim(producedBy: "human", isVerbatim: true), "Verbatim quote")
        XCTAssertEqual(EvidenceLabels.verbatim(producedBy: nil, isVerbatim: false), "Paraphrased summary")
    }

    func testProvenanceFailsClosedUnlessExactlyGrounded() {
        XCTAssertTrue(EvidenceLabels.provenance("grounded").grounded)
        XCTAssertEqual(EvidenceLabels.provenance("grounded").label, "✓ Audit-passed")
        // Anything else — including unknown, empty, or nil — is NOT grounded.
        XCTAssertFalse(EvidenceLabels.provenance("Grounded").grounded)   // case-sensitive
        XCTAssertFalse(EvidenceLabels.provenance("unverified").grounded)
        XCTAssertFalse(EvidenceLabels.provenance("partial").grounded)
        XCTAssertFalse(EvidenceLabels.provenance("").grounded)
        XCTAssertFalse(EvidenceLabels.provenance(nil).grounded)
        XCTAssertEqual(EvidenceLabels.provenance(nil).label, "⚠ Unverified provenance")
    }

    func testLockedMetaLabelsMatchWeb() {
        XCTAssertEqual(EvidenceLabels.aiLabel, "AI — not independently verified")
        XCTAssertEqual(EvidenceLabels.fixtureBanner, "OFFLINE SAMPLE — not a live read")
    }
}
