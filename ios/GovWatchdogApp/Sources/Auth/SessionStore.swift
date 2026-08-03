import Foundation
import Security

/// The one and only secret this app persists: the gated-beta session token.
///
/// GOV-1539 (Phase 4c leg 3) — spec §5 "Privacy notes binding all legs": *the
/// device stores exactly one secret (the session token, Keychain-only)*. Nothing
/// else — no email, no gated rows, no code — is ever written to disk. The token is
/// stored as a Keychain generic-password item with the attributes the issue
/// mandates verbatim:
///
///   * `kSecAttrAccessibleAfterFirstUnlock` — readable after the first unlock
///     following a boot (so a backgrounded relaunch still works), but never while
///     the device has not been unlocked since boot.
///   * **non-synchronizable** (`kSecAttrSynchronizable = false`) — the token never
///     leaves this device via iCloud Keychain.
///
/// Scope note (GOV-1681): `AfterFirstUnlock` **without** `...ThisDeviceOnly` can
/// ride an *encrypted device backup* to another device on restore;
/// `kSecAttrSynchronizable = false` blocks iCloud-Keychain sync only, not
/// backup-restore. That is low risk for a revocable 7-day session token, and the
/// accessibility class is fixed here because spec §4c-3 mandates
/// `kSecAttrAccessibleAfterFirstUnlock` verbatim. Tightening to
/// `...AfterFirstUnlockThisDeviceOnly` is a spec-level hardening decision for
/// CTO/CEO, not a client-side change to make unilaterally.
///
/// The store is deliberately tiny and free of any logging: a `SecItem*` status is
/// surfaced as a typed error, never printed, because the value it guards is a live
/// credential (spec §5: "logs on device must never contain email, token, or row
/// contents").
struct SessionStore {
    /// Keychain lookup coordinates. `service` is namespaced to the bundle so two
    /// apps (or a test host) never collide; `account` is a fixed slot because the
    /// app holds at most one session at a time.
    let service: String
    let account: String

    /// Default coordinates used by the running app. Tests inject their own
    /// `service` so they never touch the app's real item.
    static let live = SessionStore(
        service: (Bundle.main.bundleIdentifier ?? "com.isaac4alpine.govwatchdog") + ".session",
        account: "beta-session-token"
    )

    enum StoreError: Error, Equatable {
        /// A `SecItem*` call returned an unexpected OSStatus (value carried for
        /// diagnostics; it contains no secret material).
        case keychain(OSStatus)
        /// The stored bytes were not valid UTF-8 — treated as "no session".
        case corrupt
    }

    // MARK: - Write

    /// Persist (or replace) the session token. Uses delete-then-add so the
    /// accessibility/synchronizability attributes are always exactly as specified
    /// even when overwriting an older item (a bare `SecItemUpdate` can leave stale
    /// protection attributes behind).
    func save(_ token: String) throws {
        let data = Data(token.utf8)
        try? deleteRaw()   // best-effort clear; a missing item is fine.

        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            kSecAttrSynchronizable as String: false,
        ]
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw StoreError.keychain(status) }
    }

    // MARK: - Read

    /// Return the stored token, or `nil` when no session exists.
    func load() throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        switch status {
        case errSecSuccess:
            guard let data = item as? Data,
                  let token = String(data: data, encoding: .utf8) else {
                throw StoreError.corrupt
            }
            return token
        case errSecItemNotFound:
            return nil
        default:
            throw StoreError.keychain(status)
        }
    }

    /// Whether a session token is currently stored (no value returned to the caller).
    func hasSession() -> Bool {
        (try? load()) ?? nil != nil
    }

    // MARK: - Delete

    /// Destroy the stored token (sign-out). Idempotent: a missing item is success.
    func delete() throws {
        let status = deleteRaw()
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw StoreError.keychain(status)
        }
    }

    @discardableResult
    private func deleteRaw() -> OSStatus {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        return SecItemDelete(query as CFDictionary)
    }

    // MARK: - Attribute inspection (test/audit only)

    /// Return the item's protection attributes for verification (AC #2). Returns
    /// `nil` when no item exists. The token *value* is deliberately **not**
    /// returned here — only the non-secret protection metadata.
    func storedAttributes() -> [String: Any]? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return item as? [String: Any]
    }
}
