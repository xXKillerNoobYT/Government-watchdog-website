import XCTest
@testable import GovWatchdogApp

/// Backend-free contract + safety tests: cookie extraction, PII redaction (AC #4),
/// and the enumeration-neutral input validators.
final class AuthContractTests: XCTestCase {

    // MARK: - Set-Cookie extraction (matches delivered GOV-1538 wire format)

    func testExtractsSessionTokenFromSetCookie() throws {
        let url = URL(string: "https://example.test/api/beta/magic-link/consume")!
        let response = HTTPURLResponse(
            url: url, statusCode: 200, httpVersion: "HTTP/1.1",
            headerFields: [
                "Set-Cookie": "gw_beta_session=raw_tok_XYZ; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Strict"
            ]
        )!
        XCTAssertEqual(sessionToken(fromSetCookieOn: response, url: url), "raw_tok_XYZ")
    }

    func testMissingSessionCookieReturnsNil() throws {
        let url = URL(string: "https://example.test/x")!
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil,
                                       headerFields: ["Set-Cookie": "other=1; Path=/"])!
        XCTAssertNil(sessionToken(fromSetCookieOn: response, url: url))
    }

    // MARK: - PII redaction (spec §5 — nothing sensitive reaches a log)

    func testRedactionScrubsEmail() {
        let scrubbed = LogRedaction.scrub("failed for resident@e2e.test at host")
        XCTAssertFalse(scrubbed.contains("resident@e2e.test"))
        XCTAssertTrue(scrubbed.contains("<redacted-email>"))
    }

    func testRedactionLeavesNonEmailUntouched() {
        XCTAssertEqual(LogRedaction.scrub("HTTP 500 server error"), "HTTP 500 server error")
    }

    // MARK: - Input validators (enumeration-neutral, format-only)

    func testEmailValidator() {
        XCTAssertTrue(AuthModel.isPlausibleEmail("a@b.co"))
        XCTAssertTrue(AuthModel.isPlausibleEmail("first.last+tag@example.com"))
        XCTAssertFalse(AuthModel.isPlausibleEmail("no-at-symbol"))
        XCTAssertFalse(AuthModel.isPlausibleEmail("a@b"))
        XCTAssertFalse(AuthModel.isPlausibleEmail(""))
    }

    func testCodeValidator() {
        XCTAssertTrue(AuthModel.isSixDigitCode("123456"))
        XCTAssertFalse(AuthModel.isSixDigitCode("12345"))
        XCTAssertFalse(AuthModel.isSixDigitCode("1234567"))
        XCTAssertFalse(AuthModel.isSixDigitCode("12345a"))
    }
}
