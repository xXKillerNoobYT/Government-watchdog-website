/**
 * Development-only account-notification examples.
 *
 * The live client imports this module only while Vite's build-time DEV flag is
 * true. Production URLs, local storage, and visual reading modes have no import
 * path to this sample.
 */

import notificationsSample from '../fixtures/notifications.sample.json';
import { assertWebSafe } from './web-safe';

export const NOTIFICATIONS_DEMO_SOURCE: unknown = Object.freeze(
  assertWebSafe(notificationsSample as unknown),
);
