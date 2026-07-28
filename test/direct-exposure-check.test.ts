import { describe, expect, it } from 'vitest';

// The production checker is an executable JavaScript module rather than app code.
// @ts-expect-error No declaration file is needed for this build-time module.
import { API_CONFIG_SCANNED, apiConfigViolationsIn, redactCredentials, SCANNED, violationsIn } from '../scripts/check-no-direct-exposure.mjs';

interface Violation {
  rule: string;
  why: string;
  value: string;
}

const rules = (hits: Violation[]): string[] => hits.map((hit) => hit.rule);

describe('direct-exposure build check', () => {
  it('includes the isolated public HTML root', () => {
    expect(SCANNED).toContain('public-entry');
  });

  it('rejects a direct loopback service URL in the public entry', () => {
    expect(violationsIn(
      '<script src="http://127.0.0.1:8791/private.js"></script>',
      'public-entry/index.html',
    )).not.toHaveLength(0);
  });
});

// Issue #55: the guard recognized only two known loopback service ports, so a
// destination on any other port — or on any absolute host — passed silently.
describe('direct-exposure check generalization (#55)', () => {
  it('rejects a loopback destination on a port the guard was never told about', () => {
    // 8787 is the read-API port documented in .env.example. It is not a
    // SERVICE_PORT, so the port-enumerating predecessor let this through.
    expect(rules(violationsIn('const url = "http://127.0.0.1:8787/read";', 'src/data/client.ts')))
      .toContain('loopback-host');
  });

  it('rejects private-network and link-local destinations', () => {
    for (const host of ['10.0.0.4', '192.168.1.20', '172.16.5.9', '169.254.169.254']) {
      expect(rules(violationsIn(`fetch("http://${host}:3000/api")`, 'src/data/client.ts')), host)
        .toContain('loopback-host');
    }
  });

  it('rejects credentials in a URL and never reprints them', () => {
    const hits: Violation[] = violationsIn(
      'fetch("https://svc:hunter2@api.example/v1")',
      'src/data/client.ts',
    );
    expect(rules(hits)).toContain('url-userinfo');
    expect(hits.every((hit) => !hit.value.includes('hunter2'))).toBe(true);
    expect(hits.some((hit) => hit.value.includes('***:***'))).toBe(true);
  });

  it('keeps the sanctioned in-container loopback wiring passing', () => {
    expect(violationsIn('  reverse_proxy 127.0.0.1:8100', 'deploy/Caddyfile')).toHaveLength(0);
    expect(violationsIn('exec python run.py --port 8100', 'deploy/entrypoint.sh')).toHaveLength(0);
  });

  it('does not flag an absolute civic source citation in a fixture', () => {
    // Captured civic records legitimately cite public URLs. Those are evidence,
    // not API configuration, and flagging them would fail the build on honest data.
    expect(violationsIn(
      '{"source_url": "https://alpinewy.gov/agenda-2026-04-14.pdf"}',
      'src/fixtures/state-matrix.json',
    )).toHaveLength(0);
    expect(violationsIn(
      '{"archive": "https://web.archive.org/web/2026/https://alpinewy.gov"}',
      'src/fixtures/alpine-newsletter-digest.json',
    )).toHaveLength(0);
  });

  it('redacts only the credential portion of a value', () => {
    expect(redactCredentials('https://user:pw@host/x')).toBe('https://***:***@host/x');
    expect(redactCredentials('https://host/x')).toBe('https://host/x');
  });
});

// Vite inlines every VITE_* value into the shipped bundle, so an `.env` entry is
// browser-facing API configuration even though no browser loads the file.
describe('browser-facing API configuration (#55)', () => {
  it('scans the environment templates the client build reads', () => {
    expect(API_CONFIG_SCANNED).toContain('.env');
    expect(API_CONFIG_SCANNED).toContain('.env.example');
  });

  it('accepts only a root-relative path with no authority', () => {
    expect(apiConfigViolationsIn('VITE_API_BASE=/api')).toHaveLength(0);
    expect(apiConfigViolationsIn('VITE_API_BASE=/svc/v2')).toHaveLength(0);
  });

  it('rejects every off-origin URL form', () => {
    const cases: Array<[string, string]> = [
      ['VITE_API_BASE=https://evil.example/api', 'api-config-absolute'],
      ['VITE_READ_API_URL=http://127.0.0.1:8787/read', 'api-config-absolute'],
      ['VITE_API_BASE=//evil.example/api', 'api-config-network-path'],
      ['VITE_API_BASE=\\\\evil.example\\api', 'api-config-backslash'],
      ['VITE_API_BASE=https://user:pw@evil.example/api', 'api-config-userinfo'],
      ['VITE_API_BASE=/%2f%2fevil.example', 'api-config-encoded-separator'],
      ['VITE_API_BASE=/%252f%252fevil.example', 'api-config-encoded-separator'],
      [`VITE_API_BASE=/api${String.fromCharCode(1)}x`, 'api-config-control-char'],
    ];
    for (const [line, expected] of cases) {
      expect(rules(apiConfigViolationsIn(line)), line).toContain(expected);
    }
  });

  it('never reprints a credential from configuration', () => {
    const hits: Violation[] = apiConfigViolationsIn('VITE_API_BASE=https://user:hunter2@evil.example');
    expect(hits).not.toHaveLength(0);
    expect(hits.every((hit) => !hit.value.includes('hunter2'))).toBe(true);
  });

  it('treats a commented example as documentation, not a shipped destination', () => {
    expect(apiConfigViolationsIn('# Example: http://127.0.0.1:8787/read')).toHaveLength(0);
  });

  it('treats an empty value as unset', () => {
    expect(apiConfigViolationsIn('VITE_READ_API_URL=')).toHaveLength(0);
  });

  it('ignores keys that do not configure a network destination', () => {
    expect(apiConfigViolationsIn('VITE_USE_FIXTURES=false')).toHaveLength(0);
    expect(apiConfigViolationsIn('GW_SERVICE_PORT=8791')).toHaveLength(0);
    expect(apiConfigViolationsIn('BACKEND_REF=local:/path/to/Government-watchdog')).toHaveLength(0);
  });

  it('unwraps a quoted value before judging it', () => {
    expect(rules(apiConfigViolationsIn('VITE_API_BASE="https://evil.example"')))
      .toContain('api-config-absolute');
    expect(apiConfigViolationsIn("VITE_API_BASE='/api'")).toHaveLength(0);
  });

  it('names the rule and the offending value on every violation', () => {
    const [hit] = apiConfigViolationsIn('VITE_API_BASE=https://evil.example/api') as Violation[];
    expect(hit.rule).toBe('api-config-absolute');
    expect(hit.value).toContain('VITE_API_BASE=');
    expect(hit.why).not.toHaveLength(0);
  });
});
