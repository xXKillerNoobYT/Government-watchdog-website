// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { COMING_SOON_LABEL, comingSoonChip, comingSoonNote } from '../src/ui/coming-soon';

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('coming soon primitives', () => {
  it('renders an inline chip naming the feature', () => {
    const chip = comingSoonChip('Full-archive search');
    expect(chip.getAttribute('data-test')).toBe('coming-soon-chip');
    expect(chip.textContent).toContain(COMING_SOON_LABEL);
    expect(chip.textContent).toContain('Full-archive search');
  });

  it('renders a block note with the feature and detail', () => {
    const note = comingSoonNote('Alert delivery', 'Email and text delivery are not built yet.');
    expect(note.getAttribute('data-test')).toBe('coming-soon-note');
    expect(note.textContent).toContain(COMING_SOON_LABEL);
    expect(note.textContent).toContain('Alert delivery');
    expect(note.textContent).toContain('Email and text delivery are not built yet.');
  });

  it('keeps Coming Soon copy distinct from the designed-gap data language', () => {
    const note = comingSoonNote('Scheduled delivery', 'Email and text delivery will land here.');
    expect(note.textContent).not.toMatch(/not wired yet|designed gap|reviewed contract/i);
  });

  it('injects its stylesheet once', () => {
    comingSoonChip('One');
    comingSoonChip('Two');
    expect(document.querySelectorAll('#gw-coming-soon-style')).toHaveLength(1);
  });
});
