import { describe, it, expect } from 'vitest';
import { assertWebSafe, RawPathLeak, RAW_PATH_FORBIDDEN_KEYS } from '../src/data/web-safe';

describe('assertWebSafe (frontend transport raw-path sweep)', () => {
  it('passes a clean web-safe body unchanged', () => {
    const body = { scope: 'alpine', url: 'https://records.example/a.pdf', page: 3, nested: [{ archive_url: 'https://web.archive.org/x' }] };
    expect(assertWebSafe(body)).toBe(body);
  });

  it('allows public URLs (http/https)', () => {
    expect(() => assertWebSafe({ original_url: 'https://alpinewy.gov/packet.pdf' })).not.toThrow();
  });

  it('rejects an absolute filesystem path in a value', () => {
    expect(() => assertWebSafe({ x: '/Users/IA/Obsidian Vault/Source-Data/raw.txt' })).toThrow(RawPathLeak);
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
