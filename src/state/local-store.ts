/**
 * Device-local preview state — the MOTY localStorage contract in one place.
 *
 * These keys hold preview-only preferences: saved place, tracked cards, alert
 * read-state, and the roundtable listen position. They are never
 * authentication, authorization, identity proof, an alert subscription, or
 * evidence that a delivery channel was configured
 * (docs/design-handoff-integration.md).
 *
 * Two deliberate absences:
 * - `gw_home_mode` stays owned by the shell (readMode in src/ui/shell.ts).
 * - The design prototype's `gw_auth` sign-in key is NOT implemented: the
 *   Sites/reviewer gate is the only access authority.
 */

export const TRACKED_KEY = 'gw_tracked';
export const LOCATION_KEY = 'gw_location';
export const ALERTS_READ_KEY = 'gw_alerts_read';
export const DEBATE_POSITION_KEY = 'gw_debate_pos';

export interface SavedLocation {
  state: string;
  county: string;
  region: string;
  town: string;
}

export function readJson(key: string): unknown {
  try {
    const value = localStorage.getItem(key);
    return value === null ? null : JSON.parse(value);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be unavailable; the current rendered interaction still works. */
  }
}

export function readTracked(): Record<string, boolean> {
  const parsed = readJson(TRACKED_KEY);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const tracked: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === true) tracked[key] = true;
  }
  return tracked;
}

export function writeTracked(tracked: Record<string, boolean>): void {
  writeJson(TRACKED_KEY, tracked);
}

export function readLocation(): SavedLocation | null {
  const parsed = readJson(LOCATION_KEY);
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const fields = ['state', 'county', 'region', 'town'] as const;
  if (!fields.every((field) => typeof record[field] === 'string')) return null;
  return {
    state: record.state as string,
    county: record.county as string,
    region: record.region as string,
    town: record.town as string,
  };
}

export function writeLocation(location: SavedLocation): void {
  writeJson(LOCATION_KEY, location);
}

export function readAlertsRead(): string[] {
  const parsed = readJson(ALERTS_READ_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is string => typeof entry === 'string');
}

export function writeAlertsRead(ids: string[]): void {
  writeJson(ALERTS_READ_KEY, [...new Set(ids)]);
}

export function readDebatePosition(): number {
  const parsed = readJson(DEBATE_POSITION_KEY);
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < 0) return 0;
  return parsed;
}

export function writeDebatePosition(index: number): void {
  writeJson(DEBATE_POSITION_KEY, Math.max(0, Math.trunc(index)));
}
