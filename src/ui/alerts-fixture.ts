/**
 * Canonical id list for the synthetic Alerts fixture.
 *
 * Lives in its own module so the shell can size its Alerts badge without
 * importing the Alerts page — `design-pages.ts` imports shell helpers, so the
 * reverse edge would be a cycle.
 *
 * These ids describe fixture cards only. A badge count derived from them is a
 * statement about device-local sample data, never about civic activity, and it
 * must therefore render only on a route already admitted to fixture mode.
 */

import { readAlertsRead } from '../state/local-store';

/** Fixture alerts that can be unread; mirrored by FIXTURE_ALERTS in design-pages. */
export const FIXTURE_ALERT_IDS: readonly string[] = [
  'fixture-attachment-replaced',
  'fixture-meeting-eve',
  'fixture-agenda-posted',
];

/** Unread fixture cards for this device. Fixture-mode surfaces only. */
export function countUnreadFixtureAlerts(): number {
  const read = new Set(readAlertsRead());
  return FIXTURE_ALERT_IDS.filter((id) => !read.has(id)).length;
}
