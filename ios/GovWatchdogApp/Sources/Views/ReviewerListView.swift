import SwiftUI

/// Reviewer-internal record list (leg 4c-4). Read-only. Each row shows a snippet plus
/// the record's trust badge and (when AI-produced) the locked AI label, so a reviewer
/// sees the trust state without opening the record. Tapping pushes the detail.
///
/// This view renders civic data and is therefore reachable ONLY from the `.approved`
/// branch of `GatedModel` — no non-approved state can present it.
struct ReviewerListView: View {
    let records: [ReviewerRecord]

    var body: some View {
        Group {
            if records.isEmpty {
                emptyState
            } else {
                List(records) { record in
                    NavigationLink {
                        ReviewerDetailView(record: record)
                    } label: {
                        row(record)
                    }
                }
            }
        }
        .navigationTitle("Reviewer-internal")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ record: ReviewerRecord) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(record.statementText ?? "(no statement text)")
                .font(.subheadline)
                .lineLimit(3)
                .foregroundStyle(record.statementText == nil ? .secondary : .primary)
            HStack(spacing: 6) {
                if record.isAIProduced {
                    TrustBadge(symbol: "sparkles", text: EvidenceLabels.aiLabel, tone: .caution)
                }
                TrustBadge.forUIStatus(record.uiStatus)
            }
        }
        .padding(.vertical, 4)
        .frame(minHeight: 44, alignment: .leading)
    }

    private var emptyState: some View {
        // Honest empty state — mirrors the web's "Nothing to show yet". No fabricated
        // rows fill the silence.
        ContentUnavailableView {
            Label("Nothing to show yet", systemImage: "tray")
        } description: {
            Text("No reviewed, source-backed records are available for this view.")
        }
    }
}
