import { describe, expect, it } from 'vitest';

// The production checker is an executable JavaScript module rather than app code.
// @ts-expect-error No declaration file is needed for this build-time module.
import { SCANNED, violationsIn } from '../scripts/check-no-direct-exposure.mjs';

describe('direct-exposure build check', () => {
  it('includes the isolated public HTML root', () => {
    expect(SCANNED).toContain('public-entry');
  });

  it('rejects a direct loopback service URL in the public entry', () => {
    expect(violationsIn(
      '<script src="http://127.0.0.1:8791/private.js"></script>',
      'public-entry/index.html',
    )).not.toHaveLength(0);
  });
});
