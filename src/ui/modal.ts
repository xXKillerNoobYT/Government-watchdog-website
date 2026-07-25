/**
 * Shared modal primitive (MOTY full-application pass).
 *
 * Extracted from the Fast Agenda design fixture's detail dialog so every page
 * (agenda item detail, issue cards, Power Tracker vote detail) gets identical
 * mechanics: backdrop, Escape/✕/backdrop close, focus trap, inert background,
 * scroll lock, and focus restore to the opening control. Pages own their
 * content and page-specific styling via `className`; any descendant carrying a
 * `data-modal-close` attribute closes the dialog when clicked.
 *
 * Deliberately div-based (no <dialog>): jsdom lacks showModal(), and the
 * existing suite asserts on this structure.
 */

import { GW_TOKENS } from './tokens';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export interface ModalSpec {
  /** `data-test` on the dialog; the backdrop gets `${testId}-backdrop`. */
  testId: string;
  /** id of the heading element inside `header` (aria-labelledby target). */
  labelledById: string;
  /** Optional id of a descriptive element inside the body. */
  describedById?: string;
  /** Header content rendered before the built-in close button. */
  header: HTMLElement;
  /** Dialog content after the header row. */
  body: (HTMLElement | string)[];
  /** aria-label for the built-in ✕ close button. */
  closeLabel: string;
  /** Focus returns here when the dialog closes. */
  trigger: HTMLElement;
  /** Extra class on the dialog for page-specific styling. */
  className?: string;
}

export interface ModalHandle {
  close(): void;
  dialog: HTMLElement;
}

export const MODAL_STYLE = `${GW_TOKENS}
.gw-modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:var(--gw-space-5);background:rgba(3,6,10,.76)}
.gw-modal{width:min(800px,96vw);max-height:90vh;overflow:auto;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-lg);box-shadow:0 24px 80px rgba(0,0,0,.45);padding:var(--gw-space-6);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-4)}
.gw-modal-head{display:flex;align-items:start;justify-content:space-between;gap:var(--gw-space-4)}
.gw-modal-head h2{font-size:var(--gw-text-xl)}
.gw-modal-close{flex:none;width:var(--gw-tap-min);height:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);background:transparent;color:var(--gw-text);font-size:1.4rem}
@media (max-width:440px){.gw-modal-backdrop{padding:var(--gw-space-2)}.gw-modal{padding:var(--gw-space-4)}}
@media print{.gw-modal-backdrop{display:none}}
`;

export function ensureModalStyle(): void {
  if (document.getElementById('gw-modal-style')) return;
  document.head.append(el('style', { id: 'gw-modal-style' }, [MODAL_STYLE]));
}

const modalCleanup = new WeakMap<HTMLElement, () => void>();

/** Closes the modal currently open in `root`, if any (safe before re-render). */
export function closeModal(root: HTMLElement): void {
  modalCleanup.get(root)?.();
}

/** Opens a modal inside `root`, replacing any modal already open there. */
export function openModal(root: HTMLElement, spec: ModalSpec): ModalHandle {
  ensureModalStyle();
  modalCleanup.get(root)?.();

  const closeButton = el('button', {
    type: 'button',
    class: 'gw-modal-close',
    'aria-label': spec.closeLabel,
    'data-test': 'modal-close',
  }, ['×']);

  const dialogAttrs: Record<string, string> = {
    class: spec.className ? `gw-modal ${spec.className}` : 'gw-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': spec.labelledById,
    'data-test': spec.testId,
  };
  if (spec.describedById) dialogAttrs['aria-describedby'] = spec.describedById;

  const dialog = el('section', dialogAttrs, [
    el('header', { class: 'gw-modal-head' }, [spec.header, closeButton]),
    ...spec.body,
  ]);

  const backdrop = el('div', {
    class: 'gw-modal-backdrop',
    'data-test': `${spec.testId}-backdrop`,
  }, [dialog]);

  const backgroundState = [...root.children]
    .filter((node): node is HTMLElement => node instanceof HTMLElement)
    .map((node) => ({
      node,
      hadInert: node.hasAttribute('inert'),
      ariaHidden: node.getAttribute('aria-hidden'),
    }));
  const previousBodyOverflow = document.body.style.overflow;

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    for (const state of backgroundState) {
      if (!state.hadInert) state.node.removeAttribute('inert');
      if (state.ariaHidden === null) state.node.removeAttribute('aria-hidden');
      else state.node.setAttribute('aria-hidden', state.ariaHidden);
    }
    document.body.style.overflow = previousBodyOverflow;
    modalCleanup.delete(root);
    if (spec.trigger.isConnected) spec.trigger.focus();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  closeButton.addEventListener('click', close);
  for (const closer of dialog.querySelectorAll<HTMLElement>('[data-modal-close]')) {
    closer.addEventListener('click', close);
  }
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeyDown);
  modalCleanup.set(root, close);
  root.append(backdrop);
  closeButton.focus();
  for (const state of backgroundState) {
    state.node.setAttribute('inert', '');
    state.node.setAttribute('aria-hidden', 'true');
  }
  document.body.style.overflow = 'hidden';

  return { close, dialog };
}
