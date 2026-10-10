// @vitest-environment jsdom
//
// GOV-2273 — the four Source Vault source/version links must clear the shared 44px tap
// floor, on #/vault and its #/sources alias, in Simple and Advanced presentation.
//
// Why this file exists: the vault renders its source/version links as plain anchors in
// `pages-program.ts` (`supplied-file-original`, `supplied-file-archive`,
// `supersede-before-link`, `supersede-after-link`). The 44px floor was applied only to the
// vault contract-tool *buttons*, so these anchors measured ~21-24px tall — below the floor —
// while `gov88-tap-target-floor.test.ts` stayed green because it sweeps the shell STYLE only,
// never these runtime links. This is the runtime regression coverage the fix requires
// (AC: "Add browser/runtime regression coverage for these four link types rather than
// relying only on structural tag coverage").
//
// It renders the real anchors from the real render functions and binds each one to the CSS
// rule that actually governs it (the exact string the page injects), so a revert to
// `display:inline-block` without a `min-height` — the shape that produced the defect — fails
// here. jsdom does not run layout, so the *measured* height at 320/390/640/768 is proven in a
// browser and attached to the issue as SCREENSHOT evidence; this suite pins the CSS contract
// that produces that height so it cannot silently regress in CI.
import { describe, it, expect } from 'vitest';
import {
  renderSuppliedFiles,
  renderSupersedeView,
  BOARDS_VAULT_FIDELITY_STYLE,
} from '../src/ui/pages-program';
import { DRAWER_TAP_MIN_PX } from '../src/ui/tokens';
import type { SuppliedFilesProjection, SupersedeProjection } from '../src/types/read-api';
import suppliedFilesData from '../src/fixtures/alpine-supplied-files.json';
import supersedeData from '../src/fixtures/alpine-supersede-events.json';

const SUPPLIED = suppliedFilesData as unknown as SuppliedFilesProjection;
const SUPERSEDE = supersedeData as unknown as SupersedeProjection;

/** Declaration block of the rule whose selector is exactly `selector` (followed by `{`). */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{([^{}]*)\\}`).exec(css);
  expect(m, `a CSS rule targets \`${selector}\``).not.toBeNull();
  return m![1];
}

/** The four link types, keyed to the ancestor selector whose rule sets their box. */
const LINK_CASES: Array<{ test: string; render: () => HTMLElement; ruleSelector: string }> = [
  {
    test: 'supplied-file-original',
    render: () => renderSuppliedFiles(SUPPLIED, new URLSearchParams('demo=sample')),
    ruleSelector: '.gw-supplied-files-group>.gw-card a',
  },
  {
    test: 'supplied-file-archive',
    render: () => renderSuppliedFiles(SUPPLIED, new URLSearchParams('demo=sample')),
    ruleSelector: '.gw-supplied-files-group>.gw-card a',
  },
  {
    test: 'supersede-before-link',
    render: () => renderSupersedeView(SUPERSEDE, new URLSearchParams('demo=sample')),
    ruleSelector: '.gw-supersede-card .gw-vault-contract-diff-pane a',
  },
  {
    test: 'supersede-after-link',
    render: () => renderSupersedeView(SUPERSEDE, new URLSearchParams('demo=sample')),
    ruleSelector: '.gw-supersede-card .gw-vault-contract-diff-pane a',
  },
];

describe('GOV-2273 — Source Vault source/version links clear the 44px tap floor', () => {
  it('the tap floor is 44px and is not silently lowered', () => {
    expect(DRAWER_TAP_MIN_PX).toBeGreaterThanOrEqual(44);
    expect(BOARDS_VAULT_FIDELITY_STYLE).toContain('--gw-tap-min');
  });

  it.each(LINK_CASES)('$test renders and its governing rule pins the tap floor', ({ test, render, ruleSelector }) => {
    const section = render();
    const anchor = section.querySelector<HTMLAnchorElement>(`a[data-test="${test}"]`);
    expect(anchor, `the ${test} anchor renders from real fixture data`).not.toBeNull();

    // The anchor must actually sit under the selector whose rule we assert — otherwise a
    // future markup move could pass the CSS check while leaving the real link unstyled.
    expect(
      anchor!.closest('.gw-supplied-files-group>.gw-card, .gw-supersede-card .gw-vault-contract-diff-pane'),
      `${test} is nested under the styled ancestor`,
    ).not.toBeNull();

    const body = ruleBody(BOARDS_VAULT_FIDELITY_STYLE, ruleSelector);
    // A bare `min-height` on an inline box is inert; the rule must also make the box a
    // block/flex context. inline-flex (or block/flex) + the tap token is the fix.
    expect(body, `${ruleSelector} must pin min-height to the tap token`).toMatch(/min-height:\s*var\(--gw-tap-min\)/);
    expect(body, `${ruleSelector} must make min-height effective (not inline)`).toMatch(/display:\s*(inline-flex|flex|block|inline-grid|grid)/);
  });
});
