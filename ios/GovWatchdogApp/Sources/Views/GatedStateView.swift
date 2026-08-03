import SwiftUI

/// Renders one non-approved access-state gate panel (leg 4c-4). This screen shows
/// **zero civic data** by construction — it has no access to records. Its copy is the
/// verbatim `GatePanel.content(...)` wording (GOV-758 parity).
///
/// Used for `waitlisted / pending / denied / revoked / anonymous`, and reused (with a
/// neutral panel) for the fail-closed `indeterminate` / `unavailable` cases.
struct GatedStateView: View {
    let panel: GatePanel
    /// Optional footnote shown under the panel (e.g. the fail-closed rationale). Never
    /// civic data — process/status wording only.
    var footnote: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                TrustBadge(symbol: badgeSymbol, text: panel.badge, tone: badgeTone)
                    .accessibilityAddTraits(.isHeader)

                Text(panel.title)
                    .font(.title2.bold())

                Text(panel.message)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                if let label = panel.actionLabel {
                    // The action is a non-functional forward affordance in this leg —
                    // no civic data or backend mutation hides behind it. Disabled so it
                    // never implies a working route that does not exist yet.
                    Button(label) {}
                        .buttonStyle(.borderedProminent)
                        .frame(minHeight: 44)   // tap-target floor (WCAG 2.5.5)
                        .disabled(true)
                }

                if let footnote {
                    Text(footnote)
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                        .padding(.top, 8)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .navigationTitle("Beta access")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var badgeTone: TrustBadge.Tone {
        switch panel.state {
        case .approved:  return .ok
        case .revoked, .denied: return .stop
        case .waitlisted, .pending: return .caution
        case .anonymous: return .neutral
        }
    }

    private var badgeSymbol: String {
        switch panel.state {
        case .approved:   return "checkmark.seal"
        case .revoked:    return "xmark.seal"
        case .denied:     return "questionmark.circle"
        case .waitlisted: return "hourglass"
        case .pending:    return "clock"
        case .anonymous:  return "person.crop.circle.badge.questionmark"
        }
    }
}

extension GatedStateView {
    /// The neutral fail-closed panel shown when the backend did not name a recognized
    /// access state (indeterminate) or the gate is off (unavailable). It asserts NO
    /// standing and shows no civic data — the honest "we can't tell / not available"
    /// surface, distinct from the six copy panels.
    static func failClosed(title: String, message: String) -> GatePanel {
        GatePanel(state: .anonymous, badge: "Unavailable", title: title, message: message, actionLabel: nil)
    }
}
