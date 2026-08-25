// GOV-2273 — 44px tap-target floor for renderer-created Source Vault anchors.
//
// The 44px floor (--gw-tap-min, WCAG 2.5.5) was pinned only on the Vault/Boards
// contract-TOOL buttons (.gw-vault-contract-tool et al). The plain anchors the
// renderer emits for supplied-file and supersede document links —
// `supplied-file-original`, `supplied-file-archive`, `supersede-before-link`,
// `supersede-after-link` — were styled `display:inline-block` with margins only,
// so they collapsed to the ~21-24px line-box height at 320/390/640px widths, in
// both Simple and Advanced presentation and on both the /vault and /sources
// aliases. The existing tool-button tap test passed, so the gap was invisible.
//
// This sweeps the exported vault stylesheet for the two anchor rules that carry
// those links and asserts each pins min-height to the shared tap token. It is a
// SOURCE sweep (like gov88-tap-target-floor) because jsdom does not lay out
// height, so a rendered clientHeight assertion would be vacuously 0.
import { describe, it, expect } from 'vitest';
import { BOARDS_VAULT_FIDELITY_STYLE } from '../src/ui/pages-program';
import { DRAWER_TAP_MIN_PX } from '../src/ui/tokens';

/** Return the declaration body of the CSS rule whose selector is exactly `selector`. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\{([^{}]*)\\}`).exec(BOARDS_VAULT_FIDELITY_STYLE);
  expect(m, `${selector} has a rule in BOARDS_VAULT_FIDELITY_STYLE`).not.toBeNull();
  return m![1];
}

// The two selectors that carry every renderer-created document/version anchor.
const ANCHOR_RULE_SELECTORS = [
  '.gw-supplied-files-group>.gw-card a',
  '.gw-supersede-card .gw-vault-contract-diff-pane a',
];

describe('GOV-2273 tap-target floor — Source Vault document/version anchors', () => {
  it.each(ANCHOR_RULE_SELECTORS)('%s pins the tap-floor min-height', (selector) => {
    const body = ruleBody(selector);
    expect(body, `${selector} must pin min-height to the tap token`)
      .toMatch(/min-height:\s*var\(--gw-tap-min\)/);
    // A min-height only reaches the target if the box can actually grow to it —
    // an inline box ignores min-height, which is the exact bug (was inline-block).
    expect(body, `${selector} must be a flex/inline-flex box so min-height applies`)
      .toMatch(/display:\s*(inline-)?flex/);
  });

  it('the tap floor is 44px and is not silently lowered', () => {
    expect(DRAWER_TAP_MIN_PX).toBeGreaterThanOrEqual(44);
    expect(BOARDS_VAULT_FIDELITY_STYLE).toContain('--gw-tap-min');
  });
});
