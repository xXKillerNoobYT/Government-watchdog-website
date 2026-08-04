import SwiftUI

/// Notification panel (leg 4c-4). Renders the flag-gated `GET /api/notifications`
/// endpoint's states **honestly**:
///   * flag **off** → backend `404` → an explicit "Notifications aren't available yet"
///     feature-unavailable state (NOT an error, NOT a fake empty inbox).
///   * flag **on**, empty → an honest "You're all caught up" empty inbox.
///   * flag **on**, rows → the server-authored `title`/`body` rendered VERBATIM.
///
/// The panel never fabricates a notification and never recomputes the unread count.
struct NotificationPanelView: View {
    @Bindable var gated: GatedModel

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Alerts")
                .navigationBarTitleDisplayMode(.inline)
        }
        .task { await gated.loadNotifications() }
    }

    @ViewBuilder private var content: some View {
        switch gated.notifications {
        case .loading:
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)

        case .unavailable:
            ContentUnavailableView {
                Label("Notifications aren't available yet", systemImage: "bell.slash")
            } description: {
                Text("In-app notifications are turned off for this build. When the feature is "
                     + "enabled, account and cohort updates will appear here.")
            }

        case .error(let message):
            ContentUnavailableView {
                Label("Couldn't load alerts", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await gated.loadNotifications() } }
                    .frame(minHeight: 44)
            }

        case .loaded(let env):
            if env.notifications.isEmpty {
                ContentUnavailableView {
                    Label("You're all caught up", systemImage: "checkmark.circle")
                } description: {
                    Text("No new notifications.")
                }
            } else {
                List {
                    Section {
                        // Server authority — never recomputed on the client.
                        LabeledContent("Unread", value: "\(env.unreadCount)")
                    }
                    Section("Notifications") {
                        ForEach(env.notifications) { item in
                            notificationRow(item)
                        }
                    }
                }
            }
        }
    }

    private func notificationRow(_ item: NotificationItem) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.kind?.symbol ?? "bell")
                .foregroundStyle(item.read ? .secondary : .primary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title.isEmpty ? "(untitled)" : item.title)   // verbatim
                    .font(.subheadline.weight(item.read ? .regular : .semibold))
                if !item.body.isEmpty {
                    Text(item.body)                                     // verbatim
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if let ts = item.createdUTC, !ts.isEmpty {
                    Text(ts).font(.caption2).foregroundStyle(.tertiary)
                }
            }
            Spacer(minLength: 0)
            if !item.read {
                Circle().fill(.tint).frame(width: 8, height: 8)
                    .accessibilityLabel("Unread")
            }
        }
        .frame(minHeight: 44)
        .padding(.vertical, 2)
    }
}
