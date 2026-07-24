// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { INFO_NOTES, renderInfoNote } from '../src/ui/info-note';
import { renderPublicLanding } from '../src/ui/public-landing';

let root: HTMLElement;

beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
});

describe('anonymous Free lane', () => {
  it('renders a detailed honest gap and zero civic records', () => {
    renderPublicLanding(root);

    expect(root.querySelector('[data-test="public-honest-gap"]')?.textContent)
      .toContain('zero civic claims');
    expect(root.querySelectorAll('[data-availability="coverage-coming"]')).toHaveLength(3);
    expect(root.querySelector('[data-test="public-advanced-preview"]')?.textContent)
      .toContain('Preview only');
    expect(root.querySelector('[data-test="public-advanced-preview"]')?.textContent)
      .toContain('server-side grants');
    expect(root.querySelector<HTMLAnchorElement>('.gw-public-brand')?.getAttribute('href'))
      .toBe('#app');

    for (const selector of [
      '[data-test="record-card"]',
      '[data-test="source-drawer"]',
      '[data-test="trust-badge"]',
      '[data-test="app-shell"]',
      '[data-test="gate-panel"]',
    ]) {
      expect(root.querySelector(selector), selector).toBeNull();
    }
  });

  it('defaults to the Simple light skin and keeps AI safety outside a note', () => {
    renderPublicLanding(root);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(root.textContent).toContain('SIMPLE · EVERYDAY VIEW');
    expect(root.textContent).toContain('AI safety stays visible');
    expect(root.textContent).toContain('AI-assisted text cannot stand in for an official record');
  });

  it('puts a stable explanatory note on every major public module', () => {
    renderPublicLanding(root);
    const triggers = [...root.querySelectorAll<HTMLElement>('[data-info-note]')];
    const ids = triggers.map((node) => node.dataset.infoNote);
    const panelIds = triggers.map((node) => node.getAttribute('aria-controls'));

    for (const required of [
      'public-plan',
      'public-scope',
      'public-status',
      'public-meetings',
      'public-decisions',
      'public-sources',
      'public-ai-safety',
      'public-advanced',
    ]) {
      expect(ids, required).toContain(required);
      expect(INFO_NOTES[required as keyof typeof INFO_NOTES]).toBeTruthy();
    }
    expect(new Set(panelIds).size).toBe(panelIds.length);
    for (const panelId of panelIds) {
      expect(panelId).toBeTruthy();
      expect(root.querySelector(`#${panelId}`)).not.toBeNull();
    }
  });
});

describe('universal information note interaction', () => {
  it('links trigger and panel and toggles with click', () => {
    const note = renderInfoNote('public-status');
    root.append(note);
    const trigger = note.querySelector<HTMLButtonElement>('[data-info-note="public-status"]')!;
    const panel = note.querySelector<HTMLElement>('.gw-info-panel')!;

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.hidden).toBe(true);

    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('What this is');
    expect(panel.textContent).toContain('Filled from');
    expect(panel.textContent).toContain('Filed under');
    expect(panel.textContent).toContain('Expected result');

    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
  });

  it('pins open when click follows a hover preview', () => {
    const note = renderInfoNote('public-status');
    root.append(note);
    const trigger = note.querySelector<HTMLButtonElement>('[data-info-note="public-status"]')!;
    const panel = note.querySelector<HTMLElement>('.gw-info-panel')!;

    trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(panel.hidden).toBe(false);
    trigger.click();
    note.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
  });

  it('closes on Escape and restores focus to the trigger', () => {
    const note = renderInfoNote('public-ai-safety');
    root.append(note);
    const trigger = note.querySelector<HTMLButtonElement>('[data-info-note="public-ai-safety"]')!;

    trigger.click();
    note.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }));

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps only one pinned note open and dismisses it from outside', () => {
    const first = renderInfoNote('public-status');
    const second = renderInfoNote('public-sources');
    root.append(first, second);
    const firstTrigger = first.querySelector<HTMLButtonElement>('[data-info-note]')!;
    const secondTrigger = second.querySelector<HTMLButtonElement>('[data-info-note]')!;

    firstTrigger.click();
    secondTrigger.click();
    expect(firstTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(secondTrigger.getAttribute('aria-expanded')).toBe('true');

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(secondTrigger.getAttribute('aria-expanded')).toBe('false');
  });
});
