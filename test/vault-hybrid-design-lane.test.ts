// @vitest-environment jsdom
//
// The Source Vault design lane is a HYBRID, and this pins that so it stays one.
//
// Every other design lane on this app is *pure*: under `demo=design` the page renders
// nothing but fixture content, so it is routed synchronously and never touches a reviewed
// read (`/newsletter`, `/boards`). Vault is the exception — it renders reviewed source rows,
// counts and the access gate from the response and swaps exactly ONE panel for a synthetic
// version-compare. It therefore MUST keep `withReviewerContext`.
//
// Why this file exists rather than a comment: on 2026-08-01 the matrix was edited to say
// `/vault?demo=design` was routed wrongly and should be made synchronous. That was written
// from a generalisation over two pure lanes without measuring the third, and acting on it
// would have stripped the reviewed half of the page. The note is corrected, but a corrected
// sentence in a doc does not stop the next agent making the same "fix" — an executable
// assertion does.
//
// Deliberately unit-level. `design-routes.test.ts` already navigates this route, but that
// file is at its CI budget on the shared runner (adding nine navigations to it timed out a
// neighbouring test the same day), so this asserts against the renderer directly instead.
import { beforeEach, describe, expect, it } from 'vitest';
import { renderSourceVault } from '../src/ui/pages-program';
import type { ReadApiResponse } from '../src/types/read-api';
import graphRealData from '../src/fixtures/concept-graph-real.json';

const GRAPH_REAL = graphRealData as unknown as ReadApiResponse;

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

/** Reviewed rows are built from `collectSources(data)` — present only if the read was used. */
function reviewedSourceRows(el: HTMLElement): number {
  return el.querySelectorAll('[data-test="source-vault-list"] > *').length;
}

describe('Source Vault design lane is a hybrid, not a pure fixture', () => {
  it('renders reviewed source rows AND the synthetic compare panel together', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real', null, null, true);

    // The synthetic half.
    expect(root.querySelector('[data-test="source-version-compare-fixture"]')).not.toBeNull();
    // The reviewed half — this is what a synchronous rewrite would delete.
    expect(
      reviewedSourceRows(root),
      'the design lane rendered no reviewed source rows, so it is no longer consuming the '
      + 'reviewed response — do not route this lane synchronously, it is not a pure fixture',
    ).toBeGreaterThan(0);
  });

  it('swaps only the compare panel — the reviewed rows are identical with and without the fixture', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real', null, null, true);
    const withFixture = reviewedSourceRows(root);

    const plain = document.createElement('div');
    document.body.append(plain);
    renderSourceVault(plain, GRAPH_REAL, new URLSearchParams(), 'real', null, null, false);
    const withoutFixture = reviewedSourceRows(plain);

    expect(withFixture).toBeGreaterThan(0);
    // If the design flag ever starts changing the reviewed content itself, the lane has
    // stopped being "reviewed page + one synthetic panel" and the matrix note is stale.
    expect(withFixture).toBe(withoutFixture);
    // And the swap really is a swap, not an addition.
    expect(plain.querySelector('[data-test="source-version-compare-fixture"]')).toBeNull();
  });

  it('renders no source rows and no fixture outside the reviewer-internal lane', () => {
    const publicResponse = { ...GRAPH_REAL, access: 'public' } as unknown as ReadApiResponse;
    renderSourceVault(root, publicResponse, new URLSearchParams(), 'real', null, null, true);

    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(reviewedSourceRows(root)).toBe(0);
    expect(root.querySelector('[data-test="source-version-compare-fixture"]')).toBeNull();
  });
});
