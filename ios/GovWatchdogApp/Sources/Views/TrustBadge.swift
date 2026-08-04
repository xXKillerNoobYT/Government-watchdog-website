import SwiftUI

/// A trust / provenance chip. **Accessibility floor (company §5 / §11.5):** trust is
/// conveyed by **icon + text, never color alone**, and the label never renders below
/// 13pt. Color is a secondary reinforcement of the tone, not the sole signal.
///
/// The badge text is always a verbatim `EvidenceLabels` value — this view never
/// computes or upgrades a label, it only styles one it is handed.
struct TrustBadge: View {
    enum Tone { case ok, neutral, caution, stop }

    let symbol: String
    let text: String
    var tone: Tone = .neutral

    /// 13pt floor for badge text (BADGE_MIN_FONT_PX). Uses a fixed size rather than a
    /// Dynamic Type style so the floor holds at the smallest content-size classes.
    private static let minBadgeFont: CGFloat = 13

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.system(size: Self.minBadgeFont, weight: .semibold))
                .accessibilityHidden(true)   // text carries the meaning for VoiceOver
            Text(text)
                .font(.system(size: Self.minBadgeFont, weight: .semibold))
                .lineLimit(2)
                .minimumScaleFactor(1.0)     // never shrink below the 13pt floor
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .foregroundStyle(foreground)
        .background(background, in: Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }

    private var foreground: Color {
        switch tone {
        case .ok:      return .green
        case .neutral: return .secondary
        case .caution: return .orange
        case .stop:    return .red
        }
    }

    private var background: Color { foreground.opacity(0.12) }
}

extension TrustBadge {
    /// Build the trust badge for a record's `ui_status`, pairing the verbatim label
    /// (from `EvidenceLabels`) with a tone and a distinct icon. Tone mirrors the web's
    /// `statusTone`; the label is never recomputed.
    static func forUIStatus(_ status: String?) -> TrustBadge {
        let label = EvidenceLabels.uiStatus(status)
        switch status {
        case "source-backed", "archived-source-backed":
            return TrustBadge(symbol: "checkmark.seal", text: label, tone: .ok)
        case "corrected":
            return TrustBadge(symbol: "arrow.triangle.2.circlepath", text: label, tone: .neutral)
        case "disputed":
            return TrustBadge(symbol: "exclamationmark.bubble", text: label, tone: .caution)
        case "do-not-publish":
            return TrustBadge(symbol: "eye.slash", text: label, tone: .stop)
        case "source-missing", "source-changed":
            return TrustBadge(symbol: "exclamationmark.triangle", text: label, tone: .caution)
        case "pending-review", "unverified", "needs-clarification":
            return TrustBadge(symbol: "clock", text: label, tone: .caution)
        default:
            return TrustBadge(symbol: "questionmark.circle", text: label, tone: .caution)
        }
    }
}
