import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_SITE_ORIGIN, renderCrawlAsset } from '../vite.config';

/**
 * GOV-1731 — crawl control for the public beta.
 *
 * Owner direction (2026-08-11): the beta goes public on the web for geographic
 * reach, so the sitemap stays small and bot crawling stays limited.
 *
 * These assets are HYGIENE, NOT SECURITY. robots.txt is advisory; a crawler
 * that ignores it still reaches every URL. The security boundary is the gate.
 * The tests below therefore check that we do not *advertise* gated surfaces —
 * never that a Disallow line protects one.
 */

const robots = readFileSync(new URL('../crawl-control/robots.txt', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../crawl-control/sitemap.xml', import.meta.url), 'utf8');

describe('robots.txt', () => {
  it('offers general crawlers the landing page and nothing else', () => {
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/\$$/m);
    for (const path of ['/app', '/api/', '/data/', '/assets/']) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
  });

  it('never advertises the ?gate= access-state previews', () => {
    expect(robots).toContain('Disallow: /*?gate=');
  });

  it('declines AI-training and bulk scrapers outright', () => {
    // Not exhaustive by nature — new crawlers appear constantly. These are the
    // ones worth naming today; the list is expected to grow, not to be complete.
    for (const bot of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'PerplexityBot', 'Bytespider']) {
      expect(robots).toMatch(new RegExp(`^User-agent: ${bot}$`, 'm'));
    }
    // Every named bot block must actually deny everything.
    const blocks = robots.split(/\n(?=User-agent: )/).filter((b: string) => !b.startsWith('User-agent: *'));
    for (const block of blocks) {
      if (!block.startsWith('User-agent: ')) continue;
      expect(block).toContain('Disallow: /');
    }
  });

  it('states plainly that it is not a security boundary', () => {
    expect(robots).toMatch(/NOT SECURITY/i);
  });
});

describe('sitemap.xml', () => {
  it('lists exactly one URL — the landing page', () => {
    const urls = sitemap.match(/<loc>/g) ?? [];
    expect(urls).toHaveLength(1);
    expect(sitemap).toContain('<loc>__SITE_ORIGIN__/</loc>');
  });

  it('does not list gated, api, or published-lane surfaces', () => {
    for (const leak of ['/app', '/api', '/data/published.json', '?gate=']) {
      expect(sitemap).not.toContain(`<loc>__SITE_ORIGIN__${leak}`);
    }
  });
});

describe('renderCrawlAsset', () => {
  it('substitutes the build-time origin and strips a trailing slash', () => {
    const out = renderCrawlAsset('<loc>__SITE_ORIGIN__/</loc>', 'https://watchdog.isaac4alpine.com/');
    expect(out).toBe('<loc>https://watchdog.isaac4alpine.com/</loc>');
  });

  it('refuses to ship an unresolved placeholder', () => {
    // Guards the failure that matters: a sitemap served on one host while
    // claiming another is worse than having no sitemap at all.
    expect(renderCrawlAsset(robots, DEFAULT_SITE_ORIGIN)).not.toContain('__SITE_ORIGIN__');
    expect(renderCrawlAsset(sitemap, DEFAULT_SITE_ORIGIN)).not.toContain('__SITE_ORIGIN__');
  });

  it('rejects an origin that is not a bare absolute origin', () => {
    for (const bad of ['watchdog.isaac4alpine.com', 'https://x.com/path', 'ftp://x.com', '']) {
      expect(() => renderCrawlAsset('__SITE_ORIGIN__', bad)).toThrow(/GW_SITE_ORIGIN/);
    }
  });

  it('defaults to the current Sites production origin', () => {
    expect(DEFAULT_SITE_ORIGIN).toMatch(/^https:\/\/[^/]+$/);
  });
});
