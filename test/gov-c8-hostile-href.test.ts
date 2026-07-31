// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderNewsletterDetail, loadDigestResponse } from '../src/ui/newsletter';
import digest from '../src/fixtures/alpine-newsletter-digest.json';

describe('C8 end-to-end: a hostile source URL never becomes a live link', () => {
  it('refuses javascript: URLs planted on every source field', () => {
    const raw = JSON.parse(JSON.stringify(digest)) as Record<string, unknown>;
    let planted = 0;
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n && typeof n === 'object') {
        const r = n as Record<string, unknown>;
        for (const k of Object.keys(r)) {
          if (/url/i.test(k) && typeof r[k] === 'string' && r[k]) { r[k] = 'javascript:alert(1)'; planted += 1; }
        }
        Object.values(r).forEach(walk);
      }
    };
    walk(raw);
    const resp = loadDigestResponse(raw);
    const id = (resp as { digests?: { newsletterId?: string }[] }).digests?.[0]?.newsletterId ?? '';
    const root = document.createElement('div');
    document.body.append(root);
    renderNewsletterDetail(root, resp, id, 'probe');

    expect(planted, 'the probe must actually plant something').toBeGreaterThan(0);
    const anchors = [...root.querySelectorAll('a')];
    expect(anchors.length, 'the view must actually render anchors').toBeGreaterThan(0);
    // BEFORE this fix, 4 of these carried href="javascript:alert(1)".
    const bad = anchors.filter((a) => (a.getAttribute('href') ?? '').toLowerCase().includes('javascript:'));
    expect(bad).toHaveLength(0);
    // Refused links keep their text but carry no href at all.
    const refused = root.querySelectorAll('[data-href-refused]');
    expect(refused.length).toBeGreaterThan(0);
    for (const node of refused) expect(node.hasAttribute('href')).toBe(false);
  });
});
