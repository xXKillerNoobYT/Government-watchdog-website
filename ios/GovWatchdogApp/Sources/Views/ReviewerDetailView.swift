import SwiftUI

/// Reviewer-internal record detail (leg 4c-4). Shows the statement plus **all**
/// evidence-workflow labels, then the evidence trail — each row opening the source
/// drawer as a full-screen sheet. Every label is verbatim from `EvidenceLabels`;
/// nothing is recomputed, and the AI label is shown wherever the record is AI-produced
/// so visual polish can never imply a verified fact.
struct ReviewerDetailView: View {
    let record: ReviewerRecord
    @State private var drawerLink: EvidenceLink?

    var body: some View {
        List {
            Section {
                if let text = record.statementText, !text.isEmpty {
                    Text(text)
                        .font(.body)
                        .textSelection(.enabled)
                } else {
                    // No fabricated text — the record simply carries none.
                    Text("This record carries no statement text.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                if let speaker = record.speakerLabel, !speaker.isEmpty {
                    LabeledContent("Speaker", value: speaker)
                }
                // Fact-vs-AI handoff line — never dropped for an AI record.
                Text(EvidenceLabels.verbatim(producedBy: record.producedBy, isVerbatim: record.isVerbatim))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Trust & provenance") {
                // AI label first, unmissable, for any AI-produced record.
                if record.isAIProduced {
                    TrustBadge(symbol: "sparkles", text: EvidenceLabels.aiLabel, tone: .caution)
                }
                TrustBadge.forUIStatus(record.uiStatus)
                let prov = EvidenceLabels.provenance(record.provenanceStatus)
                TrustBadge(symbol: prov.grounded ? "checkmark.shield" : "exclamationmark.shield",
                           text: prov.label, tone: prov.grounded ? .ok : .caution)
            }

            Section("Record labels") {
                labelRow("Verification", EvidenceLabels.verification(record.verificationStatus))
                labelRow("Correction", EvidenceLabels.correction(record.correctionStatus))
                LabeledContent("Produced by", value: EvidenceLabels.producedBy(record.producedBy))
                labelRow("Publication", publicationLabel)
                labelRow("Confidence", record.confidenceLabel)
            }

            Section("Evidence (\(record.evidence.count))") {
                if record.evidence.isEmpty {
                    Text("No evidence links on this record.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(record.evidence) { link in
                        Button {
                            drawerLink = link
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(link.publishedBy ?? link.sourceType ?? "Source")
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(.primary)
                                    if let d = link.sourceDate, !d.isEmpty {
                                        Text(d).font(.footnote).foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.footnote).foregroundStyle(.tertiary)
                                    .accessibilityHidden(true)
                            }
                            .frame(minHeight: 44)   // tap-target floor
                            .contentShape(Rectangle())
                        }
                        .accessibilityHint("Opens the source drawer")
                    }
                }
            }
        }
        .navigationTitle("Record")
        .navigationBarTitleDisplayMode(.inline)
        // Full-screen source drawer on iPhone (company drawer rule).
        .fullScreenCover(item: $drawerLink) { link in
            SourceDrawerView(link: link) { drawerLink = nil }
        }
    }

    private var publicationLabel: String? {
        switch record.publicationState {
        case "publishable":     return "Publishable"
        case "not_publishable": return "Not publishable"
        case let other? where !other.isEmpty: return other
        default:                return nil
        }
    }

    @ViewBuilder private func labelRow(_ label: String, _ value: String?) -> some View {
        if let value, !value.isEmpty {
            LabeledContent(label, value: value)
        }
    }
}
