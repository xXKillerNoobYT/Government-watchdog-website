// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { openModal, type ModalSpec } from '../src/ui/modal';

let root: HTMLElement;
let trigger: HTMLButtonElement;

function el(tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function spec(overrides: Partial<ModalSpec> = {}): ModalSpec {
  const header = el('div');
  header.append(el('h2', { id: 'test-modal-title' }, 'Test dialog'));
  return {
    testId: 'test-modal',
    labelledById: 'test-modal-title',
    closeLabel: 'Close test dialog',
    trigger,
    header,
    body: [el('p', {}, 'Body content')],
    ...overrides,
  };
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.body.style.overflow = '';
  root = el('div');
  trigger = el('button', {}, 'Open') as HTMLButtonElement;
  root.append(trigger);
  document.body.append(root);
});

describe('openModal', () => {
  it('renders a labelled dialog with backdrop and locks scroll', () => {
    openModal(root, spec());
    const dialog = root.querySelector('[data-test="test-modal"]');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('test-modal-title');
    expect(root.querySelector('[data-test="test-modal-backdrop"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape and restores focus to the trigger', () => {
    openModal(root, spec());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(root.querySelector('[data-test="test-modal"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on the built-in close button and on backdrop click', () => {
    openModal(root, spec());
    root.querySelector<HTMLElement>('[data-test="modal-close"]')?.click();
    expect(root.querySelector('[data-test="test-modal"]')).toBeNull();

    openModal(root, spec());
    root.querySelector<HTMLElement>('[data-test="test-modal-backdrop"]')?.click();
    expect(root.querySelector('[data-test="test-modal"]')).toBeNull();
  });

  it('wires descendants carrying data-modal-close', () => {
    const footerClose = el('button', { 'data-modal-close': '' }, 'Done') as HTMLButtonElement;
    openModal(root, spec({ body: [footerClose] }));
    footerClose.click();
    expect(root.querySelector('[data-test="test-modal"]')).toBeNull();
  });

  it('replaces an already-open modal in the same root', () => {
    openModal(root, spec());
    openModal(root, spec({ testId: 'second-modal' }));
    expect(root.querySelector('[data-test="test-modal"]')).toBeNull();
    expect(root.querySelector('[data-test="second-modal"]')).not.toBeNull();
    expect(root.querySelectorAll('.gw-modal-backdrop')).toHaveLength(1);
  });

  it('marks background content inert and restores it on close', () => {
    const sibling = el('section');
    root.append(sibling);
    const handle = openModal(root, spec());
    expect(sibling.hasAttribute('inert')).toBe(true);
    expect(sibling.getAttribute('aria-hidden')).toBe('true');
    handle.close();
    expect(sibling.hasAttribute('inert')).toBe(false);
    expect(sibling.hasAttribute('aria-hidden')).toBe(false);
  });
});
