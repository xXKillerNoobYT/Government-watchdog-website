import { describe, it, expect } from 'vitest';
import { assertWebSafe, RawPathLeak, RAW_PATH_FORBIDDEN_KEYS, findRawPathLeaksInText } from '../src/data/web-safe';

describe('assertWebSafe (frontend transport raw-path sweep)', () => {
  it('passes a clean web-safe body unchanged', () => {
    const body = { scope: 'alpine', url: 'https://records.example/a.pdf', page: 3, nested: [{ archive_url: 'https://web.archive.org/x' }] };
    expect(assertWebSafe(body)).toBe(body);
  });

  it('allows public URLs (http/https)', () => {
    expect(() => assertWebSafe({ original_url: 'https://alpinewy.gov/packet.pdf' })).not.toThrow();
  });

  it('rejects an absolute filesystem path in a value', () => {
    expect(() => assertWebSafe({ x: '/Users/reviewer/Obsidian Vault/Source-Data/raw.txt' })).toThrow(RawPathLeak);
  });

  it('rejects a Windows drive-absolute path', () => {
    expect(() => assertWebSafe({ x: 'C:\\Users\\IA\\raw.pdf' })).toThrow(RawPathLeak);
  });

  it('rejects a known raw marker even without a leading slash', () => {
    expect(() => assertWebSafe({ note: 'see Obsidian Vault export' })).toThrow(RawPathLeak);
  });

  it.each(RAW_PATH_FORBIDDEN_KEYS)('rejects forbidden key %s anywhere in the body', (key) => {
    expect(() => assertWebSafe({ records: [{ [key]: 'anything' }] })).toThrow(RawPathLeak);
  });

  it('walks nested arrays/objects', () => {
    const body = { a: { b: [{ c: '/private/secret' }] } };
    expect(() => assertWebSafe(body)).toThrow(/private/);
  });
});

describe('findRawPathLeaksInText (transport-level raw-bytes scan)', () => {
  it('returns [] for a clean web-safe body text', () => {
    const text = JSON.stringify({ scope: 'alpine', original_url: 'https://alpinewy.gov/p.pdf', page: 3 });
    expect(findRawPathLeaksInText(text)).toEqual([]);
  });

  it('flags an absolute/vault path hidden in the raw bytes', () => {
    const text = JSON.stringify({ x: '/Users/reviewer/Obsidian Vault/Source-Data/raw.txt' });
    expect(findRawPathLeaksInText(text).length).toBeGreaterThan(0);
  });

  it('flags a forbidden raw field key even if its value looks innocuous', () => {
    const text = JSON.stringify({ records: [{ transcript_path: 'x' }] });
    expect(findRawPathLeaksInText(text).some((h) => h.includes('transcript_path'))).toBe(true);
  });
});
