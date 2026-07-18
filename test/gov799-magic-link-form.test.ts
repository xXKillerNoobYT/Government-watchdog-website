/**
 * GOV-799 — magic-link form unit tests.
 * Pure validator + DOM form: no backend, no real email.
 */

import { describe, it, expect } from 'vitest';
import { validateMagicLink, renderMagicLinkForm } from '../src/ui/magic-link-form';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
globalThis.document = dom.window.document as unknown as Document;

describe('GOV-799 validateMagicLink — pure email pre-check', () => {
  it('rejects empty email', () => {
    const r = validateMagicLink({});
    expect(r.ok).toBe(false);
    expect(r.emailError).toMatch(/enter your email/i);
  });

  it('rejects malformed email', () => {
    expect(validateMagicLink({ email: 'not-an-email' }).ok).toBe(false);
    expect(validateMagicLink({ email: 'missing@domain' }).ok).toBe(false);
    expect(validateMagicLink({ email: '@nodomain.com' }).ok).toBe(false);
  });

  it('accepts valid email formats', () => {
    expect(validateMagicLink({ email: 'user@example.com' }).ok).toBe(true);
    expect(validateMagicLink({ email: 'User+tag@sub.domain.org' }).ok).toBe(true);
  });
});

describe('GOV-799 renderMagicLinkForm — DOM structure', () => {
  it('renders email input + submit button with accessible labels', () => {
    const form = renderMagicLinkForm();
    expect(form.querySelector('[data-test="ml-email"]')).not.toBeNull();
    expect(form.querySelector('[data-test="ml-submit"]')).not.toBeNull();
    expect(form.getAttribute('aria-label')).toMatch(/magic link/i);
  });

  it('shows inline error on invalid submit, does not call onSubmit', () => {
    let called = false;
    const form = renderMagicLinkForm({ onSubmit: () => { called = true; } });
    const emailInput = form.querySelector('[data-test="ml-email"]') as HTMLInputElement;
    emailInput.value = 'bad';
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    expect(called).toBe(false);
    expect(form.querySelector('[data-test="ml-email-error"]')?.hasAttribute('hidden')).toBe(false);
  });

  it('calls onSubmit with valid email', () => {
    let submission: { email: string } | null = null;
    const form = renderMagicLinkForm({ onSubmit: (s) => { submission = s; } });
    const emailInput = form.querySelector('[data-test="ml-email"]') as HTMLInputElement;
    emailInput.value = 'test@example.com';
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    expect(submission).not.toBeNull();
    expect((submission as { email: string } | null)?.email).toBe('test@example.com');
  });

  it('shows neutral confirmation on demo submit (no onSubmit provided)', () => {
    const form = renderMagicLinkForm();
    const emailInput = form.querySelector('[data-test="ml-email"]') as HTMLInputElement;
    emailInput.value = 'any@example.com';
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    const confirm = form.querySelector('[data-test="ml-confirmation"]');
    expect(confirm?.hasAttribute('hidden')).toBe(false);
    // Must not leak whether email is on the allowlist.
    expect(confirm?.textContent?.toLowerCase()).toMatch(/if your email is approved/i);
  });
});
