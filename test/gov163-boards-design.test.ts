// @vitest-environment jsdom
//
// GOV-163 — the gated Boards design fixture.
//
// The matrix §4 declared a GS row ("populated handoff board cards") that no renderer
// implemented, so the binding ledger promised a reviewable lane that did not exist. This
// suite locks the renderer that closes it, and — more importantly — locks the constraints
// that make a *synthetic* government-body directory safe to ship at all.
//
// The risk here is unlike the other fixture lanes. Boards is a directory OF GOVERNMENT
// BODIES: a plausible-looking body name beside a plausible-looking meeting cadence reads as
// a real civic record the instant it is screenshotted, and all four of the page's DG rows
// exist precisely because the backend supplies none of it. So most of what follows asserts
// what the fixture must NOT contain.
import { describe, expect, it, beforeEach } from 'vitest';
import { DESIGN_FIXTURE_LABEL, renderBoardsDesign } from '../src/ui/design-pages';
import designPagesSource from '../src/ui/design-pages.ts?raw';

const ADMITTED = { access: 'reviewer_internal', fixture: true };

/**
 * `textContent` concatenates adjacent elements with NO separator, so a card reads as
 * `…Alpine Town CouncilMEETING CADENCE…`. Any pattern ending in `\b` then fails to match
 * where the next element starts with a word character — a trailing word boundary needs a
 * non-word character after it, and there is none.
 *
 * That is not hypothetical: the first version of the honesty sweep below used raw
 * `root.textContent` and **passed with `Alpine Town Council` planted in a fixture slot**.
 * The red proof caught it. Every negative assertion in this file shares the exposure, so
 * the fix belongs here, at the extraction, rather than in each individual regex.
 */
function visibleText(el: HTMLElement): string {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const value = n.nodeValue?.trim();
    if (value) parts.push(value);
  }
  return parts.join('\n');
}

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

describe('GOV-163 Boards design fixture', () => {
  it('renders the populated-card layout behind reviewer admission and the fixture flag', () => {
    renderBoardsDesign(root, ADMITTED);

    expect(root.querySelector('[data-test="boards-design-page"]')).not.toBeNull();
    expect(root.querySelector('[data-test="design-fixture-banner"]')?.textContent)
      .toBe(DESIGN_FIXTURE_LABEL);
    // Three jurisdiction lanes, two cards each — the layout the GS row exists to demonstrate.
    expect(root.querySelectorAll('[data-test="boards-design-lane"]')).toHaveLength(3);
    expect(root.querySelectorAll('[data-test="boards-design-card"]')).toHaveLength(6);
  });

  it('declares fixture origin on the page and on every card', () => {
    renderBoardsDesign(root, ADMITTED);

    expect(root.querySelector('[data-test="boards-design-page"]')?.getAttribute('data-origin'))
      .toBe('synthetic-design-fixture');
    const cards = [...root.querySelectorAll('[data-test="boards-design-card"]')];
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-origin')).toBe('fixture');
    }
  });

  it('makes every slot self-describing rather than asserting a value', () => {
    renderBoardsDesign(root, ADMITTED);

    const slots = [...root.querySelectorAll('[data-test="boards-design-slot"]')];
    // 6 cards x 4 slots. Non-empty first: a selector change would make the sweep vacuous.
    expect(slots).toHaveLength(24);
    for (const slot of slots) {
      const text = slot.textContent ?? '';
      expect(text.length).toBeGreaterThan(0);
      // The rule established by #76 and applied in #84/#83: a synthetic leaf describes the
      // slot it stands in, it does not fill it.
      expect(text).toContain('Stands in for');
    }
  });

  /**
   * The core honesty property. Each pattern below corresponds to one of the four DG rows on
   * matrix §4 — the rows that exist BECAUSE the backend supplies no such value. A fixture
   * that produced one would be manufacturing the exact claim the DG row is withholding.
   */
  it('asserts no government body, person, cadence, date, or official link', () => {
    renderBoardsDesign(root, ADMITTED);
    const text = visibleText(root);
    expect(text.length).toBeGreaterThan(0);
    // Prove the extraction separates elements, or every `\b`-terminated pattern below is
    // silently unenforceable — which is exactly how this sweep first shipped vacuous.
    expect(text.split('\n').length).toBeGreaterThan(20);

    // No body is named. "Council"/"Commission"/"Board of ..." as a NAMED body.
    expect(text).not.toMatch(/\b(Town Council|City Council|County Commission|Board of \w+)\b/);
    // No cadence is asserted.
    expect(text).not.toMatch(/\b(every|each)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|month|week)\b/i);
    expect(text).not.toMatch(/\b\d+(st|nd|rd|th)\s+(Monday|Tuesday|Wednesday|Thursday|Friday)\b/i);
    // No date, in any precision. buildTimeNavigator's rule: precision itself is a claim.
    expect(text).not.toMatch(/\b\d{4}-\d{2}(-\d{2})?\b/);
    expect(text).not.toMatch(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/);
    // No official link. Not even a refused one — there is no URL to supply.
    expect(root.querySelectorAll('a[href]')).toHaveLength(0);
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('renders nothing synthetic without fixture admission', () => {
    renderBoardsDesign(root, { access: 'reviewer_internal', fixture: false });

    expect(root.querySelector('[data-test="boards-design-inactive"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="boards-design-card"]')).toHaveLength(0);
    expect(root.querySelector('[data-test="design-fixture-banner"]')).toBeNull();
  });

  it('renders nothing at all outside the reviewer-internal lane', () => {
    renderBoardsDesign(root, { access: 'public', fixture: true });

    expect(root.querySelector('[data-test="boards-design-gated"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="boards-design-card"]')).toHaveLength(0);
    expect(root.querySelector('[data-test="design-fixture-banner"]')).toBeNull();
  });

  /**
   * A SOURCE property, not a behavioural one, and deliberately so. Matrix §4 carries an
   * explicit prohibition — "Never use `TopicTreeResponse` as a shortcut to populate them" —
   * and §4's reviewer checklist repeats it ("TopicTree is not Boards"). A behavioural test
   * cannot prove a negative about data the renderer never receives; asserting the signature
   * takes no response can. This is the same reasoning as GOV-70's single-source guard: when
   * the requirement is "this must not be wired up", that is a source property.
   */
  it('takes no reviewed response, so no topic tree can be repurposed into a body', () => {
    const signature = designPagesSource.slice(
      designPagesSource.indexOf('export function renderBoardsDesign'),
    ).slice(0, 200);
    // Guard the slice itself — a rename would otherwise silently assert on nothing.
    expect(signature).toContain('renderBoardsDesign');
    expect(signature).not.toContain('ReadApiResponse');
    expect(signature).not.toContain('topic_tree');
  });
});
