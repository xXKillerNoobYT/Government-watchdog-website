/**
 * In-app notification contract (GOV-758 / GOV-721 leg 3/5).
 *
 * This is the FRONTEND view of the leg-2 (GOV-754) notification query endpoint —
 * the backend's `scripts/notifications/` writer + query surface. This file is the
 * allowlisted wire contract the panel reads. The backend may add safe fields,
 * but the browser deliberately ignores anything outside this shape.
 *
 * The five notification kinds mirror the leg-2 writer's enumerated events
 * (GOV-754 deliverable #3 / AC-6). Rendering is copy-from-data: the panel shows
 * the server-supplied `title`/`body` verbatim and never fabricates a notification
 * (same honesty rule as the civic surfaces).
 */

/** The events leg-2 writes an in-app notification for (GOV-754 #3 / AC-6). */
export type NotificationKind =
  | 'account_approved'
  | 'account_revoked'
  | 'cohort_advanced'
  | 'consent_recorded'
  | 'unsubscribe_confirmed';

export const NOTIFICATION_KINDS = [
  'account_approved',
  'account_revoked',
  'cohort_advanced',
  'consent_recorded',
  'unsubscribe_confirmed',
] as const satisfies readonly NotificationKind[];

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

/** One in-app notification row as the query endpoint returns it. */
export interface NotificationItem {
  /** Opaque server id (e.g. `ntf_...`). Used as the list key. */
  id: string;
  kind: NotificationKind;
  /** Short heading, server-authored. Rendered verbatim. */
  title: string;
  /** One-line body, server-authored. Rendered verbatim. */
  body: string;
  /** ISO-8601 UTC creation stamp. */
  created_utc: string;
  /** Whether the recipient has seen it. Drives the unread dot + count. */
  read: boolean;
}

/** The query endpoint envelope: `GET /api/notifications` (session-scoped). */
export interface NotificationResponse {
  notifications: NotificationItem[];
  /** Server-computed unread count (authority; the panel does NOT recompute). */
  unread_count: number;
}
