import XCTest
import Security
@testable import GovWatchdogApp

/// AC #2: "Keychain attributes verified as specified." These tests store a token
/// and assert the item carries `kSecAttrAccessibleAfterFirstUnlock` and is
/// non-synchronizable, plus the save/load/delete lifecycle used by sign-out.
final class SessionStoreTests: XCTestCase {
    private var store: SessionStore!

    override func setUp() {
        super.setUp()
        // Unique service per run so tests never touch the app's real item.
        store = SessionStore(service: "com.isaac4alpine.govwatchdog.tests.\(UUID().uuidString)",
                             account: "session")
    }

    override func tearDown() {
        try? store.delete()
        store = nil
        super.tearDown()
    }

    func testSaveThenLoadRoundTrips() throws {
        XCTAssertNil(try store.load())
        try store.save("tok_abc123")
        XCTAssertEqual(try store.load(), "tok_abc123")
        XCTAssertTrue(store.hasSession())
    }

    func testSaveOverwritesPreviousToken() throws {
        try store.save("first")
        try store.save("second")
        XCTAssertEqual(try store.load(), "second")
    }

    func testDeleteRemovesToken() throws {
        try store.save("tok")
        try store.delete()
        XCTAssertNil(try store.load())
        XCTAssertFalse(store.hasSession())
    }

    func testDeleteIsIdempotent() throws {
        // Sign-out must not throw when there is nothing to remove.
        XCTAssertNoThrow(try store.delete())
    }

    /// The core AC #2 assertion: protection attributes are exactly as mandated.
    func testStoredItemHasMandatedProtectionAttributes() throws {
        try store.save("tok")
        let attrs = try XCTUnwrap(store.storedAttributes())

        // Accessible AfterFirstUnlock.
        let accessible = attrs[kSecAttrAccessible as String] as? String
        XCTAssertEqual(accessible, kSecAttrAccessibleAfterFirstUnlock as String,
                       "session token must be kSecAttrAccessibleAfterFirstUnlock")

        // Non-synchronizable: the attribute is absent or explicitly false; it must
        // never be true (which would sync the token via iCloud Keychain).
        let sync = attrs[kSecAttrSynchronizable as String] as? Bool ?? false
        XCTAssertFalse(sync, "session token must be non-synchronizable")
    }
}
