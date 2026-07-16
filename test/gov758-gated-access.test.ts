// @vitest-environment jsdom
//
// GOV-758 (GOV-721 leg 3/5) — the six gated-beta access states, the minimal
// waitlist intake form, and the in-app notification panel. Proves the deliverables
// + acceptance criteria:
//
//   - all SIX states (not-signed-in / waitlisted / pending-review / approved /
//     denied / revoked) resolve, render distinctly, and leak ZERO civic data in
//     any non-approved state (AC-1/AC-7),
//   - denial AND revocation copy never imply anything about civic standing,
//   - the waitlist form collects email + area interest ONLY (no other PII),
//     validates client-side, and is fully labelled (AC-7 ARIA),
//   - the notification panel consumes the leg-2 query contract, shows the SERVER
//     unread count, drops unknown kinds fail-closed, and is keyboard/ARIA-correct.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveAccess,
  gatePanelContent,
  ACCESS_STATES,
  isAccessState,
  type AccessState,
} from '../src/gate/access';
import { renderLanding, renderGatedApp } from '../src/ui/landing';
import { validateWaitlist, renderWaitlistForm } from '../src/ui/waitlist-form';
import { renderNotificationList, mountNotificationPanel } from '../src/ui/notification-panel';
import {
  loadNotifications,
  NOTIFICATIONS_FIXTURE,
  readNotificationsConfig,
} from '../src/data/notifications';
import { NOTIFICATION_KINDS, type NotificationResponse } from '../src/types/notification';

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

/** Civic-evidence surfaces that must NEVER appear pre-gate (AC-1/AC-7). */
const CIVIC_SELECTORS = [
  '[data-test="record-card"]',
  '[data-test="timeline"]',
  '[data-test="source-drawer"]',
  '[data-test="trust-badge"]',
  '[data-test="card-feed"]',
  '[data-test="completeness-gap-card"]',
  '[data-test="notification-item"]',
];
function assertNoCivicData(el: HTMLElement): void {
  for (const sel of CIVIC_SELECTORS) {
    expect(el.querySelector(sel), `pre-gate surface must not expose ${sel}`).toBeNull();
  }
}

describe('GOV-758 — six gated-beta access states', () => {
  it('enumerates exactly the six workflow states', () => {
    expect([...ACCESS_STATES]).toEqual([
      'anonymous',
      'waitlisted',
      'pending',
      'approved',
      'denied',
      'revoked',
    ]);
    for (const s of ACCESS_STATES) expect(isAccessState(s)).toBe(true);
  });

  it('resolveAccess: any ?gate= state wins; bypass → approved; default anonymous', () => {
    for (const s of ACCESS_STATES) {
      expect(resolveAccess(s, false)).toBe(s);
      expect(resolveAccess(s, true)).toBe(s);
    }
    expect(resolveAccess(null, false)).toBe('anonymous');
    expect(resolveAccess(null, true)).toBe('approved');
    expect(resolveAccess('nope', false)).toBe('anonymous');
  });

  it('gives every state a distinct badge + title + message', () => {
    const badges = ACCESS_STATES.map((s) => gatePanelContent(s).badge);
    expect(new Set(badges).size).toBe(ACCESS_STATES.length);
    for (const s of ACCESS_STATES) {
      const p = gatePanelContent(s);
      expect(p.badge.length).toBeGreaterThan(0);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.message.length).toBeGreaterThan(0);
    }
  });

  it('only approved offers enter-app; only approved renders the full app', () => {
    expect(gatePanelContent('approved').action?.test).toBe('gate-enter');
    expect(gatePanelContent('approved').action?.href).toBe('#/app');
    for (const s of ['anonymous', 'waitlisted', 'pending', 'denied', 'revoked'] as AccessState[]) {
      let ran = false;
      renderGatedApp(root, s, () => {
        ran = true;
      });
      expect(ran, `full app must NOT render for ${s}`).toBe(false);
      expect(root.querySelector('[data-test="gated-app"]')).not.toBeNull();
      assertNoCivicData(root);
    }
  });

  it('renders a visibly distinct, civic-data-free landing panel for each state', () => {
    for (const state of ACCESS_STATES) {
      renderLanding(root, state);
      expect(root.querySelector('[data-test="gate-badge"]')?.getAttribute('data-state')).toBe(state);
      expect(root.querySelector('[data-test="gate-panel"]')?.getAttribute('data-state')).toBe(state);
      assertNoCivicData(root);
    }
  });

  it('denial AND revocation copy never imply anything about civic standing', () => {
    for (const s of ['denied', 'revoked'] as AccessState[]) {
      const msg = gatePanelContent(s).message.toLowerCase();
      expect(msg, s).toContain('does not reflect anything about');
      expect(msg, s).toContain('standing');
      for (const banned of ['untrustworthy', 'suspicious', 'not a real', 'fake', 'ineligible citizen']) {
        expect(msg, `${s} must not say "${banned}"`).not.toContain(banned);
      }
    }
  });
});

describe('GOV-758 — waitlist intake form (email + area interest only)', () => {
  it('validateWaitlist accepts a good email and rejects empties/typos', () => {
    expect(validateWaitlist({ email: 'resident@alpine.wy.us' }).ok).toBe(true);
    expect(validateWaitlist({ email: '  resident@alpine.wy.us  ' }).ok).toBe(true);
    expect(validateWaitlist({ email: '' }).ok).toBe(false);
    expect(validateWaitlist({ email: 'not-an-email' }).ok).toBe(false);
    expect(validateWaitlist({ email: 'a@b' }).ok).toBe(false);
    expect(validateWaitlist({ email: '' }).emailError).toBeTruthy();
  });

  it('collects ONLY email + area interest — no other PII inputs', () => {
    const form = renderWaitlistForm();
    root.append(form);
    const controls = [...form.querySelectorAll('input, select, textarea')];
    // Exactly two data-bearing controls, and they are the email + area only.
    expect(controls.map((c) => c.getAttribute('name')).sort()).toEqual(['areaInterest', 'email']);
    // No name/phone/address fields snuck in.
    for (const banned of ['name', 'phone', 'address', 'zip', 'ssn']) {
      expect(form.querySelector(`[name="${banned}"]`), `must not collect ${banned}`).toBeNull();
    }
  });

  it('labels every control (AC-7 ARIA): <label for> + describedby wiring', () => {
    const form = renderWaitlistForm();
    root.append(form);
    const email = form.querySelector('[data-test="waitlist-email"]') as HTMLInputElement;
    const area = form.querySelector('[data-test="waitlist-area"]') as HTMLInputElement;
    expect(form.querySelector(`label[for="${email.id}"]`)).not.toBeNull();
    expect(form.querySelector(`label[for="${area.id}"]`)).not.toBeNull();
    expect(email.getAttribute('aria-describedby')).toContain('gw-waitlist-email-error');
    expect(form.getAttribute('aria-label')).toMatch(/waitlist/i);
  });

  it('invalid submit shows an alert error and does NOT call onSubmit', () => {
    const onSubmit = vi.fn();
    const form = renderWaitlistForm({ onSubmit });
    root.append(form);
    const err = form.querySelector('[data-test="waitlist-email-error"]') as HTMLElement;
    expect(err.hasAttribute('hidden')).toBe(true);
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(err.hasAttribute('hidden')).toBe(false);
    expect(err.getAttribute('role')).toBe('alert');
  });

  it('valid submit clears the error, shows confirmation, and calls onSubmit once', () => {
    const onSubmit = vi.fn();
    const form = renderWaitlistForm({ onSubmit });
    root.append(form);
    const email = form.querySelector('[data-test="waitlist-email"]') as HTMLInputElement;
    const area = form.querySelector('[data-test="waitlist-area"]') as HTMLInputElement;
    email.value = 'resident@alpine.wy.us';
    area.value = 'town budget';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'resident@alpine.wy.us', areaInterest: 'town budget' });
    const confirm = form.querySelector('[data-test="waitlist-confirmation"]') as HTMLElement;
    expect(confirm.hasAttribute('hidden')).toBe(false);
  });
});

describe('GOV-758 — notification client (leg-2 contract)', () => {
  it('fixture is web-safe and carries all five notification kinds', () => {
    const kinds = new Set(NOTIFICATIONS_FIXTURE.notifications.map((n) => n.kind));
    for (const k of NOTIFICATION_KINDS) expect(kinds.has(k)).toBe(true);
  });

  it('defaults to fixture mode (no live endpoint) with a visible notice', async () => {
    const cfg = readNotificationsConfig({ VITE_USE_FIXTURES: 'true' });
    const { data, notice } = await loadNotifications({ config: cfg });
    expect(data.notifications.length).toBeGreaterThan(0);
    expect(notice).toMatch(/DEV SAMPLE/i);
  });

  it('normalizes: drops unknown kinds fail-closed and trusts the SERVER unread count', async () => {
    const fakeBody: NotificationResponse = {
      unread_count: 7, // deliberately not derivable from the rows — server is authority
      notifications: [
        { id: 'a', kind: 'account_approved', title: 'T', body: 'B', created_utc: '2026-07-16T00:00:00Z', read: false },
        // @ts-expect-error — an unknown kind must be dropped, not rendered
        { id: 'b', kind: 'totally_made_up', title: 'X', body: 'Y', created_utc: '2026-07-16T00:00:00Z', read: false },
      ],
    };
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(fakeBody), { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch;
    const { data } = await loadNotifications({
      config: { useFixtures: false, apiUrl: 'https://api.example/notifications' },
      fetchImpl,
    });
    expect(data.notifications.map((n) => n.id)).toEqual(['a']); // unknown kind dropped
    expect(data.unread_count).toBe(7); // server number preserved, not recomputed
  });

  it('falls back to the fixture (with notice) when the live read fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const { data, notice } = await loadNotifications({
      config: { useFixtures: false, apiUrl: 'https://api.example/notifications' },
      fetchImpl,
    });
    expect(data).toBe(NOTIFICATIONS_FIXTURE);
    expect(notice).toMatch(/unavailable/i);
  });
});

describe('GOV-758 — notification panel (bell + drawer)', () => {
  const sample: NotificationResponse = {
    unread_count: 2,
    notifications: [
      { id: 'a', kind: 'account_approved', title: 'Approved', body: 'You are in.', created_utc: '2026-07-16T00:00:00Z', read: false },
      { id: 'b', kind: 'consent_recorded', title: 'Saved', body: 'Preference saved.', created_utc: '2026-07-15T00:00:00Z', read: true },
    ],
  };

  it('renderNotificationList shows the server count + one row per notification', () => {
    const listEl = renderNotificationList(sample, 'DEV SAMPLE notice');
    root.append(listEl);
    expect(root.querySelector('[data-test="notification-unread-count"]')?.textContent).toContain('2 unread');
    expect(root.querySelectorAll('[data-test="notification-item"]').length).toBe(2);
    expect(root.querySelector('[data-test="notification-notice"]')?.textContent).toMatch(/DEV SAMPLE/);
    // Unread row is marked; read row is not.
    expect(root.querySelector('[data-kind="account_approved"]')?.getAttribute('data-read')).toBe('false');
  });

  it('renders an honest empty state when there are no notifications', () => {
    root.append(renderNotificationList({ unread_count: 0, notifications: [] }));
    expect(root.querySelector('[data-test="notification-empty"]')).not.toBeNull();
    expect(root.querySelector('[data-test="notification-list"]')).toBeNull();
  });

  it('mounts an accessible bell that toggles the dialog drawer', async () => {
    const load = vi.fn(async () => ({ data: sample }));
    const bell = mountNotificationPanel(root, { load });
    // Accessible name reflects the unread count once primed.
    await Promise.resolve();
    await Promise.resolve();
    expect(bell.getAttribute('aria-haspopup')).toBe('dialog');
    expect(bell.getAttribute('aria-expanded')).toBe('false');
    const drawer = root.querySelector('[data-test="notification-drawer"]') as HTMLElement;
    expect(drawer.getAttribute('role')).toBe('dialog');
    expect(drawer.hasAttribute('hidden')).toBe(true);
    bell.click();
    expect(bell.getAttribute('aria-expanded')).toBe('true');
    expect(drawer.hasAttribute('hidden')).toBe(false);
    bell.click();
    expect(drawer.hasAttribute('hidden')).toBe(true);
  });

  it('shows the unread badge with the server count and hides it at zero', async () => {
    const load = vi.fn(async () => ({ data: sample }));
    const bell = mountNotificationPanel(root, { load });
    await Promise.resolve();
    await Promise.resolve();
    const badge = root.querySelector('[data-test="notification-badge"]') as HTMLElement;
    expect(badge.hasAttribute('hidden')).toBe(false);
    expect(badge.textContent).toBe('2');
    expect(bell.getAttribute('aria-label')).toMatch(/2 unread/);
  });
});
