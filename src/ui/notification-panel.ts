/**
 * In-app notification panel — bell + drawer (GOV-758 / GOV-721 leg 3/5).
 *
 * A header bell that opens a drawer listing the recipient's in-app notifications,
 * consuming the leg-2 (GOV-754) notification query endpoint via
 * {@link loadNotifications}. It renders ONLY inside the gated app shell (it lives
 * in the shell header, which only draws past the beta gate), so no notification
 * content ever reaches an unauthenticated visitor.
 *
 * Honesty: titles/bodies are shown verbatim from the validated server envelope;
 * the unread count is the server's number, not a client recompute. Every
 * non-ready live state clears the badge and rows. Development sample mode is
 * visibly labelled beside the closed bell as well as inside the drawer.
 *
 * Accessibility (AC-7): the bell is a `<button>` with an accessible name +
 * `aria-haspopup`/`aria-expanded`/`aria-controls`; the unread count is announced
 * as part of that name. The drawer is a labelled `role="dialog"`; Escape closes
 * it and returns focus to the bell; an outside click closes it. The list has an
 * accessible name and each row's timestamp uses a machine-readable `<time>`.
 */

import {
  loadNotifications,
  notificationFailureResult,
  type LoadNotificationsResult,
} from '../data/notifications';
import type { NotificationItem, NotificationKind } from '../types/notification';
import { safeExternalHref } from '../data/web-safe';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    // C8: a supplied URL is untrusted input. An unsafe scheme is REFUSED, not rendered —
    // the anchor keeps its text and simply has no href, so nothing is clickable and no
    // dead affordance is presented. See safeExternalHref in src/data/web-safe.ts.
    if (k === 'href' && safeExternalHref(v) === null) {
      node.setAttribute('data-href-refused', 'unsafe-scheme');
      continue;
    }
    node.setAttribute(k, v);
  }
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

/** A small, decorative glyph per kind (aria-hidden — the title carries meaning). */
const KIND_GLYPH: Record<NotificationKind, string> = {
  account_approved: '✓',
  account_revoked: '⊘',
  cohort_advanced: '↑',
  consent_recorded: '✉',
  unsubscribe_confirmed: '⤺',
};

/** Human label for the kind, used as a small tag chip (not the whole message). */
const KIND_LABEL: Record<NotificationKind, string> = {
  account_approved: 'Access',
  account_revoked: 'Access',
  cohort_advanced: 'Cohort',
  consent_recorded: 'Email',
  unsubscribe_confirmed: 'Email',
};

/** Render a UTC ISO stamp as a compact, locale-formatted label (falls back raw). */
function formatStamp(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function notificationRow(item: NotificationItem): HTMLElement {
  const children: (Node | string)[] = [
    el('span', { class: 'gw-ntf-glyph', 'aria-hidden': 'true' }, [KIND_GLYPH[item.kind] ?? '•']),
    el('div', { class: 'gw-ntf-main' }, [
      el('div', { class: 'gw-ntf-row-head' }, [
        el('span', { class: 'gw-ntf-tag' }, [KIND_LABEL[item.kind] ?? 'Update']),
        el('time', { class: 'gw-ntf-time', datetime: item.created_utc }, [formatStamp(item.created_utc)]),
      ]),
      el('p', { class: 'gw-ntf-title' }, [item.title]),
      el('p', { class: 'gw-ntf-body' }, [item.body]),
    ]),
  ];
  if (!item.read) {
    // Unread marker carries an accessible name; the dot itself is decorative.
    children.unshift(el('span', { class: 'gw-ntf-unread', title: 'Unread' }, [
      el('span', { class: 'gw-sr-only' }, ['Unread']),
    ]));
  }
  return el(
    'li',
    {
      class: `gw-ntf-item${item.read ? '' : ' is-unread'}`,
      'data-test': 'notification-item',
      'data-kind': item.kind,
      'data-read': item.read ? 'true' : 'false',
    },
    children,
  );
}

const FAILURE_MESSAGE: Record<'denied' | 'unavailable' | 'invalid', string> = {
  denied: 'This session cannot load account notifications.',
  unavailable: 'The account-notification service could not be reached.',
  invalid: 'The account-notification response did not pass safety validation.',
};

/** Build the drawer's inner content for one typed load result. */
export function renderNotificationList(result: LoadNotificationsResult): HTMLElement {
  const { data, notice, state } = result;
  const liveData = state === 'ready' || state === 'demo'
    ? data
    : { notifications: [], unread_count: 0 };
  const countLabel =
    state === 'demo'
      ? `${liveData.unread_count} sample unread`
      : state === 'ready'
        ? `${liveData.unread_count} unread`
        : 'Count unavailable';
  const wrap = el('div', {
    class: 'gw-ntf-list-wrap',
    'data-notification-state': state,
  });
  wrap.append(
    el('div', { class: 'gw-ntf-drawer-head' }, [
      el('h2', { id: 'gw-ntf-title', class: 'gw-ntf-heading' }, ['Notifications']),
      el('span', { class: 'gw-ntf-count', 'data-test': 'notification-unread-count' }, [
        countLabel,
      ]),
    ]),
  );
  if (notice) {
    wrap.append(el('p', { class: 'gw-ntf-notice', 'data-test': 'notification-notice' }, [notice]));
  }
  if (state === 'denied' || state === 'unavailable' || state === 'invalid') {
    wrap.append(
      el('p', {
        class: 'gw-ntf-unavailable',
        'data-test': 'notification-unavailable',
        role: 'status',
      }, [FAILURE_MESSAGE[state]]),
    );
    return wrap;
  }
  if (liveData.notifications.length === 0) {
    wrap.append(
      el('p', { class: 'gw-ntf-empty', 'data-test': 'notification-empty' }, [
        "You're all caught up — no notifications yet.",
      ]),
    );
    return wrap;
  }
  const list = el('ul', {
    class: 'gw-ntf-list',
    'data-test': 'notification-list',
    'aria-label': 'Your notifications',
  });
  for (const item of liveData.notifications) list.append(notificationRow(item));
  wrap.append(list);
  return wrap;
}

export interface NotificationPanelOptions {
  /** Injectable loader for tests; defaults to {@link loadNotifications}. */
  load?: () => Promise<LoadNotificationsResult>;
}

/**
 * Mount the bell + drawer into `container` (the shell header). Returns the bell
 * button so the shell can position it. The drawer loads notifications lazily on
 * first open (and refreshes on each open) so the bell paints instantly.
 */
export function mountNotificationPanel(
  container: HTMLElement,
  opts: NotificationPanelOptions = {},
): HTMLButtonElement {
  ensureNotificationStyle();
  const load = opts.load ?? (() => loadNotifications());

  const drawerId = 'gw-ntf-drawer';
  const bell = el(
    'button',
    {
      type: 'button',
      class: 'gw-ntf-bell',
      'data-test': 'notification-bell',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      'aria-controls': drawerId,
      'aria-label': 'Notifications',
    },
    [
      el('span', { class: 'gw-ntf-bell-icon', 'aria-hidden': 'true' }, ['🔔']),
      el('span', { class: 'gw-ntf-badge', 'data-test': 'notification-badge', hidden: 'hidden' }, []),
    ],
  ) as HTMLButtonElement;
  const badge = bell.querySelector('.gw-ntf-badge') as HTMLElement;
  const demoChip = el('span', {
    class: 'gw-ntf-demo-chip',
    'data-test': 'notification-demo-chip',
    hidden: 'hidden',
  }, ['DEV SAMPLE']);

  const drawerBody = el('div', {
    class: 'gw-ntf-drawer-body',
    'data-test': 'notification-drawer-body',
  }, [
    el('p', { class: 'gw-ntf-loading' }, ['Loading…']),
  ]);
  const closeBtn = el(
    'button',
    { type: 'button', class: 'gw-ntf-close', 'data-test': 'notification-close', 'aria-label': 'Close notifications' },
    ['✕'],
  ) as HTMLButtonElement;
  const drawer = el(
    'div',
    {
      id: drawerId,
      class: 'gw-ntf-drawer',
      'data-test': 'notification-drawer',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-label': 'Notifications',
      hidden: 'hidden',
    },
    [el('div', { class: 'gw-ntf-drawer-topbar' }, [closeBtn]), drawerBody],
  );

  /** Reflect the server unread count on the bell's badge + accessible name. */
  const applyCount = (count: number): void => {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.removeAttribute('hidden');
      bell.setAttribute('aria-label', `Notifications, ${count} unread`);
    } else {
      badge.setAttribute('hidden', 'hidden');
      bell.setAttribute('aria-label', 'Notifications');
    }
  };

  const applyResult = (result: LoadNotificationsResult): void => {
    if (result.state === 'ready') {
      demoChip.setAttribute('hidden', 'hidden');
      applyCount(result.data.unread_count);
      return;
    }
    applyCount(0);
    if (result.state === 'demo') {
      demoChip.removeAttribute('hidden');
      bell.setAttribute('aria-label', 'Notifications development sample');
    } else {
      demoChip.setAttribute('hidden', 'hidden');
      bell.setAttribute('aria-label', 'Notifications unavailable');
    }
  };

  let requestVersion = 0;
  const safeLoad = async (): Promise<LoadNotificationsResult> => {
    try {
      return await load();
    } catch {
      return notificationFailureResult('unavailable');
    }
  };
  const refresh = async (paintDrawer: boolean): Promise<void> => {
    const version = ++requestVersion;
    if (paintDrawer) {
      demoChip.setAttribute('hidden', 'hidden');
      applyCount(0);
      bell.setAttribute('aria-label', 'Notifications loading');
      drawerBody.setAttribute('aria-busy', 'true');
      drawerBody.replaceChildren(
        el('p', {
          class: 'gw-ntf-loading',
          'data-test': 'notification-loading',
          role: 'status',
        }, ['Refreshing account notifications…']),
      );
    }
    const result = await safeLoad();
    if (version !== requestVersion || !bell.isConnected) return;
    applyResult(result);
    if (paintDrawer) {
      drawerBody.replaceChildren(renderNotificationList(result));
      drawerBody.removeAttribute('aria-busy');
    }
  };

  const isOpen = (): boolean => !drawer.hasAttribute('hidden');
  // Outside click closes the drawer (but not clicks on the bell/drawer). Attached
  // only WHILE open and removed on close, so re-mounting the shell on every route
  // change never accumulates stray document listeners.
  const onOutsideClick = (evt: MouseEvent): void => {
    const target = evt.target as Node;
    if (!drawer.contains(target) && !bell.contains(target)) close(false);
  };
  const open = (): void => {
    drawer.removeAttribute('hidden');
    bell.setAttribute('aria-expanded', 'true');
    void refresh(true);
    // Defer so the click that opened the drawer doesn't immediately close it.
    setTimeout(() => {
      if (isOpen()) document.addEventListener('click', onOutsideClick);
    }, 0);
    // Move focus into the drawer for keyboard users.
    closeBtn.focus();
  };
  const close = (restoreFocus = true): void => {
    drawer.setAttribute('hidden', 'hidden');
    bell.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick);
    if (restoreFocus) bell.focus();
  };
  const toggle = (): void => (isOpen() ? close() : open());

  bell.addEventListener('click', toggle);
  closeBtn.addEventListener('click', () => close());
  drawer.addEventListener('keydown', (evt) => {
    if ((evt as KeyboardEvent).key === 'Escape') {
      evt.stopPropagation();
      close();
    }
  });

  // Prime the badge on mount WITHOUT opening the drawer. A later open request
  // supersedes this one, preventing stale data from repainting a newer state.
  const shellSlot = el(
    'div',
    { class: 'gw-ntf-anchor', 'data-test': 'notification-panel' },
    [bell, demoChip, drawer],
  );
  container.append(shellSlot);
  void refresh(false);
  return bell;
}

/** Panel styles — token-driven, no raw hex; drawer anchored under the bell. */
export const NOTIFICATION_STYLE = `
.gw-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.gw-ntf-anchor{position:relative;display:inline-flex}
.gw-ntf-bell{position:relative;appearance:none;display:inline-flex;align-items:center;justify-content:center;min-width:var(--gw-tap-min);min-height:var(--gw-tap-min);padding:0 var(--gw-space-3);background:var(--gw-surface-well);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);cursor:pointer;font-size:var(--gw-text-md)}
.gw-ntf-bell:hover{border-color:var(--gw-border-strong)}
.gw-ntf-bell:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-ntf-badge{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;box-sizing:border-box;padding:0 4px;display:inline-flex;align-items:center;justify-content:center;font:700 var(--gw-text-xs)/1 var(--gw-font);color:var(--gw-accent-text-on);background:var(--gw-stop-text);border-radius:var(--gw-radius-pill)}
.gw-ntf-badge[hidden]{display:none}
.gw-ntf-demo-chip{align-self:center;padding:2px 6px;color:var(--gw-caution-text-strong);background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-pill);font:800 var(--gw-text-xs)/1.4 var(--gw-font);letter-spacing:.04em}
.gw-ntf-demo-chip[hidden]{display:none}
.gw-ntf-drawer{position:absolute;top:calc(100% + var(--gw-space-2));right:0;z-index:70;width:min(360px,92vw);max-height:min(70vh,520px);overflow-y:auto;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-lg);padding:var(--gw-space-3) var(--gw-space-4) var(--gw-space-4)}
.gw-ntf-drawer[hidden]{display:none}
.gw-ntf-drawer-topbar{display:flex;justify-content:flex-end}
.gw-ntf-close{appearance:none;border:0;background:transparent;color:var(--gw-text-secondary);cursor:pointer;min-width:calc(var(--gw-tap-min) - 8px);min-height:calc(var(--gw-tap-min) - 8px);border-radius:var(--gw-radius);font-size:var(--gw-text-body)}
.gw-ntf-close:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-ntf-drawer-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--gw-space-3);margin:0 0 var(--gw-space-2)}
.gw-ntf-heading{font-size:var(--gw-text-lg);margin:0}
.gw-ntf-count{font-size:var(--gw-text-sm);color:var(--gw-text-secondary)}
.gw-ntf-notice{font-size:var(--gw-text-xs);color:var(--gw-caution-text-strong);background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius);padding:var(--gw-space-2) var(--gw-space-3);margin:0 0 var(--gw-space-3)}
.gw-ntf-empty,.gw-ntf-loading,.gw-ntf-unavailable{font-size:var(--gw-text-body);color:var(--gw-text-secondary);margin:var(--gw-space-3) 0}
.gw-ntf-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--gw-space-2)}
.gw-ntf-item{display:flex;gap:var(--gw-space-2);align-items:flex-start;padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle)}
.gw-ntf-item.is-unread{border-color:var(--gw-accent);background:var(--gw-surface-accent-tint)}
.gw-ntf-unread{flex:0 0 auto;width:8px;height:8px;margin-top:6px;border-radius:50%;background:var(--gw-accent)}
.gw-ntf-glyph{flex:0 0 auto;font-size:var(--gw-text-body);line-height:1.4;color:var(--gw-text-secondary)}
.gw-ntf-main{flex:1 1 auto;min-width:0}
.gw-ntf-row-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--gw-space-2)}
.gw-ntf-tag{font-size:var(--gw-text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gw-text-secondary)}
.gw-ntf-time{font-family:var(--gw-font-mono);font-size:var(--gw-text-xs);color:var(--gw-text-muted)}
.gw-ntf-title{font-size:var(--gw-text-body);font-weight:700;margin:var(--gw-space-1) 0 0}
.gw-ntf-body{font-size:var(--gw-text-sm);color:var(--gw-text-secondary);margin:var(--gw-space-1) 0 0}
@media (max-width:760px){
  .gw-ntf-drawer{position:fixed;top:auto;bottom:calc(var(--gw-tap-min) + var(--gw-space-3));right:var(--gw-space-3);left:var(--gw-space-3);width:auto;max-height:70vh}
}
`;

let styleInjected = false;
function ensureNotificationStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [NOTIFICATION_STYLE]));
  styleInjected = true;
}
