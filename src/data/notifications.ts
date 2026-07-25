/**
 * Same-origin account-notification client (GOV-758 / issue #52).
 *
 * Live is the default. A denied, unavailable, timed-out, or malformed response
 * produces a typed zero-row state; it never becomes a believable sample. The
 * development sample is reachable only through an explicit development build
 * switch (or a direct injected test loader), never a URL, local-storage value,
 * reading-mode toggle, or production endpoint override.
 */

import { apiBase } from './api';
import { assertWebSafe, findRawPathLeaksInText } from './web-safe';
import {
  isNotificationKind,
  type NotificationItem,
  type NotificationResponse,
} from '../types/notification';

type EnvLike = Record<string, unknown>;
type PlainRecord = Record<string, unknown>;

export type NotificationLoadState =
  | 'ready'
  | 'demo'
  | 'denied'
  | 'unavailable'
  | 'invalid';

export interface NotificationsConfig {
  mode: 'live' | 'demo';
  /** One root-relative, same-origin endpoint. */
  apiPath: string;
}

export interface LoadNotificationsResult {
  state: NotificationLoadState;
  data: NotificationResponse;
  notice?: string;
}

export interface LoadNotificationsOptions {
  config?: NotificationsConfig;
  /** Injectable fetch (tests / non-browser runtimes). */
  fetchImpl?: typeof fetch | null;
  /** Direct test seam; production callers never receive this option. */
  demoLoader?: () => Promise<unknown>;
  /** Positive finite test override; production uses the fixed eight-second cap. */
  timeoutMs?: number;
}

export const NOTIFICATION_REQUEST_TIMEOUT_MS = 8_000;
const NOTIFICATION_BODY_LIMIT = 256_000;
const ISO_UTC =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|\+00:00)$/;
const CONTROL_CHAR = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const PRIVATE_LOCATOR_SCHEME = /\b(?:file|smb|afp|nfs):[\\/]+/i;
const UNC_LOCATOR = /\\\\[^\\\s]+\\[^\\\s]+/;
const EMBEDDED_WINDOWS_LOCATOR = /(?:^|[\s"'(])[A-Za-z]:[\\/][^\s]+/;

const DEMO_NOTICE =
  'DEVELOPMENT SAMPLE — these are example account-workflow messages, not live notifications.';

const FAILURE_NOTICE = {
  denied:
    'Notifications are unavailable for this session. No sample account activity was substituted.',
  unavailable:
    'Notifications are temporarily unavailable. No sample account activity was substituted.',
  invalid:
    'Notifications could not be verified safely. No sample account activity was substituted.',
} as const;

function freezeResponse(data: NotificationResponse): NotificationResponse {
  for (const item of data.notifications) Object.freeze(item);
  Object.freeze(data.notifications);
  return Object.freeze(data);
}

export const EMPTY_NOTIFICATIONS: NotificationResponse = freezeResponse({
  notifications: [],
  unread_count: 0,
});

export function notificationFailureResult(
  state: 'denied' | 'unavailable' | 'invalid',
): LoadNotificationsResult {
  return { state, data: EMPTY_NOTIFICATIONS, notice: FAILURE_NOTICE[state] };
}

function truthy(value: unknown): boolean {
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

/**
 * Notification demo mode is deliberately separate from `VITE_USE_FIXTURES`,
 * which controls the reviewer read-model capture. Vite's boolean DEV/PROD
 * constants are build-time facts; browser-controlled values cannot change them.
 */
export function readNotificationsConfig(
  env: EnvLike = import.meta.env as unknown as EnvLike,
): NotificationsConfig {
  const developmentBuild = env.DEV === true && env.PROD !== true;
  const mode = developmentBuild && truthy(env.VITE_NOTIFICATIONS_DEMO) ? 'demo' : 'live';
  return { mode, apiPath: `${apiBase(env)}/notifications` };
}

export class NotificationEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationEnvelopeError';
  }
}

function plainRecord(value: unknown, label: string): PlainRecord {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new NotificationEnvelopeError(`${label} must be a plain object`);
  }
  return value as PlainRecord;
}

function boundedText(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maxLength
    || CONTROL_CHAR.test(value)
  ) {
    throw new NotificationEnvelopeError(`${label} must be a non-empty bounded string`);
  }
  return value;
}

function assertNotificationLocatorSafe(value: unknown): void {
  if (typeof value === 'string') {
    if (PRIVATE_LOCATOR_SCHEME.test(value)) {
      throw new NotificationEnvelopeError('notification response contains a private locator scheme');
    }
    for (const match of value.matchAll(/\b([a-z][a-z0-9+.-]*):\/\//gi)) {
      const scheme = match[1]?.toLowerCase();
      if (scheme !== 'http' && scheme !== 'https') {
        throw new NotificationEnvelopeError('notification response contains a private locator scheme');
      }
    }
    if (UNC_LOCATOR.test(value) || EMBEDDED_WINDOWS_LOCATOR.test(value)) {
      throw new NotificationEnvelopeError('notification response contains a private filesystem locator');
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNotificationLocatorSafe(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assertNotificationLocatorSafe(key);
      assertNotificationLocatorSafe(child);
    }
  }
}

function isUtcTimestamp(value: string): boolean {
  const match = ISO_UTC.exec(value);
  if (!match) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return (
    parsed.getUTCFullYear() === Number(match[1])
    && parsed.getUTCMonth() + 1 === Number(match[2])
    && parsed.getUTCDate() === Number(match[3])
    && parsed.getUTCHours() === Number(match[4])
    && parsed.getUTCMinutes() === Number(match[5])
    && parsed.getUTCSeconds() === Number(match[6])
  );
}

/**
 * Validate the exact fields the UI consumes. Benign additive fields are ignored
 * after the complete raw object has passed the leak sweep; malformed allowlisted
 * fields reject the whole envelope, so the panel never renders a partial answer.
 */
export function normalizeNotificationEnvelope(raw: unknown): NotificationResponse {
  const safe = assertWebSafe(raw);
  assertNotificationLocatorSafe(safe);
  const envelope = plainRecord(safe, 'notification response');
  if (!Array.isArray(envelope.notifications)) {
    throw new NotificationEnvelopeError('notifications must be an array');
  }
  if (
    !Number.isSafeInteger(envelope.unread_count)
    || (envelope.unread_count as number) < 0
  ) {
    throw new NotificationEnvelopeError('unread_count must be a non-negative safe integer');
  }

  const seen = new Set<string>();
  const notifications: NotificationItem[] = envelope.notifications.map((value, index) => {
    const row = plainRecord(value, `notifications[${index}]`);
    const id = boundedText(row.id, `notifications[${index}].id`, 200);
    if (seen.has(id)) {
      throw new NotificationEnvelopeError(`duplicate notification id at index ${index}`);
    }
    seen.add(id);
    if (!isNotificationKind(row.kind)) {
      throw new NotificationEnvelopeError(`notifications[${index}].kind is not supported`);
    }
    const createdUtc = boundedText(
      row.created_utc,
      `notifications[${index}].created_utc`,
      40,
    );
    if (!isUtcTimestamp(createdUtc)) {
      throw new NotificationEnvelopeError(
        `notifications[${index}].created_utc must be an ISO-8601 UTC timestamp`,
      );
    }
    if (typeof row.read !== 'boolean') {
      throw new NotificationEnvelopeError(`notifications[${index}].read must be a boolean`);
    }
    return Object.freeze({
      id,
      kind: row.kind,
      title: boundedText(row.title, `notifications[${index}].title`, 240),
      body: boundedText(row.body, `notifications[${index}].body`, 2_000),
      created_utc: createdUtc,
      read: row.read,
    });
  });

  return freezeResponse({
    notifications,
    unread_count: envelope.unread_count as number,
  });
}

type FailureState = 'denied' | 'unavailable' | 'invalid';

class NotificationRequestError extends Error {
  readonly state: FailureState;

  constructor(state: FailureState, message: string, options: ErrorOptions = {}) {
    super(message, options);
    this.name = 'NotificationRequestError';
    this.state = state;
  }
}

function safeNotificationPath(value: string): string {
  if (
    !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || value.includes('?')
    || value.includes('#')
    || /[\u0000-\u001f\u007f]/.test(value)
    || /%(?:25)*(?:2f|5c)/i.test(value)
  ) {
    throw new NotificationRequestError('invalid', 'notification path must be root-relative');
  }
  return value;
}

function timeoutFor(opts: LoadNotificationsOptions): number {
  const timeoutMs = opts.timeoutMs ?? NOTIFICATION_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new NotificationRequestError('invalid', 'notification timeout must be positive');
  }
  return timeoutMs;
}

function resolveFetch(opts: LoadNotificationsOptions): typeof fetch {
  const fetchImpl =
    opts.fetchImpl === null
      ? undefined
      : opts.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
  if (!fetchImpl) {
    throw new NotificationRequestError('unavailable', 'fetch is unavailable');
  }
  return fetchImpl;
}

async function fetchNotifications(
  config: NotificationsConfig,
  opts: LoadNotificationsOptions,
): Promise<NotificationResponse> {
  const controller = new AbortController();
  const timeoutMs = timeoutFor(opts);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new NotificationRequestError('unavailable', 'notification request timed out'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      (async () => {
        const response = await resolveFetch(opts)(safeNotificationPath(config.apiPath), {
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
          redirect: 'error',
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) {
          throw new NotificationRequestError('denied', 'notification request denied');
        }
        if (!response.ok) {
          throw new NotificationRequestError('unavailable', 'notification service unavailable');
        }
        const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
        if (!contentType.includes('application/json')) {
          throw new NotificationRequestError('invalid', 'notification response is not JSON');
        }
        const declaredLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > NOTIFICATION_BODY_LIMIT) {
          throw new NotificationRequestError('invalid', 'notification response is too large');
        }
        const text = await response.text();
        if (!text.trim() || text.length > NOTIFICATION_BODY_LIMIT) {
          throw new NotificationRequestError('invalid', 'notification response body is invalid');
        }
        if (findRawPathLeaksInText(text).length > 0) {
          throw new NotificationRequestError('invalid', 'notification response failed safety checks');
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(text) as unknown;
        } catch (error) {
          throw new NotificationRequestError('invalid', 'notification response JSON is malformed', {
            cause: error,
          });
        }
        try {
          return normalizeNotificationEnvelope(parsed);
        } catch (error) {
          throw new NotificationRequestError('invalid', 'notification response schema is invalid', {
            cause: error,
          });
        }
      })(),
      timeout,
    ]);
  } catch (error) {
    if (error instanceof NotificationRequestError) throw error;
    throw new NotificationRequestError('unavailable', 'notification request failed', {
      cause: error,
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function developmentDemo(): Promise<unknown> {
  const module = await import('./notifications-demo');
  return module.NOTIFICATIONS_DEMO_SOURCE;
}

/**
 * Load session-scoped account notifications. This function always resolves to a
 * safe UI state so the shell can remain usable; no error detail or sample text
 * is copied into a live failure.
 */
export async function loadNotifications(
  opts: LoadNotificationsOptions = {},
): Promise<LoadNotificationsResult> {
  const config = opts.config ?? readNotificationsConfig();

  if (config.mode === 'demo') {
    const demoLoader =
      opts.demoLoader ?? (import.meta.env.DEV ? developmentDemo : undefined);
    if (!demoLoader) return notificationFailureResult('invalid');
    try {
      return {
        state: 'demo',
        data: normalizeNotificationEnvelope(await demoLoader()),
        notice: DEMO_NOTICE,
      };
    } catch {
      return notificationFailureResult('invalid');
    }
  }

  try {
    return {
      state: 'ready',
      data: await fetchNotifications(config, opts),
    };
  } catch (error) {
    const state = error instanceof NotificationRequestError ? error.state : 'unavailable';
    return notificationFailureResult(state);
  }
}
