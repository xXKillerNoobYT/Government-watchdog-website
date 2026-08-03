import Foundation

/// Verbatim, human-readable evidence labels for the reviewer-internal lane (leg 4c-4).
///
/// Every string here is copied VERBATIM from the website's label layer
/// (`src/ui/state-view.ts` + `src/ui/statement-presenter.ts`) so the phone and the
/// web show a record's trust exactly the same way. The one hard rule (spec §1 item 3,
/// AC#2): **the client never recomputes, upgrades, or infers trust.** These functions
/// are pure lookups over the backend-supplied value and **fail closed** — an
/// unknown/missing value renders as an explicit, non-committal token, never as a
/// higher trust than the backend sent.
///
/// "Visual polish must never imply verification": these labels are the ONLY source of
/// a record's trust wording. No color, icon, or layout decision may upgrade them.
enum EvidenceLabels {

    // MARK: - ui_status (uiStatusLabel — state-view.ts)

    /// Verbatim label for a backend `ui_status`. Fail-closed default for an
    /// unforeseen future value: render it as-is (title-cased) rather than dropping it
    /// or guessing — a new backend status can never silently vanish or be upgraded.
    static func uiStatus(_ status: String?) -> String {
        switch status {
        case "source-backed":            return "Source-backed"
        case "archived-source-backed":   return "Source-backed (archived)"
        case "corrected":                return "Corrected"
        case "pending-review":           return "Pending review"
        case "unverified":               return "Unverified"
        case "needs-clarification":      return "Needs clarification"
        case "source-changed":           return "Source changed"
        case "source-missing":           return "Source missing"
        case "disputed":                 return "Disputed"
        case "do-not-publish":           return "Do not publish"
        case let other?:                 return titleCased(other)
        case nil:                        return "Unverified"   // absent → least-trust, fail-closed
        }
    }

    // MARK: - verification_status (verificationStatusLabel — statement-presenter.ts)

    /// Verbatim label for a record/evidence `verification_status`. Returns `nil` when
    /// absent (the caller omits the row) — never invents a status.
    static func verification(_ status: String?) -> String? {
        switch status {
        case "source_recorded":                return "Source recorded"
        case "machine_extracted_unreviewed":   return "Machine-extracted — unreviewed"
        case "reviewed_source_linked":         return "Reviewed — source-linked"
        case "human_verified":                 return "Human-verified"
        case "disputed":                       return "Disputed"
        case "do_not_publish":                 return "Do not publish"
        case let other? where !other.isEmpty:  return other   // unknown → verbatim, never upgraded
        default:                               return nil
        }
    }

    // MARK: - correction_status (correctionStatusLabel — statement-presenter.ts)

    /// Verbatim label for a `correction_status`. `none` → "No corrections"; any other
    /// non-empty value is shown with underscores spaced and the first letter upper.
    /// Absent/empty → `nil` (row omitted).
    static func correction(_ status: String?) -> String? {
        guard let status, !status.isEmpty else { return nil }
        if status == "none" { return "No corrections" }
        return status.replacingOccurrences(of: "_", with: " ").capitalizedFirst
    }

    // MARK: - produced_by (verbatim — statement-presenter.ts / read-api.ts)

    /// Verbatim `produced_by` provenance. Absent → "unavailable" (never assumed human).
    static func producedBy(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "unavailable" }
        return value
    }

    /// Verbatim/paraphrased provenance line (verbatimLabel — statement-presenter.ts).
    /// AI records are always labeled AI; a verbatim quote is labeled as such. This is
    /// the fact-vs-AI handoff line and must never be dropped for an AI record.
    static func verbatim(producedBy: String?, isVerbatim: Bool) -> String {
        if producedBy == "ai" { return isVerbatim ? "AI — verbatim quote" : "AI — paraphrased" }
        return isVerbatim ? "Verbatim quote" : "Paraphrased summary"
    }

    // MARK: - provenance_status (GOV-311 / GOV-314 — reviewer-internal only)

    /// The audit-passed badge, consumed VERBATIM and fail-closed: ONLY the exact value
    /// `grounded` reads as audit-passed; any other value — including absent, null, or
    /// an unknown string — collapses to "Unverified provenance". Never recomputed.
    /// Returned as (label, isGrounded) so the view pairs an icon with text (never
    /// color alone). Copy verbatim from legend.ts.
    static func provenance(_ value: String?) -> (label: String, grounded: Bool) {
        if value == "grounded" { return ("✓ Audit-passed", true) }
        return ("⚠ Unverified provenance", false)
    }

    // MARK: - Locked meta labels (state-view.ts)

    /// The single locked AI label — identical to `AI_LABEL_TEXT` on the web.
    static let aiLabel = "AI — not independently verified"

    /// The offline-sample / fixture banner text — identical to `FIXTURE_BANNER_TEXT`.
    /// (No fixture data ships in this app; retained only so a future gated-sample lane
    /// would use the exact same wording as the web.)
    static let fixtureBanner = "OFFLINE SAMPLE — not a live read"

    // MARK: - Helpers

    private static func titleCased(_ raw: String) -> String {
        raw.replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .capitalizedFirst
    }
}

private extension String {
    /// Uppercase only the first character, leave the rest untouched (matches the
    /// web's `replace(/^\w/, c => c.toUpperCase())` — NOT Swift's `.capitalized`,
    /// which would also lowercase the tail and mangle acronyms).
    var capitalizedFirst: String {
        guard let first else { return self }
        return first.uppercased() + dropFirst()
    }
}
