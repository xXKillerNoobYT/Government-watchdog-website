// @vitest-environment jsdom
//
// GOV-81: `?issue=<slug>` is the baseline's canonical deep link into a pre-filtered
// issue run. The reviewed lane discarded it silently, so a reviewer following a design
// link landed on an ordinary unfiltered Timeline and could reasonably conclude the
// requested issue run has no events. That is the false-completeness reading DG exists
// to prevent — dropping a parameter on the floor is neither RV nor DG.
//
// The assertions below are mostly about what must NOT happen: no filtering, no
// silent normalisation to `all`, and no claim that the visible events are the run.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderTimelineLevels } from '../src/ui/pages-program';
import { ISSUE_SLUGS } from '../src/ui/timeline-design';
import type { ReadApiResponse } from '../src/types/read-api';

const DATA: ReadApiResponse = {
  scope: 'alpine', access: 'reviewer_internal',
  records: [
    { statement_id: 'r1', statement_text: 'Reviewed one.', ui_status: 'source-backed',
      verification_status: 'reviewed_source_linked', produced_by: 'human', evidence: [] },
    { statement_id: 'r2', statement_text: 'Reviewed two.', ui_status: 'source-backed',
      verification_status: 'reviewed_source_linked', produced_by: 'human', evidence: [] },
  ],
};

let root: HTMLElement;
beforeEach(() => { document.body.replaceChildren(); root = document.createElement('div'); document.body.append(root); });

const render = (qs: string): HTMLElement => {
  renderTimelineLevels(root, DATA, new URLSearchParams(qs));
  return root;
};

describe('GOV-81 reviewed-lane issue deep link', () => {
  it('never silently ignores a known slug', () => {
    const r = render('issue=moratorium');
    const state = r.querySelector('[data-test="timeline-issue-deeplink-unavailable"]');
    expect(state, 'explicit state renders').not.toBeNull();
    expect(state!.getAttribute('data-issue-slug')).toBe('moratorium');
    expect(state!.getAttribute('data-issue-known')).toBe('true');
    expect(state!.textContent).toContain('moratorium');
    expect(state!.textContent).toContain('NOT applied');
  });

  it('reports an unrecognised slug AS unrecognised, not normalised to all', () => {
    const state = render('issue=not-a-real-issue')
      .querySelector('[data-test="timeline-issue-deeplink-unavailable"]')!;
    expect(state.getAttribute('data-issue-known')).toBe('false');
    expect(state.textContent).toContain('not a recognised issue');
    // The failure this replaces is SILENT normalisation to `all`. Note the copy does
    // contain the word "all" — it says the slug was *not* treated as all. Banning the
    // vocabulary would forbid the explanation, so assert the CLAIM instead: the state
    // must not present the visible events as the requested run.
    expect(state.textContent).toContain('not silently treated');
    expect(state.textContent).toContain('unfiltered reviewed timeline');
  });

  it('echoes the requested slug in the applied-filters strip, both cases', () => {
    for (const [qs, known] of [['issue=water', 'true'], ['issue=bogus', 'false']] as const) {
      const chip = render(qs).querySelector('[data-test="timeline-issue-filter"]');
      expect(chip, qs).not.toBeNull();
      expect(chip!.getAttribute('data-issue-known'), qs).toBe(known);
    }
  });

  it('renders nothing extra when no deep link was requested', () => {
    const r = render('level=town');
    expect(r.querySelector('[data-test="timeline-issue-deeplink-unavailable"]')).toBeNull();
    expect(r.querySelector('[data-test="timeline-issue-filter"]')).toBeNull();
  });

  it('does NOT filter the reviewed events — the run cannot be assembled', () => {
    const withLink = render('issue=moratorium').querySelectorAll('[data-test="timeline-record"]').length;
    document.body.replaceChildren(); root = document.createElement('div'); document.body.append(root);
    const without = render('').querySelectorAll('[data-test="timeline-record"]').length;
    expect(withLink).toBe(without);
  });

  it('the disabled preset control names the missing contract in its accessible name', () => {
    const preset = render('').querySelector('[data-test="timeline-issue-preset-unavailable"]')!;
    const name = preset.getAttribute('aria-label') ?? '';
    expect(name).toContain('typed cross-record issue edges');
    expect(preset.hasAttribute('disabled')).toBe(true);
  });

  it('covers every baseline slug as known', () => {
    expect(ISSUE_SLUGS.length).toBeGreaterThan(1);
    for (const slug of ISSUE_SLUGS) {
      document.body.replaceChildren(); root = document.createElement('div'); document.body.append(root);
      const state = render(`issue=${slug}`).querySelector('[data-test="timeline-issue-deeplink-unavailable"]')!;
      expect(state.getAttribute('data-issue-known'), slug).toBe('true');
    }
  });
});
