/**
 * Notification data client (GOV-758 / GOV-721 leg 3/5).
 *
 * Mirrors `data/client.ts`: reads ONLY the leg-2 (GOV-754) notification query
 * endpoint or a clearly-labeled local fixture, sweeps everything through
 * {@link assertWebSafe} (defense-in-depth), and falls back to the fixture with a
 * visible notice on any live-read failure. It never invents notifications.
 *
 * Leg-2's endpoint is not merged yet, so the DEFAULT is fixture mode. When the
 * endpoint lands, set `VITE_NOTIFICATIONS_API_URL` and flip `VITE_USE_FIXTURES`
 * off — the injectable `fetchImpl` seam keeps this unit-testable without a
 * browser, exactly like the read-model client.
 */

import { assertWebSafe } from './web-safe';
import { isNotificationKind, type NotificationItem, type NotificationResponse } from '../types/notification';
import notificationsSample from '../fixtures/notifications.sample.json';

/** The labeled DEV sample, swept for raw paths at module load. */
export const NOTIFICATIONS_FIXTURE: NotificationResponse = normalize(
  assertWebSafe(notificationsSample as unknown as NotificationResponse),
);

export const NOTIFICATIONS_NOTICE =
  'DEV SAMPLE notifications — not a live read. Wires to the leg-2 (GOV-754) query endpoint when it merges.';

type EnvLike = Record<string, unknown>;

export interface NotificationsConfig {
  useFixtures: boolean;
  /** Base URL of the notification query endpoint; empty → fixture mode. */
  apiUrl: string;
}

export function readNotificationsConfig(
  env: EnvLike = import.meta.env as unknown as EnvLike,
): NotificationsConfig {
  const rawUseFixtures = String(env.VITE_USE_FIXTURES ?? 'true').trim().toLowerCase();
  const useFixtures = rawUseFixtures !== 'false';
  const apiUrl = String(env.VITE_NOTIFICATIONS_API_URL ?? '').trim();
  return { useFixtures, apiUrl };
}

/**
 * Coerce a raw envelope into the shape the panel trusts: drop rows with an
 * unknown `kind` (fail-closed — never render a notification we can't classify),
 * default `read` to false, and trust the SERVER's `unread_count` (the panel does
 * not recompute trust/state — same rule as the civic read model). If the server
 * omits the count we derive it from the surviving unread rows.
 */
function normalize(raw: NotificationResponse): NotificationResponse {
  const notifications: NotificationItem[] = (raw.notifications ?? [])
    .filter((n) => n && isNotificationKind(n.kind))
    .map((n) => ({
      id: String(n.id),
      kind: n.kind,
      title: String(n.title ?? ''),
      body: String(n.body ?? ''),
      created_utc: String(n.created_utc ?? ''),
      read: n.read === true,
    }));
  const unread_count =
    typeof raw.unread_count === 'number'
      ? raw.unread_count
      : notifications.filter((n) => !n.read).length;
  return { notifications, unread_count };
}

export interface LoadNotificationsResult {
  data: NotificationResponse;
  notice?: string;
}

export interface LoadNotificationsOptions {
  config?: NotificationsConfig;
  fetchImpl?: typeof fetch;
}

async function fetchNotifications(url: string, fetchImpl: typeof fetch): Promise<NotificationResponse> {
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`notifications endpoint responded ${res.status} ${res.statusText}`.trim());
  const body = (await res.json()) as NotificationResponse;
  // Trust nothing on the wire: re-sweep + normalize before it reaches the UI.
  return normalize(assertWebSafe(body));
}

/**
 * Load in-app notifications. Fixture mode (or no API URL) → labeled DEV sample.
 * Live mode → fetch the endpoint, falling back to the sample (with a visible
 * notice) on any failure. Never throws to the caller — the bell must always
 * render.
 */
export async function loadNotifications(
  opts: LoadNotificationsOptions = {},
): Promise<LoadNotificationsResult> {
  const config = opts.config ?? readNotificationsConfig();
  const fetchImpl =
    opts.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);

  if (config.useFixtures || !config.apiUrl || !fetchImpl) {
    return { data: NOTIFICATIONS_FIXTURE, notice: NOTIFICATIONS_NOTICE };
  }

  try {
    const data = await fetchNotifications(config.apiUrl, fetchImpl);
    return { data };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      data: NOTIFICATIONS_FIXTURE,
      notice: `Live notifications unavailable (${reason}). ${NOTIFICATIONS_NOTICE}`,
    };
  }
}
