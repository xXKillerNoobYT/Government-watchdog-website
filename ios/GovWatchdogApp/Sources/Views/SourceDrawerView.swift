import SwiftUI

/// The source drawer for one evidence link (leg 4c-4). On iPhone this is presented as
/// a **full-screen sheet** (the company drawer rule: "Mobile = full-screen sheet").
///
/// Field order mirrors the website's `drawerFields()` (statement-presenter.ts) exactly:
/// relation, source type, published by, jurisdiction, date, original source, archive,
/// captured, source registry id, locator, citation pointer, verification, correction,
/// related concepts. Two rules it enforces:
///   * **Archive row is ALWAYS visible** — a real archive link, or the literal
///     "Archive not available" row. Never a hidden row.
///   * Every value is rendered VERBATIM from the web-safe payload; a missing field is
///     simply omitted (never faked). No raw/local path can appear — the type has none.
struct SourceDrawerView: View {
    let link: EvidenceLink
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section("Source") {
                    row("Relation", link.relation)
                    row("Source type", link.sourceType)
                    row("Published by", link.publishedBy)
                    row("Jurisdiction", link.jurisdiction)
                    row("Date", link.sourceDate)
                }

                Section("Original & archive") {
                    linkRow("Original source", label: "View original", url: link.originalURL)
                    // Archive: ALWAYS present — link or the explicit unavailable row.
                    if let archive = link.archiveURL, !archive.isEmpty {
                        linkRow("Archived copy", label: "View archive", url: archive)
                    } else {
                        LabeledContent("Archived copy", value: "Archive not available")
                            .accessibilityLabel("Archived copy: Archive not available")
                    }
                    row("Captured", link.scanDate)
                }

                Section("Trace") {
                    row("Source registry ID", link.toSourceID)
                    row("Locator", locatorText)
                    row("Citation pointer", link.locatorKind)
                    // Verification / correction: verbatim, never recomputed.
                    row("Verification", EvidenceLabels.verification(link.verificationStatus))
                    row("Correction", EvidenceLabels.correction(link.correctionStatus))
                    if let concepts = link.relatedConcepts, !concepts.isEmpty {
                        row("Related concepts", concepts.joined(separator: ", "))
                    }
                }
            }
            .navigationTitle("Source")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onClose).frame(minHeight: 44)
                }
            }
        }
    }

    /// Human locator string (timestamp / page / section / paragraph) — same join order
    /// the web `locatorText` uses. Raw char offsets never travel, so none appear here.
    private var locatorText: String? {
        var parts: [String] = []
        if let t = link.timestampHuman, !t.isEmpty { parts.append(t) }
        if let p = link.page?.value { parts.append("p. \(p)") }
        if let s = link.section, !s.isEmpty { parts.append(s) }
        if let para = link.paragraph, !para.isEmpty { parts.append("¶ \(para)") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    @ViewBuilder private func row(_ label: String, _ value: String?) -> some View {
        if let value, !value.trimmingCharacters(in: .whitespaces).isEmpty {
            LabeledContent(label, value: value)
                .textSelection(.enabled)
                .accessibilityLabel("\(label): \(value)")
        }
    }

    @ViewBuilder private func linkRow(_ label: String, label linkText: String, url: String?) -> some View {
        if let url, let parsed = URL(string: url) {
            Link(destination: parsed) {
                LabeledContent(label) {
                    HStack(spacing: 4) {
                        Text(linkText)
                        Image(systemName: "arrow.up.right.square").accessibilityHidden(true)
                    }
                }
            }
            .frame(minHeight: 44)
            .accessibilityLabel("\(label): \(linkText)")
        }
    }
}
