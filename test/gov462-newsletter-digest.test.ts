// @vitest-environment jsdom
//
// GOV-462 (Stage 4.06 impl) — gated reviewer-internal Alpine newsletter
// archive/detail routes rendering the Stage 4.05 digest object. Proves the
// GOV-461 contract (`docs/stage4-06-newsletter-archive-detail-frontend-contract.md`)
// end to end against the digest types + the renderers (`src/ui/newsletter.ts`):
//
//   §6.1 web-safe sweep — assertDigestWebSafe passes the real fixture; a planted raw
//        path / non-null localSourcePath / forbidden key fails LOUDLY,
//   §6.2 section presence — detail emits a node for EVERY required GOV-15 section,
//        incl. the explicit "none in this digest" affordance for empty lists,
//   §6.3 verbatim binding — a rendered item's claim/sourceTrail equals the digest
//        item of the same id (no recompute),
//   §6.4 zero-new-label — rendered claim statuses ⊆ STAGE3_CLAIM_VOCAB; the §4 map
//        domain == the frozen vocab; rendered label strings ⊆ the existing layer,
//   §6.5 non-verified visibility — every unverified / disputed / AI row carries its
//        non-verified / locked-AI marker and is never the verified (ok) tone,
//   §6.6 gate enforcement — for each non-approved AccessState the route renders the
//        gate panel and ZERO digest data; approved/bypass renders the data,
//   §6.7 no public/email path — DOM + source audit: no email / sender / publish /
//        public-deploy affordance is wired from these routes.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readDebatePosition, writeDebatePosition } from '../src/state/local-store';
import { DEBATE_POSITION_KEY } from '../src/state/local-store';
// Vite `?raw` import (typed by vite/client) — lets the source-audit grep run with
// no node:fs dependency (the tsconfig intentionally carries no @types/node).
import newsletterSource from '../src/ui/newsletter.ts?raw';
import {
  loadDigestResponse,
  renderNewsletterArchive,
  renderNewsletterDetail,
  renderNewsletterState,
  claimPresentation,
  claimStatusToUiStatus,
  archiveRows,
  resolveDigest,
  resolveItems,
  coveragePeriodLabel,
  CLAIM_STATUS_PRESENTATION,
  SPEAKER_UNIDENTIFIED_LABEL,
} from '../src/ui/newsletter';
import { assertDigestWebSafe, RawPathLeak } from '../src/data/web-safe';
import { uiStatusLabel, AI_LABEL_TEXT } from '../src/ui/state-view';
import {
  REQUIRED_DIGEST_SECTIONS,
  STAGE3_CLAIM_VOCAB,
  type NewsletterDigestResponse,
} from '../src/types/newsletter-digest';
import { renderGatedApp } from '../src/ui/landing';
import { ACCESS_STATES, resolveAccess, isApproved } from '../src/gate/access';
import digestData from '../src/fixtures/alpine-newsletter-digest.json';

const RESPONSE = loadDigestResponse(digestData);

function root(): HTMLElement {
  const r = document.createElement('div');
  r.id = 'app';
  document.body.replaceChildren(r);
  return r;
}

function expectAccessibleInfoNotes(host: HTMLElement): void {
  const triggers = Array.from(host.querySelectorAll<HTMLButtonElement>('.gw-info-trigger'));
  expect(triggers.length).toBeGreaterThan(0);

  const labels = triggers.map((trigger) => trigger.getAttribute('aria-label') ?? '');
  const controls = triggers.map((trigger) => trigger.getAttribute('aria-controls') ?? '');
  expect(labels.every(Boolean)).toBe(true);
  expect(controls.every(Boolean)).toBe(true);
  expect(new Set(labels).size).toBe(labels.length);
  expect(new Set(controls).size).toBe(controls.length);

  triggers.forEach((trigger, index) => {
    const panel = document.getElementById(controls[index]);
    expect(panel, `panel controlled by ${labels[index]}`).toBeTruthy();
    expect(panel?.getAttribute('role')).toBe('note');
    expect(panel?.getAttribute('aria-label')).toBe(labels[index]);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
}

beforeEach(() => {
  document.head.querySelectorAll('style').forEach((s) => s.remove());
});

// ---------------------------------------------------------------------------
// §6.1 — web-safe sweep (fail-loud)
// ---------------------------------------------------------------------------
describe('GOV-462 §6.1 — assertDigestWebSafe', () => {
  it('passes the real captured fixture (no raw path, localSourcePath null, /alpine/ routes exempt)', () => {
    expect(() => assertDigestWebSafe(digestData)).not.toThrow();
    // every sourceTrail entry's localSourcePath is the null invariant
    for (const d of RESPONSE.digests) {
      for (const e of d.sections.sourceTrail) expect(e.localSourcePath).toBeNull();
      for (const item of d.items) for (const e of item.sourceTrail) expect(e.localSourcePath).toBeNull();
    }
  });

  it('fails LOUD on a non-null localSourcePath carrying an absolute path', () => {
    const poisoned = JSON.parse(JSON.stringify(digestData)) as NewsletterDigestResponse;
    poisoned.digests[0].sections.sourceTrail[0].localSourcePath =
      '/Users/IA/Obsidian Vault/raw.txt' as unknown as null;
    expect(() => assertDigestWebSafe(poisoned)).toThrow(RawPathLeak);
  });

  it('fails LOUD on a forbidden raw key planted anywhere', () => {
    const poisoned = JSON.parse(JSON.stringify(digestData)) as Record<string, unknown>;
    (poisoned.digests as any[])[0].items[0].deep_link = '/alpine/timeline?card=x';
    expect(() => assertDigestWebSafe(poisoned)).toThrow(RawPathLeak);
  });

  it('fails LOUD on a non-/alpine absolute path, but allows a clean /alpine/ route', () => {
    expect(() => assertDigestWebSafe({ x: '/etc/passwd' })).toThrow(RawPathLeak);
    expect(() => assertDigestWebSafe({ x: '/alpine/timeline?card=abc' })).not.toThrow();
    expect(() => assertDigestWebSafe({ x: '/alpine/../secret' })).toThrow(RawPathLeak);
  });
});

// ---------------------------------------------------------------------------
// §6.2 — section presence (incl. empty affordance)
// ---------------------------------------------------------------------------
describe('GOV-462 §6.2 — every required GOV-15 section is rendered', () => {
  it('emits a node for every required section key on the detail route', () => {
    const r = root();
    const id = RESPONSE.digests[0].newsletterId;
    renderNewsletterDetail(r, RESPONSE, id);
    for (const key of REQUIRED_DIGEST_SECTIONS) {
      expect(r.querySelector(`[data-test="section-${key}"]`), `section ${key}`).toBeTruthy();
    }
  });

  it('renders the explicit "none in this digest" affordance for an empty list section', () => {
    // digest 0 (2026-18) has empty keyMeetings / topics / conflicts / laterOutcomes.
    const digest = RESPONSE.digests[0];
    const emptyKeys = (['keyMeetings', 'topics', 'conflicts', 'laterOutcomes'] as const).filter(
      (k) => (digest.sections[k] as string[]).length === 0,
    );
    expect(emptyKeys.length).toBeGreaterThan(0);
    const r = root();
    renderNewsletterDetail(r, RESPONSE, digest.newsletterId);
    for (const k of emptyKeys) {
      expect(r.querySelector(`[data-test="section-empty-${k}"]`), `empty affordance ${k}`).toBeTruthy();
      expect(r.querySelector(`[data-test="section-${k}"]`)?.getAttribute('data-empty')).toBe('true');
    }
  });

  it('missing digest id renders an honest not-found, never a fabricated digest', () => {
    const r = root();
    renderNewsletterDetail(r, RESPONSE, 'alpine-historical-9999-99');
    expect(r.querySelector('[data-test="newsletter-detail-missing"]')).toBeTruthy();
    expect(r.querySelector('[data-test="newsletter-detail"]')).toBeFalsy();
    expect(r.querySelectorAll('[data-test="item-row"]').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §6.3 — verbatim binding (no recompute)
// ---------------------------------------------------------------------------
describe('GOV-462 §6.3 — rendered item binds verbatim to the digest item', () => {
  it('each processed-record row carries the digest item claimStatus + label unchanged', () => {
    const digest = RESPONSE.digests[0];
    const r = root();
    renderNewsletterDetail(r, RESPONSE, digest.newsletterId);
    const items = resolveItems(digest, digest.sections.processedRecords.itemIds);
    expect(items.length).toBe(digest.sections.processedRecords.count);
    const section = r.querySelector('[data-test="section-processedRecords"]')!;
    const rows = section.querySelectorAll('[data-test="item-row"]');
    expect(rows.length).toBe(items.length);
    items.forEach((item, i) => {
      const row = rows[i] as HTMLElement;
      // claim status is the item's own value, not a recomputed one
      expect(row.getAttribute('data-claim')).toBe(item.labels.claimStatus);
      const labelNode = row.querySelector('[data-test="claim-label"]')!;
      const expected = claimPresentation(item.labels.claimStatus, item.labels.aiPresented);
      expect(labelNode.textContent).toBe(expected.label);
    });
  });

  it('source-trail rows mirror the digest sourceTrail entries in order (deduped, verbatim)', () => {
    const digest = RESPONSE.digests.find((d) => d.sections.sourceTrail.length > 0)!;
    const r = root();
    renderNewsletterDetail(r, RESPONSE, digest.newsletterId);
    const ids = Array.from(r.querySelectorAll('[data-test="source-trail-entry"] [data-test="source-id"]')).map(
      (n) => n.textContent,
    );
    expect(ids).toEqual(digest.sections.sourceTrail.map((e) => e.sourceId));
  });
});

// ---------------------------------------------------------------------------
// §6.4 — zero-new-label
// ---------------------------------------------------------------------------
describe('GOV-462 §6.4 — zero new labels (EG-7)', () => {
  it('the §4 map domain is EXACTLY the frozen STAGE3_CLAIM_VOCAB (diff == 0)', () => {
    expect(new Set(Object.keys(CLAIM_STATUS_PRESENTATION))).toEqual(new Set(STAGE3_CLAIM_VOCAB));
  });

  it('every rendered claim status is a member of the frozen vocab', () => {
    const r = root();
    renderNewsletterArchive(r, RESPONSE);
    const seen = new Set<string>();
    for (const d of RESPONSE.digests) {
      const rr = root();
      renderNewsletterDetail(rr, RESPONSE, d.newsletterId);
      rr.querySelectorAll('[data-test="claim-label"]').forEach((n) =>
        seen.add(n.getAttribute('data-claim')!),
      );
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const v of seen) expect(STAGE3_CLAIM_VOCAB as readonly string[]).toContain(v);
  });

  it('every rendered claim-label string comes from the existing presentation layer (no new strings)', () => {
    const allowed = new Set<string>([
      ...STAGE3_CLAIM_VOCAB.map((s) => uiStatusLabel(claimStatusToUiStatus(s))),
      AI_LABEL_TEXT,
      SPEAKER_UNIDENTIFIED_LABEL,
    ]);
    for (const d of RESPONSE.digests) {
      const r = root();
      renderNewsletterDetail(r, RESPONSE, d.newsletterId);
      r.querySelectorAll('[data-test="claim-label"]').forEach((n) =>
        expect(allowed.has(n.textContent ?? '')).toBe(true),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// §6.5 — non-verified is never styled as verified fact
// ---------------------------------------------------------------------------
describe('GOV-462 §6.5 — non-verified visibility', () => {
  it('only `verified` reads as the trusted (ok) tone', () => {
    for (const s of STAGE3_CLAIM_VOCAB) {
      const tone = claimPresentation(s).tone;
      if (s === 'verified') expect(tone).toBe('ok');
      else expect(tone).not.toBe('ok');
    }
  });

  it('every unverifiedItems row carries a visible non-verified marker (label present, not ok tone)', () => {
    const digest = RESPONSE.digests.find((d) => d.sections.unverifiedItems.length > 0)!;
    const r = root();
    renderNewsletterDetail(r, RESPONSE, digest.newsletterId);
    const section = r.querySelector('[data-test="section-unverifiedItems"]')!;
    const rows = section.querySelectorAll('[data-test="item-row"]');
    expect(rows.length).toBe(digest.sections.unverifiedItems.length);
    rows.forEach((row) => {
      const label = row.querySelector('[data-test="claim-label"]')!;
      expect(label).toBeTruthy();
      expect(label.getAttribute('data-tone')).not.toBe('ok');
    });
  });

  it('AI-presented rows carry the locked AI label verbatim', () => {
    const aiItem = RESPONSE.digests.flatMap((d) => d.items).find((i) => i.labels.aiPresented || i.labels.claimStatus === 'ai_presented');
    expect(aiItem).toBeTruthy();
    const owner = RESPONSE.digests.find((d) => d.items.some((i) => i.id === aiItem!.id))!;
    const r = root();
    renderNewsletterDetail(r, RESPONSE, owner.newsletterId);
    const aiLabels = Array.from(r.querySelectorAll('[data-test="ai-label"]'));
    expect(aiLabels.length).toBeGreaterThan(0);
    aiLabels.forEach((n) => expect(n.textContent).toBe(AI_LABEL_TEXT));
  });
});

// ---------------------------------------------------------------------------
// §6.6 — gated-beta enforcement on the route (AC#3 proof)
// ---------------------------------------------------------------------------
describe('GOV-462 §6.6 — gate enforcement per AccessState', () => {
  it('non-approved states render the gate panel and ZERO digest data; approved renders the data', () => {
    for (const state of ACCESS_STATES) {
      const r = root();
      renderGatedApp(r, state, () => renderNewsletterArchive(r, RESPONSE));
      if (isApproved(state)) {
        expect(r.querySelector('[data-test="newsletter-archive"]'), state).toBeTruthy();
        expect(r.querySelectorAll('[data-test="archive-row"]').length).toBeGreaterThan(0);
        expect(r.querySelector('[data-test="gate-panel"]')).toBeFalsy();
      } else {
        expect(r.querySelector('[data-test="gate-panel"]'), state).toBeTruthy();
        expect(r.querySelector('[data-test="newsletter-archive"]')).toBeFalsy();
        expect(r.querySelectorAll('[data-test="archive-row"]').length).toBe(0);
        // no digest content leaks into the DOM behind the gate
        expect(r.querySelectorAll('[data-test="item-row"]').length).toBe(0);
        expect(r.textContent).not.toContain(RESPONSE.digests[0].newsletterId);
      }
    }
  });

  it('the detail route is gated identically — no sections behind a non-approved gate', () => {
    const id = RESPONSE.digests[0].newsletterId;
    for (const state of ACCESS_STATES) {
      const r = root();
      renderGatedApp(r, state, () => renderNewsletterDetail(r, RESPONSE, id));
      if (!isApproved(state)) {
        expect(r.querySelectorAll('[data-test^="section-"]').length).toBe(0);
        expect(r.querySelector('[data-test="gate-panel"]')).toBeTruthy();
      }
    }
  });

  it('resolveAccess wiring matches the app: bypass/?gate=approved opens, default anonymous gates', () => {
    expect(isApproved(resolveAccess(null, true))).toBe(true); // reviewer bypass
    expect(isApproved(resolveAccess('approved', false))).toBe(true); // ?gate=approved
    expect(isApproved(resolveAccess(null, false))).toBe(false); // default anonymous
  });
});

// ---------------------------------------------------------------------------
// §6.7 — no email / sender / publish / public-deploy path
// ---------------------------------------------------------------------------
describe('GOV-462 §6.7 — no public/email/publish path is wired', () => {
  it('renders no mailto / external sender affordance in the DOM', () => {
    const r = root();
    renderNewsletterArchive(r, RESPONSE);
    const r2 = root();
    renderNewsletterDetail(r2, RESPONSE, RESPONSE.digests[0].newsletterId);
    for (const host of [r, r2]) {
      expect(host.querySelectorAll('a[href^="mailto:"]').length).toBe(0);
      // any in-app deep link points only at a reviewer-internal /alpine/ route hash
      host.querySelectorAll('[data-test="item-deeplink"]').forEach((a) =>
        expect((a as HTMLAnchorElement).getAttribute('href')).toMatch(/^#\/alpine\//),
      );
    }
  });

  it('the source module wires no email/sender/publish/public-deploy capability', () => {
    const src = newsletterSource;
    expect(src).not.toMatch(/mailto:|nodemailer|sendgrid|smtp|sendEmail|publishNewsletter|deploy\(/i);
    // no client-side navigation away to a public host
    expect(src).not.toMatch(/window\.location\s*=/);
  });
});

// ---------------------------------------------------------------------------
// pure-helper smoke (archive rows + state override)
// ---------------------------------------------------------------------------
describe('GOV-462 — archive rows + state override', () => {
  it('archive rows mirror the digests verbatim (count from processedRecords)', () => {
    const rows = archiveRows(RESPONSE);
    expect(rows.length).toBe(RESPONSE.digests.length);
    rows.forEach((row, i) => {
      const d = RESPONSE.digests[i];
      expect(row.newsletterId).toBe(d.newsletterId);
      expect(row.recordCount).toBe(d.sections.processedRecords.count);
      expect(row.periodLabel).toBe(coveragePeriodLabel(d.coveragePeriod));
      expect(row.href).toBe(`#/newsletter?id=${encodeURIComponent(d.newsletterId)}`);
    });
  });

  it('?state override renders the capturable async states, never fabricated data', () => {
    for (const kind of ['loading', 'empty', 'error'] as const) {
      const r = root();
      renderNewsletterState(r, kind);
      expect(r.querySelector(`[data-test="newsletter-state"]`)?.getAttribute('data-state')).toBe(kind);
      expect(r.querySelectorAll('[data-test="archive-row"]').length).toBe(0);
    }
  });

  it('resolveDigest returns the verbatim digest or undefined (never fabricates)', () => {
    expect(resolveDigest(RESPONSE, RESPONSE.digests[0].newsletterId)).toBe(RESPONSE.digests[0]);
    expect(resolveDigest(RESPONSE, 'nope')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GOV-53 — contextual information-note coverage and private-lane isolation
// ---------------------------------------------------------------------------
describe('GOV-53 — newsletter contextual information notes', () => {
  it('labels archive, trust, baseline, and every designed gap with unique accessible controls', () => {
    const r = root();
    renderNewsletterArchive(r, RESPONSE);

    const staticNotes = new Set(
      Array.from(r.querySelectorAll<HTMLElement>('[data-info-note]')).map((node) =>
        node.getAttribute('data-info-note'),
      ),
    );
    for (const id of ['newsletter-overview', 'newsletter-archive', 'newsletter-trust', 'newsletter-gaps']) {
      expect(staticNotes.has(id), id).toBe(true);
    }

    r.querySelectorAll<HTMLElement>('.gw-nl-designed-gap').forEach((gap) => {
      expect(gap.querySelector('[data-info-note^="private-gap-"]'), gap.getAttribute('data-test') ?? 'gap').toBeTruthy();
    });
    expect(r.querySelector('[data-test="newsletter-baseline-structure"]')?.getAttribute('aria-label')).toContain('newsletter baseline');
    expect(r.querySelector('[data-test="newsletter-reviewed-origin"]')?.getAttribute('aria-label')).toContain('trust');
    r.querySelectorAll<HTMLElement>('[data-test="archive-row"]').forEach((row) => {
      expect(row.getAttribute('aria-label')).toMatch(/^Open reviewed newsletter edition /);
    });
    expectAccessibleInfoNotes(r);
  });

  it('labels edition, supplied sections, source receipts, and detail archive without recomputing data', () => {
    const digest = RESPONSE.digests.find((candidate) => candidate.sections.sourceTrail.length > 0)!;
    const r = root();
    renderNewsletterDetail(r, RESPONSE, digest.newsletterId);

    const expectedStaticIds = [
      'newsletter-overview',
      'newsletter-archive',
      'newsletter-edition',
      'newsletter-sections',
      'newsletter-trust',
      'newsletter-gaps',
    ];
    for (const id of expectedStaticIds) {
      expect(r.querySelectorAll(`[data-info-note="${id}"]`).length, id).toBe(1);
    }

    expect(r.querySelector('[data-test="newsletter-detail"]')?.getAttribute('aria-label')).toContain(digest.newsletterId);
    expect(r.querySelector('[data-test="newsletter-digest-sections"] [data-info-note="newsletter-sections"]')).toBeTruthy();
    expect(r.querySelector('[data-test="newsletter-detail-archive"] [data-info-note="newsletter-archive"]')).toBeTruthy();
    expect(r.querySelector('[data-test="section-sourceTrail"]')?.getAttribute('aria-label')).toBe('Source trail newsletter section');
    r.querySelectorAll<HTMLElement>('[data-test="source-original"], [data-test="source-archive"]').forEach((link) => {
      expect(link.getAttribute('aria-label')).toMatch(/source /);
    });
    expectAccessibleInfoNotes(r);
  });

  it('explains not-found and async states honestly with route-unique placeholder notes', () => {
    const missing = root();
    renderNewsletterDetail(missing, RESPONSE, 'alpine-historical-9999-99');
    expect(missing.querySelector('[data-info-note="newsletter-edition"]')).toBeTruthy();
    expect(missing.querySelector('[data-info-note="private-gap-newsletter-detail-not-found"]')).toBeTruthy();
    expect(missing.textContent).toContain('No reviewed Alpine digest');
    expectAccessibleInfoNotes(missing);

    for (const kind of ['loading', 'empty', 'error'] as const) {
      const state = root();
      renderNewsletterState(state, kind);
      expect(state.querySelector(`[data-info-note="private-gap-newsletter-state-${kind}"]`)).toBeTruthy();
      expect(state.querySelector('[data-test="newsletter-state"]')?.getAttribute('aria-label')).toContain('newsletter state');
      expectAccessibleInfoNotes(state);
    }
  });

  it('creates no private information notes before the newsletter reviewer lane is admitted', () => {
    const denied = { ...RESPONSE, access: 'public' };
    const renderers = [
      (host: HTMLElement) => renderNewsletterArchive(host, denied),
      (host: HTMLElement) => renderNewsletterDetail(host, denied, RESPONSE.digests[0].newsletterId),
      (host: HTMLElement) => renderNewsletterState(host, 'empty', 'public'),
    ];

    for (const render of renderers) {
      const r = root();
      render(r);
      expect(r.querySelector('[data-test="state-reviewer-gated"]')).toBeTruthy();
      expect(r.querySelectorAll('[data-info-note]').length).toBe(0);
      expect(r.querySelectorAll('.gw-info-panel').length).toBe(0);
      expect(r.textContent).not.toContain('NewsletterDigest');
    }
  });

  it('supports click-open disclosure while keeping trigger-to-panel ownership exact', () => {
    const r = root();
    renderNewsletterArchive(r, RESPONSE);
    const trigger = r.querySelector<HTMLButtonElement>('[data-info-note="newsletter-archive"]')!;
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!)!;

    expect(panel.hasAttribute('hidden')).toBe(true);
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(panel.textContent).toContain('Filled from');
    expect(panel.textContent).toContain('Current state');
    expect(panel.textContent).toContain('Expected result');
  });
});

// GOV-84 — the gated design-fixture lane for #/newsletter.
//
// The matrix §7 keeps every slot DG on the reviewed lane and classes the July 21 edition,
// debate and lenses GS: "owner design reference only unless an explicit gated fixture
// renderer is added". This covers that renderer in all three lanes, and pins the two rules
// that make the fixture safe — no civic claim, and no lens classified in the browser.
describe('GOV-84 newsletter design-fixture lane', () => {
  const FIXTURE_BLOCKS = [
    'newsletter-meeting-pair-board-fixture',
    'newsletter-roundtable-fixture',
    'newsletter-agenda-feature-fixture',
    'newsletter-six-lens-grid-fixture',
    'newsletter-meeting-ledger-fixture',
  ] as const;
  const REVIEWED_BLOCKS = [
    'newsletter-meeting-pair-board',
    'newsletter-roundtable',
    'newsletter-agenda-feature',
    'newsletter-six-lens-grid',
    'newsletter-meeting-ledger',
  ] as const;
  // Strings that must never appear outside the fixture lane.
  const FIXTURE_STRINGS = ['SYNTHETIC PLACEHOLDER', 'SYNTHETIC MEETING', 'VOICE A', 'SYNTHETIC LEDGER ROW'];

  function mount(): HTMLElement {
    const r = document.createElement('div');
    document.body.append(r);
    return r;
  }

  it('reviewed lane keeps every designed gap and renders no fixture block', () => {
    const r = mount();
    renderNewsletterArchive(r, RESPONSE, undefined, false);

    for (const id of REVIEWED_BLOCKS) {
      expect(r.querySelectorAll(`[data-test="${id}"]`), id).toHaveLength(1);
    }
    for (const id of FIXTURE_BLOCKS) {
      expect(r.querySelectorAll(`[data-test="${id}"]`), id).toHaveLength(0);
    }
    expect(r.querySelector('[data-test="newsletter-design-banner"]')).toBeNull();
    for (const s of FIXTURE_STRINGS) {
      expect(r.textContent, s).not.toContain(s);
    }
  });

  it('fixture lane renders all five populated blocks under the banner', () => {
    const r = mount();
    renderNewsletterArchive(r, RESPONSE, undefined, true);

    for (const id of FIXTURE_BLOCKS) {
      expect(r.querySelectorAll(`[data-test="${id}"]`), id).toHaveLength(1);
    }
    for (const id of REVIEWED_BLOCKS) {
      expect(r.querySelectorAll(`[data-test="${id}"]`), id).toHaveLength(0);
    }
    const banner = r.querySelector('[data-test="newsletter-design-banner"]');
    expect(banner?.textContent).toContain('SYNTHETIC DESIGN FIXTURE — not a live read');
    // Every fixture block declares fixture origin at its own root, not by inheritance.
    for (const id of FIXTURE_BLOCKS) {
      expect(r.querySelector(`[data-test="${id}"]`)?.getAttribute('data-origin'), id).toBe('fixture');
    }
  });

  it('names no official, meeting, motion or quotation, and classifies no record into a lens', () => {
    const r = mount();
    renderNewsletterArchive(r, RESPONSE, undefined, true);

    // The baseline's four roundtable voices are placeholders, never people.
    const voices = [...r.querySelectorAll('.gw-nl-roundtable-voice')].map((n) => n.textContent);
    expect(voices).toEqual(['VOICE A', 'VOICE B', 'VOICE C', 'VOICE D']);

    // Six lens headings, and every cell says classification does not happen here.
    const cells = r.querySelectorAll('[data-test="newsletter-lens-cell"]');
    expect(cells).toHaveLength(6);
    for (const cell of cells) {
      expect(cell.textContent).toContain('No record is classified into this lens in the browser.');
    }

    // Every AI-authored block carries its label and caveat.
    const ai = r.querySelectorAll('[data-test="newsletter-ai-presented"]');
    expect(ai.length).toBeGreaterThan(0);
    for (const block of ai) {
      expect(block.textContent).toContain('AI-PRESENTED');
      expect(block.textContent).toContain('not independently verified');
    }
  });

  // This test OWNS its storage. The ambient global `localStorage` is whatever the last
  // file in this vitest worker left behind: six test files stub it, some omitting `clear`
  // and some not round-tripping `setItem` at all. Depending on it produced two different
  // CI-only failures at two different file orderings (`TypeError: localStorage.clear is
  // not a function`, then `expected +0 to be 1`) while passing locally every time.
  function installMemoryLocalStorage(): void {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    });
  }

  it('keeps the transcript collapsed by default and stores listen position in gw_debate_pos', () => {
    installMemoryLocalStorage();
    writeDebatePosition(0);
    const r = mount();
    renderNewsletterArchive(r, RESPONSE, undefined, true);

    const transcript = r.querySelector('[data-test="newsletter-roundtable-transcript"]')!;
    const toggle = r.querySelector('[data-test="newsletter-roundtable-toggle"]') as HTMLButtonElement;
    expect(transcript.hasAttribute('hidden')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    expect(transcript.hasAttribute('hidden')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    // Position round-trips through the shared local-store key, not a private one.
    const advance = r.querySelector('[data-test="newsletter-roundtable-advance"]') as HTMLButtonElement;
    expect(r.querySelector('[data-test="newsletter-roundtable-position"]')?.textContent)
      .toBe('Saved listen position: line 1 of 4');
    advance.click();
    expect(readDebatePosition()).toBe(1);
    expect(DEBATE_POSITION_KEY).toBe('gw_debate_pos');
    expect(r.querySelector('[data-test="newsletter-roundtable-position"]')?.textContent)
      .toBe('Saved listen position: line 2 of 4');
    vi.unstubAllGlobals();
  });

  it('fails closed: the public lane renders no fixture block and no fixture string', () => {
    const r = mount();
    renderNewsletterArchive(r, { ...RESPONSE, access: 'public' }, undefined, true);

    for (const id of FIXTURE_BLOCKS) {
      expect(r.querySelectorAll(`[data-test="${id}"]`), id).toHaveLength(0);
    }
    expect(r.querySelector('[data-test="newsletter-design-banner"]')).toBeNull();
    for (const s of FIXTURE_STRINGS) {
      expect(r.textContent, s).not.toContain(s);
    }
  });
});
