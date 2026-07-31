// C7 accessibility guard for `a11y-responsive`, 2026-07-31.
//
// The design system pins --gw-tap-min = 44px as a hard stop, and existing tests
// assert that TOKEN exists. None asserted that a focusable control actually
// reaches it — which is how `.gw-shell-search-input` came to render 19px tall
// inside a 46px row. The row met the floor; the input did not, and because the
// input is not label-wrapped, tapping the row's padding focused nothing. The
// real target was 19px, under both the 44px hard stop and WCAG 2.2 AA's 24px
// minimum.
//
// This sweeps the exported STYLE constants for focusable-control classes that
// declare a height/padding but no min-height, which is the shape that produced
// the defect.
import { describe, it, expect } from 'vitest';
import { SHELL_STYLE } from '../src/ui/shell';
import { DRAWER_TAP_MIN_PX } from '../src/ui/tokens';

/** Classes that are (or wrap) a directly focusable control in the shell. */
const FOCUSABLE_CONTROL_CLASSES = [
  'gw-shell-search-input',
  'gw-shell-print',
  'gw-shell-mode-btn',
];

function ruleBody(cls: string): string {
  const m = new RegExp(`\\.${cls}\\b[^{}]*\\{([^{}]*)\\}`).exec(SHELL_STYLE);
  expect(m, `${cls} has a rule in SHELL_STYLE`).not.toBeNull();
  return m![1];
}

describe('C7 tap-target floor — focusable shell controls reach --gw-tap-min', () => {
  it.each(FOCUSABLE_CONTROL_CLASSES)('%s declares a tap-floor height', (cls) => {
    const body = ruleBody(cls);
    // Either it pins min-height to the token, or it is a flex/inline control
    // whose own min-height is set. A raw px below the floor is never acceptable.
    expect(body, `${cls} must pin min-height to the tap token`).toMatch(/min-height:\s*var\(--gw-tap-min\)/);
  });

  it('the tap floor is 44px and is not silently lowered', () => {
    expect(DRAWER_TAP_MIN_PX).toBeGreaterThanOrEqual(44);
    expect(SHELL_STYLE).toContain('--gw-tap-min');
  });
});
