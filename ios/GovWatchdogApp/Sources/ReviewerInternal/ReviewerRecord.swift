import Foundation

/// Web-safe reviewer-internal record models (leg 4c-4).
///
/// These MIRROR the website's web-safe allowlist (`src/types/read-api.ts`, itself a
/// mirror of the backend `WEB_SAFE_FIELD_ALLOWLIST`). Two hard rules the shape
/// enforces by construction:
///
///  1. **No raw-path / private fields exist in the type surface.** There is no
///     `transcript_path`, `raw_local_path`, `raw_sha256`, `segment_id`, `local_ref`,
///     `owner_agent`, `review_state`, `note`, etc. If a field cannot be *named* here,
///     a leak cannot be rendered. Decoding is allowlist-based (explicit `CodingKeys`),
///     so an unexpected raw key in a payload is simply ignored, never surfaced.
///  2. **The client never recomputes trust.** `ui_status` / `verification_status` /
///     `correction_status` / `produced_by` / `provenance_status` are decoded as-is
///     and rendered verbatim through `EvidenceLabels`. Nothing here derives them.
///
/// Everything is optional/nullable because `to_web_safe` only emits keys present on a
/// row. Decoding is total and fail-closed: a missing or type-mismatched field becomes
/// `nil`, never a fabricated default, and never aborts the whole list.

/// One web-safe evidence-drawer entry (`evidence_links` row through the allowlist).
struct EvidenceLink: Decodable, Equatable, Identifiable {
    // Synthesized stable identity for SwiftUI lists (not a civic value).
    let id = UUID()

    let relation: String?
    let sourceType: String?
    let publishedBy: String?
    let jurisdiction: String?
    let sourceDate: String?
    let originalURL: String?
    let archiveURL: String?
    let archiveStatus: String?
    let scanDate: String?
    let toSourceID: String?
    let locatorKind: String?
    let timestampHuman: String?
    let page: FlexibleInt?
    let section: String?
    let paragraph: String?
    let verificationStatus: String?
    let correctionStatus: String?
    let relatedConcepts: [String]?

    private enum CodingKeys: String, CodingKey {
        case relation
        case sourceType = "source_type"
        case publishedBy = "published_by"
        case jurisdiction
        case sourceDate = "source_date"
        case originalURL = "original_url"
        case archiveURL = "archive_url"
        case archiveStatus = "archive_status"
        case scanDate = "scan_date"
        case toSourceID = "to_source_id"
        case locatorKind = "locator_kind"
        case timestampHuman = "timestamp_human"
        case page, section, paragraph
        case verificationStatus = "verification_status"
        case correctionStatus = "correction_status"
        case relatedConcepts = "related_concepts"
    }
}

/// A served statement: eligibility-gated by the backend, labels attached. Mirrors
/// `StatementRecord` (read-api.ts). No raw text path or vault ref can appear here.
struct ReviewerRecord: Decodable, Equatable, Identifiable {
    var id: String { statementID }

    let statementID: String
    let statementText: String?
    let uiStatus: String?
    let confidenceLabel: String?
    let speakerLabel: String?
    let provenanceStatus: String?
    let verificationStatus: String?
    let correctionStatus: String?
    let producedBy: String?
    let publicationState: String?
    private let isVerbatimRaw: FlexibleBool?
    let evidence: [EvidenceLink]

    /// Whether the statement is a verbatim quote (`is_verbatim` truthy). Absent → false.
    var isVerbatim: Bool { isVerbatimRaw?.value ?? false }

    /// Whether this record was produced by AI (drives the locked AI label).
    var isAIProduced: Bool { producedBy == "ai" }

    private enum CodingKeys: String, CodingKey {
        case statementID = "statement_id"
        case statementText = "statement_text"
        case uiStatus = "ui_status"
        case confidenceLabel = "confidence_label"
        case speakerLabel = "speaker_label"
        case provenanceStatus = "provenance_status"
        case verificationStatus = "verification_status"
        case correctionStatus = "correction_status"
        case producedBy = "produced_by"
        case publicationState = "publication_state"
        case isVerbatimRaw = "is_verbatim"
        case evidence
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // statement_id is the one required field; a row without it is not a record.
        statementID = try c.decode(String.self, forKey: .statementID)
        statementText = try? c.decodeIfPresent(String.self, forKey: .statementText)
        uiStatus = try? c.decodeIfPresent(String.self, forKey: .uiStatus)
        confidenceLabel = try? c.decodeIfPresent(String.self, forKey: .confidenceLabel)
        speakerLabel = try? c.decodeIfPresent(String.self, forKey: .speakerLabel)
        provenanceStatus = try? c.decodeIfPresent(String.self, forKey: .provenanceStatus)
        verificationStatus = try? c.decodeIfPresent(String.self, forKey: .verificationStatus)
        correctionStatus = try? c.decodeIfPresent(String.self, forKey: .correctionStatus)
        producedBy = try? c.decodeIfPresent(String.self, forKey: .producedBy)
        publicationState = try? c.decodeIfPresent(String.self, forKey: .publicationState)
        isVerbatimRaw = try? c.decodeIfPresent(FlexibleBool.self, forKey: .isVerbatimRaw)
        evidence = (try? c.decodeIfPresent([EvidenceLink].self, forKey: .evidence)) ?? []
    }
}

/// The reviewer-internal list envelope. The backend may attach an `access_state`
/// alongside the rows; it is consumed fail-closed via `AccessState.resolve`.
struct ReviewerResponse: Decodable, Equatable {
    let accessState: String?
    let records: [ReviewerRecord]

    private enum CodingKeys: String, CodingKey {
        case accessState = "access_state"
        // The backend serves rows under one of these keys depending on lane; accept
        // both so a contract rename doesn't blank the screen. Allowlist-based.
        case records
        case statements
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        accessState = try? c.decodeIfPresent(String.self, forKey: .accessState)
        let recs = (try? c.decodeIfPresent([ReviewerRecord].self, forKey: .records))
            ?? (try? c.decodeIfPresent([ReviewerRecord].self, forKey: .statements))
            ?? []
        records = recs
    }
}

// MARK: - Lenient scalar decoders

/// Some backends emit integer-ish fields as JSON numbers OR strings ("3"); decode
/// either without failing the whole record. Never fabricates a value.
struct FlexibleInt: Decodable, Equatable {
    let value: Int
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let i = try? c.decode(Int.self) { value = i }
        else if let s = try? c.decode(String.self), let i = Int(s) { value = i }
        else { throw DecodingError.typeMismatch(Int.self, .init(codingPath: decoder.codingPath, debugDescription: "not int-like")) }
    }
}

/// `is_verbatim` appears as `0/1`, a bool, or occasionally a string. Decode all;
/// anything unrecognized is treated as `false` (fail-closed: not a verbatim quote).
struct FlexibleBool: Decodable, Equatable {
    let value: Bool
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self) { value = b }
        else if let i = try? c.decode(Int.self) { value = i != 0 }
        else if let s = try? c.decode(String.self) { value = (s == "1" || s.lowercased() == "true") }
        else { value = false }
    }
}
